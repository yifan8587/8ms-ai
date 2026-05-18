<template>
  <el-container class="layout">
    <!-- 侧边栏 -->
    <el-aside width="260px" class="sidebar">
      <div class="sidebar-header">
        <el-icon :size="28" color="#6366f1"><ChatDotRound /></el-icon>
        <span class="logo-text">AI 智枢</span>
      </div>

      <div class="new-chat-btn">
        <el-button type="primary" :icon="Plus" @click="newChat" class="w-full">
          新建对话
        </el-button>
      </div>

      <div class="conv-list">
        <div class="conv-list-title">历史对话</div>
        <el-scrollbar height="calc(100vh - 280px)">
          <div
            v-for="conv in conversations"
            :key="conv.id"
            class="conv-item"
            :class="{ active: currentConvId === conv.id }"
            @click="selectConversation(conv.id)"
          >
            <el-icon class="conv-icon"><ChatLineRound /></el-icon>
            <span class="conv-title">{{ conv.title }}</span>
            <el-button
              class="conv-del"
              :icon="Delete"
              size="small"
              type="danger"
              text
              @click.stop="deleteConv(conv.id)"
            />
          </div>
        </el-scrollbar>
      </div>

      <div class="sidebar-footer">
        <el-dropdown trigger="click" @command="handleCommand">
          <div class="user-info">
            <el-avatar :size="36" :src="userStore.userInfo?.avatar || undefined">
              {{ userStore.userInfo?.nickname?.[0] || userStore.userInfo?.username?.[0] }}
            </el-avatar>
            <div class="user-detail">
              <div class="user-name">{{ userStore.userInfo?.nickname || userStore.userInfo?.username }}</div>
              <div class="user-sub">{{ userStore.userInfo?.is_vip ? 'VIP会员' : '普通用户' }}</div>
            </div>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">个人设置</el-dropdown-item>
              <el-dropdown-item command="tokens">API Token</el-dropdown-item>
              <el-dropdown-item command="billing">账单&用量</el-dropdown-item>
              <el-dropdown-item v-if="userStore.userInfo?.is_staff" command="admin" divided>
                🛠 运营管理后台
              </el-dropdown-item>
              <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-aside>

    <!-- 主内容区 -->
    <el-main class="main-content">
      <router-view :key="currentConvId" @conversation-created="loadConversations" />
    </el-main>
  </el-container>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { Plus, Delete, ChatDotRound, ChatLineRound } from '@element-plus/icons-vue'
import { useUserStore } from '../store/user'
import { getConversations, deleteConversation } from '../api/chat'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const conversations = ref([])
const currentConvId = ref(route.params.id ? Number(route.params.id) : null)

const loadConversations = async () => {
  const res = await getConversations()
  conversations.value = res.results || res
}

const newChat = () => {
  currentConvId.value = null
  router.push('/chat')
}

const selectConversation = (id) => {
  currentConvId.value = id
  router.push(`/chat/${id}`)
}

const deleteConv = async (id) => {
  await ElMessageBox.confirm('确定删除该对话？', '提示', { type: 'warning' })
  await deleteConversation(id)
  ElMessage.success('已删除')
  if (currentConvId.value === id) {
    currentConvId.value = null
    router.push('/chat')
  }
  await loadConversations()
}

const handleCommand = (cmd) => {
  if (cmd === 'profile') router.push('/profile')
  if (cmd === 'tokens') router.push('/my-tokens')
  if (cmd === 'billing') router.push('/my-billing')
  if (cmd === 'admin') router.push('/admin')
  if (cmd === 'logout') {
    userStore.logout()
    router.push('/login')
  }
}

watch(() => route.params.id, (id) => {
  currentConvId.value = id ? Number(id) : null
})

onMounted(loadConversations)
</script>

<style scoped>
.layout {
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  background: #1a1a2e;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #2d2d4e;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 16px;
  border-bottom: 1px solid #2d2d4e;
}

.logo-text {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}

.new-chat-btn {
  padding: 12px 16px;
}

.new-chat-btn .el-button {
  width: 100%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
}

.conv-list {
  flex: 1;
  padding: 0 8px;
  overflow: hidden;
}

.conv-list-title {
  font-size: 12px;
  color: #666;
  padding: 8px 8px 4px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.conv-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 8px;
  border-radius: 8px;
  cursor: pointer;
  color: #aaa;
  transition: all 0.2s;
  position: relative;
}

.conv-item:hover {
  background: #2d2d4e;
  color: #fff;
}

.conv-item.active {
  background: #2d2d4e;
  color: #fff;
}

.conv-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.conv-del {
  opacity: 0;
  transition: opacity 0.2s;
}

.conv-item:hover .conv-del {
  opacity: 1;
}

.conv-icon {
  flex-shrink: 0;
  color: #6366f1;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid #2d2d4e;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: background 0.2s;
}

.user-info:hover {
  background: #2d2d4e;
}

.user-name {
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.user-sub {
  color: #888;
  font-size: 12px;
}

.main-content {
  padding: 0;
  background: #f8f9ff;
}
</style>
