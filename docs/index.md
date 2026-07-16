---
layout: home

hero:
  name: "IvyFlow"
  text: "AI-Native Development Workflow"
  tagline: AI 编码 Agent 的工作流强约束器 — 阻止 AI 在不该写代码的时候写代码
  image:
    src: /hero-bg.png
    alt: IvyFlow
  actions:
    - theme: brand
      text: 快速开始
      link: /README
    - theme: alt
      text: 在 Agent 中使用
      link: /agent-usage
    - theme: alt
      text: GitHub
      link: https://github.com/jseko/IvyFlow

features:
  - icon: 🛡️
    title: 三重阶段守卫
    details: PreToolUse Hook + Rule 文件 + Git Pre-Push Hook，三层纵深防御阻止 Agent 跳过必要阶段
  - icon: 📊
    title: 采纳率分析
    details: 四层归因模型（L1-L4），每层标注置信度，量化 AI 的代码贡献
  - icon: 🔄
    title: 五阶段工作流
    details: open → design → build → verify → archive，TypeScript 状态机精确控制阶段转换
  - icon: 👥
    title: 五大角色协作
    details: Developer / PM / QA / Architect / DevOps，每个角色有独立工作流和斜杠命令
  - icon: 🧠
    title: 知识记忆系统
    details: 三层记忆架构，自动提取决策、约束、风险和事实，构建项目知识库
  - icon: 🌐
    title: 16 平台支持
    details: 覆盖 Claude Code、Cursor、GitHub Copilot、Windsurf、Gemini CLI 等主流平台
---

## 安装

```bash
npm install -g ivyflow-cli
cd your-project
ivy init
```

## 在 Agent 中使用

重启 AI 编码工具，输入：

```
/ivyflow "实现用户登录功能"
```

Agent 会按 open → design → build → verify → archive 五阶段完成开发。

## 平台支持

| Tier 1 | Tier 2 | Tier 3 |
|--------|--------|--------|
| Claude Code · Cursor · GitHub Copilot | Windsurf · Gemini CLI · Cline · Amazon Q · Continue · RooCode | CodeBuddy · Trae · Qoder · OpenCode · Kilo Code · Auggie · Kimi Code · Lingma |
