import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  // ── 用户端公开页 ────────────────────────────────
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true, guestOnly: true },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/RegisterView.vue'),
    meta: { public: true, guestOnly: true },
  },

  // ── 管理员专属登录页 ─────────────────────────────
  {
    path: '/admin/login',
    name: 'AdminLogin',
    component: () => import('../views/admin/AdminLoginView.vue'),
    meta: { public: true, adminLoginPage: true },
  },
  {
    path: '/docs',
    name: 'Docs',
    component: () => import('../views/DocView.vue'),
    meta: { public: true },
  },

  // ── 用户端主布局 ─────────────────────────────────
  {
    path: '/',
    name: 'Layout',
    component: () => import('../views/LayoutView.vue'),
    meta: { requireAuth: true },
    children: [
      { path: '', redirect: '/chat' },
      { path: 'chat', name: 'Chat', component: () => import('../views/ChatView.vue') },
      { path: 'chat/:id', name: 'ChatDetail', component: () => import('../views/ChatView.vue') },
      { path: 'profile', name: 'Profile', component: () => import('../views/ProfileView.vue') },
      { path: 'my-tokens', name: 'MyTokens', component: () => import('../views/MyTokensView.vue') },
      { path: 'my-billing', name: 'MyBilling', component: () => import('../views/MyBillingView.vue') },
    ],
  },

  // ── 管理员后台布局 ───────────────────────────────
  {
    path: '/admin',
    name: 'AdminLayout',
    component: () => import('../views/admin/AdminLayout.vue'),
    meta: { requireAuth: true, adminOnly: true },
    children: [
      { path: '', redirect: '/admin/dashboard' },
      { path: 'dashboard', name: 'AdminDashboard', component: () => import('../views/admin/DashboardView.vue') },
      { path: 'customers', name: 'AdminCustomers', component: () => import('../views/admin/CustomersView.vue') },
      { path: 'billing', name: 'AdminBilling', component: () => import('../views/admin/BillingView.vue') },
      { path: 'plans', name: 'AdminPlans', component: () => import('../views/admin/PlansView.vue') },
      { path: 'models', name: 'AdminModels', component: () => import('../views/admin/ModelsView.vue') },
      { path: 'tokens', name: 'AdminTokens', component: () => import('../views/admin/TokensView.vue') },
      { path: 'stats', name: 'AdminStats', component: () => import('../views/admin/StatsView.vue') },
      { path: 'backends', name: 'AdminBackends', component: () => import('../views/admin/BackendsView.vue') },
      { path: 'routing', name: 'AdminRouting', component: () => import('../views/admin/RoutingView.vue') },
      { path: 'gateway-stats', name: 'AdminGatewayStats', component: () => import('../views/admin/GatewayStatsView.vue') },
      { path: 'knowledge', name: 'AdminKnowledge', component: () => import('../views/admin/KnowledgeView.vue') },
    ],
  },
]

// 注意：base 路径来自 vite 构建时传入的 --base= 参数
//   开发模式 vite dev    → import.meta.env.BASE_URL = '/'
//   生产模式 vite build  → import.meta.env.BASE_URL = '/console/' （install.sh 已带）
// 这样 <router-link to="/login"> 会自动渲染成 href="/console/login"，
// 不会与 Next.js 门户的 /login 或 Django 的 /admin/ 冲突。
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to) => {
  document.title = 'AI 智枢平台'
  const token = localStorage.getItem('access_token')
  const userInfo = JSON.parse(localStorage.getItem('user_info') || 'null')
  const isLoggedIn = !!token
  const isAdmin = !!userInfo?.is_staff

  // ── 管理员登录页：已登录的管理员直接进后台，已登录的普通用户进前台 ──
  if (to.meta.adminLoginPage) {
    if (isLoggedIn && isAdmin) return '/admin/dashboard'
    if (isLoggedIn && !isAdmin) return '/'
    return // 未登录，正常显示管理员登录页
  }

  // ── 普通登录/注册页（guestOnly）：已登录则跳走 ──
  if (to.meta.guestOnly && isLoggedIn) {
    return isAdmin ? '/admin/dashboard' : '/'
  }

  // ── 需要登录的页面 ──
  if (to.meta.requireAuth && !isLoggedIn) {
    // 管理端路径 → 跳到管理员登录页，并携带 redirect
    if (to.path.startsWith('/admin')) {
      return {
        path: '/admin/login',
        query: { redirect: to.fullPath },
      }
    }
    // 普通路径 → 跳到用户登录页
    return {
      path: '/login',
      query: { redirect: to.fullPath },
    }
  }

  // ── 管理员专属页面：已登录但不是管理员 ──
  if (to.meta.adminOnly && isLoggedIn && !isAdmin) {
    return '/'
  }
})

export default router
