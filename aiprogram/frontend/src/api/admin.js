import request from './request'

// ── 仪表盘 ──────────────────────────────────────────────────────
export const getDashboard = () => request.get('/billing/admin/dashboard/')

// ── 客户管理 ────────────────────────────────────────────────────
export const getCustomers = (params) => request.get('/users/admin/customers/', { params })
export const getCustomerDetail = (id) => request.get(`/users/admin/customers/${id}/`)
export const updateCustomer = (id, data) => request.patch(`/users/admin/customers/${id}/`, data)
export const deleteCustomer = (id) => request.delete(`/users/admin/customers/${id}/`)
export const createMainAccount = (data) => request.post('/users/admin/customers/create/', data)
export const createSubAccount = (parentId, data) => request.post(`/users/admin/customers/${parentId}/sub-accounts/`, data)
export const getSubAccountUsage = (parentId, params) => request.get(`/users/admin/customers/${parentId}/sub-usage/`, { params })
export const resetCustomerPassword = (userId, data) => request.post(`/users/admin/customers/${userId}/reset-password/`, data)

// ── 充值 & 余额调整 ──────────────────────────────────────────────
export const rechargeUser = (userId, data) => request.post(`/billing/admin/recharge/${userId}/`, data)
export const adjustBalance = (userId, data) => request.post(`/billing/admin/adjust/${userId}/`, data)

// ── 账单记录 ────────────────────────────────────────────────────
export const getBillingRecords = (params) => request.get('/billing/admin/records/', { params })
export const getRechargeOrders = (params) => request.get('/billing/admin/orders/', { params })

// ── 用量统计 ────────────────────────────────────────────────────
export const getUsageStats = (params) => request.get('/billing/admin/usage/', { params })
export const getUserUsage = (userId, params) => request.get('/billing/admin/usage/', { params: { ...params, user_id: userId } })

// ── API Token 管理 ───────────────────────────────────────────────
export const getAdminTokens = (params) => request.get('/users/admin/api-tokens/', { params })
export const updateAdminToken = (id, data) => request.patch(`/users/admin/api-tokens/${id}/`, data)
export const deleteAdminToken = (id) => request.delete(`/users/admin/api-tokens/${id}/`)

// ── AI 模型管理 ──────────────────────────────────────────────────
export const getAdminModels = (params) => request.get('/chat/admin/models/', { params })
export const updateAdminModel = (id, data) => request.patch(`/chat/admin/models/${id}/`, data)
export const batchUpdateModels = (data) => request.post('/chat/admin/models/batch/', data)
export const syncModels = (data) => request.post('/chat/models/sync/', data || {})

// ── 个人 API Token ───────────────────────────────────────────────
export const getMyTokens = () => request.get('/users/tokens/')
export const createMyToken = (data) => request.post('/users/tokens/', data)
export const updateMyToken = (id, data) => request.patch(`/users/tokens/${id}/`, data)
export const deleteMyToken = (id) => request.delete(`/users/tokens/${id}/`)

// ── 个人账单 & 用量 ──────────────────────────────────────────────
export const getMyBilling = (params) => request.get('/billing/my/records/', { params })
export const getMyUsage = (params) => request.get('/billing/my/usage/', { params })
export const getMyModelPrices = (params) => request.get('/chat/my/model-prices/', { params })

// ── Gateway: 元数据（下拉选项） ─────────────────────────────────
export const getGatewayMeta = () => request.get('/gateway/meta/')

// ── Gateway: API 后端管理 ────────────────────────────────────────
export const getBackends = (params) => request.get('/gateway/backends/', { params })
export const createBackend = (data) => request.post('/gateway/backends/', data)
export const getBackend = (id) => request.get(`/gateway/backends/${id}/`)
export const updateBackend = (id, data) => request.patch(`/gateway/backends/${id}/`, data)
export const deleteBackend = (id) => request.delete(`/gateway/backends/${id}/`)
export const resetBackendHealth = (id) => request.post(`/gateway/backends/${id}/reset-health/`)
export const testBackend = (id) => request.post(`/gateway/backends/${id}/test/`)

// ── Gateway: 后端组管理 ──────────────────────────────────────────
export const getBackendGroups = (params) => request.get('/gateway/groups/', { params })
export const createBackendGroup = (data) => request.post('/gateway/groups/', data)
export const getBackendGroup = (id) => request.get(`/gateway/groups/${id}/`)
export const updateBackendGroup = (id, data) => request.patch(`/gateway/groups/${id}/`, data)
export const deleteBackendGroup = (id) => request.delete(`/gateway/groups/${id}/`)

// ── Gateway: 路由规则管理 ────────────────────────────────────────
export const getRoutingRules = (params) => request.get('/gateway/rules/', { params })
export const createRoutingRule = (data) => request.post('/gateway/rules/', data)
export const getRoutingRule = (id) => request.get(`/gateway/rules/${id}/`)
export const updateRoutingRule = (id, data) => request.patch(`/gateway/rules/${id}/`, data)
export const deleteRoutingRule = (id) => request.delete(`/gateway/rules/${id}/`)

// ── Gateway: 请求日志 & 统计 ────────────────────────────────────
export const getRequestLogs = (params) => request.get('/gateway/logs/', { params })
export const getGatewayStats = (params) => request.get('/gateway/stats/', { params })

// ── 汇率配置 ─────────────────────────────────────────────────────
export const getExchangeRate = () => request.get('/billing/admin/exchange-rate/')
export const updateExchangeRate = (data) => request.patch('/billing/admin/exchange-rate/', data)

// ── 套餐管理 ────────────────────────────────────────────────────
export const getPlans = () => request.get('/billing/admin/plans/')
export const createPlan = (data) => request.post('/billing/admin/plans/', data)
export const getPlan = (id) => request.get(`/billing/admin/plans/${id}/`)
export const updatePlan = (id, data) => request.patch(`/billing/admin/plans/${id}/`, data)
export const deletePlan = (id) => request.delete(`/billing/admin/plans/${id}/`)

// ── 知识库管理 ──────────────────────────────────────────────────
export const getKbCategories = () => request.get('/knowledge/admin/categories/')
export const createKbCategory = (data) => request.post('/knowledge/admin/categories/', data)
export const updateKbCategory = (id, data) => request.patch(`/knowledge/admin/categories/${id}/`, data)
export const deleteKbCategory = (id) => request.delete(`/knowledge/admin/categories/${id}/`)

export const getKbColumns = (params) => request.get('/knowledge/admin/columns/', { params })
export const createKbColumn = (data) => request.post('/knowledge/admin/columns/', data)
export const updateKbColumn = (id, data) => request.patch(`/knowledge/admin/columns/${id}/`, data)
export const deleteKbColumn = (id) => request.delete(`/knowledge/admin/columns/${id}/`)

export const getKbArticles = (params) => request.get('/knowledge/admin/articles/', { params })
export const createKbArticle = (data) => request.post('/knowledge/admin/articles/', data)
export const getKbArticle = (id) => request.get(`/knowledge/admin/articles/${id}/`)
export const updateKbArticle = (id, data) => request.patch(`/knowledge/admin/articles/${id}/`, data)
export const deleteKbArticle = (id) => request.delete(`/knowledge/admin/articles/${id}/`)
