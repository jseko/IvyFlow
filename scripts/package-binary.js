/**
 * Binary packaging pipeline — esbuild bundle + Bun compile with embedded assets.
 *
 * 1. tsc compiles TypeScript to dist/
 * 2. Generate assets-registry.js that imports all asset files as text
 * 3. esbuild bundles everything (dist + assets-registry) into a single CJS file
 * 4. Bun compile generates standalone binary
 */

import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const ASSETS = path.join(ROOT, 'assets');
const PACKAGE_JSON = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
const VERSION = PACKAGE_JSON.version;
const BIN_DIR = path.join(ROOT, 'bin-out');

function collectFiles(dir, base) {
  const result = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      result.push(...collectFiles(full, base));
    } else {
      result.push(path.relative(base, full));
    }
  }
  return result;
}

function generateAssetsRegistry() {
  console.log('  Generating assets registry...');
  const files = collectFiles(ASSETS, ASSETS);

  const entries = [];

  for (const f of files) {
    const absPath = path.join(ASSETS, f);
    const content = readFileSync(absPath, 'utf-8');
    const escaped = JSON.stringify(content);
    entries.push(`  ${JSON.stringify(f)}: ${escaped},`);
  }

  const code = `// Auto-generated assets registry — ${files.length} files embedded at build time
var ASSETS_REGISTRY = {
${entries.join('\n')}
};

globalThis.__ivyflow_assets = ASSETS_REGISTRY;

module.exports = ASSETS_REGISTRY;
`;

  const outPath = path.join(DIST, 'assets-registry.cjs');
  writeFileSync(outPath, code);
  console.log(`  Registered ${files.length} asset files (${(code.length / 1024).toFixed(0)}KB)`);
}

async function bundle() {
  console.log('[1/3] Building TypeScript (tsc)...');
  execSync('npx tsc', { cwd: ROOT, stdio: 'inherit' });

  generateAssetsRegistry();

  console.log('[2/3] Bundling with esbuild...');

  await build({
    entryPoints: [path.join(DIST, 'cli', 'index.js')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: path.join(DIST, 'ivyflow-bundle.cjs'),
    banner: {
      js: `#!/usr/bin/env node
// IvyFlow v${VERSION} — standalone bundle with embedded assets
`,
    },
    inject: [path.join(DIST, 'assets-registry.cjs')],
    external: [
      'fsevents',
      'lightningcss',
      '@rolldown/*',
    ],
    define: {
      'process.env.IVYFLOW_VERSION': JSON.stringify(VERSION),
    },
    loader: {
      '.sh': 'text',
      '.md': 'text',
      '.yaml': 'text',
      '.yml': 'text',
      '.json': 'text',
      '.hbs': 'text',
    },
    minify: false,
    sourcemap: false,
    legalComments: 'none',
  });

  console.log('  Bundle complete');
}

function patchBundle() {
  console.log('  Patching ESM → CJS compatibility...');

  const bundlePath = path.join(DIST, 'ivyflow-bundle.cjs');
  let bundled = readFileSync(bundlePath, 'utf-8');

  // Remove createRequire calls (esbuild wraps them as import_module.createRequire)
  bundled = bundled.replace(
    /var\s+require\d*\s*=\s*\(0,\s*import_module\d*\.createRequire\)\([^)]*\)\s*;?\s*/g,
    '',
  );

  bundled = bundled.replace(
    /const\s+\{\s*createRequire\s*\}\s*=\s*require\(["']module["']\);?\s*/g,
    '',
  );

  // Replace package.json version reads
  let firstVersionReplaced = false;
  bundled = bundled.replace(
    /(?:const|var)\s+\{[^}]*\bversion\b[^}]*\}\s*=\s*require\d*\(["'][^"']*package\.json["']\)[^;]*;?/g,
    () => {
      if (!firstVersionReplaced) {
        firstVersionReplaced = true;
        return `const version = process.env.IVYFLOW_VERSION || "${VERSION}";`;
      }
      return '// version already defined above';
    },
  );

  // Replace remaining PKG_VERSION / PKG_VERSION2 references with injected value
  // These appear when esbuild deduplicates and renames duplicate variable names
  bundled = bundled.replace(
    /\bPKG_VERSION\d*\b/g,
    `process.env.IVYFLOW_VERSION || "${VERSION}"`,
  );

  // Replace import.meta.url usage
  bundled = bundled.replace(
    /var\s+__filename\d*\s*=\s*\(0,\s*import_url\d*\.fileURLToPath\)\(import_meta\d*\.url\)\s*;?/g,
    '// __filename patched — using native CJS __filename',
  );
  bundled = bundled.replace(
    /var\s+__dirname\d*\s*=\s*import_path\d*\.default\.dirname\(__filename\d*\)\s*;?/g,
    '// __dirname patched — using native CJS __dirname',
  );
  bundled = bundled.replace(
    /import_meta\d*\.url/g,
    `"file://${ROOT}/"`,
  );

  writeFileSync(bundlePath, bundled);
  const sizeKb = (bundled.length / 1024).toFixed(0);
  console.log(`  Bundle patched: ${sizeKb}KB`);
}

async function compileBinary() {
  console.log('[3/3] Compiling binaries with Bun (assets embedded in bundle)...');

  mkdirSync(BIN_DIR, { recursive: true });

  const bundlePath = path.join(DIST, 'ivyflow-bundle.cjs');

  // Target platforms: macOS (arm64/x64), Linux (x64/arm64), Windows (x64)
  const targets = [
    { platform: 'darwin', arch: 'aarch64', ext: '' },
    { platform: 'darwin', arch: 'x64', ext: '' },
    { platform: 'linux', arch: 'x64', ext: '' },
    { platform: 'linux', arch: 'aarch64', ext: '' },
    { platform: 'windows', arch: 'x64', ext: '.exe' },
  ];

  for (const target of targets) {
    const outName = `ivyflow-${VERSION}-${target.platform}-${target.arch}${target.ext}`;
    const outPath = path.join(BIN_DIR, outName);

    console.log(`  Compiling ${target.platform}/${target.arch}...`);
    try {
      execSync(
        `bun build --compile --target=bun-${target.platform}-${target.arch} "${bundlePath}" --outfile "${outPath}"`,
        { cwd: ROOT, stdio: 'pipe' },
      );
      const stat = execSync(`ls -lh "${outPath}"`).toString().trim();
      console.log(`    ${stat}`);
    } catch (err) {
      console.log(`    ⚠ Skipped (cross-compilation may not be supported on this host)`);
    }
  }

  // Create wrapper scripts
  const hostExt = process.platform === 'win32' ? '.exe' : '';
  const hostArch = process.arch === 'arm64' ? 'aarch64' : 'x64';
  const hostOutName = `ivyflow-${VERSION}-${process.platform}-${hostArch}${hostExt}`;
  const wrapperName = `ivy${hostExt}`;
  const wrapperPath = path.join(BIN_DIR, wrapperName);
  writeFileSync(wrapperPath, `#!/bin/sh\nexec "$(dirname "$0")/${hostOutName}" "$@"\n`);
  execSync(`chmod +x "${wrapperPath}"`);

  console.log(`\n  Assets: ${collectFiles(ASSETS, ASSETS).length} files embedded in bundle`);
  console.log(`\n  Output: ${BIN_DIR}/`);
}

async function main() {
  const args = process.argv.slice(2);
  const skipCompile = args.includes('--skip-compile');

  try {
    await bundle();
    patchBundle();
    if (!skipCompile) {
      await compileBinary();
    }
    console.log('\n✓ Binary packaging complete!');
  } catch (err) {
    console.error('✗ Binary packaging failed:', err);
    process.exit(1);
  }
}

main();
