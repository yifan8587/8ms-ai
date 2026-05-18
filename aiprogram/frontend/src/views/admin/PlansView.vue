<template>
  <div>
    <div class="page-header">
      <div class="page-title">订阅套餐管理</div>
      <div class="header-actions">
        <el-button type="primary" :icon="Plus" @click="openCreate">新建套餐</el-button>
      </div>
    </div>

    <div class="table-card" v-loading="loading">
      <el-table :data="sortedPlans" stripe border>
        <el-table-column prop="id" label="ID" width="64" />
        <el-table-column prop="name" label="套餐名称" min-width="140" show-overflow-tooltip />
        <el-table-column label="等级" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="TIER_TAG[row.tier]" size="small" effect="light">
              {{ row.tier_display || tierLabel(row.tier) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="月价" width="100" align="right">
          <template #default="{ row }">¥{{ formatPrice(row.monthly_price) }}</template>
        </el-table-column>
        <el-table-column label="折扣系数" width="110" align="right">
          <template #default="{ row }">{{ formatDiscount(row.discount) }}</template>
        </el-table-column>
        <el-table-column label="月 Token 上限" width="120" align="right">
          <template #default="{ row }">{{ formatLimit(row.monthly_token_limit) }}</template>
        </el-table-column>
        <el-table-column label="日请求上限" width="110" align="right">
          <template #default="{ row }">{{ formatLimit(row.daily_request_limit) }}</template>
        </el-table-column>
        <el-table-column label="最大上下文条数" width="120" align="right">
          <template #default="{ row }">{{ row.max_context_length ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="允许业务类型" min-width="200">
          <template #default="{ row }">
            <div class="tags-wrap">
              <template v-if="!row.allowed_business_types?.length">
                <el-tag type="info" size="small" effect="plain">全部</el-tag>
              </template>
              <el-tag
                v-for="t in row.allowed_business_types"
                :key="t"
                :type="businessTypeTagType(t)"
                size="small"
                effect="plain"
                class="tag-item"
              >
                {{ businessTypeLabel(t) }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="模型/组/后端" width="140" align="center">
          <template #default="{ row }">
            <div class="tags-wrap" style="justify-content:center">
              <el-tooltip v-if="row.allowed_models_count > 0" :content="`${row.allowed_models_count} 个指定模型`">
                <el-tag size="small" type="primary" effect="plain">模型 {{ row.allowed_models_count }}</el-tag>
              </el-tooltip>
              <el-tooltip v-if="row.allowed_backend_groups_info?.length" :content="row.allowed_backend_groups_info.map(g => g.name).join('、')">
                <el-tag size="small" type="warning" effect="plain">组 {{ row.allowed_backend_groups_info.length }}</el-tag>
              </el-tooltip>
              <el-tooltip v-if="row.allowed_backends_info?.length" :content="row.allowed_backends_info.map(b => b.name).join('、')">
                <el-tag size="small" type="success" effect="plain">后端 {{ row.allowed_backends_info.length }}</el-tag>
              </el-tooltip>
              <span v-if="row.allowed_models_count === -1 && !row.allowed_backend_groups_info?.length && !row.allowed_backends_info?.length" class="muted">全部</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="启用" width="88" align="center">
          <template #default="{ row }">
            <el-switch
              v-model="row.is_active"
              :loading="row._toggling"
              @change="toggleActive(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" text @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" text @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="tbl-footer">
        <span class="total-hint">共 {{ plans.length }} 条套餐</span>
      </div>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑套餐' : '新建套餐'"
      width="640px"
      destroy-on-close
      class="plan-dialog"
      @closed="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="132px">
        <el-form-item label="套餐名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入套餐名称" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="等级" prop="tier">
          <el-select v-model="form.tier" placeholder="选择等级" style="width: 100%">
            <el-option
              v-for="opt in TIER_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="套餐说明" />
        </el-form-item>
        <el-form-item label="月租价格" prop="monthly_price">
          <el-input-number
            v-model="form.monthly_price"
            :min="0"
            :precision="2"
            :step="1"
            controls-position="right"
            style="width: 100%"
          />
          <span class="unit-suffix">元/月</span>
        </el-form-item>
        <el-form-item label="充值折扣系数" prop="discount">
          <el-input-number
            v-model="form.discount"
            :min="0.0001"
            :precision="4"
            :step="0.1"
            controls-position="right"
            style="width: 100%"
          />
          <div class="field-hint">可用金额 = 充值金额 * (1 / 折扣系数)。例如 0.8 表示到账 1.25 倍。</div>
        </el-form-item>
        <el-form-item label="月 Token 上限" prop="monthly_token_limit">
          <el-input-number
            v-model="form.monthly_token_limit"
            :min="0"
            :step="1000"
            controls-position="right"
            style="width: 100%"
          />
          <div class="field-hint">0 表示不限制</div>
        </el-form-item>
        <el-form-item label="日请求上限" prop="daily_request_limit">
          <el-input-number
            v-model="form.daily_request_limit"
            :min="0"
            :step="10"
            controls-position="right"
            style="width: 100%"
          />
          <div class="field-hint">0 表示不限制</div>
        </el-form-item>
        <el-form-item label="最大上下文条数" prop="max_context_length">
          <el-input-number
            v-model="form.max_context_length"
            :min="1"
            :max="9999"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="允许业务类型">
          <div class="checkbox-grid">
            <el-checkbox-group v-model="form.allowed_business_types">
              <el-checkbox v-for="opt in BUSINESS_TYPE_OPTIONS" :key="opt.value" :value="opt.value">
                {{ opt.label }}（{{ opt.value }}）
              </el-checkbox>
            </el-checkbox-group>
          </div>
          <div class="field-hint">不勾选表示不限制（全部业务类型）</div>
        </el-form-item>
        <el-form-item label="可用模型">
          <el-select
            v-model="form.allowed_model_ids"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="不选表示不通过模型指定"
            style="width: 100%"
          >
            <el-option
              v-for="m in modelOptions"
              :key="m.id"
              :label="modelOptionLabel(m)"
              :value="m.id"
            />
          </el-select>
          <div class="field-hint">指定单个模型；与下方后端组/后端取并集</div>
        </el-form-item>
        <el-form-item label="可用后端组">
          <el-select
            v-model="form.allowed_backend_group_ids"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="不选表示不通过后端组指定"
            style="width: 100%"
          >
            <el-option v-for="g in backendGroupOptions" :key="g.id" :label="g.name" :value="g.id" />
          </el-select>
          <div class="field-hint">选择后端组后，组内后端提供的所有模型均可用</div>
        </el-form-item>
        <el-form-item label="可用后端">
          <el-select
            v-model="form.allowed_backend_ids"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="不选表示不通过后端指定"
            style="width: 100%"
          >
            <el-option v-for="b in backendOptions" :key="b.id" :label="`${b.name} (${b.base_url || ''})`" :value="b.id" />
          </el-select>
          <div class="field-hint">直接指定后端，该后端提供的所有模型均可用</div>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.is_active" />
        </el-form-item>
        <el-form-item label="排序" prop="sort_order">
          <el-input-number v-model="form.sort_order" :min="0" :max="99999" controls-position="right" />
          <span class="field-hint inline">数字越小越靠前</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getAdminModels,
  getBackendGroups,
  getBackends,
} from '../../api/admin'

const TIER_TAG = {
  free: 'info',
  basic: 'success',
  pro: 'warning',
  enterprise: 'danger',
}

const TIER_OPTIONS = [
  { value: 'free', label: 'free / 免费版' },
  { value: 'basic', label: 'basic / 基础版' },
  { value: 'pro', label: 'pro / 专业版' },
  { value: 'enterprise', label: 'enterprise / 企业版' },
]

const BUSINESS_TYPE_OPTIONS = [
  { value: 'chat', label: '聊天对话', tagType: 'primary' },
  { value: 'coding', label: '编程开发', tagType: 'success' },
  { value: 'text2img', label: '文生图', tagType: 'warning' },
  { value: 'text2video', label: '文生视频', tagType: 'danger' },
  { value: 'translation', label: '翻译', tagType: 'info' },
  { value: 'writing', label: '写作', tagType: '' },
  { value: 'analysis', label: '数据分析', tagType: 'success' },
  { value: 'general', label: '通用', tagType: 'info' },
]

const businessTypeLabelMap = Object.fromEntries(BUSINESS_TYPE_OPTIONS.map((o) => [o.value, o.label]))
const businessTypeTagMap = Object.fromEntries(
  BUSINESS_TYPE_OPTIONS.map((o) => [o.value, o.tagType || 'info'])
)

const businessTypeLabel = (v) => businessTypeLabelMap[v] || v || '—'
const businessTypeTagType = (v) => businessTypeTagMap[v] || 'info'

const tierLabel = (tier) => TIER_OPTIONS.find((o) => o.value === tier)?.label || tier

const plans = ref([])
const modelOptions = ref([])
const backendGroupOptions = ref([])
const backendOptions = ref([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref(null)

const form = reactive({
  id: null,
  name: '',
  tier: 'free',
  description: '',
  monthly_price: 0,
  discount: 1,
  monthly_token_limit: 0,
  daily_request_limit: 0,
  max_context_length: 20,
  allowed_business_types: [],
  allowed_model_ids: [],
  allowed_backend_group_ids: [],
  allowed_backend_ids: [],
  is_active: true,
  sort_order: 0,
})

const formRules = {
  name: [{ required: true, message: '请输入套餐名称', trigger: 'blur' }],
  tier: [{ required: true, message: '请选择等级', trigger: 'change' }],
}

const sortedPlans = computed(() =>
  [...plans.value].sort((a, b) => {
    const so = (a.sort_order ?? 0) - (b.sort_order ?? 0)
    if (so !== 0) return so
    return (a.id ?? 0) - (b.id ?? 0)
  })
)

const formatPrice = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(2) : '—'
}
const formatDiscount = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n.toFixed(4) : '1.0000'
}

const formatLimit = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n) || n === 0) return '不限制'
  return n.toLocaleString()
}

const modelOptionLabel = (m) => {
  const name = m.name || m.model_id || `模型 #${m.id}`
  return m.model_id ? `${name} (${m.model_id})` : name
}

const normalizePlanRow = (row) => ({
  ...row,
  allowed_business_types: Array.isArray(row.allowed_business_types) ? row.allowed_business_types : [],
  allowed_models: Array.isArray(row.allowed_models) ? row.allowed_models : [],
  _toggling: false,
})

const loadPlans = async () => {
  loading.value = true
  try {
    const res = await getPlans()
    const list = Array.isArray(res) ? res : res?.results || []
    plans.value = list.map(normalizePlanRow)
  } catch {
    plans.value = []
  } finally {
    loading.value = false
  }
}

const loadModels = async () => {
  try {
    const res = await getAdminModels({})
    modelOptions.value = Array.isArray(res) ? res : res?.results || []
  } catch { modelOptions.value = [] }
  try {
    const r = await getBackendGroups()
    backendGroupOptions.value = r.results || r || []
  } catch { backendGroupOptions.value = [] }
  try {
    const r = await getBackends()
    backendOptions.value = r.results || r || []
  } catch { backendOptions.value = [] }
}

const buildPayload = () => ({
  name: form.name.trim(),
  tier: form.tier,
  description: form.description || '',
  monthly_price: form.monthly_price,
  discount: form.discount || 1,
  monthly_token_limit: form.monthly_token_limit ?? 0,
  daily_request_limit: form.daily_request_limit ?? 0,
  max_context_length: form.max_context_length ?? 20,
  allowed_business_types: [...(form.allowed_business_types || [])],
  allowed_models: [...(form.allowed_model_ids || [])],
  allowed_backend_groups: [...(form.allowed_backend_group_ids || [])],
  allowed_backends: [...(form.allowed_backend_ids || [])],
  is_active: !!form.is_active,
  sort_order: form.sort_order ?? 0,
})

const openCreate = () => {
  isEdit.value = false
  Object.assign(form, {
    id: null,
    name: '',
    tier: 'free',
    description: '',
    monthly_price: 0,
    discount: 1,
    monthly_token_limit: 0,
    daily_request_limit: 0,
    max_context_length: 20,
    allowed_business_types: [],
    allowed_model_ids: [],
    allowed_backend_group_ids: [],
    allowed_backend_ids: [],
    is_active: true,
    sort_order: 0,
  })
  dialogVisible.value = true
}

const openEdit = (row) => {
  isEdit.value = true
  Object.assign(form, {
    id: row.id,
    name: row.name || '',
    tier: row.tier,
    description: row.description || '',
    monthly_price: Number(row.monthly_price) || 0,
    discount: Number(row.discount) || 1,
    monthly_token_limit: Number(row.monthly_token_limit) || 0,
    daily_request_limit: Number(row.daily_request_limit) || 0,
    max_context_length: row.max_context_length ?? 20,
    allowed_business_types: [...(row.allowed_business_types || [])],
    allowed_model_ids: [...(row.allowed_models || [])],
    allowed_backend_group_ids: [...(row.allowed_backend_groups || [])],
    allowed_backend_ids: [...(row.allowed_backends || [])],
    is_active: row.is_active !== false,
    sort_order: row.sort_order ?? 0,
  })
  dialogVisible.value = true
}

const resetForm = () => {
  formRef.value?.resetFields?.()
}

const submitForm = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    const payload = buildPayload()
    if (isEdit.value) {
      await updatePlan(form.id, payload)
      ElMessage.success('更新成功')
    } else {
      await createPlan(payload)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    await loadPlans()
  } catch {
    /* 错误提示由 request 拦截器统一弹出 */
  } finally {
    saving.value = false
  }
}

const toggleActive = async (row) => {
  row._toggling = true
  try {
    await updatePlan(row.id, { is_active: row.is_active })
    ElMessage.success(row.is_active ? '已启用' : '已停用')
  } catch {
    row.is_active = !row.is_active
  } finally {
    row._toggling = false
  }
}

const confirmDelete = (row) => {
  ElMessageBox.confirm(`确定删除套餐「${row.name}」吗？此操作不可恢复。`, '删除确认', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(async () => {
      try {
        await deletePlan(row.id)
        ElMessage.success('已删除')
        await loadPlans()
      } catch {
        /* 错误提示由 request 拦截器统一弹出 */
      }
    })
    .catch(() => {})
}

onMounted(() => {
  loadPlans()
  loadModels()
})
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
.tbl-footer {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.total-hint {
  font-size: 13px;
  color: #888;
}
.tags-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.tag-item {
  margin: 0;
}
.muted {
  color: #64748b;
  font-size: 13px;
}
.field-hint {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
  line-height: 1.4;
}
.field-hint.inline {
  margin-top: 0;
  margin-left: 10px;
  vertical-align: middle;
}
.unit-suffix {
  margin-left: 8px;
  font-size: 13px;
  color: #64748b;
}
.checkbox-grid {
  width: 100%;
}
.checkbox-grid :deep(.el-checkbox-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}
.plan-dialog :deep(.el-form-item) {
  margin-bottom: 18px;
}
</style>
