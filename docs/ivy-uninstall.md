# ivy uninstall — 卸载

## 功能介绍

`ivy uninstall` 安全移除 IvyFlow 安装的文件，支持预览和强制模式。

## 操作步骤

### 预览卸载

```bash
ivy uninstall --dry-run
```

### 执行卸载

```bash
ivy uninstall
```

### 指定平台卸载

```bash
ivy uninstall --platforms claude-code,cursor
```

### 跳过确认

```bash
ivy uninstall --force
```

## 使用案例

### 案例 1：安全移除

```bash
ivy uninstall --dry-run
# 先预览将要删除的文件
ivy uninstall
# 确认后执行
```

### 案例 2：仅移除特定平台

```bash
ivy uninstall --platforms cursor --force
```

## 相关命令

- `ivy init` — 初始化安装
- `ivy doctor` — 健康检查
