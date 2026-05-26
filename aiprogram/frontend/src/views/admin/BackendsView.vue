<template>
  <div>
    <el-tabs v-model="activeMainTab" class="main-tabs">
      <el-tab-pane label="API 后端" name="backends">
        <div class="page-header">
          <div class="page-title">API 后端管理</div>
          <div class="header-actions">
            <el-input v-model="search" placeholder="搜索名称或URL" clearable style="width:200px" :prefix-icon="Search" @input="debounceSearch" />
            <el-select v-model="filterHealth" placeholder="健康状态" clearable style="width:120px" @change="loadBackends">
              <el-option label="健康" value="healthy" />
              <el-option label="降级" value="degraded" />
              <el-option label="不可用" value="down" />
            </el-select>
            <el-button type="primary" :icon="Plus" @click="openCreate">添加后端</el-button>
          </div>
        </div>

        <div class="stats-bar">
          <div class="sb-item">
            <span class="sb-num">{{ backends.length }}</span>
            <span class="sb-label">后端总数</span>
          </div>
          <div class="sb-divider" />
          <div class="sb-item">
            <span class="sb-num" style="color:#10b981">{{ backends.filter(b => b.is_active).length }}</span>
            <span class="sb-label">已启用</span>
          </div>
          <div class="sb-divider" />
          <div class="sb-item">
            <span class="sb-num" style="color:#22c55e">{{ backends.filter(b => b.health_status === 'healthy').length }}</span>
            <span class="sb-label">健康</span>
          </div>
          <div class="sb-divider" />
          <div class="sb-item">
            <span class="sb-num" style="color:#ef4444">{{ backends.filter(b => b.health_status === 'down').length }}</span>
            <span class="sb-label">不可用</span>
          </div>
        </div>

        <div class="table-card" v-loading="loading">
          <el-table :data="backends" stripe border>
            <el-table-column prop="id" label="ID" width="56" />
            <el-table-column prop="name" label="名称" min-width="120" />
            <el-table-column label="协议" width="92" align="center">
              <template #default="{ row }">
                <el-tag :type="row.backend_type === 'anthropic' ? 'warning' : 'success'" size="small" effect="plain">
                  {{ row.backend_type === 'anthropic' ? 'Anthropic' : 'OpenAI' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="base_url" label="API 地址" min-width="240" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="mono-text">{{ row.base_url }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="api_key_masked" label="API Key" width="160">
              <template #default="{ row }">
                <span class="mono-text">{{ row.api_key_masked }}</span>
              </template>
            </el-table-column>
            <el-table-column label="权重" width="70" align="center" prop="weight" />
            <el-table-column label="定价倍率" width="88" align="center">
              <template #default="{ row }">{{ Number(row.pricing_multiplier ?? 1).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="统计系数" width="88" align="center">
              <template #default="{ row }">{{ Number(row.stats_request_multiplier ?? 1).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="健康" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="healthType(row.health_status)" size="small" effect="light">
                  {{ healthLabel(row.health_status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="请求数" width="90" align="right" prop="total_requests" />
            <el-table-column label="Tokens" width="100" align="right">
              <template #default="{ row }">{{ formatNumber(row.total_tokens) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="70">
              <template #default="{ row }">
                <el-switch v-model="row.is_active" :loading="row._toggling" @change="toggleActive(row)" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button size="small" type="primary" text @click="openEdit(row)">编辑</el-button>
                <el-button size="small" type="success" text :loading="row._testing" @click="doTest(row)">测试</el-button>
                <el-button size="small" type="warning" text @click="doResetHealth(row)" :disabled="row.health_status === 'healthy'">重置</el-button>
                <el-popconfirm title="确认删除该后端？" @confirm="doDelete(row)">
                  <template #reference>
                    <el-button size="small" type="danger" text>删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <el-tab-pane label="后端组" name="groups">
        <div class="page-header">
          <div class="page-title">后端组管理</div>
          <div class="header-actions">
            <el-button type="primary" :icon="Plus" @click="openGroupCreate">新建后端组</el-button>
          </div>
        </div>

        <div class="table-card" v-loading="groupsLoading">
          <el-table :data="backendGroups" stripe border>
            <el-table-column prop="id" label="ID" width="64" />
            <el-table-column prop="name" label="名称" min-width="120" />
            <el-table-column prop="description" label="描述" min-width="140" show-overflow-tooltip />
            <el-table-column label="负载策略" width="120">
              <template #default="{ row }">{{ strategyLabel(row.strategy) }}</template>
            </el-table-column>
            <el-table-column label="成员后端" min-width="220">
              <template #default="{ row }">
                <div class="group-members" v-if="(row.backends_info || []).length">
                  <el-tag
                    v-for="b in row.backends_info"
                    :key="b.id"
                    size="small"
                    class="member-tag"
                    effect="plain"
                  >
                    {{ b.name }}
                    <span class="member-meta">({{ healthLabel(b.health_status) }})</span>
                  </el-tag>
                </div>
                <span v-else class="text-muted">暂无成员</span>
              </template>
            </el-table-column>
            <el-table-column label="启用" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="row.is_active ? 'success' : 'info'" size="small">{{ row.is_active ? '是' : '否' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button size="small" type="primary" text @click="openGroupEdit(row)">编辑</el-button>
                <el-popconfirm title="确认删除该后端组？" @confirm="doDeleteGroup(row)">
                  <template #reference>
                    <el-button size="small" type="danger" text>删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 创建/编辑后端弹窗 -->
    <el-dialog v-model="formVisible" :title="isEdit ? '编辑后端' : '添加后端'" width="560px" destroy-on-close>
      <el-form :model="form" label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="例如：OpenRouter-Main" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" placeholder="可选描述" />
        </el-form-item>
        <el-form-item label="协议类型" required>
          <el-select v-model="form.backend_type" style="width:100%">
            <el-option value="openai" label="OpenAI 兼容（OpenRouter / DeepSeek / 通义 / Moonshot 等）" />
            <el-option value="anthropic" label="Anthropic Messages（Claude / CMI Cloudcode / tokenrouterapi 等）" />
          </el-select>
          <div class="form-hint">
            openai：POST /v1/chat/completions，Authorization: Bearer …；
            anthropic：POST /v1/messages，x-api-key + anthropic-version
          </div>
        </el-form-item>
        <el-form-item label="API 地址" required>
          <el-input v-model="form.base_url"
                    :placeholder="form.backend_type === 'anthropic'
                      ? 'https://tokenrouterapi.com（或 https://api.anthropic.com）'
                      : 'https://openrouter.ai/api/v1'" />
        </el-form-item>
        <el-form-item label="API Key" required>
          <el-input v-model="form.api_key" placeholder="sk-..." show-password />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="权重">
              <el-input-number v-model="form.weight" :min="1" :max="100" controls-position="right" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="超时(秒)">
              <el-input-number v-model="form.timeout_seconds" :min="5" :max="300" controls-position="right" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="启用">
          <el-switch v-model="form.is_active" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="RPM上限">
              <el-input-number v-model="form.max_rpm" :min="0" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="最大并发">
              <el-input-number v-model="form.max_concurrent" :min="0" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="定价倍率">
              <el-input-number v-model="form.pricing_multiplier" :min="0" :max="1000" :step="0.01" :precision="4" style="width:100%" />
              <div class="form-hint">同步模型时：上游单价 × 此值写入模型定价</div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="请求统计系数">
              <el-input-number v-model="form.stats_request_multiplier" :min="0" :max="1000" :step="0.1" :precision="4" style="width:100%" />
              <div class="form-hint">网关日志每条请求的统计权重（等效请求数）</div>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveForm">保存</el-button>
      </template>
    </el-dialog>

    <!-- 创建/编辑后端组弹窗 -->
    <el-dialog v-model="groupFormVisible" :title="groupIsEdit ? '编辑后端组' : '新建后端组'" width="560px" destroy-on-close>
      <el-form :model="groupForm" label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="groupForm.name" placeholder="唯一组名" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="groupForm.description" type="textarea" :rows="2" placeholder="可选描述" />
        </el-form-item>
        <el-form-item label="负载策略" required>
          <el-select v-model="groupForm.strategy" placeholder="选择策略" style="width:100%">
            <el-option
              v-for="opt in strategyOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="成员后端">
          <el-select
            v-model="groupForm.backends"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="选择后端（可多选）"
            style="width:100%"
          >
            <el-option
              v-for="b in allBackends"
              :key="b.id"
              :label="`${b.name} (#${b.id})`"
              :value="b.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="groupForm.is_active" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="groupFormVisible = false">取消</el-button>
        <el-button type="primary" :loading="groupSaving" @click="saveGroupForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Plus } from '@element-plus/icons-vue'
import {
  getBackends, createBackend, updateBackend, deleteBackend,
  resetBackendHealth, testBackend,
  getBackendGroups, createBackendGroup, updateBackendGroup, deleteBackendGroup,
} from '../../api/admin'

const activeMainTab = ref('backends')

const backends = ref([])
const loading = ref(false)
const search = ref('')
const filterHealth = ref('')
let debounceTimer = null

const formVisible = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const formDefaults = {
  id: null, name: '', description: '', backend_type: 'openai',
  base_url: '', api_key: '',
  weight: 1, timeout_seconds: 60, max_rpm: 0, max_concurrent: 0, is_active: true,
  pricing_multiplier: 1, stats_request_multiplier: 1,
}
const form = reactive({ ...formDefaults })

const allBackends = ref([])
const backendGroups = ref([])
const groupsLoading = ref(false)
const groupFormVisible = ref(false)
const groupIsEdit = ref(false)
const groupSaving = ref(false)
const groupFormDefaults = {
  id: null,
  name: '',
  description: '',
  strategy: 'round_robin',
  backends: [],
  is_active: true,
}
const groupForm = reactive({ ...groupFormDefaults })

const strategyOptions = [
  { value: 'round_robin', label: '轮询' },
  { value: 'weighted', label: '加权轮询' },
  { value: 'random', label: '随机' },
  { value: 'least_used', label: '最少使用' },
]

const strategyLabel = (s) => strategyOptions.find(o => o.value === s)?.label || s

const healthType = (s) => ({ healthy: 'success', degraded: 'warning', down: 'danger' }[s] || 'info')
const healthLabel = (s) => ({ healthy: '健康', degraded: '降级', down: '不可用' }[s] || s)
const formatNumber = (n) => n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n)

const normalizeList = (res) => {
  if (Array.isArray(res)) return res
  if (res?.results) return res.results
  return []
}

const loadAllBackends = async () => {
  try {
    const res = await getBackends()
    allBackends.value = normalizeList(res)
  } catch {
    allBackends.value = []
  }
}

const loadBackends = async () => {
  loading.value = true
  try {
    const res = await getBackends({
      q: search.value || undefined,
      health_status: filterHealth.value || undefined,
    })
    backends.value = normalizeList(res).map(b => ({ ...b, _toggling: false, _testing: false }))
  } finally {
    loading.value = false
  }
}

const loadGroups = async () => {
  groupsLoading.value = true
  try {
    const res = await getBackendGroups()
    backendGroups.value = normalizeList(res)
  } finally {
    groupsLoading.value = false
  }
}

watch(activeMainTab, (t) => {
  if (t === 'groups') {
    loadGroups()
    loadAllBackends()
  }
})

const debounceSearch = () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(loadBackends, 300) }

const toggleActive = async (row) => {
  row._toggling = true
  try {
    await updateBackend(row.id, { is_active: row.is_active })
    ElMessage.success(row.is_active ? '已启用' : '已禁用')
  } catch { row.is_active = !row.is_active } finally { row._toggling = false }
}

const openCreate = () => {
  Object.assign(form, { ...formDefaults })
  isEdit.value = false
  formVisible.value = true
}

const openEdit = (row) => {
  Object.assign(form, {
    id: row.id, name: row.name, description: row.description || '',
    backend_type: row.backend_type || 'openai',
    base_url: row.base_url, api_key: '',
    weight: row.weight, timeout_seconds: row.timeout_seconds,
    max_rpm: row.max_rpm, max_concurrent: row.max_concurrent,
    is_active: row.is_active,
    pricing_multiplier: Number(row.pricing_multiplier ?? 1),
    stats_request_multiplier: Number(row.stats_request_multiplier ?? 1),
  })
  isEdit.value = true
  formVisible.value = true
}

const saveForm = async () => {
  if (!form.name || !form.base_url) {
    return ElMessage.warning('请填写名称和 API 地址')
  }
  if (!isEdit.value && !form.api_key) {
    return ElMessage.warning('请填写 API Key')
  }
  saving.value = true
  try {
    const data = { ...form }
    if (isEdit.value && !data.api_key) delete data.api_key
    delete data.id
    if (isEdit.value) {
      await updateBackend(form.id, data)
    } else {
      await createBackend(data)
    }
    ElMessage.success('保存成功')
    formVisible.value = false
    await loadBackends()
    await loadAllBackends()
  } finally { saving.value = false }
}

const doTest = async (row) => {
  row._testing = true
  try {
    const res = await testBackend(row.id)
    ElMessage.success(res.msg || '测试完成')
    await loadBackends()
  } catch (e) {
    ElMessage.error(e.response?.data?.msg || '测试失败')
  } finally { row._testing = false }
}

const doResetHealth = async (row) => {
  try {
    await resetBackendHealth(row.id)
    ElMessage.success('健康状态已重置')
    await loadBackends()
  } catch {}
}

const doDelete = async (row) => {
  try {
    await deleteBackend(row.id)
    ElMessage.success('已删除')
    await loadBackends()
    await loadAllBackends()
  } catch {}
}

const openGroupCreate = () => {
  Object.assign(groupForm, { ...groupFormDefaults, backends: [] })
  groupIsEdit.value = false
  groupFormVisible.value = true
  loadAllBackends()
}

const openGroupEdit = (row) => {
  const ids = Array.isArray(row.backends) ? [...row.backends] : (row.backends_info || []).map(b => b.id)
  Object.assign(groupForm, {
    id: row.id,
    name: row.name,
    description: row.description || '',
    strategy: row.strategy || 'round_robin',
    backends: ids,
    is_active: row.is_active !== false,
  })
  groupIsEdit.value = true
  groupFormVisible.value = true
  loadAllBackends()
}

const saveGroupForm = async () => {
  if (!groupForm.name?.trim()) {
    return ElMessage.warning('请填写组名称')
  }
  groupSaving.value = true
  try {
    const payload = {
      name: groupForm.name.trim(),
      description: groupForm.description || '',
      strategy: groupForm.strategy,
      backends: groupForm.backends || [],
      is_active: groupForm.is_active,
    }
    if (groupIsEdit.value) {
      await updateBackendGroup(groupForm.id, payload)
    } else {
      await createBackendGroup(payload)
    }
    ElMessage.success('保存成功')
    groupFormVisible.value = false
    await loadGroups()
  } finally {
    groupSaving.value = false
  }
}

const doDeleteGroup = async (row) => {
  try {
    await deleteBackendGroup(row.id)
    ElMessage.success('已删除')
    await loadGroups()
  } catch {}
}

onMounted(() => {
  loadBackends()
  loadAllBackends()
})
</script>

<style scoped>
.main-tabs { margin-bottom: 0; }
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.page-title { font-size: 20px; font-weight: 700; color: #1a1a2e; }
.header-actions { display: flex; gap: 10px; align-items: center; }
.stats-bar { background: #fff; border-radius: 12px; padding: 14px 24px; margin-bottom: 14px; display: flex; align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.sb-item { display: flex; flex-direction: column; align-items: center; flex: 1; }
.sb-num { font-size: 26px; font-weight: 800; color: #1a1a2e; line-height: 1; }
.sb-label { font-size: 12px; color: #888; margin-top: 4px; }
.sb-divider { width: 1px; height: 40px; background: #f0f0f0; }
.table-card { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.mono-text { font-family: monospace; font-size: 12px; color: #555; }
.group-members { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.member-tag { margin: 0; }
.member-meta { font-size: 11px; color: #888; margin-left: 2px; }
.text-muted { color: #999; font-size: 13px; }
.form-hint { font-size: 12px; color: #909399; margin-top: 4px; line-height: 1.4; }
</style>
