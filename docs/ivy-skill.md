# ivy skill — 技能注册表

## 功能介绍

`ivy skill` 管理 IvyFlow 的技能注册表，查看已安装技能及其详情。

## 操作步骤

### 列出所有技能

```bash
ivy skill
ivy skill list
```

### 查看技能详情

```bash
ivy skill --detail ivy-build
```

输出版本号、状态、使用次数和最后使用时间。

## 使用案例

### 案例 1：了解可用技能

```bash
ivy skill
# 列出所有已安装的技能及其用途
```

### 案例 2：查看技能详情

```bash
ivy skill --detail ivy-verify
# 显示版本号、状态、使用次数、最后使用时间
```

## 相关命令

- `ivy capability list` — 能力列表
- `ivy doctor` — 健康检查
