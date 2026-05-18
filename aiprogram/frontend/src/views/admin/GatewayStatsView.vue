<template>
  <div class="gw-stats" v-loading="statsLoading">
    <div class="page-header">
      <div class="page-title">网关监控 & 请求日志</div>
      <div class="header-actions">
        <el-select v-model="statsDays" style="width:120px" @change="loadAll">
          <el-option :value="1" label="今天" />
          <el-option :value="7" label="近 7 天" />
          <el-option :value="30" label="近 30 天" />
        </el-select>
        <el-button :icon="Refresh" @click="loadAll">刷新</el-button>
      </div>
    </div>

    <!-- 概览卡片 -->
    <div class="stats-bar">
      <div class="sb-item">
        <span class="sb-num">{{ overview.active_backends || 0 }}/{{ overview.total_backends || 0 }}</span>
        <span class="sb-label">后端 (启用/总)</span>
      </div>
      <div class="sb-divider" />
      <div class="sb-item">
        <span class="sb-num" style="color:#22c55e">{{ overview.healthy_backends || 0 }}</span>
        <span class="sb-label">健康后端</span>
      </div>
      <div class="sb-divider" />
      <div class="sb-item">
        <span class="sb-num" style="color:#6366f1">{{ fmtReq(totals.total_requests) }}</span>
        <span class="sb-label">总请求数(加权)</span>
      </div>
      <div class="sb-divider" />
      <div class="sb-item">
        <span class="sb-num" style="color:#10b981">{{ successRate }}%</span>
        <span class="sb-label">成功率</span>
      </div>
      <div class="sb-divider" />
      <div class="sb-item">
        <span class="sb-num" style="color:#f59e0b">{{ formatNumber(totals.total_tokens || 0) }}</span>
        <span class="sb-label">总 Tokens</span>
      </div>
      <div class="sb-divider" />
      <div class="sb-item">
        <span class="sb-num" style="color:#ef4444">¥{{ (Number(totals.total_cost_cny) || 0).toFixed(2) }}</span>
        <span class="sb-label">总费用</span>
      </div>
      <div class="sb-divider" />
      <div class="sb-item">
        <span class="sb-num">{{ Math.round(totals.avg_response_ms || 0) }}ms</span>
        <span class="sb-label">平均响应</span>
      </div>
    </div>

    <!-- 后端请求分布：整列表格 + 图 -->
    <div class="card block-full">
      <div class="card-title">后端请求分布</div>
      <el-table :data="byBackend" size="small" border stripe max-height="320">
        <el-table-column prop="backend__name" label="后端" min-width="140">
          <template #default="{ row }">{{ row.backend__name || '—' }}</template>
        </el-table-column>
        <el-table-column label="请求数(加权)" width="110" align="right">
          <template #default="{ row }">{{ fmtNum(row.requests) }}</template>
        </el-table-column>
        <el-table-column label="成功率" width="88" align="right">
          <template #default="{ row }">
            {{ row.requests ? ((Number(row.success) / Number(row.requests)) * 100).toFixed(1) : 0 }}%
          </template>
        </el-table-column>
        <el-table-column label="Tokens" width="100" align="right">
          <template #default="{ row }">{{ formatNumber(row.tokens || 0) }}</template>
        </el-table-column>
        <el-table-column label="费用" width="100" align="right">
          <template #default="{ row }">¥{{ (Number(row.cost) || 0).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="平均耗时" width="96" align="right">
          <template #default="{ row }">{{ Math.round(row.avg_ms || 0) }}ms</template>
        </el-table-column>
      </el-table>
      <div ref="chartBackendRef" class="chart-box" />
    </div>

    <!-- 模型 TOP10：整列表格 + 图 -->
    <div class="card block-full">
      <div class="card-title">模型请求 TOP 10</div>
      <el-table :data="byModel" size="small" border stripe max-height="320">
        <el-table-column prop="model_id" label="模型" min-width="220" show-overflow-tooltip />
        <el-table-column label="请求数(加权)" width="110" align="right">
          <template #default="{ row }">{{ fmtNum(row.requests) }}</template>
        </el-table-column>
        <el-table-column label="Tokens" width="100" align="right">
          <template #default="{ row }">{{ formatNumber(row.tokens || 0) }}</template>
        </el-table-column>
        <el-table-column label="费用" width="100" align="right">
          <template #default="{ row }">¥{{ (Number(row.cost) || 0).toFixed(2) }}</template>
        </el-table-column>
      </el-table>
      <div ref="chartModelRef" class="chart-box" />
    </div>

    <!-- 每日趋势：整列表格 + 图 -->
    <div class="card block-full">
      <div class="card-title">每日趋势</div>
      <el-table :data="daily" size="small" border stripe max-height="360">
        <el-table-column prop="date" label="日期" width="120" />
        <el-table-column label="请求数(加权)" width="110" align="right">
          <template #default="{ row }">{{ fmtNum(row.requests) }}</template>
        </el-table-column>
        <el-table-column label="成功数(加权)" width="120" align="right">
          <template #default="{ row }">{{ fmtNum(row.success) }}</template>
        </el-table-column>
        <el-table-column label="Tokens" width="110" align="right">
          <template #default="{ row }">{{ formatNumber(row.tokens || 0) }}</template>
        </el-table-column>
        <el-table-column label="费用(元)" width="110" align="right">
          <template #default="{ row }">¥{{ (Number(row.cost) || 0).toFixed(2) }}</template>
        </el-table-column>
      </el-table>
      <div ref="chartDailyRef" class="chart-box chart-tall" />
    </div>

    <!-- 请求日志 -->
    <div class="card block-full">
      <div class="card-title row-between">
        <span>最近请求日志</span>
        <div class="log-filters">
          <el-select v-model="logFilter.is_success" placeholder="状态" clearable style="width:100px" @change="loadLogs">
            <el-option label="成功" value="true" />
            <el-option label="失败" value="false" />
          </el-select>
          <el-input v-model="logFilter.model_id" placeholder="模型ID" clearable style="width:200px" @input="debounceLoadLogs" />
        </div>
      </div>
      <el-table :data="logs" size="small" border stripe v-loading="logsLoading" max-height="500">
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column prop="username" label="用户" width="100" />
        <el-table-column prop="backend_name" label="后端" width="120" />
        <el-table-column prop="business_type_display" label="业务类型" width="96" />
        <el-table-column prop="model_id" label="模型" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="mono-text">{{ row.model_id }}</span>
          </template>
        </el-table-column>
        <el-table-column label="流式" width="60" align="center">
          <template #default="{ row }">
            <el-tag :type="row.is_stream ? 'primary' : 'info'" size="small">{{ row.is_stream ? 'SSE' : 'REST' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="输入" width="70" align="right" prop="prompt_tokens" />
        <el-table-column label="输出" width="70" align="right" prop="completion_tokens" />
        <el-table-column label="总Tokens" width="80" align="right" prop="total_tokens" />
        <el-table-column label="费用" width="88" align="right">
          <template #default="{ row }">{{ Number(row.cost_cny) > 0 ? `¥${Number(row.cost_cny).toFixed(4)}` : '-' }}</template>
        </el-table-column>
        <el-table-column label="权重" width="72" align="right">
          <template #default="{ row }">{{ fmtNum(row.stats_weight ?? 1) }}</template>
        </el-table-column>
        <el-table-column label="耗时" width="80" align="right">
          <template #default="{ row }">{{ row.response_time_ms }}ms</template>
        </el-table-column>
        <el-table-column label="状态" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.is_success ? 'success' : 'danger'" size="small">
              {{ row.is_success ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="HTTP" width="70" align="center" prop="status_code" />
        <el-table-column label="错误" min-width="150" show-overflow-tooltip prop="error_message" />
      </el-table>
    </div>

    <div class="card block-full">
      <div class="card-title">业务类型与状态码统计</div>
      <div class="stats-grid">
        <el-table :data="byBusinessType" size="small" border stripe max-height="280">
          <el-table-column prop="business_type" label="业务类型" min-width="120" />
          <el-table-column label="请求数(加权)" width="120" align="right">
            <template #default="{ row }">{{ fmtNum(row.requests) }}</template>
          </el-table-column>
          <el-table-column label="成功率" width="96" align="right">
            <template #default="{ row }">
              {{ row.requests ? ((Number(row.success) / Number(row.requests)) * 100).toFixed(1) : 0 }}%
            </template>
          </el-table-column>
        </el-table>
        <el-table :data="byStatusCode" size="small" border stripe max-height="280">
          <el-table-column prop="status_code" label="HTTP状态码" min-width="120" />
          <el-table-column label="日志条数" width="100" align="right" prop="count" />
          <el-table-column label="请求数(加权)" width="120" align="right">
            <template #default="{ row }">{{ fmtNum(row.requests) }}</template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { getGatewayStats, getRequestLogs } from '../../api/admin'

const statsDays = ref(7)
const statsLoading = ref(false)
const logsLoading = ref(false)

const overview = ref({})
const totals = ref({})
const byBackend = ref([])
const byModel = ref([])
const byBusinessType = ref([])
const byStatusCode = ref([])
const daily = ref([])
const logs = ref([])

const chartBackendRef = ref(null)
const chartModelRef = ref(null)
const chartDailyRef = ref(null)
let chartBackend = null
let chartModel = null
let chartDaily = null

const logFilter = reactive({ is_success: '', model_id: '' })
let debounceTimer = null

const successRate = computed(() => {
  const t = Number(totals.value.total_requests) || 0
  const s = Number(totals.value.success_requests) || 0
  return t ? ((s / t) * 100).toFixed(1) : '100.0'
})

const formatNumber = (n) =>
  n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n || 0))

const fmtReq = (v) => {
  const n = Number(v) || 0
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toFixed(n % 1 ? 1 : 0)
}

const fmtNum = (v) => {
  const n = Number(v) || 0
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

const formatTime = (t) => (t ? new Date(t).toLocaleString('zh-CN', { hour12: false }) : '')

const renderCharts = () => {
  nextTick(() => {
    // 后端分布：横向柱状图
    if (chartBackendRef.value) {
      if (!chartBackend) chartBackend = echarts.init(chartBackendRef.value)
      const rows = byBackend.value || []
      const names = rows.map((r) => r.backend__name || `后端#${r.backend_id || ''}`)
      const vals = rows.map((r) => Number(r.requests) || 0)
      chartBackend.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: 12, right: 24, top: 24, bottom: 8, containLabel: true },
        xAxis: { type: 'value', axisLabel: { fontSize: 11 } },
        yAxis: { type: 'category', data: names, inverse: true, axisLabel: { fontSize: 11, width: 120, overflow: 'truncate' } },
        series: [{
          type: 'bar',
          data: vals,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#6366f1' },
              { offset: 1, color: '#a5b4fc' },
            ]),
            borderRadius: [0, 4, 4, 0],
          },
        }],
      }, true)
    }

    // 模型 TOP10：横向柱状图
    if (chartModelRef.value) {
      if (!chartModel) chartModel = echarts.init(chartModelRef.value)
      const rows = (byModel.value || []).slice(0, 10)
      const names = rows.map((r) => (r.model_id || '').slice(0, 40))
      const vals = rows.map((r) => Number(r.requests) || 0)
      chartModel.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: 12, right: 24, top: 24, bottom: 8, containLabel: true },
        xAxis: { type: 'value', axisLabel: { fontSize: 11 } },
        yAxis: { type: 'category', data: names, inverse: true, axisLabel: { fontSize: 10, width: 200, overflow: 'truncate' } },
        series: [{
          type: 'bar',
          data: vals,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#10b981' },
              { offset: 1, color: '#6ee7b7' },
            ]),
            borderRadius: [0, 4, 4, 0],
          },
        }],
      }, true)
    }

    // 每日趋势：折线 + 面积
    if (chartDailyRef.value) {
      if (!chartDaily) chartDaily = echarts.init(chartDailyRef.value)
      const rows = daily.value || []
      const dates = rows.map((r) => String(r.date || '').slice(5))
      const req = rows.map((r) => Number(r.requests) || 0)
      const cost = rows.map((r) => Number(r.cost) || 0)
      chartDaily.setOption({
        tooltip: { trigger: 'axis' },
        legend: { data: ['等效请求数', '费用(元)'], bottom: 0, textStyle: { fontSize: 11 } },
        grid: { left: 48, right: 48, top: 28, bottom: 40 },
        xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 11 } },
        yAxis: [
          { type: 'value', name: '请求', axisLabel: { fontSize: 11 } },
          { type: 'value', name: '元', axisLabel: { fontSize: 11 } },
        ],
        series: [
          {
            name: '等效请求数',
            type: 'line',
            smooth: true,
            areaStyle: { opacity: 0.12, color: '#6366f1' },
            lineStyle: { color: '#6366f1', width: 2 },
            data: req,
          },
          {
            name: '费用(元)',
            type: 'bar',
            yAxisIndex: 1,
            data: cost,
            itemStyle: { color: '#f59e0b', borderRadius: [3, 3, 0, 0] },
          },
        ],
      }, true)
    }
  })
}

const onResize = () => {
  chartBackend?.resize()
  chartModel?.resize()
  chartDaily?.resize()
}

const loadStats = async () => {
  statsLoading.value = true
  try {
    const res = await getGatewayStats({ days: statsDays.value })
    overview.value = res.overview || {}
    totals.value = res.totals || {}
    byBackend.value = res.by_backend || []
    byModel.value = res.by_model || []
    byBusinessType.value = res.by_business_type || []
    byStatusCode.value = res.by_status_code || []
    daily.value = res.daily || []
    await nextTick()
    renderCharts()
  } finally {
    statsLoading.value = false
  }
}

const loadLogs = async () => {
  logsLoading.value = true
  try {
    const params = { days: statsDays.value }
    if (logFilter.is_success) params.is_success = logFilter.is_success
    if (logFilter.model_id) params.model_id = logFilter.model_id
    const res = await getRequestLogs(params)
    logs.value = (res.results || res).slice(0, 200)
  } finally {
    logsLoading.value = false
  }
}

const debounceLoadLogs = () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(loadLogs, 400)
}

const loadAll = () => {
  loadStats()
  loadLogs()
}

onMounted(() => {
  loadAll()
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chartBackend?.dispose()
  chartModel?.dispose()
  chartDaily?.dispose()
  chartBackend = null
  chartModel = null
  chartDaily = null
})
</script>

<style scoped>
.gw-stats { padding-bottom: 24px; }
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.page-title { font-size: 20px; font-weight: 700; color: #1a1a2e; }
.header-actions { display: flex; gap: 10px; align-items: center; }

.stats-bar {
  background: #fff;
  border-radius: 12px;
  padding: 14px 24px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  flex-wrap: wrap;
  gap: 8px 0;
}
.sb-item { display: flex; flex-direction: column; align-items: center; flex: 1; min-width: 72px; }
.sb-num { font-size: 22px; font-weight: 800; color: #1a1a2e; line-height: 1; }
.sb-label { font-size: 11px; color: #888; margin-top: 4px; text-align: center; }
.sb-divider { width: 1px; height: 40px; background: #f0f0f0; }

.card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}
.block-full {
  width: 100%;
  margin-bottom: 16px;
}
.card-title {
  font-size: 15px;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 12px;
}
.card-title.row-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.log-filters { display: flex; gap: 10px; align-items: center; }

.chart-box {
  width: 100%;
  height: 280px;
  margin-top: 16px;
}
.chart-tall {
  height: 300px;
}

.mono-text { font-family: monospace; font-size: 12px; color: #555; }
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 1100px) {
  .stats-grid { grid-template-columns: 1fr; }
}
</style>
