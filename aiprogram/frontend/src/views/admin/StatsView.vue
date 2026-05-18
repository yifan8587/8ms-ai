<template>
  <div>
    <div class="page-header">
      <div class="page-title">用量统计</div>
      <div class="header-actions">
        <el-input v-model="filterUserId" placeholder="用户ID过滤" clearable style="width:150px" @change="load" />
        <el-radio-group v-model="days" size="small" @change="load">
          <el-radio-button :value="7">7天</el-radio-button>
          <el-radio-button :value="30">30天</el-radio-button>
          <el-radio-button :value="90">90天</el-radio-button>
        </el-radio-group>
        <el-button type="primary" :icon="Search" @click="load">查询</el-button>
      </div>
    </div>

    <!-- 汇总卡片 -->
    <el-row :gutter="16" style="margin-bottom:16px">
      <el-col :span="8" v-for="c in totalCards" :key="c.label">
        <div class="total-card">
          <div class="tc-val">{{ c.val }}</div>
          <div class="tc-label">{{ c.label }}</div>
        </div>
      </el-col>
    </el-row>

    <!-- 每日趋势 + 模型分布 -->
    <el-row :gutter="16" style="margin-bottom:16px">
      <el-col :span="16">
        <div class="chart-card">
          <div class="chart-header">
            <span class="chart-title">每日用量趋势</span>
            <el-radio-group v-model="trendMetric" size="small" @change="renderTrend">
              <el-radio-button value="messages">消息</el-radio-button>
              <el-radio-button value="tokens">Tokens</el-radio-button>
              <el-radio-button value="cost">费用</el-radio-button>
            </el-radio-group>
          </div>
          <div ref="trendRef" style="height:240px" v-loading="loading" />
        </div>
      </el-col>
      <el-col :span="8">
        <div class="chart-card">
          <div class="chart-title">模型使用占比（按 Token）</div>
          <div ref="modelRef" style="height:240px" />
        </div>
      </el-col>
    </el-row>

    <!-- Top 用户 + 模型明细 -->
    <el-row :gutter="16">
      <el-col :span="12">
        <div class="table-card">
          <div class="tc-header">
            <span class="chart-title">Top 用户（按 Token 排序）</span>
          </div>
          <el-table :data="stats?.by_user || []" size="small" max-height="300" stripe
            @row-click="openUserDetail" style="cursor:pointer">
            <el-table-column type="index" width="40" />
            <el-table-column prop="user__username" label="用户" min-width="100" />
            <el-table-column prop="messages" label="消息数" width="80" align="right" />
            <el-table-column label="Tokens" width="90" align="right">
              <template #default="{ row }">{{ (row.tokens || 0).toLocaleString() }}</template>
            </el-table-column>
            <el-table-column label="费用" width="80" align="right">
              <template #default="{ row }">¥{{ Number(row.cost || 0).toFixed(4) }}</template>
            </el-table-column>
          </el-table>
          <div style="font-size:11px;color:#aaa;margin-top:8px;text-align:right">点击行查看详情</div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="table-card">
          <div class="tc-header">
            <span class="chart-title">模型用量明细</span>
          </div>
          <el-table :data="stats?.by_model || []" size="small" max-height="300" stripe>
            <el-table-column type="index" width="40" />
            <el-table-column prop="model_id" label="模型" min-width="160" show-overflow-tooltip />
            <el-table-column prop="messages" label="消息" width="70" align="right" />
            <el-table-column label="Tokens" width="90" align="right">
              <template #default="{ row }">{{ (row.tokens || 0).toLocaleString() }}</template>
            </el-table-column>
            <el-table-column label="费用" width="80" align="right">
              <template #default="{ row }">¥{{ Number(row.cost || 0).toFixed(4) }}</template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>

    <!-- 用户详情弹窗 -->
    <el-dialog v-model="userDetailVisible" :title="`用户详情：${selectedUser?.user__username}`" width="520px">
      <div v-if="userDetailData">
        <el-row :gutter="8" style="margin-bottom:12px">
          <el-col :span="8" v-for="c in userDetailCards" :key="c.label">
            <div class="total-card">
              <div class="tc-val" style="font-size:18px">{{ c.val }}</div>
              <div class="tc-label">{{ c.label }}</div>
            </div>
          </el-col>
        </el-row>
        <div style="font-size:13px;font-weight:600;margin-bottom:8px">模型使用明细</div>
        <el-table :data="userDetailData.by_model || []" size="small" max-height="220" stripe>
          <el-table-column prop="model_id" label="模型" show-overflow-tooltip />
          <el-table-column prop="messages" label="消息" width="70" align="right" />
          <el-table-column label="Tokens" width="80" align="right">
            <template #default="{ row }">{{ (row.tokens || 0).toLocaleString() }}</template>
          </el-table-column>
          <el-table-column label="费用" width="80" align="right">
            <template #default="{ row }">¥{{ Number(row.cost || 0).toFixed(4) }}</template>
          </el-table-column>
        </el-table>
      </div>
      <div v-else v-loading="true" style="height:100px" />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import { Search } from '@element-plus/icons-vue'
import { getUsageStats, getUserUsage } from '../../api/admin'

const loading = ref(false)
const stats = ref(null)
const days = ref(30)
const filterUserId = ref('')
const trendMetric = ref('messages')

const trendRef = ref()
const modelRef = ref()
let chartInstances = {}

const totalCards = computed(() => {
  if (!stats.value) return []
  const t = stats.value.totals
  return [
    { label: `近${days.value}天总消息数`, val: (t.total_messages || 0).toLocaleString() },
    { label: `近${days.value}天总 Tokens`, val: ((t.total_tokens || 0) / 10000).toFixed(2) + ' 万' },
    { label: `近${days.value}天总费用`, val: '¥' + Number(t.total_cost || 0).toFixed(4) },
  ]
})

const COLORS = ['#6366f1','#10b981','#f59e0b','#3b82f6','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#a855f7']

const renderTrend = () => {
  if (!stats.value || !trendRef.value) return
  const d = stats.value.daily || []
  if (!chartInstances.trend) chartInstances.trend = echarts.init(trendRef.value)
  const keyMap = { messages: 'messages', tokens: 'tokens', cost: 'cost' }
  const colorMap = { messages: '#6366f1', tokens: '#f59e0b', cost: '#10b981' }
  const labelMap = { messages: '消息数', tokens: 'Tokens', cost: '费用(¥)' }
  chartInstances.trend.setOption({
    tooltip: { trigger: 'axis' },
    grid: { top: 16, bottom: 32, left: 52, right: 20 },
    xAxis: { type: 'category', data: d.map(i => String(i.date).slice(5)), axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 11 } },
    series: [{
      name: labelMap[trendMetric.value], type: 'line', smooth: true,
      data: d.map(i => {
        const v = i[keyMap[trendMetric.value]] || 0
        return trendMetric.value === 'cost' ? Number(v).toFixed(4) : v
      }),
      itemStyle: { color: colorMap[trendMetric.value] },
      lineStyle: { width: 3, color: colorMap[trendMetric.value] },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: colorMap[trendMetric.value] + '50' },
        { offset: 1, color: colorMap[trendMetric.value] + '00' },
      ]) },
      symbol: 'circle', symbolSize: 5,
    }],
  }, true)
}

const renderModelPie = () => {
  if (!stats.value || !modelRef.value) return
  const topModels = (stats.value.by_model || []).slice(0, 10)
  if (!chartInstances.model) chartInstances.model = echarts.init(modelRef.value)
  chartInstances.model.setOption({
    tooltip: { trigger: 'item', formatter: '{b}\n{c} tokens ({d}%)' },
    legend: { show: false },
    series: [{
      type: 'pie', radius: ['36%', '68%'],
      data: topModels.map((m, i) => ({
        name: m.model_id?.split('/').pop() || m.model_id,
        value: m.tokens || 0,
        itemStyle: { color: COLORS[i % COLORS.length] }
      })),
      label: { fontSize: 10, formatter: '{b}\n{d}%' },
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.1)' } },
    }],
  }, true)
}

const load = async () => {
  loading.value = true
  try {
    const res = await getUsageStats({
      days: days.value,
      user_id: filterUserId.value || undefined,
    })
    stats.value = res
    await nextTick()
    renderTrend()
    renderModelPie()
  } finally {
    loading.value = false
  }
}

// 用户详情弹窗
const userDetailVisible = ref(false)
const selectedUser = ref(null)
const userDetailData = ref(null)
const userDetailCards = computed(() => {
  if (!userDetailData.value) return []
  const t = userDetailData.value.totals
  return [
    { label: '消息数', val: (t.total_messages || 0).toLocaleString() },
    { label: 'Tokens', val: ((t.total_tokens || 0) / 1000).toFixed(1) + 'K' },
    { label: '费用', val: '¥' + Number(t.total_cost || 0).toFixed(4) },
  ]
})

const openUserDetail = async (row) => {
  selectedUser.value = row
  userDetailData.value = null
  userDetailVisible.value = true
  const res = await getUserUsage(row.user_id, { days: days.value })
  userDetailData.value = res
}

const resizeCharts = () => Object.values(chartInstances).forEach(c => c?.resize())

onMounted(() => {
  load()
  window.addEventListener('resize', resizeCharts)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts)
  Object.values(chartInstances).forEach(c => c?.dispose())
})
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; color: #1a1a2e; }
.header-actions { display: flex; gap: 10px; align-items: center; }

.total-card {
  background: #fff; border-radius: 12px; padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05); text-align: center;
}
.tc-val { font-size: 24px; font-weight: 800; color: #1a1a2e; }
.tc-label { font-size: 12px; color: #888; margin-top: 4px; }

.chart-card { background: #fff; border-radius: 12px; padding: 16px 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.chart-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.chart-title { font-size: 14px; font-weight: 600; color: #333; }

.table-card { background: #fff; border-radius: 12px; padding: 16px 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.tc-header { margin-bottom: 10px; }
</style>
