---
description: Go 编码约束 — 命名、错误处理、并发、性能、安全
globs: **/*.go
---

# Go 编码约束

## 代码组织
- 包名使用简短小写单词，描述单一职责，禁止 `util`/`common` 等通用命名
- 不对外暴露的代码放入 `internal/` 目录强制封装
- 文件和包一一对应，一个包不要散落在多个文件中无明确分工

## 命名约定
- 包名：全小写，单数，简短（`auth`、`text`）
- 导出标识符：PascalCase（`UserService`）
- 非导出标识符：camelCase（`initConfig`）
- 常量：PascalCase 或 ALL_CAPS（取决于作用域和习惯）
- 接口：单方法接口以 `-er` 结尾（`Reader`、`Writer`）

## 错误处理
- 永远不要忽略 error 返回值（禁止 `_` 丢弃 error）
- 使用 `fmt.Errorf("context: %w", err)` 包装错误以保留链路
- 使用 `errors.Is()` / `errors.As()` 判断错误类型，禁止 `==` 直接比较
- 在 API 边界处添加错误上下文，内部传递可轻量处理
- panic 仅用于不可恢复的程序错误，禁止用作控制流

## 并发
- `context.Context` 作为函数第一个参数，用于 I/O 和长耗时操作
- 使用 `errgroup.Group` 管理并发任务组，统一处理取消和错误
- goroutine 必须有明确的退出条件，禁止 goroutine 泄漏
- 使用 `sync.Mutex` 保护共享可变状态，优先使用 `chan` 通信
- 循环中启动 goroutine 必须捕获循环变量

## 性能
- 已知长度时预分配 slice/map：`make([]T, 0, size)`
- 循环中拼接字符串使用 `strings.Builder`，禁止 `+=` 或 `fmt.Sprintf`
- 频繁创建和销毁的对象使用 `sync.Pool` 复用
- 小且不可变的结构体优先值传递，减少堆分配
- 使用 `io.Reader`/`io.Writer` 而非 `[]byte` 传递数据

## API 设计
- 函数签名：`(value, error)` 返回模式，context 作为第一个参数
- 接受接口，返回具体类型（Accept interfaces, return structs）
- 禁止使用 naked return（裸返回）
- 公开 API 必须有文档注释，以函数/类型名开头

## 测试
- 必须使用 table-driven tests
- 使用 `t.Run()` 为每个 case 创建独立子测试
- 使用 `t.TempDir()` 创建临时目录（自动清理）
- 使用 `testing.TB.Cleanup()` 注册清理逻辑
- 集成测试使用 build tags 或环境变量隔离

## 安全
- 所有外部输入必须在 API 边界处验证（长度、格式、范围）
- 定期运行 `govulncheck ./...` 扫描依赖漏洞
- 提交前运行 `go mod tidy` 清理未使用依赖
- 不要在代码中硬编码密钥、密码或 token
