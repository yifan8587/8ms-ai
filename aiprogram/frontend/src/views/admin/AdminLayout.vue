<template>
  <el-container class="admin-layout">
    <!-- 顶部导航栏 -->
    <el-header class="admin-header">
      <div class="header-left">
        <el-button
          class="collapse-btn"
          :icon="isCollapse ? Expand : Fold"
          text
          @click="isCollapse = !isCollapse"
        />
        <div class="brand">
          <el-icon :size="22" color="#6366f1"><DataBoard /></el-icon>
          <span v-if="!isCollapse" class="brand-name">AI 运营管理</span>
        </div>
        <!-- 面包屑 -->
        <el-breadcrumb separator="/" class="breadcrumb">
          <el-breadcrumb-item :to="{ path: '/admin/dashboard' }">首页</el-breadcrumb-item>
          <el-breadcrumb-item>{{ currentPageTitle }}</el-breadcrumb-item>
        </el-breadcrumb>
      </div>

      <div class="header-right">
        <div class="clock">{{ currentTime }}</div>
        <el-tooltip content="刷新页面数据" placement="bottom">
          <el-button :icon="Refresh" circle size="small" @click="refreshPage" />
        </el-tooltip>
        <el-divider direction="vertical" />
        <el-dropdown trigger="click" @command="handleCmd">
          <div class="admin-profile">
            <el-avatar :size="32" style="background: linear-gradient(135deg,#6366f1,#8b5cf6); font-size:14px">
              {{ userStore.userInfo?.username?.[0]?.toUpperCase() }}
            </el-avatar>
            <div class="profile-info">
              <span class="uname">{{ userStore.userInfo?.username }}</span>
              <el-tag type="warning" size="small" effect="dark">管理员</el-tag>
            </div>
            <el-icon class="arrow"><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="front" :icon="HomeFilled">返回前台</el-dropdown-item>
              <el-dropdown-item command="logout" :icon="SwitchButton" divided>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-header>

    <el-container class="body-container">
      <!-- 侧边栏 -->
      <el-aside :width="isCollapse ? '64px' : '220px'" class="admin-aside">
        <el-menu
          :default-active="activeMenu"
          :collapse="isCollapse"
          :collapse-transition="false"
          router
          class="side-menu"
        >
          <el-menu-item index="/admin/dashboard">
            <el-icon><DataBoard /></el-icon>
            <template #title>仪表盘</template>
          </el-menu-item>

          <el-menu-item index="/admin/customers">
            <el-icon><UserFilled /></el-icon>
            <template #title>客户管理</template>
          </el-menu-item>

          <el-menu-item index="/admin/billing">
            <el-icon><CreditCard /></el-icon>
            <template #title>计费记账</template>
          </el-menu-item>

          <el-menu-item index="/admin/plans">
            <el-icon><Ticket /></el-icon>
            <template #title>套餐管理</template>
          </el-menu-item>

          <el-menu-item index="/admin/models">
            <el-icon><Connection /></el-icon>
            <template #title>模型管理</template>
          </el-menu-item>

          <el-menu-item index="/admin/tokens">
            <el-icon><Key /></el-icon>
            <template #title>Token 管理</template>
          </el-menu-item>

          <el-menu-item index="/admin/stats">
            <el-icon><TrendCharts /></el-icon>
            <template #title>用量统计</template>
          </el-menu-item>

          <el-divider style="margin:8px 12px;border-color:rgba(255,255,255,0.08)" />

          <el-menu-item index="/admin/backends">
            <el-icon><Cpu /></el-icon>
            <template #title>API 后端</template>
          </el-menu-item>

          <el-menu-item index="/admin/routing">
            <el-icon><Guide /></el-icon>
            <template #title>路由规则</template>
          </el-menu-item>

          <el-menu-item index="/admin/gateway-stats">
            <el-icon><Monitor /></el-icon>
            <template #title>网关监控</template>
          </el-menu-item>

          <el-divider style="margin:8px 12px;border-color:rgba(255,255,255,0.08)" />

          <el-menu-item index="/admin/knowledge">
            <el-icon><Reading /></el-icon>
            <template #title>知识库</template>
          </el-menu-item>
        </el-menu>

        <!-- 底部版本信息 -->
        <div v-if="!isCollapse" class="aside-footer">
          <span>AI Platform v1.0</span>
        </div>
      </el-aside>

      <!-- 主内容区 -->
      <el-main class="admin-main">
        <router-view v-slot="{ Component }">
          <transition name="fade-slide" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  DataBoard, UserFilled, CreditCard, Key, TrendCharts,
  Refresh, Expand, Fold, ArrowDown, HomeFilled, SwitchButton, Connection,
  Cpu, Guide, Monitor, Ticket, Reading
} from '@element-plus/icons-vue'
import { useUserStore } from '../../store/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const isCollapse = ref(false)
const currentTime = ref('')

const PAGE_TITLES = {
  '/admin/dashboard': '仪表盘',
  '/admin/customers': '客户管理',
  '/admin/billing': '计费记账',
  '/admin/models': '模型管理',
  '/admin/tokens': 'Token 管理',
  '/admin/stats': '用量统计',
  '/admin/plans': '套餐管理',
  '/admin/backends': 'API 后端',
  '/admin/routing': '路由规则',
  '/admin/gateway-stats': '网关监控',
  '/admin/knowledge': '知识库',
}
const activeMenu = computed(() => route.path)
const currentPageTitle = computed(() => PAGE_TITLES[route.path] || '管理')

let clockTimer = null
const updateClock = () => {
  currentTime.value = new Date().toLocaleString('zh-CN', { hour12: false })
}
onMounted(() => {
  updateClock()
  clockTimer = setInterval(updateClock, 1000)
})
onBeforeUnmount(() => clearInterval(clockTimer))

const refreshPage = () => router.go(0)

const handleCmd = (cmd) => {
  if (cmd === 'front') router.push('/')
  if (cmd === 'logout') {
    userStore.logout()
    router.push('/admin/login')
  }
}
</script>

<style scoped>
.admin-layout {
  height: 100vh;
  overflow: hidden;
  background: #f0f2f5;
}

.admin-header {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 0 0;
  height: 56px;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  z-index: 200;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.collapse-btn {
  font-size: 18px;
  color: #595959;
  padding: 0 16px;
  height: 56px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 40px;
}

.brand-name {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a2e;
  white-space: nowrap;
}

.breadcrumb {
  margin-left: 8px;
}

:deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
  color: #6366f1;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.clock {
  font-size: 13px;
  color: #888;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.admin-profile {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
  transition: background 0.2s;
}

.admin-profile:hover {
  background: #f5f5f5;
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.uname {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  line-height: 1;
}

.arrow {
  color: #888;
  font-size: 12px;
}

/* 侧边栏 */
.body-container {
  height: calc(100vh - 56px);
  overflow: hidden;
}

.admin-aside {
  background: #001529;
  transition: width 0.3s;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.side-menu {
  border-right: none;
  background: transparent;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

:deep(.el-menu--collapse) {
  width: 64px;
}

:deep(.side-menu .el-menu-item) {
  color: rgba(255, 255, 255, 0.65);
  height: 48px;
  line-height: 48px;
  margin: 2px 4px;
  border-radius: 6px;
  font-size: 14px;
}

:deep(.side-menu .el-menu-item:hover) {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

:deep(.side-menu .el-menu-item.is-active) {
  background: #6366f1;
  color: #fff;
}

:deep(.side-menu .el-menu-item.is-active .el-icon) {
  color: #fff;
}

:deep(.side-menu .el-menu-item .el-icon) {
  color: rgba(255, 255, 255, 0.65);
}

.aside-footer {
  padding: 12px 20px;
  color: rgba(255, 255, 255, 0.3);
  font-size: 11px;
  text-align: center;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

/* 主内容区 */
.admin-main {
  overflow-y: auto;
  padding: 20px;
  background: #f0f2f5;
}

/* 页面切换动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
