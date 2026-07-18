# Spring Boot API Implementation Patterns

项目后端使用 Spring Boot 3 + MyBatis-Plus，以下为 REST API 实现模式补充。

## 统一响应格式

项目使用 `ApiResponse<T>` 包装所有响应：

```java
public class ApiResponse<T> {
    private int code;      // 200=成功, 400=参数错误, 401=未登录, 403=权限不足, 500=服务器错误
    private String message;
    private T data;

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(200, "success", data);
    }

    public static <T> ApiResponse<T> success(String message, T data) {
        return new ApiResponse<>(200, message, data);
    }

    public static <T> ApiResponse<T> error(int code, String message) {
        return new ApiResponse<>(code, message, null);
    }
}
```

### 成功响应示例
```json
{
  "code": 200,
  "message": "success",
  "data": { "id": 1, "name": "张三", "phone": "138****1234" }
}
```

### 分页响应示例
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "records": [...],
    "total": 100,
    "page": 1,
    "size": 20
  }
}
```

### 错误响应示例
```json
{
  "code": 403,
  "message": "权限不足",
  "data": null
}
```

## Controller 实现模式

### 标准 CRUD Controller
```java
@RestController
@RequestMapping("/customers")
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customerService;
    private final PermissionService permissionService;

    @GetMapping
    @RequirePermission("customer:view")
    public ApiResponse<PageResult<Customer>> queryCustomers(
            Authentication authentication, CustomerQueryRequest request) {
        Long userId = (Long) authentication.getPrincipal();
        // 数据范围过滤
        if (!permissionService.isAdmin(userId) && !permissionService.isManager(userId)) {
            request.setAssignedAgentId(userId);
        }
        return ApiResponse.success(customerService.queryCustomers(request));
    }

    @PostMapping
    @RequirePermission("customer:create")
    public ApiResponse<Customer> createCustomer(
            Authentication authentication, @RequestBody @Valid CustomerDTO dto) {
        Long agentId = (Long) authentication.getPrincipal();
        return ApiResponse.success(customerService.createCustomer(dto, agentId));
    }

    @PutMapping("/{id}")
    @RequirePermission("customer:edit")
    public ApiResponse<Customer> updateCustomer(
            @PathVariable Long id, @RequestBody @Valid CustomerDTO dto) {
        return ApiResponse.success(customerService.updateCustomer(id, dto));
    }

    @DeleteMapping("/{id}")
    @RequirePermission("customer:delete")
    public ApiResponse<Void> deleteCustomer(@PathVariable Long id) {
        customerService.deleteCustomer(id);
        return ApiResponse.success("删除成功", null);
    }
}
```

### 获取当前用户
```java
// 从 SecurityContext 获取 userId（JWT principal）
Long userId = (Long) authentication.getPrincipal();
String username = (String) authentication.getCredentials();
```

## DTO 与参数校验

### 请求 DTO
```java
public class CustomerQueryRequest {
    @NotBlank(message = "关键词不能为空")
    private String keyword;

    private Long assignedAgentId;  // 可选，数据范围过滤

    @Min(1) @Max(100)
    private int page = 1;

    @Min(1) @Max(50)
    private int size = 20;
}
```

### 响应 DTO（脱敏）
```java
public class UserVO {
    private Long id;
    private String username;
    private String nickname;
    private String phone;   // 已脱敏：138****1234
    private String email;   // 已脱敏：zh***@example.com
    private List<String> roles;

    public static UserVO from(User user) {
        UserVO vo = new UserVO();
        vo.setId(user.getId());
        vo.setUsername(user.getUsername());
        vo.setNickname(user.getNickname());
        vo.setPhone(MaskUtil.maskPhone(user.getPhone()));
        vo.setEmail(MaskUtil.maskEmail(user.getEmail()));
        return vo;
    }
}
```

## 分页查询模式

### MyBatis-Plus 分页
```java
@Service
@RequiredArgsConstructor
public class CustomerServiceImpl extends ServiceImpl<CustomerMapper, Customer>
        implements CustomerService {

    public PageResult<Customer> queryCustomers(CustomerQueryRequest request) {
        Page<Customer> page = new Page<>(request.getPage(), request.getSize());
        LambdaQueryWrapper<Customer> wrapper = new LambdaQueryWrapper<>();

        if (request.getKeyword() != null) {
            wrapper.like(Customer::getName, request.getKeyword());
        }
        if (request.getAssignedAgentId() != null) {
            wrapper.eq(Customer::getAssignedAgentId, request.getAssignedAgentId());
        }
        wrapper.orderByDesc(Customer::getCreatedAt);

        Page<Customer> result = baseMapper.selectPage(page, wrapper);
        return new PageResult<>(result.getRecords(), result.getTotal(),
                request.getPage(), request.getSize());
    }
}
```

## 文件上传

```java
@PostMapping("/upload")
@RequirePermission("customer:edit")
public ApiResponse<String> uploadFile(@RequestParam("file") MultipartFile file) {
    // 校验文件大小和类型
    if (file.getSize() > 5 * 1024 * 1024) {
        return ApiResponse.error(400, "文件大小不能超过5MB");
    }
    String allowedTypes = "image/jpeg,image/png,application/pdf";
    if (!allowedTypes.contains(file.getContentType())) {
        return ApiResponse.error(400, "不支持的文件类型");
    }
    String path = fileStorageService.store(file);
    return ApiResponse.success(path);
}
```