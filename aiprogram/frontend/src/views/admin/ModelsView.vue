<template>
  <div>
    <div class="page-header">
      <div class="page-title">AI 模型管理</div>
      <div class="header-actions">
        <el-input v-model="search" placeholder="搜索模型名称或ID" clearable style="width:200px" :prefix-icon="Search" @input="debounceSearch" />
        <el-select v-model="filterBusinessType" placeholder="业务类型" clearable style="width:130px" @change="loadModels">
          <el-option v-for="o in BT_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-select v-model="filterBackendId" placeholder="来源后端" clearable filterable style="width:150px" @change="loadModels">
          <el-option v-for="b in backends" :key="b.id" :label="b.name" :value="b.id" />
        </el-select>
        <el-select v-model="filterVisible" placeholder="可见性" clearable style="width:100px" @change="loadModels">
          <el-option label="可见" value="true" /><el-option label="隐藏" value="false" />
        </el-select>
        <el-select v-model="filterActive" placeholder="启用" clearable style="width:100px" @change="loadModels">
          <el-option label="已启用" value="true" /><el-option label="已禁用" value="false" />
        </el-select>
        <el-button type="warning" :icon="Refresh" :loading="syncing" @click="openSyncDialog">同步模型</el-button>
      </div>
    </div>

    <!-- 统计栏 -->
    <div class="stats-bar">
      <div class="sb-item"><span class="sb-num">{{ totalCount }}</span><span class="sb-label">模型总数</span></div>
      <div class="sb-divider" />
      <div class="sb-item"><span class="sb-num" style="color:#10b981">{{ activeCount }}</span><span class="sb-label">已启用</span></div>
      <div class="sb-divider" />
      <div class="sb-item"><span class="sb-num" style="color:#6366f1">{{ freeCount }}</span><span class="sb-label">免费模型</span></div>
      <div class="sb-divider" />
      <div class="sb-item"><span class="sb-num" style="color:#f59e0b">{{ paidCount }}</span><span class="sb-label">付费模型</span></div>
    </div>

    <!-- 分组方式切换 + 批量操作 -->
    <div class="toolbar-bar">
      <div class="toolbar-left">
        <span class="toolbar-label">分组方式：</span>
        <el-radio-group v-model="groupMode" size="small" @change="clearSelection">
          <el-radio-button value="business_type">按业务类型</el-radio-button>
          <el-radio-button value="source_backend">按来源后端</el-radio-button>
          <el-radio-button value="none">不分组</el-radio-button>
        </el-radio-group>
      </div>
      <div class="toolbar-right" v-if="selectedIds.length">
        <span style="font-size:13px;color:#666">已选 <strong>{{ selectedIds.length }}</strong> 个模型 →</span>
        <el-select v-model="batchBizType" placeholder="业务类型" size="small" style="width:130px" clearable>
          <el-option v-for="o in BT_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-select v-model="batchVisible" placeholder="可见性" size="small" style="width:110px" clearable>
          <el-option label="可见" value="true" />
          <el-option label="隐藏" value="false" />
        </el-select>
        <el-select v-model="batchActive" placeholder="启用状态" size="small" style="width:110px" clearable>
          <el-option label="启用" value="true" />
          <el-option label="禁用" value="false" />
        </el-select>
        <el-select v-model="batchFree" placeholder="收费" size="small" style="width:100px" clearable>
          <el-option label="免费" value="true" />
          <el-option label="付费" value="false" />
        </el-select>
        <el-button type="primary" size="small" :loading="batching" @click="doBatchApply">应用</el-button>
        <el-button size="small" @click="clearSelection">取消</el-button>
      </div>
    </div>

    <div class="table-card" v-loading="loading">
      <!-- 分组展示 -->
      <div v-for="grp in displayGroups" :key="grp.key" class="model-group">
        <div v-if="grp.showTitle" class="group-title">
          <el-tag :type="grp.tagType" size="small" effect="dark">{{ grp.title }}</el-tag>
          <span class="group-count">共 {{ grp.items.length }} 个</span>
        </div>
        <el-table :data="grp.items" stripe border size="small" @selection-change="onSelChange($event, grp.key)">
          <el-table-column type="selection" width="40" />
          <el-table-column prop="id" label="ID" width="58" />
          <el-table-column prop="model_id" label="模型 ID" min-width="200" show-overflow-tooltip>
            <template #default="{ row }"><span class="model-id">{{ row.model_id }}</span></template>
          </el-table-column>
          <el-table-column prop="name" label="名称" min-width="150" show-overflow-tooltip />
          <el-table-column label="业务类型" width="108" align="center">
            <template #default="{ row }">
              <el-tag :type="btTagType(row.business_type)" size="small" effect="light">{{ btLabel(row.business_type) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="来源后端" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">
              <template v-if="row.source_backends_info && row.source_backends_info.length">
                <el-tooltip :content="sourceTooltip(row)" placement="top">
                  <div class="source-cell">
                    <el-tag
                      v-for="b in row.source_backends_info"
                      :key="b.id"
                      size="small"
                      effect="plain"
                      class="source-tag"
                    >
                      {{ b.name }}<span v-if="b.groups?.length" class="source-group">({{ b.groups.join('/') }})</span>
                    </el-tag>
                  </div>
                </el-tooltip>
              </template>
              <span v-else>{{ row.source_backend_name || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="收费" width="68" align="center">
            <template #default="{ row }">
              <el-tag :type="row.is_free ? 'success' : 'warning'" size="small" effect="light">{{ row.is_free ? '免费' : '付费' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="上下文" width="80" align="right">
            <template #default="{ row }">{{ fmtCtx(row.context_length) }}</template>
          </el-table-column>
          <el-table-column label="定价($/M tokens)" min-width="180">
            <template #default="{ row }">
              <span class="pricing-cell">
                入:<span :class="pClass(row.pricing_prompt)">{{ fmtPrice(row.pricing_prompt) }}</span>
                <span class="pricing-sep">|</span>
                出:<span :class="pClass(row.pricing_completion)">{{ fmtPrice(row.pricing_completion) }}</span>
              </span>
              <div v-if="(Number(row.pricing_prompt) > 0 || Number(row.pricing_completion) > 0) && exchangeRate" class="pricing-cny">
                ≈ ¥{{ cnyPrice(row.pricing_prompt) }} / ¥{{ cnyPrice(row.pricing_completion) }}（/M）
              </div>
            </template>
          </el-table-column>
          <el-table-column label="可见" width="68" align="center">
            <template #default="{ row }">
              <el-switch v-model="row.is_visible" :loading="row._tv" @change="toggleField(row, 'is_visible', '_tv')" />
            </template>
          </el-table-column>
          <el-table-column label="启用" width="68" align="center">
            <template #default="{ row }">
              <el-switch v-model="row.is_active" :loading="row._ta" @change="toggleField(row, 'is_active', '_ta')" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="68" fixed="right">
            <template #default="{ row }"><el-button size="small" type="primary" text @click="openEdit(row)">编辑</el-button></template>
          </el-table-column>
        </el-table>
      </div>
      <div class="tbl-footer"><span style="font-size:13px;color:#888">共 {{ models.length }} 条</span></div>
    </div>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="editVisible" title="编辑模型" width="500px" destroy-on-close>
      <div style="font-size:12px;color:#888;margin-bottom:12px;word-break:break-all">{{ editForm.model_id }}</div>
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="显示名称"><el-input v-model="editForm.name" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="editForm.description" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="业务类型">
          <el-select v-model="editForm.business_type" style="width:100%">
            <el-option v-for="o in BT_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源后端">
          <el-select v-model="editForm.source_backend" placeholder="可选" clearable filterable style="width:100%">
            <el-option v-for="b in backends" :key="b.id" :label="b.name" :value="b.id" />
          </el-select>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="输入定价">
              <el-input-number v-model="editForm.pricing_prompt_per_m" :min="0" :precision="4" :step="0.1" controls-position="right" style="width:100%" />
              <div class="price-hint">美元 / 百万 tokens<span v-if="exchangeRate">（≈ ¥{{ (editForm.pricing_prompt_per_m * exchangeRate).toFixed(4) }}/M）</span></div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="输出定价">
              <el-input-number v-model="editForm.pricing_completion_per_m" :min="0" :precision="4" :step="0.1" controls-position="right" style="width:100%" />
              <div class="price-hint">美元 / 百万 tokens<span v-if="exchangeRate">（≈ ¥{{ (editForm.pricing_completion_per_m * exchangeRate).toFixed(4) }}/M）</span></div>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="免费模型"><el-switch v-model="editForm.is_free" /></el-form-item>
        <el-form-item label="对用户可见"><el-switch v-model="editForm.is_visible" active-text="可见" inactive-text="隐藏" /></el-form-item>
        <el-form-item label="启用状态"><el-switch v-model="editForm.is_active" active-text="启用" inactive-text="禁用" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 同步弹窗 -->
    <el-dialog v-model="syncDialogVisible" title="同步模型" width="420px" destroy-on-close>
      <p class="sync-hint">选择要从哪个 API 后端拉取模型列表</p>
      <el-select v-model="syncBackendId" placeholder="选择后端" filterable style="width:100%">
        <el-option v-for="b in backends" :key="b.id" :label="b.name" :value="b.id" />
      </el-select>
      <template #footer>
        <el-button @click="syncDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="syncing" :disabled="!syncBackendId" @click="confirmSync">开始同步</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh } from '@element-plus/icons-vue'
import { getAdminModels, updateAdminModel, batchUpdateModels, syncModels, getBackends, getExchangeRate } from '../../api/admin'

const BT_OPTIONS = [
  { value: 'chat', label: '聊天对话', tag: 'primary' },
  { value: 'coding', label: '编程开发', tag: 'success' },
  { value: 'text2img', label: '文生图', tag: 'warning' },
  { value: 'text2video', label: '文生视频', tag: 'danger' },
  { value: 'translation', label: '翻译', tag: 'info' },
  { value: 'writing', label: '写作', tag: '' },
  { value: 'analysis', label: '数据分析', tag: 'success' },
  { value: 'general', label: '通用', tag: 'info' },
]
const _btLabel = Object.fromEntries(BT_OPTIONS.map(o => [o.value, o.label]))
const _btTag = Object.fromEntries(BT_OPTIONS.map(o => [o.value, o.tag || 'info']))
const btLabel = v => _btLabel[v] || v || '通用'
const btTagType = v => _btTag[v] || 'info'

const models = ref([])
const backends = ref([])
const loading = ref(false)
const syncing = ref(false)
const search = ref('')
const filterBusinessType = ref('')
const filterBackendId = ref('')
const filterVisible = ref('')
const filterActive = ref('')
const groupMode = ref('business_type')
let debounceTimer = null

const editVisible = ref(false)
const saving = ref(false)
const editForm = reactive({ id: null, model_id: '', name: '', description: '', business_type: 'general', is_active: true, is_visible: true, source_backend: null, pricing_prompt: 0, pricing_completion: 0, pricing_prompt_per_m: 0, pricing_completion_per_m: 0, is_free: false })

const syncDialogVisible = ref(false)
const syncBackendId = ref(null)

const exchangeRate = ref(0)

// 批量操作
const selectionMap = ref({})
const batchBizType = ref('')
const batchVisible = ref('')
const batchActive = ref('')
const batchFree = ref('')
const batching = ref(false)

const selectedIds = computed(() => {
  const ids = []
  for (const arr of Object.values(selectionMap.value)) {
    for (const row of arr) ids.push(row.id)
  }
  return ids
})

const totalCount = computed(() => models.value.length)
const activeCount = computed(() => models.value.filter(m => m.is_active).length)
const freeCount = computed(() => models.value.filter(m => m.is_free).length)
const paidCount = computed(() => models.value.filter(m => !m.is_free).length)

const displayGroups = computed(() => {
  const list = models.value
  if (groupMode.value === 'none') {
    return [{ key: 'all', showTitle: false, title: '', tagType: 'info', items: list }]
  }
  const map = new Map()
  for (const m of list) {
    let key, title, tagType
    if (groupMode.value === 'source_backend') {
      key = m.source_backend ? `backend_${m.source_backend}` : 'no_backend'
      title = m.source_backend_name || '未指定来源后端'
      tagType = m.source_backend ? '' : 'info'
    } else {
      key = m.business_type || 'general'
      title = btLabel(key)
      tagType = btTagType(key)
    }
    if (!map.has(key)) map.set(key, { key, showTitle: true, title, tagType, items: [] })
    map.get(key).items.push(m)
  }
  if (groupMode.value === 'business_type') {
    const order = BT_OPTIONS.map(o => o.value)
    const sorted = []
    for (const bt of order) { if (map.has(bt)) sorted.push(map.get(bt)) }
    for (const [k, g] of map) { if (!order.includes(k)) sorted.push(g) }
    return sorted
  }
  return [...map.values()]
})

const onSelChange = (selection, groupKey) => { selectionMap.value = { ...selectionMap.value, [groupKey]: selection } }
const clearSelection = () => { selectionMap.value = {} }

const fmtCtx = len => { const n = Number(len) || 0; return n <= 0 ? '—' : `${(n / 1000).toFixed(0)}K` }
const fmtPrice = p => { const v = Number(p) || 0; return v > 0 ? `$${(v * 1e6).toFixed(2)}` : 'Free' }
const pClass = p => Number(p) > 0 ? 'price-paid' : 'price-free'
const cnyPrice = p => { const v = (Number(p) || 0) * 1e6 * (Number(exchangeRate.value) || 0); return v.toFixed(2) }
const sourceTooltip = row => (row.source_backends_info || []).map(b => {
  return b.groups?.length ? `${b.name}（组: ${b.groups.join('/')}）` : b.name
}).join('\n')
const mapRow = m => ({ ...m, _tv: false, _ta: false })

const loadBackends = async () => { try { backends.value = (await getBackends()).results || (await getBackends()) || [] } catch { backends.value = [] } }
const loadExchangeRate = async () => {
  try {
    const res = await getExchangeRate()
    exchangeRate.value = Number(res.usd_to_cny) || 0
  } catch { exchangeRate.value = 0 }
}
const loadModels = async () => {
  loading.value = true
  try {
    const res = await getAdminModels({ q: search.value || undefined, is_free: undefined, is_active: filterActive.value || undefined, business_type: filterBusinessType.value || undefined, source_backend: filterBackendId.value || undefined, is_visible: filterVisible.value || undefined })
    models.value = (res.results || res).map(mapRow)
    clearSelection()
  } finally { loading.value = false }
}
const debounceSearch = () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(loadModels, 300) }

const toggleField = async (row, field, loadingKey) => {
  row[loadingKey] = true
  try { await updateAdminModel(row.id, { [field]: row[field] }); ElMessage.success('更新成功') }
  catch { row[field] = !row[field] }
  finally { row[loadingKey] = false }
}

const openEdit = row => {
  const pp = Number(row.pricing_prompt) || 0
  const pc = Number(row.pricing_completion) || 0
  Object.assign(editForm, {
    id: row.id,
    model_id: row.model_id,
    name: row.name,
    description: row.description || '',
    business_type: row.business_type || 'general',
    is_active: row.is_active,
    is_visible: row.is_visible !== false,
    source_backend: row.source_backend ?? null,
    pricing_prompt: pp,
    pricing_completion: pc,
    // 展示给用户的是 "美元 / 百万 tokens"，便于输入
    pricing_prompt_per_m: Number((pp * 1e6).toFixed(4)),
    pricing_completion_per_m: Number((pc * 1e6).toFixed(4)),
    is_free: !!row.is_free,
  })
  editVisible.value = true
}
const saveEdit = async () => {
  saving.value = true
  try {
    const perTokenPrompt = Number((Number(editForm.pricing_prompt_per_m || 0) / 1e6).toFixed(8))
    const perTokenCompletion = Number((Number(editForm.pricing_completion_per_m || 0) / 1e6).toFixed(8))
    const payload = {
      name: editForm.name,
      description: editForm.description,
      business_type: editForm.business_type,
      is_active: editForm.is_active,
      is_visible: editForm.is_visible,
      source_backend: editForm.source_backend || null,
      pricing_prompt: perTokenPrompt,
      pricing_completion: perTokenCompletion,
      is_free: editForm.is_free,
    }
    await updateAdminModel(editForm.id, payload)
    ElMessage.success('保存成功')
    editVisible.value = false
    await loadModels()
  } finally { saving.value = false }
}

const doBatchApply = async () => {
  if (!selectedIds.value.length) return ElMessage.warning('请先选择模型')
  const payload = { model_ids: selectedIds.value }
  if (batchBizType.value) payload.business_type = batchBizType.value
  if (batchVisible.value !== '') payload.is_visible = batchVisible.value === 'true'
  if (batchActive.value !== '') payload.is_active = batchActive.value === 'true'
  if (batchFree.value !== '') payload.is_free = batchFree.value === 'true'
  if (Object.keys(payload).length <= 1) {
    return ElMessage.warning('请至少选择一项要批量修改的内容')
  }
  batching.value = true
  try {
    const res = await batchUpdateModels(payload)
    ElMessage.success(res.msg || '批量更新成功')
    batchBizType.value = ''
    batchVisible.value = ''
    batchActive.value = ''
    batchFree.value = ''
    clearSelection()
    await loadModels()
  } finally { batching.value = false }
}

const openSyncDialog = async () => {
  if (!backends.value.length) await loadBackends()
  if (!backends.value.length) { ElMessage.warning('暂无已配置的后端，请先添加'); return }
  syncBackendId.value = null
  syncDialogVisible.value = true
}
const confirmSync = async () => {
  if (!syncBackendId.value) return
  syncing.value = true
  try {
    const res = await syncModels({ backend_id: syncBackendId.value })
    ElMessage.success(res.msg || '同步成功')
    syncDialogVisible.value = false
    await loadModels()
  } finally { syncing.value = false }
}

onMounted(async () => {
  await Promise.all([loadBackends(), loadExchangeRate()])
  await loadModels()
})
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; }
.page-title { font-size: 20px; font-weight: 700; color: #1a1a2e; }
.header-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.stats-bar { background: #fff; border-radius: 12px; padding: 14px 24px; margin-bottom: 14px; display: flex; align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.sb-item { display: flex; flex-direction: column; align-items: center; flex: 1; }
.sb-num { font-size: 26px; font-weight: 800; color: #1a1a2e; line-height: 1; }
.sb-label { font-size: 12px; color: #888; margin-top: 4px; }
.sb-divider { width: 1px; height: 40px; background: #f0f0f0; }
.toolbar-bar { background: #fff; border-radius: 10px; padding: 10px 16px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 1px 4px rgba(0,0,0,0.04); flex-wrap: wrap; gap: 8px; }
.toolbar-left { display: flex; align-items: center; gap: 8px; }
.toolbar-label { font-size: 13px; color: #666; }
.toolbar-right { display: flex; align-items: center; gap: 8px; }
.table-card { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.model-group { margin-bottom: 20px; }
.model-group:last-of-type { margin-bottom: 0; }
.group-title { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding: 8px 4px 4px; border-bottom: 1px solid #f0f0f0; }
.group-count { font-size: 12px; color: #888; margin-left: auto; }
.model-id { font-family: monospace; font-size: 12px; color: #555; }
.pricing-cell { font-size: 12px; white-space: nowrap; }
.pricing-sep { color: #ccc; margin: 0 4px; }
.pricing-cny { font-size: 11px; color: #9ca3af; margin-top: 2px; }
.price-paid { color: #f59e0b; }
.price-free { color: #10b981; }
.price-hint { font-size: 11px; color: #9ca3af; margin-top: 4px; line-height: 1.4; }
.source-cell { display: flex; flex-wrap: wrap; gap: 4px; }
.source-tag { max-width: 100%; }
.source-group { color: #909399; margin-left: 2px; font-size: 11px; }
.tbl-footer { margin-top: 14px; display: flex; justify-content: flex-end; }
.sync-hint { font-size: 13px; color: #666; margin: 0 0 14px; line-height: 1.5; }
</style>
