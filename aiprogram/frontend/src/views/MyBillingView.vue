<template>
  <div class="billing-container">
    <div class="billing-card">
      <!-- 余额信息 -->
      <div class="balance-header">
        <div class="balance-box">
          <div class="balance-label">账户余额</div>
          <div class="balance-value">¥{{ Number(userStore.userInfo?.balance || 0).toFixed(4) }}</div>
        </div>
        <div class="tier-box">
          <el-tag :type="tierTagType(userStore.userInfo?.tier)" effect="dark" size="large">
            {{ userStore.userInfo?.tier_display || '免费版' }}
          </el-tag>
        </div>
      </div>

      <!-- 用量统计 -->
      <div class="section-title">近 {{ days }} 天用量</div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <el-radio-group v-model="days" @change="loadUsage" size="small">
          <el-radio-button :value="7">7天</el-radio-button>
          <el-radio-button :value="30">30天</el-radio-button>
          <el-radio-button :value="90">90天</el-radio-button>
        </el-radio-group>
      </div>
      <el-row :gutter="12" style="margin-bottom:16px" v-if="usage">
        <el-col :span="8">
          <div class="usage-stat">
            <div class="us-v">{{ usage.summary.total_messages || 0 }}</div>
            <div class="us-l">对话次数</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="usage-stat">
            <div class="us-v">{{ ((usage.summary.total_tokens || 0) / 1000).toFixed(1) }}K</div>
            <div class="us-l">Tokens</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="usage-stat">
            <div class="us-v">¥{{ Number(usage.summary.total_cost || 0).toFixed(4) }}</div>
            <div class="us-l">总费用</div>
          </div>
        </el-col>
      </el-row>

      <!-- 每日趋势图 -->
      <div ref="chartRef" style="height:200px;margin-bottom:20px" />

      <!-- 账单流水 -->
      <div class="section-title">账单流水</div>
      <el-table :data="records" v-loading="recordLoading" stripe size="small" max-height="300">
        <el-table-column label="时间" width="130">
          <template #default="{ row }">{{ fmtDatetime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag :type="typeTag(row.record_type)" size="small">{{ row.record_type_display }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="100" align="right">
          <template #default="{ row }">
            <span :style="{ color: Number(row.amount) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }">
              {{ Number(row.amount) >= 0 ? '+' : '' }}{{ Number(row.amount).toFixed(4) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="余额" width="100" align="right">
          <template #default="{ row }">¥{{ Number(row.balance_after).toFixed(4) }}</template>
        </el-table-column>
        <el-table-column prop="description" label="说明" show-overflow-tooltip />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'
import { useUserStore } from '../store/user'
import { getMyBilling, getMyUsage } from '../api/admin'

const userStore = useUserStore()
const days = ref(30)
const usage = ref(null)
const records = ref([])
const recordLoading = ref(false)
const chartRef = ref()
let chart = null

const loadUsage = async () => {
  const res = await getMyUsage({ days: days.value })
  usage.value = res
  renderChart(res)
}

const loadRecords = async () => {
  recordLoading.value = true
  try {
    const res = await getMyBilling()
    records.value = res.results || res
  } finally {
    recordLoading.value = false
  }
}

const renderChart = (data) => {
  if (!chartRef.value) return
  if (!chart) chart = echarts.init(chartRef.value)
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['消息数'], bottom: 0 },
    grid: { top: 16, bottom: 36, left: 40, right: 16 },
    xAxis: { type: 'category', data: (data.daily || []).map(d => d.date?.slice(5)), axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 11 } },
    series: [{
      name: '消息数', type: 'bar',
      data: (data.daily || []).map(d => d.messages || 0),
      itemStyle: { color: '#6366f1', borderRadius: [4,4,0,0] }
    }],
  })
}

const tierTagType = (tier) => ({ free: 'info', basic: '', pro: 'warning', enterprise: 'danger' }[tier] || 'info')
const typeTag = (t) => ({ recharge: 'success', deduction: 'danger', refund: 'warning', adjustment: 'info', reward: '' }[t] || 'info')
const fmtDatetime = (d) => d ? new Date(d).toLocaleString('zh-CN', { hour12: false }).slice(0, 16) : '-'

onMounted(async () => {
  await userStore.fetchProfile()
  await Promise.all([loadUsage(), loadRecords()])
})
onBeforeUnmount(() => chart?.dispose())
</script>

<style scoped>
.billing-container { padding: 32px 24px; background: #f8f9ff; min-height: 100vh; }
.billing-card {
  background: #fff; border-radius: 16px; padding: 28px 32px; max-width: 900px;
  box-shadow: 0 4px 24px rgba(99,102,241,0.08);
}
.balance-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 24px; }
.balance-label { font-size: 14px; color: #888; margin-bottom: 4px; }
.balance-value { font-size: 36px; font-weight: 800; color: #10b981; }
.section-title { font-size: 15px; font-weight: 700; color: #333; margin-bottom: 10px; }
.usage-stat {
  background: #f8f9ff; border-radius: 10px; padding: 14px; text-align: center;
}
.us-v { font-size: 22px; font-weight: 800; color: #1a1a2e; }
.us-l { font-size: 12px; color: #888; margin-top: 4px; }
</style>
