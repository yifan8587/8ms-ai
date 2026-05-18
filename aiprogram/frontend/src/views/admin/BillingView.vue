<template>
  <div>
    <div class="page-header">
      <div class="page-title">计费记账</div>
      <div class="header-rate">
        <el-tooltip content="所有美金 → 人民币换算（模型定价/计费）都按此汇率计算">
          <el-tag size="large" effect="plain" type="info">
            USD → CNY 汇率：<strong style="color:#6366f1;margin-left:4px">{{ rateDisplay }}</strong>
          </el-tag>
        </el-tooltip>
        <el-button size="small" :icon="Edit" @click="openRateDialog">修改汇率</el-button>
      </div>
    </div>

    <!-- 收入汇总卡片 -->
    <el-row :gutter="16" style="margin-bottom:16px">
      <el-col :span="6" v-for="card in summaryCards" :key="card.label">
        <div class="summary-card" :style="{ borderTop: `3px solid ${card.color}` }">
          <div class="sc-val" :style="{ color: card.color }">{{ card.val }}</div>
          <div class="sc-label">{{ card.label }}</div>
        </div>
      </el-col>
    </el-row>

    <!-- 汇率编辑弹窗 -->
    <el-dialog v-model="rateDialogVisible" title="修改 USD → CNY 汇率" width="420px" destroy-on-close>
      <el-form :model="rateForm" label-width="110px">
        <el-form-item label="当前汇率">
          <el-input-number v-model="rateForm.usd_to_cny" :min="0.01" :precision="4" :step="0.01" controls-position="right" style="width:100%" />
          <div class="rate-hint">例如 1 USD = 7.2 CNY 则填写 7.2</div>
        </el-form-item>
        <el-form-item label="数据来源">
          <el-input v-model="rateForm.source" placeholder="manual / 央行 / 某 API..." />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="rateForm.remark" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="最近更新" v-if="rateForm.updated_at">
          <span style="color:#909399;font-size:13px">{{ rateForm.updated_at }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rateDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="rateSaving" @click="saveRate">保存</el-button>
      </template>
    </el-dialog>

    <!-- Tab 切换 -->
    <div class="table-card">
      <div class="toolbar">
        <el-tabs v-model="activeTab" @tab-change="handleTabChange" style="flex:1">
          <el-tab-pane label="📋 账单流水" name="records" />
          <el-tab-pane label="💰 充值订单" name="orders" />
        </el-tabs>
        <el-button
          v-if="activeTab === 'records'"
          type="primary" size="small" :icon="Plus"
          @click="manualVisible = true"
        >
          手动记账
        </el-button>
      </div>

      <!-- ── 账单流水 ── -->
      <template v-if="activeTab === 'records'">
        <div class="filter-row">
          <el-select
            v-model="recordUserId"
            filterable
            remote
            clearable
            reserve-keyword
            :remote-method="searchRecordUsers"
            :loading="recordUserSearching"
            placeholder="请选择用户后展开账单"
            style="width:280px"
            @change="handleRecordUserChange"
          >
            <el-option
              v-for="u in recordUserOptions"
              :key="u.id"
              :label="`${u.username}${u.nickname ? `（${u.nickname}）` : ''}`"
              :value="u.id"
            />
          </el-select>
          <el-select v-model="recordType" placeholder="类型" clearable style="width:120px" @change="loadRecords">
            <el-option label="充值" value="recharge" />
            <el-option label="消费" value="deduction" />
            <el-option label="退款" value="refund" />
            <el-option label="人工调整" value="adjustment" />
            <el-option label="奖励" value="reward" />
          </el-select>
          <el-button type="primary" :icon="Search" @click="loadRecords">查询</el-button>
        </div>
        <el-empty
          v-if="!recordUserId && !recordLoading"
          description="请先选择用户，再展开查看账单流水"
          :image-size="80"
        />
        <el-collapse v-else v-model="activeRecordUsers" v-loading="recordLoading">
          <el-collapse-item
            v-for="grp in groupedRecords"
            :key="grp.key"
            :name="grp.key"
          >
            <template #title>
              <span style="font-weight:600">{{ grp.username }}</span>
              <span style="margin-left:10px;color:#909399">共 {{ grp.records.length }} 条</span>
            </template>
            <el-table :data="grp.records" stripe border size="default">
              <el-table-column prop="id" label="ID" width="64" />
              <el-table-column label="类型" width="90">
                <template #default="{ row }">
                  <el-tag :type="TYPE_TAG[row.record_type]" size="small">{{ row.record_type_display }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="金额" width="110" align="right">
                <template #default="{ row }">
                  <span :style="{ color: Number(row.amount) >= 0 ? '#10b981' : '#ef4444', fontWeight: 700, fontSize: '14px' }">
                    {{ Number(row.amount) >= 0 ? '+' : '' }}{{ Number(row.amount).toFixed(4) }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="变前余额" width="104" align="right">
                <template #default="{ row }">¥{{ Number(row.balance_before).toFixed(4) }}</template>
              </el-table-column>
              <el-table-column label="变后余额" width="104" align="right">
                <template #default="{ row }">
                  <span style="font-weight:600">¥{{ Number(row.balance_after).toFixed(4) }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
              <el-table-column prop="operator_name" label="操作人" width="84" />
              <el-table-column label="时间" width="130">
                <template #default="{ row }">{{ fmtDt(row.created_at) }}</template>
              </el-table-column>
            </el-table>
          </el-collapse-item>
        </el-collapse>

        <div class="tbl-footer">
          <el-pagination v-model:current-page="recordPage" :page-size="20" :total="recordTotal"
            layout="total, prev, pager, next" @current-change="loadRecords" small />
        </div>
      </template>

      <!-- ── 充值订单 ── -->
      <template v-if="activeTab === 'orders'">
        <div class="filter-row">
          <el-input v-model="orderSearch" placeholder="用户ID 或 订单号" clearable style="width:200px" :prefix-icon="Search" />
          <el-select v-model="orderStatus" placeholder="状态" clearable style="width:110px" @change="loadOrders">
            <el-option label="待支付" value="pending" />
            <el-option label="已支付" value="paid" />
            <el-option label="失败" value="failed" />
            <el-option label="已退款" value="refunded" />
          </el-select>
          <el-button type="primary" :icon="Search" @click="loadOrders">查询</el-button>
        </div>

        <el-table :data="orders" v-loading="orderLoading" stripe border size="default">
          <el-table-column prop="order_no" label="订单号" min-width="220" show-overflow-tooltip />
          <el-table-column prop="username" label="用户" width="110" />
          <el-table-column label="金额" width="100" align="right">
            <template #default="{ row }">
              <span style="color:#10b981;font-weight:700">¥{{ Number(row.amount).toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="payment_method_display" label="支付方式" width="96" />
          <el-table-column label="状态" width="88">
            <template #default="{ row }">
              <el-tag :type="ORDER_STATUS_TAG[row.status]" size="small">{{ row.status_display }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="130" show-overflow-tooltip />
          <el-table-column prop="operator_name" label="操作人" width="80" />
          <el-table-column label="创建时间" width="130">
            <template #default="{ row }">{{ fmtDt(row.created_at) }}</template>
          </el-table-column>
          <el-table-column label="支付时间" width="130">
            <template #default="{ row }">{{ fmtDt(row.paid_at) }}</template>
          </el-table-column>
        </el-table>

        <div class="tbl-footer">
          <el-pagination v-model:current-page="orderPage" :page-size="20" :total="orderTotal"
            layout="total, prev, pager, next" @current-change="loadOrders" small />
        </div>
      </template>
    </div>

    <!-- ── 手动记账弹窗 ── -->
    <el-dialog v-model="manualVisible" title="手动记账" width="400px" destroy-on-close>
      <el-alert type="info" :closable="false" style="margin-bottom:14px">
        手动充值将自动创建充值订单并更新用户余额
      </el-alert>
      <el-form :model="manualForm" label-width="80px">
        <el-form-item label="用户名" required>
          <el-select
            v-model="manualForm.user_id"
            filterable
            remote
            clearable
            reserve-keyword
            :remote-method="searchUsers"
            :loading="userSearching"
            placeholder="输入用户名搜索并选择"
            style="width:100%"
          >
            <el-option
              v-for="u in userOptions"
              :key="u.id"
              :label="`${u.username}${u.nickname ? `（${u.nickname}）` : ''}`"
              :value="u.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="金额(元)" required>
          <el-input-number v-model="manualForm.amount" :min="0.01" :precision="2" :step="10" style="width:100%" />
        </el-form-item>
        <el-form-item label="支付方式">
          <el-select v-model="manualForm.payment_method" style="width:100%">
            <el-option label="人工充值" value="manual" />
            <el-option label="支付宝" value="alipay" />
            <el-option label="微信支付" value="wechat" />
            <el-option label="银行转账" value="bank" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="manualForm.remark" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="manualVisible = false">取消</el-button>
        <el-button type="primary" :loading="manualLoading" @click="doManual">提交记账</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Plus, Edit } from '@element-plus/icons-vue'
import {
  getBillingRecords, getRechargeOrders, getDashboard, rechargeUser, getCustomers,
  getExchangeRate, updateExchangeRate,
} from '../../api/admin'

const TYPE_TAG = { recharge: 'success', deduction: 'danger', refund: 'warning', adjustment: 'info', reward: '' }
const ORDER_STATUS_TAG = { pending: 'warning', paid: 'success', failed: 'danger', refunded: 'info' }

// 汇总数据
const dashboard = ref(null)
const summaryCards = computed(() => {
  const d = dashboard.value?.income
  if (!d) return []
  return [
    { label: '累计收入', val: `¥${Number(d.total).toFixed(2)}`, color: '#10b981' },
    { label: '本月收入', val: `¥${Number(d.month).toFixed(2)}`, color: '#6366f1' },
    { label: '今日收入', val: `¥${Number(d.today).toFixed(2)}`, color: '#f59e0b' },
    { label: '注册用户', val: dashboard.value?.users?.total?.toLocaleString() || '—', color: '#3b82f6' },
  ]
})

// 账单流水
const activeTab = ref('records')
const records = ref([])
const recordLoading = ref(false)
const recordUserId = ref(null)
const recordUserOptions = ref([])
const recordUserSearching = ref(false)
const activeRecordUsers = ref([])
const recordType = ref('')
const recordPage = ref(1)
const recordTotal = ref(0)

// 充值订单
const orders = ref([])
const orderLoading = ref(false)
const orderSearch = ref('')
const orderStatus = ref('')
const orderPage = ref(1)
const orderTotal = ref(0)

// 手动记账
const manualVisible = ref(false)
const manualLoading = ref(false)
const manualForm = reactive({ user_id: null, amount: 100, payment_method: 'manual', remark: '' })
const userOptions = ref([])
const userSearching = ref(false)

// 汇率配置
const rateDialogVisible = ref(false)
const rateSaving = ref(false)
const rateForm = reactive({ usd_to_cny: 7.2, source: 'manual', remark: '', updated_at: '' })
const rateDisplay = computed(() => {
  const v = Number(rateForm.usd_to_cny)
  return v > 0 ? v.toFixed(4) : '—'
})
const groupedRecords = computed(() => {
  const map = new Map()
  for (const r of records.value || []) {
    const key = String(r.user_id || recordUserId.value || r.username || 'unknown')
    if (!map.has(key)) map.set(key, { key, username: r.username || `用户#${key}`, records: [] })
    map.get(key).records.push(r)
  }
  return Array.from(map.values())
})
const loadRate = async () => {
  try {
    const res = await getExchangeRate()
    Object.assign(rateForm, {
      usd_to_cny: Number(res.usd_to_cny) || 7.2,
      source: res.source || 'manual',
      remark: res.remark || '',
      updated_at: res.updated_at || '',
    })
  } catch { /* ignore */ }
}
const openRateDialog = () => {
  loadRate()
  rateDialogVisible.value = true
}
const saveRate = async () => {
  if (!rateForm.usd_to_cny || Number(rateForm.usd_to_cny) <= 0) {
    return ElMessage.warning('汇率必须大于 0')
  }
  rateSaving.value = true
  try {
    await updateExchangeRate({
      usd_to_cny: Number(rateForm.usd_to_cny),
      source: rateForm.source || 'manual',
      remark: rateForm.remark || '',
    })
    ElMessage.success('汇率已更新，后续计费换算将立即生效')
    rateDialogVisible.value = false
    await loadRate()
  } finally { rateSaving.value = false }
}

const loadRecords = async () => {
  if (!recordUserId.value) {
    records.value = []
    recordTotal.value = 0
    return
  }
  recordLoading.value = true
  try {
    const res = await getBillingRecords({
      user_id: recordUserId.value || undefined,
      type: recordType.value || undefined,
      page: recordPage.value,
    })
    records.value = res.results || res
    recordTotal.value = res.count || records.value.length
    activeRecordUsers.value = groupedRecords.value.map(g => g.key)
  } finally {
    recordLoading.value = false
  }
}
const searchRecordUsers = async (keyword) => {
  recordUserSearching.value = true
  try {
    const res = await getCustomers({ q: keyword || undefined, page_size: 30, page: 1 })
    recordUserOptions.value = res.results || res || []
  } catch {
    recordUserOptions.value = []
  } finally {
    recordUserSearching.value = false
  }
}
const handleRecordUserChange = () => {
  recordPage.value = 1
  loadRecords()
}

const loadOrders = async () => {
  orderLoading.value = true
  try {
    const res = await getRechargeOrders({
      user_id: isNaN(Number(orderSearch.value)) ? undefined : orderSearch.value || undefined,
      status: orderStatus.value || undefined,
      page: orderPage.value,
    })
    orders.value = res.results || res
    orderTotal.value = res.count || orders.value.length
  } finally {
    orderLoading.value = false
  }
}

const handleTabChange = (tab) => {
  if (tab === 'records') loadRecords()
  else loadOrders()
}

const doManual = async () => {
  if (!manualForm.user_id) return ElMessage.warning('请选择用户')
  if (!manualForm.amount) return ElMessage.warning('请输入金额')
  manualLoading.value = true
  try {
    const res = await rechargeUser(manualForm.user_id, {
      amount: manualForm.amount,
      payment_method: manualForm.payment_method,
      remark: manualForm.remark,
    })
    ElMessage.success(res.msg || '记账成功')
    manualVisible.value = false
    Object.assign(manualForm, { user_id: null, amount: 100, payment_method: 'manual', remark: '' })
    await loadRecords()
    const d = await getDashboard()
    dashboard.value = d
  } finally {
    manualLoading.value = false
  }
}

const searchUsers = async (keyword) => {
  userSearching.value = true
  try {
    const res = await getCustomers({ q: keyword || undefined, page_size: 30, page: 1 })
    userOptions.value = res.results || res || []
  } catch {
    userOptions.value = []
  } finally {
    userSearching.value = false
  }
}

const fmtDt = (d) => d ? new Date(d).toLocaleString('zh-CN', { hour12: false }).slice(0, 16) : '—'

onMounted(async () => {
  const d = await getDashboard()
  dashboard.value = d
  searchUsers('')
  searchRecordUsers('')
  loadRate()
})
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; }
.page-title { font-size: 20px; font-weight: 700; color: #1a1a2e; }
.header-rate { display: flex; align-items: center; gap: 10px; }
.rate-hint { font-size: 12px; color: #9ca3af; margin-top: 4px; }

.summary-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  text-align: center;
}
.sc-val { font-size: 26px; font-weight: 800; line-height: 1; }
.sc-label { font-size: 13px; color: #888; margin-top: 6px; }

.table-card { background: #fff; border-radius: 12px; padding: 0 16px 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.toolbar { display: flex; align-items: center; border-bottom: 1px solid #f0f0f0; padding-right: 4px; }
.filter-row { display: flex; gap: 10px; margin-bottom: 14px; margin-top: 4px; align-items: center; flex-wrap: wrap; }
.tbl-footer { display: flex; justify-content: flex-end; margin-top: 14px; }
</style>
