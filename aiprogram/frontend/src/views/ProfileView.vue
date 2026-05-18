<template>
  <div class="profile-container">
    <div class="profile-card">
      <div class="profile-header">
        <el-avatar :size="80" :src="form.avatar || undefined" style="background: linear-gradient(135deg, #6366f1, #8b5cf6); font-size: 28px;">
          {{ form.nickname?.[0] || form.username?.[0] }}
        </el-avatar>
        <h2>{{ form.nickname || form.username }}</h2>
        <el-tag v-if="userStore.userInfo?.is_vip" type="warning">VIP 会员</el-tag>
        <el-tag v-else type="info">普通用户</el-tag>
      </div>

      <el-divider />

      <el-form :model="form" label-width="80px" size="large">
        <el-form-item label="用户名">
          <el-input :value="form.username" disabled />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="form.nickname" placeholder="设置昵称" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" placeholder="设置邮箱" />
        </el-form-item>
        <el-form-item label="头像URL">
          <el-input v-model="form.avatar" placeholder="头像图片链接" />
        </el-form-item>
        <el-form-item label="积分">
          <el-input :value="userStore.userInfo?.credits" disabled />
        </el-form-item>
        <el-form-item label="注册时间">
          <el-input :value="formatDate(userStore.userInfo?.created_at)" disabled />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="saveProfile" style="background: linear-gradient(135deg, #6366f1, #8b5cf6); border: none;">
            保存修改
          </el-button>
        </el-form-item>
      </el-form>

      <el-divider />
      <el-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" label-width="80px" size="large">
        <el-form-item label="旧密码" prop="old_password">
          <el-input v-model="pwdForm.old_password" type="password" show-password autocomplete="current-password" />
        </el-form-item>
        <el-form-item label="新密码" prop="new_password">
          <el-input v-model="pwdForm.new_password" type="password" show-password autocomplete="new-password" />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirm_password">
          <el-input v-model="pwdForm.confirm_password" type="password" show-password autocomplete="new-password" />
        </el-form-item>
        <el-form-item>
          <el-button type="danger" :loading="changingPassword" @click="submitPasswordChange">修改密码</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../store/user'
import { updateProfile, changePassword } from '../api/user'

const userStore = useUserStore()
const saving = ref(false)
const changingPassword = ref(false)
const pwdFormRef = ref(null)

const form = reactive({
  username: '',
  nickname: '',
  email: '',
  avatar: '',
})
const pwdForm = reactive({
  old_password: '',
  new_password: '',
  confirm_password: '',
})
const pwdRules = {
  old_password: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  new_password: [{ required: true, message: '请输入新密码', trigger: 'blur' }, { min: 6, message: '密码至少6位', trigger: 'blur' }],
  confirm_password: [{ required: true, message: '请确认新密码', trigger: 'blur' }],
}

const loadProfile = async () => {
  await userStore.fetchProfile()
  const info = userStore.userInfo
  form.username = info.username
  form.nickname = info.nickname || ''
  form.email = info.email || ''
  form.avatar = info.avatar || ''
}

const saveProfile = async () => {
  saving.value = true
  try {
    const res = await updateProfile({
      nickname: form.nickname,
      email: form.email,
      avatar: form.avatar,
    })
    userStore.setUserInfo(res)
    ElMessage.success('保存成功')
  } finally {
    saving.value = false
  }
}

const formatDate = (d) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('zh-CN')
}

const submitPasswordChange = async () => {
  if (!pwdFormRef.value) return
  await pwdFormRef.value.validate(async (ok) => {
    if (!ok) return
    if (pwdForm.new_password !== pwdForm.confirm_password) {
      ElMessage.warning('两次输入的新密码不一致')
      return
    }
    changingPassword.value = true
    try {
      const res = await changePassword({
        old_password: pwdForm.old_password,
        new_password: pwdForm.new_password,
      })
      ElMessage.success(res.msg || '密码修改成功，请重新登录')
      pwdForm.old_password = ''
      pwdForm.new_password = ''
      pwdForm.confirm_password = ''
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user_info')
      // 带上 vite 构建时的 BASE_URL（部署在 /console/ 时会自动加前缀）
      const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '/')
      window.location.href = `${base}login`
    } finally {
      changingPassword.value = false
    }
  })
}

onMounted(loadProfile)
</script>

<style scoped>
.profile-container {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 40px 24px;
  min-height: 100vh;
  background: #f8f9ff;
}

.profile-card {
  background: #fff;
  border-radius: 16px;
  padding: 40px;
  width: 100%;
  max-width: 560px;
  box-shadow: 0 4px 24px rgba(99, 102, 241, 0.08);
}

.profile-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.profile-header h2 {
  font-size: 22px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0;
}
</style>
