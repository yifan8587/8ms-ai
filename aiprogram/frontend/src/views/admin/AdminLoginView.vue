<template>
  <div class="admin-login-wrap">
    <!-- 背景装饰 -->
    <div class="bg-grid" />
    <div class="bg-glow top-left" />
    <div class="bg-glow bottom-right" />

    <div class="login-panel">
      <!-- 左侧品牌区 -->
      <div class="panel-brand">
        <div class="brand-logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="url(#grad)" />
            <path d="M14 24 L24 14 L34 24 L24 34 Z" fill="white" opacity="0.9"/>
            <circle cx="24" cy="24" r="5" fill="white"/>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#6366f1"/>
                <stop offset="100%" stop-color="#8b5cf6"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1 class="brand-title">AI 运营管理平台</h1>
        <p class="brand-sub">Operational Management Console</p>

        <div class="brand-features">
          <div class="feat-item" v-for="f in features" :key="f.text">
            <div class="feat-dot" />
            <span>{{ f.text }}</span>
          </div>
        </div>

        <div class="brand-footer">
          仅限授权管理人员登录 · 操作日志全程记录
        </div>
      </div>

      <!-- 右侧表单区 -->
      <div class="panel-form">
        <div class="form-header">
          <div class="form-badge">ADMIN</div>
          <h2>管理员登录</h2>
          <p>请使用管理员账号登录运营后台</p>
        </div>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          size="large"
          class="login-form"
          @keyup.enter="handleLogin"
        >
          <el-form-item prop="username">
            <el-input
              v-model="form.username"
              placeholder="管理员账号"
              :prefix-icon="UserFilled"
              autocomplete="username"
            />
          </el-form-item>
          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="登录密码"
              :prefix-icon="Lock"
              show-password
              autocomplete="current-password"
            />
          </el-form-item>

          <el-alert
            v-if="errorMsg"
            :title="errorMsg"
            type="error"
            :closable="false"
            show-icon
            style="margin-bottom:16px"
          />

          <el-form-item>
            <el-button
              type="primary"
              :loading="loading"
              class="submit-btn"
              @click="handleLogin"
            >
              <el-icon v-if="!loading" style="margin-right:6px"><Key /></el-icon>
              {{ loading ? '验证中...' : '登录管理后台' }}
            </el-button>
          </el-form-item>
        </el-form>

        <div class="form-footer">
          <router-link to="/login" class="back-link">
            <el-icon><ArrowLeft /></el-icon>
            返回用户登录
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { UserFilled, Lock, Key, ArrowLeft } from '@element-plus/icons-vue'
import { useUserStore } from '../../store/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const formRef = ref()
const loading = ref(false)
const errorMsg = ref('')

const form = reactive({ username: '', password: '' })
const rules = {
  username: [{ required: true, message: '请输入管理员账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

const features = [
  { text: '客户账号全生命周期管理' },
  { text: '充值、计费、账单一体化' },
  { text: 'AI 模型启用 / 禁用控制' },
  { text: '实时用量统计与趋势分析' },
  { text: 'API Token 集中管控' },
]

const handleLogin = async () => {
  errorMsg.value = ''
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  loading.value = true
  try {
    const res = await userStore.login(form)
    const user = res.data?.user

    // 校验是否是管理员
    if (!user?.is_staff) {
      // 清除登录状态，拒绝非管理员
      userStore.logout()
      errorMsg.value = '权限不足：该账号没有管理员权限，请使用管理员账号登录'
      return
    }

    // 登录成功，跳转到目标页或仪表盘
    const redirect = route.query.redirect || '/admin/dashboard'
    router.push(decodeURIComponent(String(redirect)))
  } catch (err) {
    errorMsg.value = err?.response?.data?.msg || err?.message || '登录失败，请检查账号密码'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* ── 整体背景 ── */
.admin-login-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f0f1a;
  position: relative;
  overflow: hidden;
}

.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(99,102,241,0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
}

.bg-glow {
  position: absolute;
  width: 500px;
  height: 500px;
  border-radius: 50%;
  filter: blur(120px);
  pointer-events: none;
  opacity: 0.25;
}
.top-left { top: -200px; left: -200px; background: #6366f1; }
.bottom-right { bottom: -200px; right: -200px; background: #8b5cf6; }

/* ── 登录面板 ── */
.login-panel {
  position: relative;
  z-index: 10;
  display: flex;
  width: 820px;
  min-height: 520px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 32px 80px rgba(0,0,0,0.5);
  backdrop-filter: blur(20px);
}

/* ── 左侧品牌区 ── */
.panel-brand {
  width: 360px;
  flex-shrink: 0;
  background: linear-gradient(160deg, #1e1b4b 0%, #2d1b69 50%, #1a1a2e 100%);
  padding: 48px 36px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(255,255,255,0.06);
}

.brand-logo { margin-bottom: 20px; }

.brand-title {
  font-size: 22px;
  font-weight: 800;
  color: #fff;
  margin: 0 0 6px;
  line-height: 1.3;
}

.brand-sub {
  font-size: 12px;
  color: rgba(255,255,255,0.35);
  letter-spacing: 1.5px;
  text-transform: uppercase;
  margin: 0 0 36px;
}

.brand-features {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.feat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: rgba(255,255,255,0.65);
}

.feat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #6366f1;
  flex-shrink: 0;
  box-shadow: 0 0 6px rgba(99,102,241,0.8);
}

.brand-footer {
  font-size: 11px;
  color: rgba(255,255,255,0.25);
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 16px;
  margin-top: 24px;
  line-height: 1.6;
}

/* ── 右侧表单区 ── */
.panel-form {
  flex: 1;
  padding: 48px 44px;
  display: flex;
  flex-direction: column;
  background: rgba(255,255,255,0.02);
}

.form-header { margin-bottom: 32px; }

.form-badge {
  display: inline-block;
  padding: 3px 10px;
  background: rgba(99,102,241,0.15);
  border: 1px solid rgba(99,102,241,0.4);
  border-radius: 100px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #818cf8;
  margin-bottom: 14px;
}

.form-header h2 {
  font-size: 26px;
  font-weight: 800;
  color: #fff;
  margin: 0 0 6px;
}

.form-header p {
  font-size: 13px;
  color: rgba(255,255,255,0.4);
  margin: 0;
}

/* 输入框深色样式 */
.login-form :deep(.el-input__wrapper) {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: none;
  border-radius: 10px;
  transition: border-color 0.2s;
}

.login-form :deep(.el-input__wrapper:hover) {
  border-color: rgba(99,102,241,0.5);
}

.login-form :deep(.el-input__wrapper.is-focus) {
  border-color: #6366f1;
  background: rgba(99,102,241,0.08);
  box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
}

.login-form :deep(.el-input__inner) {
  color: #fff;
  font-size: 14px;
}

.login-form :deep(.el-input__inner::placeholder) {
  color: rgba(255,255,255,0.3);
}

.login-form :deep(.el-input__prefix-icon) {
  color: rgba(255,255,255,0.35);
}

.login-form :deep(.el-input__suffix-icon) {
  color: rgba(255,255,255,0.35);
}

.login-form :deep(.el-form-item__error) {
  color: #f87171;
}

.submit-btn {
  width: 100%;
  height: 46px;
  font-size: 15px;
  font-weight: 600;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  border-radius: 10px;
  letter-spacing: 0.5px;
  transition: opacity 0.2s, transform 0.1s;
}

.submit-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.submit-btn:active {
  transform: translateY(0);
}

.form-footer {
  margin-top: auto;
  padding-top: 24px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: rgba(255,255,255,0.35);
  text-decoration: none;
  transition: color 0.2s;
}

.back-link:hover {
  color: rgba(255,255,255,0.7);
}

/* 响应式 */
@media (max-width: 700px) {
  .login-panel {
    flex-direction: column;
    width: 92vw;
    min-height: unset;
  }
  .panel-brand {
    width: 100%;
    padding: 32px 28px;
  }
  .panel-form {
    padding: 32px 28px;
  }
  .brand-features { display: none; }
}
</style>
