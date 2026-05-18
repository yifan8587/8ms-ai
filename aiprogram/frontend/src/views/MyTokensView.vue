<template>
  <div class="tokens-container">
    <div class="tokens-card">
      <div class="card-header">
        <h2>API Token 管理</h2>
        <el-button type="primary" :icon="Plus" @click="createDialogVisible = true">创建 Token</el-button>
      </div>
      <p class="desc">API Token 用于通过 API 方式调用 AI 服务，请妥善保管，勿泄露给他人。</p>

      <el-alert type="info" :closable="false" class="openai-hint" show-icon>
        <template #title>OpenAI 标准兼容（第三方工具直接接入）</template>
        <div class="openai-hint-body">
          <div class="kv"><span class="k">Base URL</span><code class="v">{{ openAiBaseUrl }}</code></div>
          <div class="kv"><span class="k">API Key</span><code class="v">下方创建的 sk-... 直接填入 OpenAI 的 API Key 位置</code></div>
          <div class="kv"><span class="k">鉴权 Header</span><code class="v">Authorization: Bearer sk-...</code></div>
          <div class="endpoint-grid">
            <div><strong>模型列表</strong><br/><code>GET {{ openAiBaseUrl }}/models</code></div>
            <div><strong>对话补全</strong><br/><code>POST {{ openAiBaseUrl }}/chat/completions</code></div>
            <div><strong>单模型详情</strong><br/><code>GET {{ openAiBaseUrl }}/models/&#123;model_id&#125;</code></div>
            <div><strong>文本向量</strong><br/><code>POST {{ openAiBaseUrl }}/embeddings</code></div>
          </div>
          <div class="hint-note">
            已支持完整 OpenAI 字段：<code>messages / stream / temperature / top_p / max_tokens /
            tools / tool_choice / response_format / seed</code> 等。
          </div>
          <div class="tools-row">
            <strong>常用工具配置：</strong>
            <span>Cherry Studio · ChatBox · NextChat · LobeChat：</span> 选「自定义 OpenAI / OpenAI-API-compatible」→ 填上面的 Base URL 与 sk-Key 即可。
            <br/>
            <strong>OpenAI Python SDK：</strong><code>OpenAI(api_key="sk-...", base_url="{{ openAiBaseUrl }}")</code>
            <br/>
            <strong>Cline / Continue：</strong> Provider 选 “OpenAI Compatible”，Base URL 同上。
            <br/>
            <strong>Dify / FastGPT：</strong> 模型供应商选 “OpenAI-API-compatible”，URL 同上。
          </div>
        </div>
      </el-alert>

      <el-table :data="tokens" v-loading="loading" stripe>
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column prop="token_key_masked" label="Token（脱敏）" min-width="200" />
        <el-table-column label="权限" width="80">
          <template #default="{ row }">
            <el-tag :type="row.permissions === 'all' ? 'warning' : ''" size="small">
              {{ row.permissions === 'all' ? '全部' : '对话' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'danger'" size="small">
              {{ row.is_active ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="usage_count" label="使用次数" width="90" align="right" />
        <el-table-column label="最后使用" width="110">
          <template #default="{ row }">{{ fmtDate(row.last_used_at) }}</template>
        </el-table-column>
        <el-table-column label="创建时间" width="110">
          <template #default="{ row }">{{ fmtDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button size="small" :type="row.is_active ? 'warning' : 'success'" text @click="toggleToken(row)">
              {{ row.is_active ? '禁用' : '启用' }}
            </el-button>
            <el-button size="small" type="danger" text @click="delToken(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 创建 Token 对话框 -->
    <el-dialog v-model="createDialogVisible" title="创建 API Token" width="420px" destroy-on-close>
      <el-form :model="createForm" label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="createForm.name" placeholder="如：我的应用" />
        </el-form-item>
        <el-form-item label="权限">
          <el-radio-group v-model="createForm.permissions">
            <el-radio value="chat">仅对话</el-radio>
            <el-radio value="all">全部</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="过期时间">
          <el-date-picker v-model="createForm.expires_at" type="datetime" placeholder="不设置则永久" style="width:100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="doCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 显示新建 Token 完整值 -->
    <el-dialog v-model="newTokenVisible" title="⚠️ 请保存您的 Token" width="500px" :close-on-click-modal="false">
      <el-alert type="warning" :closable="false" style="margin-bottom:12px">
        Token 值只显示一次，关闭后将无法再次查看，请立即复制保存！
      </el-alert>
      <el-input :value="newTokenValue" readonly>
        <template #append>
          <el-button @click="copyToken">复制</el-button>
        </template>
      </el-input>
      <template #footer>
        <el-button type="primary" @click="newTokenVisible = false">我已保存，关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { getMyTokens, createMyToken, updateMyToken, deleteMyToken } from '../api/admin'
import { BASE_URL } from '../api/request'

/** 与 OpenAI 官方 SDK 对齐：Base URL = 站点源 + /api/v1（无尾斜杠） */
const openAiBaseUrl = computed(() => {
  const root = (BASE_URL || '/api').replace(/\/+$/, '')
  if (typeof window === 'undefined') return `${root}/v1`
  return `${window.location.origin}${root}/v1`
})

const tokens = ref([])
const loading = ref(false)
const createDialogVisible = ref(false)
const creating = ref(false)
const newTokenVisible = ref(false)
const newTokenValue = ref('')
const createForm = reactive({ name: '', permissions: 'chat', expires_at: null })

const loadTokens = async () => {
  loading.value = true
  try {
    tokens.value = await getMyTokens()
  } finally {
    loading.value = false
  }
}

const doCreate = async () => {
  if (!createForm.name.trim()) return ElMessage.warning('请输入 Token 名称')
  creating.value = true
  try {
    const res = await createMyToken(createForm)
    newTokenValue.value = res.data.token_key
    createDialogVisible.value = false
    newTokenVisible.value = true
    Object.assign(createForm, { name: '', permissions: 'chat', expires_at: null })
    await loadTokens()
  } finally {
    creating.value = false
  }
}

const copyToken = () => {
  navigator.clipboard.writeText(newTokenValue.value)
  ElMessage.success('已复制到剪贴板')
}

const toggleToken = async (row) => {
  await updateMyToken(row.id, { is_active: !row.is_active })
  row.is_active = !row.is_active
  ElMessage.success(row.is_active ? '已启用' : '已禁用')
}

const delToken = async (row) => {
  await ElMessageBox.confirm(`确定删除 Token「${row.name}」？`, '警告', { type: 'warning' })
  await deleteMyToken(row.id)
  ElMessage.success('已删除')
  await loadTokens()
}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('zh-CN') : '-'
onMounted(loadTokens)
</script>

<style scoped>
.tokens-container {
  padding: 32px 24px;
  background: #f8f9ff;
  min-height: 100vh;
}
.tokens-card {
  background: #fff;
  border-radius: 16px;
  padding: 28px 32px;
  max-width: 1000px;
  box-shadow: 0 4px 24px rgba(99,102,241,0.08);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.card-header h2 { font-size: 20px; font-weight: 700; color: #1a1a2e; }
.desc { color: #888; font-size: 13px; margin-bottom: 20px; }
.openai-hint { margin-bottom: 20px; }
.openai-hint-body { font-size: 13px; line-height: 1.7; color: #444; }
.openai-hint-body code { font-size: 12px; padding: 1px 6px; background: #f3f4f6; border-radius: 4px; word-break: break-all; }
.openai-hint-body .kv { display: flex; gap: 8px; align-items: baseline; margin-top: 4px; }
.openai-hint-body .kv .k { color: #555; font-weight: 600; min-width: 92px; }
.openai-hint-body .kv .v { flex: 1; }
.endpoint-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 16px;
  margin: 12px 0 8px;
  padding: 10px 12px;
  background: #fafbff;
  border-radius: 8px;
}
.endpoint-grid > div { font-size: 12.5px; }
.hint-note { margin-top: 8px; color: #888; font-size: 12px; }
.tools-row { margin-top: 10px; padding: 10px 12px; background: #fff8e6; border-radius: 8px; font-size: 12.5px; line-height: 1.9; }
</style>
