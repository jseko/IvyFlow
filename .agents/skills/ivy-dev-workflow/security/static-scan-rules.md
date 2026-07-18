# AI 静态扫描规则

> v3.2 新增：事后审核层 — AI 模拟静态代码安全扫描规则。
> 在步骤四（代码审查阶段）执行，补充专业代码审查的覆盖范围。

---

## 扫描规则

### SEC-001：SQL 注入风险

```
检测目标：字符串拼接 SQL、MyBatis ${} 动态 SQL
Java 检测：String.format(...) + SELECT/INSERT/UPDATE/DELETE、Statement.execute() 拼接
严重等级：CRITICAL
修复建议：使用参数化查询（#{}）、PreparedStatement
```

### SEC-002：XSS 跨站脚本

```
检测目标：未转义的用户输入渲染到 HTML
Java 检测：response.getWriter().write(userInput)、@ResponseBody 返回未过滤用户数据
前端检测：v-html 指令、innerHTML 赋值、document.write()
严重等级：HIGH
修复建议：后端输出编码（HtmlUtils.htmlEscape）、前端使用 v-text / textContent
```

### SEC-003：敏感信息硬编码

```
检测目标：密码、API Key、Token 直接写在代码中
检测模式：password = "..."、apiKey = "..."、secret = "..."、token = "..."
严重等级：CRITICAL
修复建议：使用环境变量或配置中心，代码中使用占位符
```

### SEC-004：路径遍历

```
检测目标：文件路径由用户输入拼接
Java 检测：new File(userInput + basePath)、Paths.get(userInput)
严重等级：HIGH
修复建议：校验输入不包含 ../、使用 Path.normalize()、白名单限制目录
```

### SEC-005：不安全的反序列化

```
检测目标：ObjectInputStream.readObject() 直接反序列化外部数据
Java 检测：new ObjectInputStream(inputStream).readObject()
严重等级：HIGH
修复建议：使用 Jackson/Gson 替代 Java 原生序列化、实现 ObjectInputFilter
```

### SEC-006：缺失权限校验

```
检测目标：Controller 方法缺少 @RequiresPermissions 或 @PreAuthorize
Java 检测：@RequestMapping/@PostMapping 方法无权限注解
严重等级：HIGH
修复建议：所有管理类接口添加权限注解
```

---

## AI 扫描局限性声明

> ⚠️ **重要**：以下扫描由 AI 模拟执行，**不等同于专业 SAST 工具**。

### 已知局限

| 局限类型 | 说明 |
|---------|------|
| **覆盖不全** | AI 无法覆盖所有 CWE Top 25 / OWASP Top 10 漏洞类型 |
| **误报风险** | AI 可能将安全的代码模式误判为漏洞 |
| **漏报风险** | AI 依赖模式匹配，无法检测运行时行为相关的漏洞（如竞态条件、内存泄漏） |
| **非实时数据** | CVE 检测基于训练数据截止日的漏洞知识库，无法覆盖最新披露的 CVE |
| **无数据流分析** | 无法追踪变量从输入点到汇点的完整数据流（taint analysis） |
| **无控制流分析** | 无法精确分析条件分支下的可达性 |

### 推荐专业工具

生产环境部署前，建议使用以下专业 SAST 工具进行复核：

| 工具 | 类型 | 适用场景 |
|------|------|---------|
| SonarQube Community/Enterprise | 静态分析 | Java/JS/TS/Python 多语言 |
| Checkmarx | SAST | 企业级安全扫描 |
| Fortify Static Code Analyzer | SAST | 金融/政府合规审计 |
| Snyk Code | SAST + SCA | 开源依赖 CVE 检测 |
| OWASP Dependency-Check | SCA | 三方库已知 CVE 检测 |

---

## 扫描执行流程

```
步骤四代码审查阶段：
    │
    ├── java-reviewer / typescript-reviewer 执行通用代码审查
    │
    ├── [full 模式] security-reviewer 执行安全专项审查
    │   └── 按 SEC-001 ~ SEC-006 逐项扫描变更文件
    │
    ├── 主 agent 执行三方库 CVE 检测
    │   └── 检查 pom.xml / package.json 中依赖的已知漏洞
    │
    └── 生成审查报告：
        ├── CRITICAL → 必须修复（阻断流程）
        ├── HIGH → 必须修复
        ├── MEDIUM → 建议修复
        └── LOW → 记录，不强制修复
```

---

## 注意事项

- 本规则文件为 AI 扫描的参考基线，随项目安全策略迭代更新
- 建议结合 CI/CD 流水线集成真实 SAST 工具
- `security/` 目录下的白名单文件（`api-whitelist.yaml`、`component-whitelist.yaml`）如存在，在事中控制阶段优先使用
