<template>
  <div class="auth-container">
    <div class="auth-card">
      <div class="auth-logo">
        <el-icon :size="48" color="#6366f1"><ChatDotRound /></el-icon>
        <h1>AI 智枢</h1>
        <p>智能枢纽，探索无限可能</p>
      </div>
      <el-form ref="formRef" :model="form" :rules="rules" size="large" @keyup.enter="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" :prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" :prefix-icon="Lock" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" class="submit-btn" @click="handleLogin">
            登 录
          </el-button>
        </el-form-item>
      </el-form>
      <div class="auth-footer">
        还没有账号？<router-link to="/register">立即注册</router-link>
      </div>
      <div class="admin-entry">
        <router-link to="/admin/login">管理员登录入口 →</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock, ChatDotRound } from '@element-plus/icons-vue'
import { useUserStore } from '../store/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const formRef = ref()
const loading = ref(false)

const form = reactive({ username: '', password: '' })

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

const handleLogin = async () => {
  await formRef.value.validate()
  loading.value = true
  try {
    await userStore.login(form)
    ElMessage.success('登录成功')
    // 支持 redirect 参数回跳（但不允许跳转到 /admin 路径）
    const redirect = route.query.redirect
    if (redirect && !String(redirect).startsWith('/admin')) {
      router.push(decodeURIComponent(String(redirect)))
    } else {
      router.push('/chat')
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.auth-card {
  background: #fff;
  border-radius: 16px;
  padding: 48px 40px;
  width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.auth-logo {
  text-align: center;
  margin-bottom: 32px;
}

.auth-logo h1 {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 8px 0 4px;
}

.auth-logo p {
  color: #888;
  font-size: 14px;
}

.submit-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
}

.auth-footer {
  text-align: center;
  color: #888;
  font-size: 14px;
  margin-top: 16px;
}

.auth-footer a {
  color: #6366f1;
  text-decoration: none;
  font-weight: 600;
}

.admin-entry {
  text-align: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.admin-entry a {
  font-size: 12px;
  color: #bbb;
  text-decoration: none;
  transition: color 0.2s;
}

.admin-entry a:hover {
  color: #6366f1;
}
</style>
