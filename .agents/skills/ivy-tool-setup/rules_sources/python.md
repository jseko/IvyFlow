---
description: Python 编码约束 — PEP 8 规范、类型注解、测试、禁止模式
globs: **/*.py
---

# Python 编码约束

## 代码风格（PEP 8）
- 缩进：4 空格，禁止 Tab
- 行宽：88 字符（Black 默认），文档字符串 72 字符
- 顶级函数/类之间：2 空行；类内方法之间：1 空行
- 使用 Black 或 Ruff 自动格式化，禁止手动调整格式

## 导入规范
- 顺序：标准库 → 第三方库 → 本地/项目库，各组之间空行分隔
- 按字母顺序排列
- 禁止 `import *`（通配符导入）
- 优先使用绝对导入，避免相对导入

## 命名约定（PEP 8）
- 模块/包：`lowercase_with_underscores`
- 类：`PascalCase`
- 函数/方法/变量：`lowercase_with_underscores`
- 常量：`UPPERCASE_WITH_UNDERSCORES`
- 非公开成员：`_leading_underscore`
- 名称避免与 Python 内置名称冲突

## 类型注解（必须）
- 所有函数签名必须添加类型注解（参数和返回值）
- 复杂类型使用 `typing` 模块（`List`、`Dict`、`Optional`、`Union`）
- 复杂类型别名使用 `TypeAlias`
- 项目必须配置 `mypy` 或 `pyright` 进行静态类型检查

## 虚拟环境（必须）
- 每个项目使用独立虚拟环境，推荐 Poetry 或 Pipenv
- 禁止直接使用全局 Python 环境 `pip install`
- `venv/` 或 `.venv/` 必须加入 `.gitignore`
- 依赖锁定文件（`poetry.lock` / `Pipfile.lock`）必须提交

## 文档
- 所有公开的模块、类、函数必须有 docstring（遵循 PEP 257）
- docstring 使用 reStructuredText 格式（`:param:` / `:return:` / `:raises:`）
- 注释说明"为什么"而非"是什么"

## 测试（必须）
- 使用 `pytest` 作为测试框架，禁止只用 `unittest.TestCase`
- 使用 `pytest.mark.parametrize` 测试多组输入
- 使用 `pytest.fixtures` 管理测试准备和清理
- 使用 `pytest-cov` 检查覆盖率，目标 > 80%
- 鼓励 TDD：先写测试，再写实现

## 禁止模式
- 禁止使用可变对象作为默认参数值
- 禁止使用裸 `except:`（至少使用 `except Exception:`）
- 禁止使用 `from module import *`
- 禁止在 f-string 中嵌入复杂表达式（先赋值给变量）
- 禁止忽视异常（`except ...: pass`）

## 推荐模式
- 文件和网络资源使用 `with` 语句（上下文管理器）
- 字符串格式化优先使用 `f-string`（Python 3.6+）
- 符号常量使用 `enum.Enum` 而非字符串字面量
- 数据转换优先使用列表推导式/生成器表达式
- 项目结构使用 `src/` 布局，`pyproject.toml` 作为项目元数据文件
