<template>
  <div>
    <div class="page-header">
      <div class="page-title">API Token 管理</div>
      <div class="header-actions">
        <el-input
          v-model="filterUserId" placeholder="用户ID过滤" clearable style="width:160px"
          :prefix-icon="Search" @change="reloadPage"
        />
        <el-select v-model="filterActive" placeholder="状态" clearable style="width:100px" @change="reloadPage">
          <el-option label="已启用" value="true" />
          <el-option label="已禁用" value="false" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="reloadPage">查询</el-button>
      </div>
    </div>

    <div class="table-card" v-loading="loading">
      <el-table :data="tokens" stripe border>
        <el-table-column prop="id" label="ID" width="56" />
        <el-table-column label="用户" width="120">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.username }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="Token 名称" min-width="140" show-overflow-tooltip />
        <el-table-column label="Token（脱敏）" min-width="200">
          <template #default="{ row }">
            <el-tooltip :content="row.token_key_masked" placement="top">
              <span class="token-key">{{ row.token_key_masked }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="权限" width="80">
          <template #default="{ row }">
            <el-tag :type="row.permissions === 'all' ? 'warning' : 'info'" size="small" effect="light">
              {{ row.permissions === 'all' ? '全部' : '对话' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-switch
              v-model="row.is_active"
              :loading="row._toggling"
              @change="toggleToken(row)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="usage_count" label="使用次数" width="86" align="right" />
        <el-table-column label="最后使用" width="110">
          <template #default="{ row }">{{ fmtDate(row.last_used_at) }}</template>
        </el-table-column>
        <el-table-column label="创建时间" width="110">
          <template #default="{ row }">{{ fmtDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="过期时间" width="110">
          <template #default="{ row }">
            <span :style="{ color: isExpired(row.expires_at) ? '#ef4444' : 'inherit' }">
              {{ fmtDate(row.expires_at) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="danger" text @click="delToken(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="tbl-footer">
        <span style="font-size:13px;color:#888">共 {{ total }} 条</span>
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          small
          @current-change="loadTokens"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { getAdminTokens, updateAdminToken, deleteAdminToken } from '../../api/admin'

const tokens = ref([])
const loading = ref(false)
const filterUserId = ref('')
const filterActive = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const loadTokens = async () => {
  loading.value = true
  try {
    const res = await getAdminTokens({
      user_id: filterUserId.value || undefined,
      is_active: filterActive.value || undefined,
      page: page.value,
    })
    tokens.value = (res.results || res).map(t => ({ ...t, _toggling: false }))
    total.value = res.count || tokens.value.length
  } finally {
    loading.value = false
  }
}

const reloadPage = () => { page.value = 1; loadTokens() }

const toggleToken = async (row) => {
  row._toggling = true
  try {
    await updateAdminToken(row.id, { is_active: row.is_active })
    ElMessage.success(row.is_active ? '已启用' : '已禁用')
  } catch {
    row.is_active = !row.is_active
  } finally {
    row._toggling = false
  }
}

const delToken = async (row) => {
  await ElMessageBox.confirm(`确定删除 Token「${row.name}」？`, '警告', { type: 'warning' })
  await deleteAdminToken(row.id)
  ElMessage.success('已删除')
  await loadTokens()
}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('zh-CN') : '—'
const isExpired = (d) => d && new Date(d) < new Date()

onMounted(loadTokens)
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; color: #1a1a2e; }
.header-actions { display: flex; gap: 10px; align-items: center; }
.table-card { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.token-key { font-family: monospace; font-size: 12px; color: #555; }
.tbl-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; }
</style>
