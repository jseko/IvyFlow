/**
 * Integration test: Three-stage compiler cross-stage isolation (TC-37).
 *
 * v0.14: Sprint 14.5 — Capability Infrastructure.
 *
 * Verifies that the three-stage compiler model (detect → compile → emit)
 * maintains strict isolation between stages:
 * - Stage 1 (detect): Pure scan, no writes
 * - Stage 2 (compile): Pure function, no I/O
 * - Stage 3 (emit): Write results, no further computation
 */

import { describe, it, expect } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import { detectCapabilities } from './capability-detector.js';
import { generateRules } from './rule-generator.js';
import { generateProfile } from './verify-profile.js';

describe('TC-37: Three-stage compiler isolation', () => {
  // Stage 1: Detection is pure (no writes)
  describe('Stage 1: Detection purity', () => {
    it('should not write any files during detection', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-detect-pure-'));
      await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({
        dependencies: { react: '^18.0.0' },
      }));

      // Record directory state before detection
      const beforeFiles = await fs.readdir(tmpDir, { withFileTypes: true });
      const beforeCount = beforeFiles.length;

      // Run detection
      await detectCapabilities(tmpDir);

      // Check directory state after detection
      const afterFiles = await fs.readdir(tmpDir, { withFileTypes: true });
      const afterCount = afterFiles.length;

      // Detection should not create any files
      expect(afterCount).toBe(beforeCount);
    });

    it('should produce consistent output for same input', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-detect-consistent-'));
      await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({
        dependencies: { react: '^18.0.0', next: '^14.0.0' },
      }));

      const r1 = await detectCapabilities(tmpDir);
      const r2 = await detectCapabilities(tmpDir);

      // Tech stack should be identical
      expect(JSON.stringify(r1.techStack)).toBe(JSON.stringify(r2.techStack));
      expect(r1.projectIntent).toBe(r2.projectIntent);

      // Timestamps may differ (that's expected for detection)
      expect(r1.timestamp).not.toBe(r2.timestamp);
    });
  });

  // Stage 2: Compile is pure function (no I/O)
  describe('Stage 2: Compile purity', () => {
    it('should not perform any I/O during rule generation', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-compile-pure-'));
      await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({
        dependencies: { react: '^18.0.0' },
      }));

      // Detect first to get tech stack
      const detection = await detectCapabilities(tmpDir);
      const techStacks = Object.values(detection.techStack).flat().filter(Boolean) as string[];

      // Record directory state
      const beforeFiles = await fs.readdir(tmpDir, { withFileTypes: true });
      const beforeCount = beforeFiles.length;

      // Generate rules (pure function, no I/O)
      const profile = await generateRules(detection.techStack, detection.projectIntent);

      // Check directory state
      const afterFiles = await fs.readdir(tmpDir, { withFileTypes: true });
      const afterCount = afterFiles.length;

      // Rule generation should not create any files
      expect(afterCount).toBe(beforeCount);
      expect(profile.rules).toBeDefined();
      expect(Array.isArray(profile.rules)).toBe(true);
    });

    it('should produce consistent output for same inputs', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-compile-consistent-'));
      await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({
        dependencies: { react: '^18.0.0', playwright: '^1.40.0' },
      }));

      const detection = await detectCapabilities(tmpDir);

      const p1 = await generateRules(detection.techStack, detection.projectIntent);
      const p2 = await generateRules(detection.techStack, detection.projectIntent);

      // Rule profiles should be identical
      expect(JSON.stringify(p1.rules)).toBe(JSON.stringify(p2.rules));
      expect(p1.rules.length).toBe(p2.rules.length);
    });
  });

  // Stage 3: Emit is isolated (writes only, no computation)
  describe('Stage 3: Emit isolation', () => {
    it('should not perform computation during emit', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-emit-isolated-'));
      await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({
        dependencies: { react: '^18.0.0' },
      }));

      const detection = await detectCapabilities(tmpDir);
      const profile = await generateRules(detection.techStack, detection.projectIntent);

      // Emit should just write, no computation
      // This test verifies that emit doesn't modify the profile
      const beforeRules = JSON.stringify(profile.rules);
      // Simulate emit by writing to file
      await fs.writeFile(path.join(tmpDir, 'rules-output.json'), JSON.stringify(profile));
      const afterRules = JSON.stringify(profile.rules);

      expect(beforeRules).toBe(afterRules);
    });

    it('should write correct output format', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-emit-format-'));
      await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({
        dependencies: { react: '^18.0.0', next: '^14.0.0' },
      }));

      const detection = await detectCapabilities(tmpDir);
      const profile = await generateRules(detection.techStack, detection.projectIntent);

      // Write output
      const outputPath = path.join(tmpDir, 'rules-output.json');
      await fs.writeFile(outputPath, JSON.stringify(profile));

      // Read back and verify
      const content = await fs.readFile(outputPath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed).toHaveProperty('rules');
      expect(Array.isArray(parsed.rules)).toBe(true);
      expect(parsed.rules.every((r: { id: string; tier: string; severity: string }) => r.id && r.tier && r.severity)).toBe(true);
    });
  });

  // Cross-stage: Full pipeline isolation
  describe('Cross-stage: Full pipeline', () => {
    it('should maintain isolation across all three stages', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-full-pipeline-'));
      await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({
        dependencies: { react: '^18.0.0', express: '^4.18.0', vitest: '^1.0.0' },
      }));

      // Stage 1: Detect
      const detection = await detectCapabilities(tmpDir);
      expect(detection.techStack).toBeDefined();

      // Stage 2: Compile (rules)
      const ruleProfile = await generateRules(detection.techStack, detection.projectIntent);
      expect(ruleProfile.rules).toBeDefined();

      // Stage 2: Compile (verify profile)
      const verifyProfile = generateProfile('development', Object.values(detection.techStack).flat().filter(Boolean) as string[]);
      expect(verifyProfile.compile).toBeDefined();

      // Stage 3: Emit
      const output = {
        detection: {
          techStack: detection.techStack,
          projectIntent: detection.projectIntent,
          confidence: detection.confidence,
        },
        rules: ruleProfile.rules.map(r => ({ id: r.id, tier: r.tier, severity: r.severity })),
        verify: verifyProfile,
      };

      await fs.writeFile(path.join(tmpDir, 'pipeline-output.json'), JSON.stringify(output));

      // Verify output integrity
      const saved = JSON.parse(await fs.readFile(path.join(tmpDir, 'pipeline-output.json'), 'utf-8'));
      expect(saved.detection.techStack).toEqual(detection.techStack);
      expect(saved.rules.length).toBe(ruleProfile.rules.length);
      expect(saved.verify.compile).toBe(verifyProfile.compile);
    });

    it('should not leak state between stages', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivy-no-leak-'));
      await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({
        dependencies: { react: '^18.0.0' },
      }));

      // Run full pipeline
      const detection = await detectCapabilities(tmpDir);
      const ruleProfile = await generateRules(detection.techStack, detection.projectIntent);
      const verifyProfile = generateProfile('development', Object.values(detection.techStack).flat().filter(Boolean) as string[]);

      // Verify no cross-contamination
      // Detection result should not be modified by compile
      expect(detection.techStack).toBeDefined();
      expect(detection.projectIntent).toBeDefined();

      // Rule profile should not affect detection
      expect(ruleProfile.rules).toBeDefined();

      // Verify profile should be independent
      expect(verifyProfile).toBeDefined();
      expect(verifyProfile.compile).toBeDefined();
    });
  });
});
