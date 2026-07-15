# ivy doctor — 健康检查

## 功能介绍

`ivy doctor` 是本地不变量健康检查命令（纯离线，无遥测，无网络，无状态推断）。它检查 IvyFlow 安装的完整性，支持修复缺失文件、平台健康认证、生态系统检测、知识库同步和记忆健康评估。

### 核心能力

- **基本检查**：验证技能、规则、Hook 文件完整性
- **自动修复**：`--fix` 重建缺失文件（不覆盖已有文件）
- **平台认证**：`--platforms` 展示各平台安装状态
- **生态系统检测**：`--ecosystem` 能力检测
- **知识库同步**：`--sync-kb` 同步参考标记
- **记忆健康**：`--memory` 六维度记忆健康评估

## 操作步骤

### 基本健康检查

```bash
ivy doctor
```

输出示例：

```
✓ phase-machine: OK
✓ skills integrity: 31/31 present
✓ rules integrity: 12/12 present
✓ hooks integrity: 3/3 present
✓ project.yaml: valid
```

### 自动修复缺失文件

```bash
ivy doctor --fix
```

### 平台健康认证

```bash
ivy doctor --platforms
```

### 生态系统能力检测

```bash
ivy doctor --ecosystem
```

### 知识库同步

```bash
ivy doctor --sync-kb
```

### 记忆健康评估

```bash
ivy doctor --memory
```

### JSON 格式输出

```bash
ivy doctor --memory --json
```

## 检查项目清单

| 检查项 | 说明 |
|--------|------|
| phase-machine | 阶段机状态文件完整性 |
| skills integrity | 技能文件是否存在 |
| rules integrity | 规则文件是否存在 |
| hooks integrity | Hook 文件是否存在 |
| project.yaml | 配置文件格式是否有效 |
| platform health | 各平台安装状态 |
| ecosystem | 技术栈能力检测 |
| knowledge sync | 知识库参考标记 |
| memory health | 六维度记忆健康 |

## 使用案例

### 案例 1：日常健康检查

```bash
ivy doctor
```

### 案例 2：安装后验证

```bash
npm install -g ivyflow-cli
cd project && ivy init --yes
ivy doctor --platforms   # 确认所有平台安装正确
```

### 案例 3：修复意外删除的文件

```bash
ivy doctor --fix
# 自动重建缺失的技能、规则、Hook 文件
```

### 案例 4：CI 集成

```bash
ivy doctor && echo "IvyFlow healthy" || echo "IvyFlow needs attention"
```

## 相关命令

- `ivy init` — 初始化安装
- `ivy validate` — 阶段验证
- `ivy status` — 状态查询
