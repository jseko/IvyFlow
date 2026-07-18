# Common Antipatterns

项目常见反模式清单，覆盖 Java 和 Vue 3 双栈。

## Java 反模式

### ❌ Controller 包含业务逻辑
```java
// BAD: Controller 直接操作数据库
@RestController
public class BadController {
    @Autowired
    private UserMapper userMapper;

    @PostMapping("/users")
    public ApiResponse<User> create(@RequestBody User user) {
        userMapper.insert(user);  // 业务逻辑应在 Service 层
        return ApiResponse.success(user);
    }
}
```
```java
// GOOD: Controller 仅做参数接收和调用 Service
@RestController
@RequiredArgsConstructor
public class GoodController {
    private final UserService userService;

    @PostMapping("/users")
    public ApiResponse<User> create(@RequestBody @Valid UserDTO dto) {
        return ApiResponse.success(userService.createUser(dto));
    }
}
```

### ❌ 直接暴露 Entity 到 API
```java
// BAD: 返回数据库 Entity（可能包含敏感字段）
@GetMapping("/{id}")
public ApiResponse<User> getUser(@PathVariable Long id) {
    return ApiResponse.success(userMapper.selectById(id));
    // User 包含 password、phoneHash 等敏感字段
}
```
```java
// GOOD: 使用 DTO 过滤字段，脱敏处理
@GetMapping("/{id}")
public ApiResponse<UserVO> getUser(@PathVariable Long id) {
    User user = userService.findById(id);
    UserVO vo = UserVO.from(user);
    vo.setPhone(MaskUtil.maskPhone(user.getPhone()));
    return ApiResponse.success(vo);
}
```

### ❌ @Autowired 字段注入
```java
// BAD: 字段注入，无法保证不可变性
@Autowired
private UserService userService;
@Autowired
private PermissionService permissionService;
```
```java
// GOOD: 构造器注入，保证不可变性和可测试性
@RequiredArgsConstructor
public class GoodController {
    private final UserService userService;
    private final PermissionService permissionService;
}
```

### ❌ 粗粒度权限控制
```java
// BAD: 仅检查 ADMIN 角色，无法做细粒度控制
@PreAuthorize("hasRole('ADMIN')")
public ApiResponse<Void> deleteUser(@PathVariable Long id) { ... }
```
```java
// GOOD: 使用权限码做细粒度控制
@RequirePermission("user:delete")
public ApiResponse<Void> deleteUser(@PathVariable Long id) { ... }
```

### ❌ 内存缓存替代分布式缓存
```java
// BAD: ConcurrentHashMap 缓存，多实例不一致
private final Map<Long, List<String>> cache = new ConcurrentHashMap<>();
```
```java
// GOOD: Redis 缓存，支持分布式一致性
@RequiredArgsConstructor
public class GoodService {
    private final StringRedisTemplate redisTemplate;

    public List<String> getPermissions(Long userId) {
        String key = "perm:user:" + userId;
        String cached = redisTemplate.opsForValue().get(key);
        if (cached != null) return parseList(cached);
        List<String> perms = loadFromDb(userId);
        redisTemplate.opsForValue().set(key, serialize(perms), Duration.ofMinutes(5));
        return perms;
    }
}
```

## Vue 3 反模式

### ❌ Options API 混用
```vue
<!-- BAD: Options API -->
<script>
export default {
    data() { return { count: 0 } },
    methods: { increment() { this.count++ } }
}
</script>
```
```vue
<!-- GOOD: Composition API -->
<script setup>
import { ref } from 'vue'
const count = ref(0)
function increment() { count.value++ }
</script>
```

### ❌ 手动 import Element Plus 组件
```vue
<!-- BAD -->
<script setup>
import { ElButton, ElTable } from 'element-plus'
</script>
```
```vue
<!-- GOOD: auto-import 自动注册，无需手动 import -->
<script setup>
// ElButton、ElTable 直接在 template 中使用
</script>
```

### ❌ Store 中调用 ElMessage
```js
// BAD: Store 直接操作 UI
export const useUserStore = defineStore('user', () => {
    async function login() {
        ElMessage.success('登录成功')  // UI 反馈应在组件层
    }
})
```
```js
// GOOD: Store 只管状态，UI 反馈在组件层
export const useUserStore = defineStore('user', () => {
    async function login() {
        const data = await loginApi(form)
        token.value = data.token
        return data  // 组件层处理 UI 反馈
    }
})
```

### ❌ 硬编码颜色值
```vue
<!-- BAD -->
<style scoped>
.header { background: #2c3e50; color: #bfcbd9; }
</style>
```
```vue
<!-- GOOD: 使用 CSS 变量，支持主题切换 -->
<style scoped>
.header { background: var(--el-bg-color-overlay); color: var(--el-text-color-regular); }
</style>
```

### ❌ API 层自行创建 axios 实例
```js
// BAD: 绕过 interceptor，无 JWT 注入和错误处理
import axios from 'axios'
const myAxios = axios.create({ baseURL: '/api' })
```
```js
// GOOD: 使用项目统一的 request 实例
import request from '@/utils/request'
export function getUsers() { return request.get('/users') }
```