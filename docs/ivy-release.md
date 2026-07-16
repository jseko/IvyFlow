# ivy release — 发布打包

## 功能介绍

`ivy release` 将已完成的 Change 产物打包，包含归档信息、证据报告和知识提取结果，用于交付。

### 打包内容

- 归档报告
- 证据报告
- 知识提取结果
- 变更摘要

## 操作步骤

### 基本发布

```bash
ivy release --change add-user-auth
```

### 指定输出目录

```bash
ivy release --change add-user-auth --output ./releases/
```

## 使用案例

### 案例 1：标准发布流程

```bash
# 1. 验证
ivy verify --change add-user-auth

# 2. 归档
ivy archive --change add-user-auth --adr

# 3. 发布打包
ivy release --change add-user-auth
```

### 案例 2：自定义输出

```bash
ivy release --change add-payment --output ./dist/releases/
```

## 相关命令

- `ivy archive` — 变更归档
- `ivy verify` — 质量门禁
