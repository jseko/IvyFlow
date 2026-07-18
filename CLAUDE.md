///

# /CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IvyFlow (`ivyflow-cli`) is a CLI tool that enforces a structured 9-step AI-assisted development workflow. It distributes Skills, Rules, and Hooks to 7 AI coding platforms to constrain Agent behavior by phase, preventing code writes during design/open phases and blocking pushes for non-archive changes.

**Current state: v0.14.0 shipped.** 6 CLI commands, 7 platforms, 165 tests, 92.98% coverage.

## v0.14 Capability Infrastructure

v0.14 adds a capability-aware infrastructure layer — the system now detects project tech stack, generates context-appropriate rules, recommends skills, and validates verify profiles.

### New CLI Commands

- `ivy capability detect [--refresh] [--format json]` — detect project tech stack (writes `.ivy/capability.yaml`)
- `ivy capability list [--recommended]` — list detected capabilities or recommended skills
- `ivy capability health [--gaps-only] [--format json]` — capability health assessment (3D: coverage, drift, risk)
- `ivy capability profile [--format json]` — show verify profile based on detected tech stack
- `ivy capability verify [--gaps-only]` — capability-lifecycle integration check (advisory)
- `ivy rules generate [--format json]` — generate rules from tech stack
- `ivy rules analyze [--format json]` — analyze rules (coverage, conflicts)
- `ivy rules validate [--format json]` — validate rules against tech stack

### New Core Modules

| Module                              | Role                                                                  |
| ----------------------------------- | --------------------------------------------------------------------- |
| `src/core/capability-model.ts`    | Capability types, ProjectIntent, TechStack, CapabilityDependencyIndex |
| `src/core/capability-detector.ts` | 4-stage pipeline: scan → infer → reconcile → emit                  |
| `src/core/capability-health.ts`   | Diagnostic assessment (coverage, drift, risk — no scores)            |
| `src/core/rule-generator.ts`      | Generate rules from tech stack with tiering (core/context/optional)   |
| `src/core/skill-registry.ts`      | Skill catalog with deterministic/heuristic classification             |
| `src/core/verify-profile.ts`      | Generate verify profiles with maturity-based gate filtering           |
| `src/core/export-api.ts`          | Export API with`capability` and `verify-profile` dimensions       |

### Assets

| Asset                                     | Role                                   |
| ----------------------------------------- | -------------------------------------- |
| `assets/capability/rule-mapping.yaml`   | Rule definitions with tier annotations |
| `assets/capability/skill-mapping.yaml`  | Skill definitions with install modes   |
| `assets/capability/verify-mapping.yaml` | Verify profile templates by maturity   |

### Three-Stage Compiler Model

```
detect (scan sources) → compile (pure function) → emit (write results)
```

Strict isolation between stages:

- Stage 1: No file writes
- Stage 2: No I/O
- Stage 3: No computation

### Rule Tiering

- **core**: Always deployed regardless of tech stack
- **context**: Stack-bound, only deployed when applicable
- **optional**: Recommended-only, never auto-deployed

### Skill Determinism

- **deterministic**: Stack-bound, triggered by detected tech
- **heuristic**: Advisory-only, always available

### Boundary Constraints

- `MAX_BUILTIN_SKILLS = 20` (hard limit)
- Capability guards are advisory-only (warn-level, never blocking)
- Health is diagnostic-only (no scores/percentages/weighted averages)

## Reference Codebase

~60% of the v0.1 implementation was ported from Comet (`/Users/liuzhupeng/workspace/vibecoding/comet/`). Core modules:

| IvyFlow module                | Role                                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/cli/index.ts`          | Commander CLI registration (6 commands)                                                                  |
| `src/core/platforms.ts`     | 7-platform const array (`PLATFORMS`), no interface registry                                            |
| `src/core/skills.ts`        | Manifest-driven Skill/Rule/Hook distribution                                                             |
| `src/core/render/`          | Per-platform render:`index.ts` (switch) + `rule-mdc.ts` + `rule-copilot.ts` + `hook-windsurf.ts` |
| `src/core/detect.ts`        | Confidence-scored platform detection (1.0/0.8/0.6)                                                       |
| `src/core/security.ts`      | Security validation: rule presence + sensitive filename scan                                             |
| `src/core/version.ts`       | Local version reader (for`ivy update`)                                                                 |
| `src/core/phase-machine.ts` | Phase enum + transition table (100% coverage)                                                            |
| `src/utils/fs.ts`           | File utilities                                                                                           |

## Architecture (v0.3)

### Commands

6 commands ship in v0.3:

- `ivy init [--quick|--standard|--enterprise] [--overwrite] [--skip-openspec]` — detects platforms, installs Skills/Rules/Hooks, writes `.ivy/project.yaml`, installs git pre-push hook.
- `ivy status [--change <name>]` — reads `.ivy/project.yaml` and optional `openspec/changes/<name>/.ivy.yaml`.
- `ivy validate [--security]` — validates phase transitions + security rule presence + sensitive filenames (default `--security=true` since v0.3).
- `ivy doctor [--fix]` — local invariant health check; `--fix` only creates missing files.
- `ivy uninstall [--platforms <ids>] [--dry-run] [--force]` — safe removal with dry-run preview and confirm.
- `ivy update [--check]` — check npm registry for updates, prints command, never auto-installs.

### Phase Machine

```typescript
enum IvyPhase { OPEN, DESIGN, BUILD, VERIFY, ARCHIVE }
const TRANSITIONS: Record<IvyPhase, IvyPhase[]> = {
  [OPEN]:    [DESIGN, BUILD],
  [DESIGN]:  [BUILD, OPEN],
  [BUILD]:   [VERIFY, DESIGN],
  [VERIFY]:  [ARCHIVE, BUILD],
  [ARCHIVE]: [],
};
```

`scripts/sync-phases.ts` regenerates `assets/rules/ivy-phase-guard.md` from the enum at build time; CI fails on drift.

### Triple Defense

| Layer                      | v0.3 status      | Implementation                                                                                                     |
| -------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| Primary (Rule file)        | ✅               | `ivy-phase-guard.md` + `ivy-security.md` per platform                                                          |
| Secondary (Git Hook)       | ✅               | `assets/hooks/ivy-git-prepush.sh` → `.git/hooks/pre-push`; wrapped with IvyFlow markers for precise uninstall |
| Tertiary (PreToolUse Hook) | ✅ Windsurf only | `.windsurf/hooks/ivy-phase-guard.json` rendered by `render/hook-windsurf.ts`                                   |

### Spec Adapter

`src/core/spec-adapter.ts` defines `SpecAdapter` interface. v0.3 ships `OpenSpecAdapter` only. `IVY_SPEC_ADAPTER` env var reserved for future substitution.

### Manifest v2

`assets/manifest.json` schemaVersion=2:

- `skills[]` — Skill files to copy
- `rules[]` — Rule files to render per-platform (`ivy-phase-guard.md`, `ivy-security.md`)
- `hooks` — Platform hook definitions (static vs rendered)

Validated by `scripts/check-manifest.js` at build time.

### Evolution Constraints (§9 Red Lines)

CI-enforced via `scripts/check-skill-blocks.js` and `scripts/check-manifest.js`:

- `render/` ≤ 8 files, each ≤ 50 lines, `index.ts` ≤ 30 lines. No Renderer interface / IR.
- `detect.ts` confidence ≤ 4 layers (currently 3). No `DetectionStrategy` interface. No network/git-history reads.
- `SKILL.md` exactly 4 blocks (ROUTER/CONSTRAINTS/VARIABLES/REFERENCES), each ≤ 50 lines.
- `doctor.ts` no `--telemetry` / `--report` / `--upload`. Offline-only.
- Skill recommendation deferred until ≥ 100 projects usage data.
- PreToolUse Hook expansion deferred until platform stable ≥ 6 months.

## Backwards Compatibility

- v0.1 `.ivy/project.yaml` (`platform: string`) — read transparently by `status.ts` and `doctor.ts`.
- v0.2 `.ivy/project.yaml` (`platforms: string[]`) — fully compatible.
- v0.3 adds `analytics_enabled: false` field (no-op until v0.4).

## Common Development Commands

```bash
npm install
npm run build       # produces dist/
npm test            # vitest
npm run lint        # eslint
```

Single test file:

```bash
npx vitest run src/core/security.test.ts
```

Watch mode:

```bash
npx vitest
```

CI gate:

```bash
npm ci && npm run build && npm test && npm run lint
```

## 每次回复前喊"爸爸"

## 项目路径速查

| 项目                           | 绝对路径                                         |
| ------------------------------ | ------------------------------------------------ |
| Comet 源码                     | `/Users/liuzhupeng/workspace/vibecoding/comet` |
| 参考 Skill — ivy-dev-workflow | `.claude/skills/ivy-dev-workflow/SKILL.md`     |
| 参考 Skill — ivy-tool-setup   | `.claude/skills/ivy-tool-setup/SKILL.md`       |

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **IvyFlow** (7957 symbols, 16209 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource                                   | Use for                                  |
| ------------------------------------------ | ---------------------------------------- |
| `gitnexus://repo/IvyFlow/context`        | Codebase overview, check index freshness |
| `gitnexus://repo/IvyFlow/clusters`       | All functional areas                     |
| `gitnexus://repo/IvyFlow/processes`      | All execution flows                      |
| `gitnexus://repo/IvyFlow/process/{name}` | Step-by-step execution trace             |

## CLI

| Task                                         | Read this skill file                                          |
| -------------------------------------------- | ------------------------------------------------------------- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"  | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"             | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md`       |
| Rename / extract / split / refactor          | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md`     |
| Tools, resources, schema reference           | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands      | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md`             |

<!-- gitnexus:end -->

## 多智能体开源项目

- github仓库地址：https://github.com/msitarzewski/agency-agents
- 源码地址：./vendors/agency-agents

## Full Stack Skills

- github仓库地址：https://github.com/partme-ai/full-stack-skills.git
- 源码地址：./vendors/full-stack-skills

<!-- ivyflow-language -->
请始终使用中文回复。
