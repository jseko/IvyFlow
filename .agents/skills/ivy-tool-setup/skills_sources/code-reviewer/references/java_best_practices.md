# Java / Spring Boot Best Practices

项目后端使用 Spring Boot 3 + MyBatis-Plus + MySQL + Redis，以下为最佳实践。

## 项目分层

```
controller/     REST 端点（@RestController）
service/        业务逻辑（@Service）
mapper/         MyBatis-Plus 数据访问（@Mapper，继承 BaseMapper）
entity/         数据库实体（@TableName，@TableField）
dto/            API 请求/响应对象
config/         Spring 配置类
security/       JWT 过滤器和认证组件
exception/      自定义异常和全局处理器
util/           工具类
schedule/       定时任务（@Scheduled）
```

## MyBatis-Plus 使用规范

### Entity 定义
```java
@TableName("sys_user")
public class User {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String username;
    private String password;

    // 非数据库字段
    @TableField(exist = false)
    private List<String> roles;

    // 自动填充
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
```

### Mapper 定义
```java
@Mapper
public interface UserMapper extends BaseMapper<User> {
    // 仅在 BaseMapper 方法不够用时自定义
    @Select("SELECT u.* FROM sys_user u WHERE u.department_id = #{deptId}")
    List<User> findByDepartmentId(@Param("deptId") Long deptId);
}
```

### Service 定义
```java
@Service
@RequiredArgsConstructor
public class UserServiceImpl extends ServiceImpl<UserMapper, User> implements UserService {

    private final PermissionService permissionService;

    // 继承 ServiceImpl 后可直接使用 CRUD 方法
    // getById, insert, updateById, deleteById 等
}
```

## Spring Security + JWT

### JWT 过滤器
```java
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtTokenProvider tokenProvider;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain chain) {
        String token = extractToken(request);
        if (token != null && tokenProvider.validate(token)) {
            Long userId = tokenProvider.getUserId(token);
            String username = tokenProvider.getUsername(token);
            List<String> roles = tokenProvider.getRoles(token);

            var authorities = roles.stream()
                .map(r -> new SimpleGrantedAuthority("ROLE_" + r))
                .collect(Collectors.toList());

            var auth = new UsernamePasswordAuthenticationToken(
                userId, username, authorities);
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        chain.doFilter(request, response);
    }
}
```

### 权限注解（项目自定义）
```java
// 自定义 @RequirePermission 注解替代 @PreAuthorize
@Target({ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface RequirePermission {
    String[] value();  // 权限码数组，任一满足即通过
}
```

## Redis 缓存模式

```java
@RequiredArgsConstructor
public class PermissionService {
    private final StringRedisTemplate redisTemplate;
    private final UserRoleMapper userRoleMapper;
    private final RolePermissionMapper rolePermissionMapper;

    public List<String> getUserPermissions(Long userId) {
        String key = "perm:user:" + userId;
        String cached = redisTemplate.opsForValue().get(key);
        if (cached != null) return deserialize(cached);

        List<String> perms = computePermissions(userId);
        redisTemplate.opsForValue().set(key, serialize(perms), Duration.ofMinutes(5));
        return perms;
    }

    // 权限变更时清除缓存
    public void assignPermissionsToRole(Long roleId, List<Long> permIds) {
        rolePermissionMapper.deleteByMap(Map.of("role_id", roleId));
        // ... insert new mappings
        clearRoleCache(roleId);
    }

    private void clearRoleCache(Long roleId) {
        // 清除该角色关联的所有用户缓存
        List<Long> userIds = userRoleMapper.selectUserIdsByRoleId(roleId);
        userIds.forEach(uid ->
            redisTemplate.delete("perm:user:" + uid));
        redisTemplate.delete("perm:role:" + roleId);
    }
}
```

## 全局异常处理

```java
@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(PermissionDeniedException.class)
    public ApiResponse<Void> handlePermissionDenied(PermissionDeniedException e) {
        return ApiResponse.error(403, "权限不足");
    }

    @ExceptionHandler(BusinessException.class)
    public ApiResponse<Void> handleBusiness(BusinessException e) {
        return ApiResponse.error(e.getCode(), e.getMessage());
    }

    @ExceptionHandler(Exception.class)
    public ApiResponse<Void> handleUnknown(Exception e) {
        log.error("Unexpected error", e);
        return ApiResponse.error(500, "服务器内部错误");
    }
}
```

## 数据脱敏

```java
public class MaskUtil {
    public static String maskPhone(String phone) {
        if (phone == null || phone.length() < 7) return phone;
        return phone.substring(0, 3) + "****" + phone.substring(7);
    }

    public static String maskEmail(String email) {
        if (email == null || !email.contains("@")) return email;
        int at = email.indexOf("@");
        return email.substring(0, 2) + "***" + email.substring(at);
    }

    public static String maskName(String name) {
        if (name == null || name.length() <= 1) return name;
        return name.charAt(0) + "*" + name.substring(name.length() - 1);
    }
}
```