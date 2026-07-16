import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'IvyFlow',
  description: 'AI-Native Development Workflow — AI 编码 Agent 的工作流强约束器',
  lang: 'zh-CN',
  base: '/IvyFlow/',

  head: [
    ['link', { rel: 'icon', href: '/IvyFlow/favicon.svg' }],
  ],

  themeConfig: {
    logo: { src: '/IvyFlow/favicon.svg', alt: 'IvyFlow' },

    nav: [
      { text: '操作手册', link: '/README' },
      { text: 'Agent 使用', link: '/agent-usage' },
      { text: '最佳实践', link: '/best-practice-workflow' },
      {
        text: 'v0.15.1',
        items: [
          { text: '更新日志', link: 'https://github.com/jseko/IvyFlow/blob/main/CHANGELOG.md' },
          { text: 'GitHub', link: 'https://github.com/jseko/IvyFlow' },
          { text: 'npm', link: 'https://www.npmjs.com/package/ivyflow-cli' },
        ],
      },
    ],

    sidebar: {
      '/': [
        {
          text: '概述',
          items: [
            { text: 'IvyFlow 操作手册', link: '/README' },
            { text: '在 AI Agent 中使用', link: '/agent-usage' },
            { text: '最佳实践工作流', link: '/best-practice-workflow' },
            { text: '流水线实现评估', link: '/pipeline-implementation-assessment' },
          ],
        },
        {
          text: '安装与维护',
          collapsed: false,
          items: [
            { text: 'ivy init — 安装与初始化', link: '/ivy-init' },
            { text: 'ivy uninstall — 卸载', link: '/ivy-uninstall' },
            { text: 'ivy update — 更新检查', link: '/ivy-update' },
            { text: 'ivy doctor — 健康检查', link: '/ivy-doctor' },
            { text: 'ivy sync — 平台同步', link: '/ivy-sync' },
          ],
        },
        {
          text: '工作流核心',
          collapsed: true,
          items: [
            { text: 'ivy status — 状态查询', link: '/ivy-status' },
            { text: 'ivy validate — 阶段验证', link: '/ivy-validate' },
            { text: 'ivy guard — 三重阶段守卫', link: '/ivy-guard' },
            { text: 'ivy guard validate — 守卫层验证', link: '/ivy-guard-validate' },
            { text: 'ivy verify — 质量门禁', link: '/ivy-verify' },
            { text: 'ivy archive — 变更归档', link: '/ivy-archive' },
            { text: 'ivy state — 生命周期检查点', link: '/ivy-state' },
            { text: 'ivy workflow — 工作流管理', link: '/ivy-workflow' },
          ],
        },
        {
          text: '分析洞察',
          collapsed: true,
          items: [
            { text: 'ivy analytics — 采纳率分析', link: '/ivy-analytics' },
            { text: 'ivy dashboard — 仪表盘', link: '/ivy-dashboard' },
            { text: 'ivy suggest — 工作流建议', link: '/ivy-suggest' },
            { text: 'ivy review — 建议审查', link: '/ivy-review' },
            { text: 'ivy check — CI 健康检查', link: '/ivy-check' },
            { text: 'ivy explain — 建议溯源', link: '/ivy-explain' },
            { text: 'ivy feedback — 反馈分析', link: '/ivy-feedback' },
            { text: 'ivy assess — 遗留项目评估', link: '/ivy-assess' },
          ],
        },
        {
          text: '知识管理',
          collapsed: true,
          items: [
            { text: 'ivy audit — 证据审计', link: '/ivy-audit' },
            { text: 'ivy trace — 知识链接追溯', link: '/ivy-trace' },
            { text: 'ivy knowledge — 知识链接管理', link: '/ivy-knowledge' },
            { text: 'ivy memory — 记忆系统管理', link: '/ivy-memory' },
            { text: 'ivy council — 记忆智囊团', link: '/ivy-council' },
          ],
        },
        {
          text: '能力与规则',
          collapsed: true,
          items: [
            { text: 'ivy fingerprint — 技术栈检测', link: '/ivy-fingerprint' },
            { text: 'ivy capability — 能力检测', link: '/ivy-capability' },
            { text: 'ivy rules — 规则管理', link: '/ivy-rules' },
            { text: 'ivy skill — 技能注册表', link: '/ivy-skill' },
          ],
        },
        {
          text: '发布与导出',
          collapsed: true,
          items: [
            { text: 'ivy release — 发布打包', link: '/ivy-release' },
            { text: 'ivy export — 数据导出', link: '/ivy-export' },
          ],
        },
        {
          text: '多角色与协作',
          collapsed: true,
          items: [
            { text: 'ivy role — 角色管理', link: '/ivy-role' },
            { text: 'ivy pipeline — 多角色流水线', link: '/ivy-pipeline' },
            { text: 'ivy dispatch — 多 Agent 任务分发', link: '/ivy-dispatch' },
          ],
        },
        {
          text: '开发流程',
          collapsed: true,
          items: [
            { text: 'ivy propose — 提案驱动开发', link: '/ivy-propose' },
            { text: 'ivy apply — 实施入口', link: '/ivy-apply' },
            { text: 'ivy worktree — Git 工作树', link: '/ivy-worktree' },
            { text: 'ivy handoff — 上下文交接', link: '/ivy-handoff' },
            { text: 'ivy next — 下一技能解析', link: '/ivy-next' },
            { text: 'ivy explore — 只读探索模式', link: '/ivy-explore' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/jseko/IvyFlow' },
    ],

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索文档' },
          modal: { displayDetails: '显示详情', noResultsText: '未找到结果', resetButtonTitle: '重置' },
        },
      },
    },

    footer: {
      message: '基于 MIT 许可证发布',
      copyright: `Copyright © 2026 IvyFlow`,
    },

    outline: {
      level: [2, 3],
      label: '本页目录',
    },

    docFooter: {
      prev: '上一页',
      next: '下一页',
    },

    darkModeSwitchLabel: '主题切换',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '回到顶部',
  },
})
