# 部署集成 (Deployment Integration)

一键生成 CI/CD 配置和发布流程管理。

## CI/CD 模板

安装后自动生成 CI 配置文件：

- `.github/workflows/ivyflow-ci.yml` — GitHub Actions
- `.gitlab-ci.yml` — GitLab CI

CI 流水线包含：
- 代码检查 (`ivy check`)
- 编译验证
- 测试运行
- 质量门控 (`ivy verify`)

## 发布流程

使用 `ivy release` 打包发布产物：

```bash
ivy release              # 打包当前变更产物
ivy release --name v1.0  # 指定发布名称
```

## 环境配置

支持多环境配置管理，在 `.ivy/project.yaml` 中定义：

```yaml
capabilities:
  deployment:
    enabled: true
    ci_provider: github-actions
```
