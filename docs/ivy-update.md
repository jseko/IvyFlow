# ivy update — 更新检查

## 功能介绍

`ivy update` 检查 IvyFlow CLI 是否有新版本可用，打印升级命令但不自动安装。

## 操作步骤

### 检查更新

```bash
ivy update
```

### 仅检查（退出码）

```bash
ivy update --check
# 有新版本时退出码非零
```

## 使用案例

### 案例 1：检查是否有新版本

```bash
ivy update
# 输出：New version available: 0.16.0 (current: 0.15.0)
# Run: npm install -g ivyflow-cli@latest
```

### 案例 2：CI 中检查

```bash
ivy update --check && echo "Up to date" || echo "Update available"
```

## 相关命令

- `ivy init` — 初始化安装
- `ivy doctor` — 健康检查
