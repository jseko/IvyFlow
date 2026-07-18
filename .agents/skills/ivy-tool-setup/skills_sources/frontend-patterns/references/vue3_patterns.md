# Vue 3 + Element Plus + Pinia Patterns

项目前端使用 Vue 3 Composition API + Element Plus + Pinia，以下为核心模式。

## 组件模式

### Composition API / `<script setup>`
```vue
<template>
  <el-table :data="customers" stripe>
    <el-table-column prop="name" label="姓名" />
    <el-table-column prop="phone" label="电话" />
  </el-table>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getCustomers } from '@/api/customer'

const customers = ref([])

onMounted(async () => {
  const res = await getCustomers()
  customers.value = res.data.records
})
</script>
```

### Props + Emits 模式
```vue
<script setup>
const props = defineProps({
  visible: { type: Boolean, required: true },
  customerId: { type: Number, default: null }
})

const emit = defineEmits(['update:visible', 'saved'])

function handleClose() {
  emit('update:visible', false)
}

function handleSaved(data) {
  emit('saved', data)
  handleClose()
}
</script>
```

## Pinia Store 模式

### Composition API Store
```js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getMyPermissions } from '@/api/permission'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userInfo = ref(null)
  const permissions = ref(null)

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => permissions.value?.isAdmin || false)

  async function fetchPermissions() {
    const res = await getMyPermissions()
    permissions.value = res.data
    localStorage.setItem('permissions', JSON.stringify(res.data))
  }

  function hasPermission(code) {
    if (isAdmin.value) return true
    return permissions.value?.permissions?.includes(code) || false
  }

  return { token, userInfo, permissions, isLoggedIn, isAdmin, fetchPermissions, hasPermission }
})
```

## 权限指令

### v-permission 按钮级权限
```vue
<template>
  <el-button v-permission="['customer:create']" type="primary" @click="handleCreate">
    新增客户
  </el-button>
  <el-button v-permission="'customer:delete'" type="danger" @click="handleDelete">
    删除
  </el-button>
</template>
```

```js
// directives/permission.js
export const permissionDirective = {
  mounted(el, binding) {
    const userStore = useUserStore()
    const value = binding.value
    let has = false
    if (Array.isArray(value)) {
      has = userStore.hasAnyPermission(value)
    } else {
      has = userStore.hasPermission(value)
    }
    if (!has) el.parentNode?.removeChild(el)
  }
}
```

## Element Plus 集成

### 表格 + 分页
```vue
<template>
  <el-table :data="pageData.records" stripe>
    <el-table-column prop="name" label="姓名" />
    <el-table-column label="操作" width="150">
      <template #default="{ row }">
        <el-button type="primary" size="small" text @click="handleEdit(row)">编辑</el-button>
      </template>
    </el-table-column>
  </el-table>
  <el-pagination
    v-model:current-page="pageData.page"
    v-model:page-size="pageData.size"
    :total="pageData.total"
    @current-change="fetchData"
  />
</template>
```

### 表单 + 校验
```vue
<script setup>
import { ref, reactive } from 'vue'

const formRef = ref()
const form = reactive({ name: '', phone: '', email: '' })

const rules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  phone: [{ required: true, message: '请输入电话', trigger: 'blur' }],
  email: [{ type: 'email', message: '邮箱格式不正确', trigger: 'blur' }]
}

async function handleSubmit() {
  await formRef.value.validate()
  // 提交逻辑
}
</script>
```

### Dialog 模式
```vue
<template>
  <el-dialog v-model="dialogVisible" title="编辑客户" width="500px">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
      <el-form-item label="姓名" prop="name">
        <el-input v-model="form.name" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="submitting">确认</el-button>
    </template>
  </el-dialog>
</template>
```

## WebSocket 集成

```js
// utils/websocket.js
export class WebSocketClient {
  constructor(url, token) {
    this.url = `${url}?token=${token}`
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
  }

  connect() {
    this.ws = new WebSocket(this.url)
    this.ws.onmessage = (event) => this.onMessage(JSON.parse(event.data))
    this.ws.onclose = () => this.reconnect()
    this.ws.onerror = () => this.reconnect()
  }

  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return
    this.reconnectAttempts++
    setTimeout(() => this.connect(), 3000)
  }

  send(data) {
    this.ws?.send(JSON.stringify(data))
  }

  disconnect() {
    this.ws?.close()
    this.reconnectAttempts = this.maxReconnectAttempts
  }
}
```