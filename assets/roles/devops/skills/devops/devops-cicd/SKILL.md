---
name: devops-cicd
description: DevOps Phase 2: CI/CD 搭建 — 流水线配置、构建优化、制品管理
---

# DevOps Phase 2: CI/CD 搭建

## 目标

搭建自动化 CI/CD 流水线。

## 步骤

### 0. 入口状态验证

```bash
ivy state show
```

验证当前阶段为 cicd。读取 `docs/devops/infrastructure.md`。

### 1. 流水线设计

```
代码提交 → Lint → 单元测试 → 构建镜像 → 推送仓库 → 部署 Staging → E2E 测试 → 部署 Production
```

### 2. GitHub Actions 配置

```yaml
name: CI/CD Pipeline
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run lint

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          echo "Deploying..."
```

### 3. 构建优化

- 缓存 node_modules
- 并行执行独立任务
- 使用多阶段 Docker 构建

### 4. 制品管理

- Docker Registry：推送镜像
- npm Registry：发布包
- 版本号策略：语义化版本

### 5. 产出物

生成 `.github/workflows/ci.yml`。

### 6. 守卫检查

```bash
ivy guard cicd --apply
```
