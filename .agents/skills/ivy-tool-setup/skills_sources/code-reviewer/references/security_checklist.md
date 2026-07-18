# Security Checklist

## 认证与授权

- [ ] 所有受保护接口是否有权限注解（@PreAuthorize 或 @RequirePermission）
- [ ] JWT token 是否有过期时间且 TTL 合理（建议 access token 2h，refresh token 7d）
- [ ] 密码是否使用 BCrypt 加密存储
- [ ] 是否存在未保护的敏感接口（直接访问无需认证）
- [ ] 权限码是否在后端校验（不仅前端隐藏按钮）
- [ ] ADMIN 角色是否有独立的权限放行逻辑

## 输入校验

- [ ] 所有 API 入参是否有 @Valid / @NotNull / @Size 校验
- [ ] 是否存在 SQL 拼接（应使用 MyBatis-Plus QueryWrapper）
- [ ] 文件上传是否校验类型和大小
- [ ] 是否存在 XSS 风险（用户输入未转义直接渲染）
- [ ] 路径参数是否防止路径遍历

## 数据安全

- [ ] 敏感数据是否加密存储（密码、密钥、token）
- [ ] 日志中是否脱敏处理（不记录密码、token、身份证号等）
- [ ] API 响应是否泄露不必要的内部信息（堆栈信息、SQL、服务器版本）
- [ ] 是否存在硬编码的密钥/密码/连接字符串
- [ ] DTO 是否过滤了不应返回的字段（如密码 hash）

## 通信安全

- [ ] 生产环境是否强制 HTTPS
- [ ] CORS 配置是否限制为已知域名（禁止 *）
- [ ] Cookie 是否设置 HttpOnly / Secure / SameSite
- [ ] WebSocket 是否有认证机制（JWT handshake）

## 会话管理

- [ ] Token 失效后是否能正确清理前端状态
- [ ] 401 响应是否能正确触发登出和跳转
- [ ] 是否有并发会话控制（同一账号多地登录）
- [ ] 登出是否使服务端 token 失效（黑名单或短 TTL）

## Spring Security 专项

- [ ] SecurityFilterChain 是否配置正确（公开路径 vs 受保护路径）
- [ ] JwtAuthenticationFilter 过滤器顺序是否正确
- [ ] 是否禁用了不安全的 HTTP 方法（TRACE、DELETE 等）
- [ ] CSRF 保护是否合理配置（API 无状态可禁用，表单提交需启用）
- [ ] 是否有速率限制防止暴力破解