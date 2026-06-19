## 1. Project Skeleton (Sprint 1.1, Week 1-2)

- [x] 1.1 Copy `package.json` / `tsconfig.json` / `vitest.config.ts` / `build.js` / `eslint.config.*` from `/Users/liuzhupeng/workspace/vibecoding/comet/` and rename `comet → ivyflow-cli`
- [x] 1.2 Add dependencies: `commander`, `@inquirer/prompts`; devDeps: `typescript`, `vitest`, `@types/node`
- [x] 1.3 Create `bin/ivy.js` shim that requires `dist/cli/index.js`; configure `package.json#bin = { "ivy": "bin/ivy.js" }`
- [x] 1.4 Create `src/cli/index.ts` registering commander program with name `ivy`, version from `package.json`
- [x] 1.5 Create `src/utils/{fs.ts,git.ts,logger.ts}` (port `file-system.ts` from Comet; add `runGit(args)` helper using `child_process.execFile`)
- [x] 1.6 Port `src/core/types.ts` and `src/core/command-error.ts` from Comet, strip Superpowers/CodeGraph references
- [x] 1.7 `npm install` succeeds; `npm run build` produces `dist/` with `bin/ivy.js` runnable; `ivy --version` prints version

## 2. Skill Distribution (Sprint 1.2, Week 3)

- [x] 2.1 Create `src/core/platforms.ts` with single `claude` entry matching the `Platform` interface (id/name/skillsDir/globalSkillsDir/openspecToolId/rulesDir/rulesFormat/supportsHooks/hookFormat)
- [x] 2.2 Port `src/core/skills.ts` from Comet, rename `copyCometSkillsForPlatform → copyIvySkillsForPlatform`, simplify to single platform path
- [x] 2.3 Port `src/core/detect.ts` from Comet, simplify detection to single platform
- [x] 2.4 Create `assets/manifest.json` listing `ivy/SKILL.md` and references; rules listing `ivy-phase-guard.md`; hooks empty for v0.1 PreToolUse
- [x] 2.5 Migrate `.claude/skills/ivy-dev-workflow/SKILL.md` content into `assets/skills/ivy/SKILL.md` (single-file v0.1, no phase split)
- [x] 2.6 Migrate references (`explore-fast-track.md`, `prerequisites.md`, etc.) into `assets/skills/ivy/references/` with each file ≤ 200 lines
- [x] 2.7 Unit test: `copyIvySkillsForPlatform` against tmp dir copies all manifest entries; `overwrite=false` skips existing files

## 3. OpenSpec Integration + SpecAdapter (Sprint 1.3, Week 4)

- [x] 3.1 Port `src/core/openspec.ts` from Comet verbatim (already studied; keeps `installOpenSpec`, `ensureOpenSpecCli`, `buildOpenSpecInitInvocation`)
- [x] 3.2 Create `src/core/spec-adapter.ts` with `SpecAdapter` interface, `OpenSpecAdapter` class delegating to `core/openspec.ts`, and `defaultSpecAdapter` singleton
- [x] 3.3 Document `IVY_SPEC_ADAPTER` env var as reserved (no-op in v0.1) in code comments
- [x] 3.4 Unit test: `defaultSpecAdapter.name === 'openspec'`; mock `child_process.execFile` to verify `ensureCli` invokes `npm install` when `which openspec` fails

## 4. Phase Machine + Phase Guard (Sprint 1.4, Week 5)

- [x] 4.1 Create `src/core/phase-machine.ts` exporting `IvyPhase` enum, `TRANSITIONS` (per design D3 + spec phase-machine), `canTransition`, `isTerminalPhase`, `parsePhase`
- [x] 4.2 Create `src/core/phase-machine.test.ts` covering: 4 forward edges, 3 rollback edges, 4 illegal skip-aheads, terminal detection, `parsePhase('build')`, `parsePhase('implementing')` → null. Achieve 100% line coverage
- [x] 4.3 Create `assets/rules/ivy-phase-guard.md` describing 9-step workflow constraints; phase list (`open|design|build|verify|archive`) marked with comment `<!-- DO NOT EDIT: synced from src/core/phase-machine.ts -->`
- [x] 4.4 Add `scripts/sync-phases.ts` (runs in `npm run build`) that re-derives the phase list from `IvyPhase` enum and rewrites the marked block in `assets/rules/ivy-phase-guard.md`; CI fails if regenerated content differs from committed file
- [x] 4.5 Create `assets/hooks/ivy-git-prepush.sh` per design D5 (grep/awk only, no yq, branch-prefix `ivy/`)
- [x] 4.6 Extend `core/skills.ts` (or new `core/git-hook.ts`) to detect `.git/` and copy hook to `.git/hooks/pre-push` chmod 0755 during `init`
- [x] 4.7 Integration test: temp git repo + `ivy init` produces executable `.git/hooks/pre-push` that exits 1 for `phase: build` and 0 for `phase: archive`

## 5. CLI Commands (Sprint 1.5, Week 6 — v0.1 only 3 commands)

- [x] 5.1 Create `src/commands/init.ts` orchestrating: detect platform → `defaultSpecAdapter.ensureCli` + `init` → `copyIvySkillsForPlatform` → install git pre-push hook → write `.ivy/project.yaml` → print "use /ivy to start"
- [x] 5.2 Wire `--quick` (default), `--standard` (interactive wizard via `@inquirer/prompts`), `--enterprise` (standard + plugin prompt placeholder) flags
- [x] 5.3 Create `src/commands/status.ts` reading `.ivy/project.yaml` + optional `--change <name>` → load `openspec/changes/<name>/.ivy.yaml` → print `Phase: <phase>` + adoption one-liner if snapshot exists
- [x] 5.4 Create `src/commands/validate.ts` walking all `openspec/changes/*/.ivy.yaml` → `parsePhase` + `phase_history` pair-wise `canTransition` → colored output, exit non-zero on any failure
- [x] 5.5 Wire all three commands into `cli/index.ts`; explicitly DO NOT register `doctor`, `uninstall`, `update`
- [x] 5.6 Integration test: scaffold tmp project → run `init --quick` → assert `.claude/skills/ivy/SKILL.md` exists, `.git/hooks/pre-push` exists, `.ivy/project.yaml` exists; then `status` prints expected output; then `validate` exits 0

## 6. Adoption-Lite (Sprint 1.6, Week 7)

- [x] 6.1 Create `src/core/adoption-lite.ts` exporting `AdoptionSnapshot` interface and `snapshotAdoption(changeName)` per spec adoption-lite
- [x] 6.2 Implement `git diff --shortstat <baseCommit>..HEAD` parsing; handle empty diff (0 insertions, 0 deletions); confidence hardcoded `'low'`
- [x] 6.3 Read `phase` from `openspec/changes/<name>/.ivy.yaml`; throw with clear message when `isTerminalPhase(phase) === false`
- [x] 6.4 Persist snapshot under `adoption:` key while preserving other top-level YAML keys (use a minimal YAML writer; no full yaml lib if avoidable, otherwise add `yaml` dep)
- [x] 6.5 Wire `status --change <name>` to display adoption summary when snapshot exists; format: `Adoption: ~<lines_added> lines (low confidence, commit diff)`
- [x] 6.6 Unit tests: parse known shortstat outputs (`5 files changed, 420 insertions(+), 30 deletions(-)`, empty, deletions-only); reject non-archive phase; persistence preserves other keys

## 7. Tests & Release (Sprint 1.7, Week 8)

- [x] 7.1 Achieve overall vitest line coverage ≥ 70%; phase-machine 100%
- [x] 7.2 Add `npm run lint` (eslint config copied from Comet) and ensure clean
- [x] 7.3 Write `README.md` (英文) + `README.zh-CN.md` (中文)：positioning ("A Workflow Enforcer for AI Coding Agents"), Comet relationship clarification, quickstart (`npm i -g ivyflow-cli && ivy init`), known limitations (low-confidence adoption, single platform)
- [x] 7.4 双语 README 内容对齐校验：核心信息（quickstart 命令、定位语句、3 个命令、限制说明）同步一致
- [x] 7.5 Write `CHANGELOG.md` v0.1.0 entries
- [x] 7.6 Add GitHub Actions CI: `npm ci && npm run build && npm test && npm run lint`
- [ ] 7.7 `npm publish` v0.1.0 with package name `ivyflow-cli`; enable GitHub Discussions

## 8. Brainstorming 决议（2026-06-16，已关闭）

> 5 项原 NEEDS_USER_INPUT 全部敲定，下游任务按以下结论实现，无需再阻塞 7.4 / 7.7。

- [x] 8.1 npm 包名：`ivyflow-cli`（无 scope 摩擦）
- [x] 8.2 README 语言：中英双语（`README.md` 英文 + `README.zh-CN.md` 中文）
- [x] 8.3 状态机回退：**不允许** `VERIFY -> DESIGN`；`TRANSITIONS[VERIFY] = [ARCHIVE, BUILD]`
- [x] 8.4 adoption-lite：**不允许** `--force-snapshot`；`snapshotAdoption` 严格 `isTerminalPhase` 校验
- [x] 8.5 `ivy validate --json`：v0.1 不实现，仅人类可读色彩文本（YAGNI）
