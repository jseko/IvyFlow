# Spring Boot Security Checklist

项目使用 Spring Security + JWT + MyBatis-Plus，以下为安全检查清单。

## 认证安全

### JWT Token 安全
- [ ] Token 使用强签名密钥（至少 256 位，从环境变量读取，不硬编码）
- [ ] Token 设置合理过期时间（项目：24h 访问令牌，7d 刷新令牌）
- [ ] Token 存储在 Redis 中支持主动失效（logout 时删除）
- [ ] Token 不包含敏感数据（仅存 userId、username、roles）
- [ ] 刷新令牌与访问令牌分离，刷新令牌有更长过期但可撤销

```java
// GOOD: JWT 生成
public String generateToken(Long userId, String username, List<String> roles) {
    return Jwts.builder()
        .subject(String.valueOf(userId))
        .claim("username", username)
        .claim("roles", roles)
        .issuedAt(new Date())
        .expiration(new Date(System.currentTimeMillis() + 86400000))
        .signWith(secretKey)  // 密钥从配置读取
        .compact();
}
```

### 密码安全
- [ ] 密码使用 BCrypt 哈希（cost factor >= 10）
- [ ] 禁止存储明文密码
- [ ] 密码修改需验证旧密码
- [ ] 登录失败不提示"密码错误"（统一提示"账号或密码错误"）

```java
// GOOD: BCrypt 哈希
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);  // cost factor 12
}
```

## 授权安全

### 权限校验
- [ ] 所有受保护接口添加权限注解（`@RequirePermission`）
- [ ] ADMIN 角色自动拥有所有权限
- [ ] 数据范围过滤（getManagedAgentIds）确保用户只能访问授权数据
- [ ] 权限变更后缓存立即失效

```java
// GOOD: 细粒度权限 + 数据范围
@GetMapping("/customers")
@RequirePermission("customer:view")
public ApiResponse<PageResult<Customer>> query(
        Authentication auth, CustomerQueryRequest req) {
    Long userId = (Long) auth.getPrincipal();
    if (!permissionService.isAdmin(userId) && !permissionService.isManager(userId)) {
        req.setAssignedAgentId(userId);  // 数据范围过滤
    }
    return ApiResponse.success(customerService.queryCustomers(req));
}
```

### 禁止的模式
- [ ] ❌ 仅用 `hasRole('ADMIN')` 做粗粒度保护
- [ ] ❌ 接口无任何权限检查
- [ ] ❌ 前端权限码校验但后端不校验（前端校验仅为 UI 优化，不能替代后端）

## 输入校验

### 参数校验
- [ ] 所有请求 DTO 使用 Bean Validation（`@NotBlank`、`@Size`、`@Email` 等）
- [ ] Controller 方法参数加 `@Valid` / `@Validated`
- [ ] 文件上传校验大小和类型
- [ ] 数字参数校验范围（`@Min`、`@Max`）

```java
// GOOD: DTO 校验
public class CreateUserDTO {
    @NotBlank(message = "用户名不能为空")
    @Size(min = 3, max = 50, message = "用户名长度3-50")
    private String username;

    @NotBlank(message = "密码不能为空")
    @Size(min = 8, max = 100, message = "密码长度8-100")
    private String password;

    @Email(message = "邮箱格式不正确")
    private String email;
}
```

### SQL 注入防护
- [ ] MyBatis-Plus 查询使用 `LambdaQueryWrapper`（类型安全）
- [ ] 自定义 SQL 使用 `@Select` + `#{param}` 参数化（禁止 `${param}` 拼接）
- [ ] 禁止字符串拼接 SQL

```java
// GOOD: LambdaQueryWrapper（类型安全）
LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();
wrapper.eq(User::getUsername, username);  // 自动参数化

// GOOD: @Select 参数化
@Select("SELECT * FROM sys_user WHERE username = #{username}")
User findByUsername(@Param("username") String username);

// BAD: 字符串拼接（SQL 注入风险）
String sql = "SELECT * FROM sys_user WHERE username = '" + username + "'";
```

## XSS / CSRF 防护

### XSS 防护
- [ ] 输入过滤：`InputSanitizationFilter` 过滤 SQL 注入、XSS、路径遍历
- [ ] 输出脱敏：`MaskUtil` 对手机号、邮箱、姓名做脱敏展示
- [ ] 响应头：CSP、X-XSS-Protection 等安全头（`SecurityHeaderFilter`）

### CSRF 防护
- [ ] 无状态 JWT API 不需要 CSRF Token（项目已禁用 CSRF）
- [ ] Cookie 使用 `SameSite=Strict`（如使用 Cookie 存储 Token）

## 速率限制

- [ ] `RateLimitFilter` 已配置：60 RPM 默认，10 RPM 登录/注册，100 RPM 外部 API
- [ ] 登录接口有更严格的限制（防止暴力破解）
- [ ] 速率限制基于 IP（需注意 X-Forwarded-For 信任问题）

## CORS 配置

```java
// GOOD: 限制特定来源
@Bean
public CorsFilter corsFilter() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of("http://localhost:5173"));  // 仅允许前端来源
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));
    config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
    config.setAllowCredentials(true);
    // ❌ 禁止 config.setAllowedOrigins(List.of("*")) + allowCredentials(true)
    return new CorsFilter(new UrlBasedCorsConfigurationSource());
}
```

## 日志安全

- [ ] 禁止在日志中输出密码、Token、手机号明文
- [ ] 异常日志不包含堆栈信息对外暴露（全局异常处理器返回通用消息）
- [ ] 使用 SLF4J，禁止 `System.out.println`

## 依赖安全

- [ ] 定期运行 `mvn dependency-check:check` 检查已知漏洞
- [ ] JWT 库版本保持更新（项目使用 jjwt 0.12.6）
- [ ] Spring Boot 版本保持更新（项目使用 3.5.0）