# ivy assess — 遗留项目评估

## 功能介绍

`ivy assess` 对遗留项目进行五维评估，帮助了解项目当前状态和改进方向。

### 五维评估

| 维度 | 说明 |
|------|------|
| 代码质量 | 代码规范、复杂度、重复度 |
| 测试覆盖 | 测试存在性和覆盖率 |
| 文档完整度 | 文档覆盖和质量 |
| 架构健康 | 模块耦合度、循环依赖 |
| 技术债务 | 已知问题和改进建议 |

## 操作步骤

### 基本评估

```bash
ivy assess
```

### 输出到文件

```bash
ivy assess --output assessment-report.md
```

## 使用案例

### 案例 1：评估遗留项目

```bash
cd legacy-project
ivy init --yes
ivy assess
# 了解项目当前状态和改进方向
```

### 案例 2：生成评估报告

```bash
ivy assess --output ./docs/project-assessment.md
```

## 相关命令

- `ivy capability detect` — 技术栈检测
- `ivy doctor` — 健康检查
