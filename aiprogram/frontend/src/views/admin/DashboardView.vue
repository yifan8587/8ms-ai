<template>
  <div class="dashboard" v-loading="loading">
    <!-- 顶部操作栏 -->
    <div class="page-header">
      <div class="page-title">运营仪表盘</div>
      <el-button :icon="Refresh" @click="loadData" :loading="loading" size="small">刷新</el-button>
    </div>

    <!-- 核心指标卡片 -->
    <el-row :gutter="16">
      <el-col :xs="12" :sm="6" v-for="card in statCards" :key="card.key">
        <div class="kpi-card" :style="{ '--accent': card.color }">
          <div class="kpi-left">
            <div class="kpi-value">{{ card.value }}</div>
            <div class="kpi-label">{{ card.label }}</div>
            <div class="kpi-sub">
              <el-icon :size="12"><Top /></el-icon>
              {{ card.sub }}
            </div>
          </div>
          <div class="kpi-icon">
            <el-icon :size="28" :color="card.color"><component :is="card.icon" /></el-icon>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 趋势图 + 套餐分布 -->
    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="17">
        <div class="chart-card">
          <div class="chart-header">
            <span class="chart-title">近 7 天运营趋势</span>
            <el-radio-group v-model="trendMetric" size="small" @change="updateTrendChart">
              <el-radio-button value="messages">消息量</el-radio-button>
              <el-radio-button value="users">新增用户</el-radio-button>
              <el-radio-button value="income">收入</el-radio-button>
            </el-radio-group>
          </div>
          <div ref="trendRef" style="height:260px" />
        </div>
      </el-col>
      <el-col :span="7">
        <div class="chart-card" style="height:100%">
          <div class="chart-title">套餐分布</div>
          <div ref="tierRef" style="height:240px" />
        </div>
      </el-col>
    </el-row>

    <!-- 账号状态 + 收入柱图 -->
    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="7">
        <div class="chart-card">
          <div class="chart-title">账号状态</div>
          <div ref="statusRef" style="height:200px" />
        </div>
      </el-col>
      <el-col :span="17">
        <div class="chart-card">
          <div class="chart-title">近 7 天收入（元）</div>
          <div ref="incomeRef" style="height:200px" />
        </div>
      </el-col>
    </el-row>

    <!-- 快速操作 -->
    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="24">
        <div class="quick-actions">
          <div class="qa-title">快捷入口</div>
          <div class="qa-buttons">
            <el-button @click="$router.push('/admin/customers')" :icon="UserFilled" type="primary" plain>客户管理</el-button>
            <el-button @click="$router.push('/admin/billing')" :icon="CreditCard" type="success" plain>充值记账</el-button>
            <el-button @click="$router.push('/admin/models')" :icon="Connection" type="warning" plain>模型管理</el-button>
            <el-button @click="$router.push('/admin/stats')" :icon="TrendCharts" type="info" plain>用量统计</el-button>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import {
  Refresh, Top, UserFilled, CreditCard, Connection, TrendCharts,
  Money, ChatDotRound, DataBoard, Coin
} from '@element-plus/icons-vue'
import { getDashboard } from '../../api/admin'

const loading = ref(false)
const data = ref(null)
const trendMetric = ref('messages')

const trendRef = ref()
const tierRef = ref()
const statusRef = ref()
const incomeRef = ref()

let chartInstances = {}

const statCards = computed(() => {
  if (!data.value) return []
  const d = data.value
  return [
    {
      key: 'users', label: '注册用户总数',
      value: d.users.total.toLocaleString(),
      sub: `今日新增 +${d.users.new_today} · 本月 +${d.users.new_month}`,
      color: '#6366f1', icon: 'UserFilled'
    },
    {
      key: 'active', label: '今日活跃用户',
      value: d.users.active_today.toLocaleString(),
      sub: `本周新增 +${d.users.new_week}`,
      color: '#10b981', icon: 'DataBoard'
    },
    {
      key: 'income', label: '累计充值收入',
      value: `¥${Number(d.income.total).toFixed(2)}`,
      sub: `今日 ¥${Number(d.income.today).toFixed(2)} · 本月 ¥${Number(d.income.month).toFixed(2)}`,
      color: '#f59e0b', icon: 'Coin'
    },
    {
      key: 'messages', label: '总对话次数',
      value: d.messages.total.toLocaleString(),
      sub: `今日 ${d.messages.today} · Tokens ${Math.round(d.messages.total_tokens / 10000)}万`,
      color: '#3b82f6', icon: 'ChatDotRound'
    },
  ]
})

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6']

const initCharts = (d) => {
  const dates = d.daily_trend.map(i => i.date.slice(5))

  // 趋势图
  if (!chartInstances.trend) chartInstances.trend = echarts.init(trendRef.value)
  updateTrendChart(trendMetric.value, d)

  // 套餐分布
  const tierMap = { free: '免费版', basic: '基础版', pro: '专业版', enterprise: '企业版' }
  if (!chartInstances.tier) chartInstances.tier = echarts.init(tierRef.value)
  chartInstances.tier.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c}人 ({d}%)' },
    legend: { bottom: 4, itemWidth: 10, textStyle: { fontSize: 11 }, icon: 'circle' },
    series: [{
      type: 'pie', radius: ['42%', '68%'], center: ['50%', '44%'],
      data: d.tier_distribution.map((t, i) => ({
        name: tierMap[t.tier] || t.tier, value: t.count,
        itemStyle: { color: COLORS[i] }
      })),
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold' } },
    }],
  })

  // 账号状态
  const statusMap = { active: '正常', suspended: '暂停', banned: '封禁' }
  const statusColors = ['#10b981', '#f59e0b', '#ef4444']
  if (!chartInstances.status) chartInstances.status = echarts.init(statusRef.value)
  chartInstances.status.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c}人 ({d}%)' },
    series: [{
      type: 'pie', radius: '65%',
      data: d.status_distribution.map((s, i) => ({
        name: statusMap[s.customer_status] || s.customer_status, value: s.count,
        itemStyle: { color: statusColors[i] }
      })),
      label: { formatter: '{b}\n{c}人', fontSize: 12 },
    }],
  })

  // 收入柱图
  if (!chartInstances.income) chartInstances.income = echarts.init(incomeRef.value)
  chartInstances.income.setOption({
    tooltip: { trigger: 'axis', formatter: (p) => `${p[0].name}<br/>¥ ${p[0].value}` },
    grid: { top: 12, bottom: 32, left: 52, right: 16 },
    xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 11, formatter: '¥{value}' } },
    series: [{
      type: 'bar',
      data: d.daily_trend.map(i => Number(i.income).toFixed(2)),
      itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: '#10b981' },
        { offset: 1, color: '#6ee7b7' },
      ]), borderRadius: [4, 4, 0, 0] },
    }],
  })
}

const updateTrendChart = (metric, raw) => {
  const d = raw || data.value
  if (!d || !chartInstances.trend) return
  const dates = d.daily_trend.map(i => i.date.slice(5))
  const metricKey = { messages: 'messages', users: 'new_users', income: 'income' }[metric]
  const color = { messages: '#6366f1', users: '#10b981', income: '#f59e0b' }[metric]
  const label = { messages: '消息数', users: '新增用户', income: '收入(¥)' }[metric]

  chartInstances.trend.setOption({
    tooltip: { trigger: 'axis' },
    grid: { top: 20, bottom: 32, left: 46, right: 20 },
    xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 11 } },
    series: [{
      name: label, type: 'line', smooth: true,
      data: d.daily_trend.map(i => metricKey === 'income' ? Number(i[metricKey]).toFixed(2) : i[metricKey]),
      itemStyle: { color },
      lineStyle: { width: 3, color },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: color + '40' },
        { offset: 1, color: color + '00' },
      ]) },
      symbol: 'circle', symbolSize: 6,
    }],
  })
}

const resizeCharts = () => {
  Object.values(chartInstances).forEach(c => c?.resize())
}

const loadData = async () => {
  loading.value = true
  try {
    const res = await getDashboard()
    data.value = res
    await nextTick()
    initCharts(res)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
  window.addEventListener('resize', resizeCharts)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts)
  Object.values(chartInstances).forEach(c => c?.dispose())
})
</script>

<style scoped>
.dashboard { padding-bottom: 16px; }

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-title { font-size: 20px; font-weight: 700; color: #1a1a2e; }

/* KPI 卡片 */
.kpi-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  border-left: 4px solid var(--accent);
  transition: box-shadow 0.2s, transform 0.2s;
  cursor: default;
}
.kpi-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.1); transform: translateY(-2px); }
.kpi-value { font-size: 28px; font-weight: 800; color: #1a1a2e; line-height: 1; }
.kpi-label { font-size: 13px; color: #666; margin: 6px 0 4px; }
.kpi-sub { font-size: 11px; color: #aaa; display: flex; align-items: center; gap: 2px; }
.kpi-icon {
  width: 56px; height: 56px; border-radius: 12px;
  background: var(--accent, #6366f1);
  opacity: 0.12;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.kpi-card .kpi-icon {
  position: relative;
}
.kpi-card .kpi-icon::after {
  content: '';
  position: absolute;
}

/* Chart cards */
.chart-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.chart-title { font-size: 14px; font-weight: 600; color: #333; margin-bottom: 12px; display: block; }

/* 快捷操作 */
.quick-actions {
  background: #fff;
  border-radius: 12px;
  padding: 16px 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  display: flex;
  align-items: center;
  gap: 20px;
}
.qa-title { font-size: 14px; font-weight: 600; color: #333; white-space: nowrap; }
.qa-buttons { display: flex; gap: 10px; flex-wrap: wrap; }
</style>
