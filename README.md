# IvyFlow

> **AI-Native Development Workflow.** Enforce structured development across 5 roles, with phase gates, multi-agent collaboration, and one-command setup.

[简体中文](./README.zh-CN.md) | [Changelog](./CHANGELOG.md) | [Website](https://jseko.github.io/IvyFlow/)

---

## Quick Start

```bash
npm install -g ivyflow-cli
cd your-project
ivy init
```

That's it. IvyFlow is now installed with all 5 roles and ready to use.

---

## Multi-Role System

IvyFlow supports 5 roles, each with its own workflow phases and skills. Init installs all roles — switch anytime with `ivy role set`.

| Role | Command | Workflow | Description |
|------|---------|----------|-------------|
| 💻 **Developer** | `/ivyflow` | open → design → build → verify → archive | Full-stack development with phase gates |
| 📋 **PM** | `/pmflow` | collect → analyze → prd → review → accept | Requirements analysis + PRD + review |
| 🧪 **QA** | `/qaflow` | testcase → execute → bug → report → regression | Test case design + execution + tracking |
| 🏗️ **Architect** | `/archflow` | research → design → review → guide | Tech selection + system design + review |
| 🚀 **DevOps** | `/devopsflow` | env → cicd → deploy → monitor → alert | Infrastructure + CI/CD + monitoring |

```bash
ivy role show          # Show current role
ivy role list          # List all available roles
ivy role set pm        # Switch to Product Manager
```

---

## Init Workflow (4 Steps)

```
Step 1: Welcome + Install Scope
Step 2: Language + Tech Stack Detection
Step 3: CodeGraph + OpenSpec (optional)
Step 4: Install + Completion Guide
```

After init, your project has:

```
.claude/
├── commands/          # 20 commands across 5 roles
├── skills/
│   ├── ivy-role/      # Role dispatcher (auto-detects current role)
│   ├── ivy/           # Developer phase skills (8 + references)
│   ├── pm/            # PM phase skills (6)
│   ├── qa/            # QA phase skills (6)
│   ├── architect/     # Architect phase skills (5)
│   └── devops/        # DevOps phase skills (6)
└── rules/             # Phase guard + security + coding rules

.ivy/
└── project.yaml       # role, language, capabilities, workflow config
```

---

## Developer Workflow (5 Phases)

```
/ivyflow → open → design → build → verify → archive
```

| Phase | Skill | Description |
|-------|-------|-------------|
| **open** | ivy-open | Create OpenSpec change structure (proposal/design/tasks) |
| **design** | ivy-design | Brainstorming via Superpowers, handoff generation, delta spec checklist |
| **build** | ivy-build | Execute tasks (executing-plans / subagent-driven / direct), TDD enforcement |
| **verify** | ivy-verify | Quality gates (compile/test/coverage), branch handling |
| **archive** | ivy-archive | OpenSpec archive, knowledge extraction, cleanup |

**Shortcut paths:**

| Path | Command | Use Case |
|------|---------|----------|
| Hotfix | `/ivyflow-hotfix` | Bug fix (≤2 files, skip brainstorming) |
| Tweak | `/ivyflow-tweak` | Small change (≤3 tasks, skip brainstorming) |
| Quick | `/ivyflow-quick` | Fast fix (skip plan) |

---

## Quick Commands

```bash
# Init & Setup
ivy init [--quick|--yes|--all]            # Interactive or automated init
ivy role set <pm|qa|architect|devops>     # Switch role
ivy role show                             # Current role

# Workflow
ivy state show                            # Current phase and state
ivy workflow start <name> [--preset]      # Start new change
ivy guard <phase> --apply                 # Validate and advance phase

# Quality
ivy verify --change <name>                # Run all quality gates
ivy doctor [--fix]                        # Health check and repair

# Analytics
ivy analytics [--confidence]              # Adoption metrics
ivy dashboard                             # ASCII dashboard
```

---

## Platform Support

| Tier | Platforms |
|------|-----------|
| **Tier 1** | Claude Code, Cursor, GitHub Copilot |
| **Tier 2** | Windsurf, Gemini CLI, Cline, Amazon Q, Continue, RooCode |
| **Tier 3** | CodeBuddy, Trae, Qoder, OpenCode, Kilo Code, Auggie, Kimi Code, Lingma |

---

## Binary Distribution

```bash
# Download standalone binary (no Node.js required)
./ivy --version        # 0.14.0
./ivy init --quick     # One-command setup
```

---

## Development

```bash
npm install
npm run build          # tsc + validations
npm test               # 977 tests
npm run package:binary # Build standalone binary
```

---

## License

MIT. See [LICENSE](./LICENSE) for details.
