<template>
  <div>
    <div class="page-header">
      <div class="page-title">路由规则管理</div>
      <div class="header-actions">
        <el-button type="primary" :icon="Plus" @click="openCreate">添加规则</el-button>
      </div>
    </div>

    <el-alert type="info" :closable="false" style="margin-bottom: 14px">
      路由规则按优先级（数值越小越优先）匹配。请求到达时，系统依次匹配规则，找到第一条满足条件的规则后，从该规则关联的后端（及后端组内后端）中按负载策略选择一个后端进行转发。
    </el-alert>

    <div class="table-card" v-loading="loading">
      <el-table :data="rules" stripe border>
        <el-table-column prop="id" label="ID" width="56" />
        <el-table-column prop="name" label="规则名称" min-width="140" />
        <el-table-column label="优先级" width="80" align="center" prop="priority" />
        <el-table-column label="匹配类型" width="130">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.match_type_display }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="匹配值" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <template v-if="row.match_type === 'user_exact'">
              <el-tag v-for="u in (row.match_users_info || [])" :key="u.id" size="small" style="margin:2px">@{{ u.username }}</el-tag>
              <span v-if="!row.match_users_info?.length" style="color:#999;font-size:12px">未指定用户</span>
            </template>
            <span v-else class="mono-text">{{ displayMatchValue(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="负载策略" width="110">
          <template #default="{ row }">{{ row.strategy_display }}</template>
        </el-table-column>
        <el-table-column label="关联后端" min-width="200">
          <template #default="{ row }">
            <div class="backend-tags">
              <el-tag
                v-for="b in row.backends_info"
                :key="b.id"
                size="small"
                :type="b.health_status === 'healthy' ? 'success' : 'warning'"
                style="margin: 2px"
              >
                {{ b.name }}
              </el-tag>
              <span v-if="!row.backends_info?.length" style="color: #999; font-size: 12px">未关联</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="关联后端组" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            <template v-if="row.backend_group_info">
              <el-tag size="small" type="info">{{ row.backend_group_info.name }}</el-tag>
            </template>
            <span v-else style="color: #999; font-size: 12px">—</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="70">
          <template #default="{ row }">
            <el-switch v-model="row.is_active" @change="toggleRule(row)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" text @click="openEdit(row)">编辑</el-button>
            <el-popconfirm title="确认删除该规则？" @confirm="doDelete(row)">
              <template #reference>
                <el-button size="small" type="danger" text>删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 创建/编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="isEdit ? '编辑规则' : '添加规则'" width="640px" destroy-on-close>
      <el-form :model="form" label-width="110px">
        <el-form-item label="规则名称" required>
          <el-input v-model="form.name" placeholder="例如：Claude 模型专属通道" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" placeholder="可选描述" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="匹配类型" required>
              <el-select v-model="form.match_type" style="width: 100%" placeholder="选择匹配类型">
                <el-option
                  v-for="opt in gatewayMeta.match_types"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="匹配值">
              <template v-if="form.match_type === 'all'">
                <el-input model-value="（全部匹配无需填写）" disabled style="width: 100%" />
              </template>
              <el-select
                v-else-if="form.match_type === 'user_tier'"
                v-model="form.match_value"
                style="width: 100%"
                placeholder="选择用户等级"
                clearable
                filterable
              >
                <el-option
                  v-for="opt in gatewayMeta.user_tiers"
                  :key="opt.value"
                  :label="`${opt.value}（${opt.label}）`"
                  :value="opt.value"
                />
              </el-select>
              <el-select
                v-else-if="form.match_type === 'business_type'"
                v-model="form.match_value"
                style="width: 100%"
                placeholder="选择业务类型"
                clearable
                filterable
              >
                <el-option
                  v-for="opt in gatewayMeta.business_types"
                  :key="opt.value"
                  :label="`${opt.value}（${opt.label}）`"
                  :value="opt.value"
                />
              </el-select>
              <template v-else-if="form.match_type === 'user_exact'">
                <el-input model-value="（请在下方选择指定用户）" disabled style="width: 100%" />
              </template>
              <el-input
                v-else
                v-model="form.match_value"
                :placeholder="matchPlaceholder"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="优先级">
              <el-input-number v-model="form.priority" :min="1" :max="9999" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="负载策略">
              <el-select v-model="form.strategy" style="width: 100%" placeholder="选择策略">
                <el-option
                  v-for="opt in gatewayMeta.strategies"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item v-if="form.match_type === 'user_exact'" label="指定用户" required>
          <el-select v-model="form.match_users" multiple filterable placeholder="选择要匹配的用户" style="width: 100%">
            <el-option v-for="u in gatewayMeta.users" :key="u.id" :label="`@${u.username}`" :value="u.id" />
          </el-select>
          <div class="form-hint">该规则仅对选中的用户生效，请求将转发到下方指定的后端。</div>
        </el-form-item>
        <el-form-item label="关联后端">
          <el-select v-model="form.backends" multiple placeholder="可选：直接选择后端" style="width: 100%">
            <el-option v-for="b in allBackends" :key="b.id" :label="`${b.name} (${b.base_url})`" :value="b.id" />
          </el-select>
          <div class="form-hint">可与下方「关联后端组」同时填写；至少填写其一。</div>
        </el-form-item>
        <el-form-item label="关联后端组">
          <el-select
            v-model="form.backend_group"
            clearable
            placeholder="可选：选择后端组"
            style="width: 100%"
          >
            <el-option v-for="g in allBackendGroups" :key="g.id" :label="g.name" :value="g.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.is_active" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  getRoutingRules,
  createRoutingRule,
  updateRoutingRule,
  deleteRoutingRule,
  getBackends,
  getBackendGroups,
  getGatewayMeta,
} from '../../api/admin'

const rules = ref([])
const allBackends = ref([])
const allBackendGroups = ref([])
const loading = ref(false)
const formVisible = ref(false)
const isEdit = ref(false)
const saving = ref(false)

const gatewayMeta = reactive({
  match_types: [],
  strategies: [],
  user_tiers: [],
  business_types: [],
  users: [],
})

const formDefaults = {
  id: null,
  name: '',
  description: '',
  priority: 100,
  match_type: 'all',
  match_value: '',
  match_users: [],
  backends: [],
  backend_group: null,
  strategy: 'round_robin',
  is_active: true,
}
const form = reactive({ ...formDefaults })

const matchPlaceholder = computed(() => {
  const m = {
    all: '(无需填写)',
    model_prefix: '如 anthropic/',
    model_exact: '如 openai/gpt-4o',
    user_tier: '请选择用户等级',
    user_exact: '(请在下方选择用户)',
    business_type: '请选择业务类型',
  }
  return m[form.match_type] || ''
})

const choiceLabelMap = computed(() => {
  const map = new Map()
  for (const opt of gatewayMeta.user_tiers) {
    map.set(`tier:${opt.value}`, opt.label)
  }
  for (const opt of gatewayMeta.business_types) {
    map.set(`biz:${opt.value}`, opt.label)
  }
  return map
})

function displayMatchValue(row) {
  if (row.match_type === 'all' || !row.match_value) return '(全部)'
  if (row.match_type === 'user_tier') {
    const label = choiceLabelMap.value.get(`tier:${row.match_value}`)
    return label ? `${row.match_value}（${label}）` : row.match_value
  }
  if (row.match_type === 'business_type') {
    const label = choiceLabelMap.value.get(`biz:${row.match_value}`)
    return label ? `${row.match_value}（${label}）` : row.match_value
  }
  return row.match_value
}

watch(
  () => form.match_type,
  (next) => {
    if (next === 'all' || next === 'user_exact') {
      form.match_value = ''
    }
    if (next !== 'user_exact') {
      form.match_users = []
    }
  }
)

const loadData = async () => {
  loading.value = true
  try {
    const [rulesRes, backendsRes, groupsRes, metaRes] = await Promise.all([
      getRoutingRules(),
      getBackends(),
      getBackendGroups(),
      getGatewayMeta(),
    ])
    rules.value = rulesRes.results || rulesRes
    allBackends.value = backendsRes.results || backendsRes
    allBackendGroups.value = groupsRes.results || groupsRes
    const meta = metaRes || {}
    gatewayMeta.match_types = meta.match_types || []
    gatewayMeta.strategies = meta.strategies || []
    gatewayMeta.user_tiers = meta.user_tiers || []
    gatewayMeta.business_types = meta.business_types || []
    gatewayMeta.users = meta.users || []
  } finally {
    loading.value = false
  }
}

const toggleRule = async (row) => {
  try {
    await updateRoutingRule(row.id, { is_active: row.is_active })
    ElMessage.success(row.is_active ? '已启用' : '已禁用')
  } catch {
    row.is_active = !row.is_active
  }
}

const openCreate = () => {
  Object.assign(form, { ...formDefaults, backends: [], backend_group: null, match_users: [] })
  isEdit.value = false
  formVisible.value = true
}

const openEdit = (row) => {
  Object.assign(form, {
    id: row.id,
    name: row.name,
    description: row.description || '',
    priority: row.priority,
    match_type: row.match_type,
    match_value: row.match_value || '',
    match_users: row.match_users_info?.map((u) => u.id) || [],
    backends: row.backends_info?.map((b) => b.id) || [],
    backend_group: row.backend_group ?? null,
    strategy: row.strategy,
    is_active: row.is_active,
  })
  isEdit.value = true
  formVisible.value = true
}

const saveForm = async () => {
  if (!form.name) return ElMessage.warning('请填写规则名称')
  if (!form.backends.length && (form.backend_group === null || form.backend_group === undefined)) {
    return ElMessage.warning('请至少选择「关联后端」或「关联后端组」之一')
  }
  if (form.match_type === 'user_exact' && !form.match_users.length) {
    return ElMessage.warning('指定用户匹配类型需要选择至少一个用户')
  }
  if (!['all', 'user_exact'].includes(form.match_type) && !String(form.match_value || '').trim()) {
    return ElMessage.warning('请填写或选择匹配值')
  }
  saving.value = true
  try {
    const data = {
      name: form.name,
      description: form.description,
      priority: form.priority,
      match_type: form.match_type,
      match_value: ['all', 'user_exact'].includes(form.match_type) ? '' : String(form.match_value || '').trim(),
      match_users: form.match_type === 'user_exact' ? form.match_users : [],
      backends: form.backends,
      backend_group: form.backend_group ?? null,
      strategy: form.strategy,
      is_active: form.is_active,
    }
    if (isEdit.value) {
      await updateRoutingRule(form.id, data)
    } else {
      await createRoutingRule(data)
    }
    ElMessage.success('保存成功')
    formVisible.value = false
    await loadData()
  } finally {
    saving.value = false
  }
}

const doDelete = async (row) => {
  try {
    await deleteRoutingRule(row.id)
    ElMessage.success('已删除')
    await loadData()
  } catch {}
}

onMounted(loadData)
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.page-title {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
}
.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}
.table-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}
.mono-text {
  font-family: monospace;
  font-size: 12px;
  color: #555;
}
.backend-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}
.form-hint {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}
</style>
