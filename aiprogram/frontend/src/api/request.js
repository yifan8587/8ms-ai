import axios from 'axios'
import { ElMessage } from 'element-plus'

export const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')

// SPA 部署在 /console/ 子路径下时，所有 location.href 跳转必须带上 BASE_URL，
// 否则 /login 会被 nginx 路由到 Next.js 门户而不是 Vue admin 自身的登录页。
const SPA_BASE = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '/')
const goLogin = () => {
  window.location.href = `${SPA_BASE}login`
}

const request = axios.create({
  baseURL: BASE_URL,
  timeout: 90000,
})

// 防止并发 401 触发多次 refresh
let _refreshing = false
let _refreshWaiters = []

const waitForRefresh = () =>
  new Promise((resolve, reject) => _refreshWaiters.push({ resolve, reject }))

const resolveWaiters = (token) => {
  _refreshWaiters.forEach(({ resolve }) => resolve(token))
  _refreshWaiters = []
}

const rejectWaiters = () => {
  _refreshWaiters.forEach(({ reject }) => reject())
  _refreshWaiters = []
}

request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

request.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const status = error.response?.status
    const originalConfig = error.config

    if (status === 401 && !originalConfig._retry) {
      // 登录 / 注册 / 密码修改 等认证接口本身返回 401，属于业务错误，
      // 直接显示后端给的错误信息，不走 token 刷新逻辑
      const authEndpoints = ['/users/login/', '/users/register/']
      const isAuthEndpoint = authEndpoints.some(ep => originalConfig.url?.includes(ep))
      if (isAuthEndpoint) {
        const msg = error.response?.data?.msg || error.response?.data?.detail || '用户名或密码错误'
        ElMessage.error({ message: msg, duration: 5000, showClose: true })
        return Promise.reject(error)
      }

      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) {
        localStorage.clear()
        goLogin()
        return Promise.reject(error)
      }

      if (_refreshing) {
        // 等待刷新完成后重试
        try {
          const newToken = await waitForRefresh()
          originalConfig.headers.Authorization = `Bearer ${newToken}`
          return request(originalConfig)
        } catch {
          return Promise.reject(error)
        }
      }

      originalConfig._retry = true
      _refreshing = true

      try {
        const res = await axios.post(`${BASE_URL}/users/token/refresh/`, {
          refresh: refreshToken,
        })
        const newAccess = res.data.access
        localStorage.setItem('access_token', newAccess)
        if (res.data.refresh) localStorage.setItem('refresh_token', res.data.refresh)
        resolveWaiters(newAccess)
        originalConfig.headers.Authorization = `Bearer ${newAccess}`
        return request(originalConfig)
      } catch {
        rejectWaiters()
        localStorage.clear()
        goLogin()
        return Promise.reject(error)
      } finally {
        _refreshing = false
      }
    }

    if (status !== 401) {
      const d = error.response?.data
      let msg = d?.msg || d?.detail
      if (msg == null && d && typeof d === 'object') {
        const parts = []
        for (const [k, v] of Object.entries(d)) {
          if (Array.isArray(v)) parts.push(`${k}: ${v.map((x) => (typeof x === 'string' ? x : x?.string || String(x))).join('，')}`)
          else if (typeof v === 'string') parts.push(`${k}: ${v}`)
        }
        if (parts.length) msg = parts.join('；')
      }
      if (typeof msg !== 'string') msg = Array.isArray(msg) ? msg.join('；') : String(msg || '请求失败')
      ElMessage.error({ message: msg, duration: 5000, showClose: true })
    }
    return Promise.reject(error)
  }
)

export default request
