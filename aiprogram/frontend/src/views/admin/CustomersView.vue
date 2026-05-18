<template>
  <div>
    <!-- 页头 -->
    <div class="page-header">
      <div class="page-title">客户管理</div>
      <div class="header-actions">
        <el-input
          v-model="search" placeholder="搜索用户名 / 手机 / 邮箱 / 公司"
          clearable style="width:260px" :prefix-icon="Search"
          @input="debounceSearch"
        />
        <el-select v-model="filterAccountType" placeholder="账号类型" clearable style="width:120px" @change="reloadPage">
          <el-option label="全部" value="" />
          <el-option label="主账号" value="main" />
          <el-option label="子账号" value="sub" />
        </el-select>
        <el-select v-model="filterTier" placeholder="套餐" clearable style="width:110px" @change="reloadPage">
          <el-option label="免费版" value="free" />
          <el-option label="基础版" value="basic" />
          <el-option label="专业版" value="pro" />
          <el-option label="企业版" value="enterprise" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="状态" clearable style="width:100px" @change="reloadPage">
          <el-option label="正常" value="active" />
          <el-option label="暂停" value="suspended" />
          <el-option label="封禁" value="banned" />
        </el-select>
        <el-button type="primary" :icon="Plus" @click="openCreateMain">新增主账号</el-button>
        <el-button :icon="Download" @click="exportCSV">导出</el-button>
      </div>
    </div>

    <!-- 批量操作 -->
    <transition name="slide-down">
      <div v-if="selection.length" class="batch-bar">
        <span>已选 <strong>{{ selection.length }}</strong> 项</span>
        <el-button size="small" type="success" @click="openBatchUpgrade">批量升级套餐</el-button>
        <el-button size="small" type="danger" @click="batchSuspend">批量暂停</el-button>
        <el-button size="small" @click="selection = []">取消选择</el-button>
      </div>
    </transition>

    <!-- 表格 -->
    <div class="table-card">
      <el-table :data="customers" v-loading="loading" stripe border @selection-change="selection = $event">
        <el-table-column type="selection" width="44" />
        <el-table-column prop="id" label="ID" width="64" />
        <el-table-column prop="username" label="用户名" min-width="120" show-overflow-tooltip />
        <el-table-column prop="nickname" label="昵称" min-width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ row.nickname || '—' }}</template>
        </el-table-column>
        <el-table-column label="套餐" width="96">
          <template #default="{ row }">
            <el-tag :type="TIER_TAG[row.tier]" size="small" effect="light">{{ row.plan_name || row.tier_display }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="账号类型" width="96" align="center">
          <template #default="{ row }">
            <el-tag :type="row.is_sub_account ? 'info' : 'success'" size="small" effect="plain">
              {{ row.is_sub_account ? '子账号' : '主账号' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="主账号" min-width="110" show-overflow-tooltip>
          <template #default="{ row }">{{ row.parent_username || '—' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="88">
          <template #default="{ row }">
            <el-tag :type="STATUS_TAG[row.customer_status]" size="small">{{ row.customer_status_display }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="余额" width="100" align="right">
          <template #default="{ row }">
            <span class="balance">¥{{ Number(row.balance).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="子账号数" width="88" align="center">
          <template #default="{ row }">{{ row.is_sub_account ? '—' : (row.sub_account_count ?? 0) }}</template>
        </el-table-column>
        <el-table-column label="总 Tokens" width="110" align="right" sortable :sort-method="(a, b) => (a.total_tokens || 0) - (b.total_tokens || 0)">
          <template #default="{ row }">{{ Number(row.total_tokens || 0).toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="总费用" width="100" align="right" sortable :sort-method="(a, b) => (a.total_cost || 0) - (b.total_cost || 0)">
          <template #default="{ row }">
            <span v-if="row.total_cost > 0" class="balance" style="color:#ef4444">¥{{ Number(row.total_cost).toFixed(2) }}</span>
            <span v-else style="color:#ccc">—</span>
          </template>
        </el-table-column>
        <el-table-column label="请求数" width="80" align="right">
          <template #default="{ row }">{{ Number(row.request_count || 0).toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="最后活跃" width="118">
          <template #default="{ row }">{{ row.last_active_at ? fmtDate(row.last_active_at) : '—' }}</template>
        </el-table-column>
        <el-table-column label="注册时间" width="118">
          <template #default="{ row }">{{ fmtDate(row.date_joined) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" text @click="openDrawer(row)">详情</el-button>
            <el-button v-if="!row.is_sub_account" size="small" type="success" text @click="openCreateSub(row)">创建子账号</el-button>
            <el-button size="small" type="info" text @click="openRecharge(row)">充值</el-button>
            <el-popconfirm title="确定删除该客户？此操作不可恢复" confirm-button-text="删除" cancel-button-text="取消" confirm-button-type="danger" width="260" @confirm="doDeleteCustomer(row)">
              <template #reference>
                <el-button size="small" type="danger" text>删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
      <div class="table-footer">
        <span class="total-hint">共 {{ total }} 条记录</span>
        <el-pagination
          v-model:current-page="page" :page-size="pageSize" :total="total"
          :page-sizes="[20, 50, 100]" layout="sizes, prev, pager, next, jumper"
          @current-change="loadCustomers" @size-change="val => { pageSize = val; page = 1; loadCustomers() }"
        />
      </div>
    </div>

    <!-- ── 详情 / 编辑抽屉 ── -->
    <el-drawer v-model="drawerVisible" title="" size="620px" destroy-on-close>
      <template #header>
        <div class="drawer-head" v-if="current">
          <el-avatar :size="44" :style="{ background: avatarColor(current.username) }">
            {{ (current.nickname || current.username)?.[0]?.toUpperCase() }}
          </el-avatar>
          <div>
            <div style="font-size:16px;font-weight:700">{{ current.nickname || current.username }}</div>
            <div style="font-size:12px;color:#888">
              @{{ current.username }} ·
              <el-tag :type="current.is_sub_account ? 'info' : 'success'" size="small" style="margin:0 4px">{{ current.is_sub_account ? '子账号' : '主账号' }}</el-tag>
              · 注册于 {{ fmtDate(current.date_joined) }}
            </div>
          </div>
          <el-tag :type="STATUS_TAG[current.customer_status]" style="margin-left:auto">{{ current.customer_status_display }}</el-tag>
        </div>
      </template>

      <el-tabs v-model="drawerTab" v-if="current">
        <!-- === 基本信息 === -->
        <el-tab-pane label="基本信息" name="info">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="ID">{{ current.id }}</el-descriptions-item>
            <el-descriptions-item label="用户名">{{ current.username }}</el-descriptions-item>
            <el-descriptions-item label="邮箱">{{ current.email || '—' }}</el-descriptions-item>
            <el-descriptions-item label="手机">{{ current.phone || '—' }}</el-descriptions-item>
            <el-descriptions-item label="公司">{{ current.company || '—' }}</el-descriptions-item>
            <el-descriptions-item label="套餐">
              <el-tag :type="TIER_TAG[current.tier]" size="small">{{ current.plan_name || current.tier_display }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="账户余额">
              <span class="balance" style="font-size:15px">¥{{ Number(current.balance).toFixed(4) }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="VIP">
              <el-tag :type="current.is_vip ? 'warning' : 'info'" size="small">{{ current.is_vip ? '是' : '否' }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item v-if="current.is_sub_account" label="主账号">
              @{{ current.parent_username || '—' }}（ID {{ current.parent }}）
            </el-descriptions-item>
            <el-descriptions-item v-if="!current.is_sub_account" label="子账号数">
              {{ current.sub_account_count ?? 0 }}
            </el-descriptions-item>
            <el-descriptions-item v-if="current.is_sub_account" label="月Token额度">
              {{ current.monthly_token_limit ? Number(current.monthly_token_limit).toLocaleString() : '不限制' }}
            </el-descriptions-item>
            <el-descriptions-item label="对话数">{{ current.conversation_count }}</el-descriptions-item>
            <el-descriptions-item label="消息数">{{ current.message_count }}</el-descriptions-item>
            <el-descriptions-item label="API请求数">{{ (current.request_count || 0).toLocaleString() }}</el-descriptions-item>
            <el-descriptions-item label="总Tokens">{{ (current.total_tokens || 0).toLocaleString() }}</el-descriptions-item>
            <el-descriptions-item label="总消费">
              <span style="color:#ef4444;font-weight:700">¥{{ Number(current.total_cost || 0).toFixed(4) }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="最后活跃">{{ current.last_active_at ? fmtDatetime(current.last_active_at) : '—' }}</el-descriptions-item>
          </el-descriptions>

          <el-divider>编辑</el-divider>
          <el-form :model="editForm" label-width="120px" size="default">
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="套餐">
                  <el-select v-model="editForm.tier" style="width:100%">
                    <el-option
                      v-for="p in planTierOptions"
                      :key="p.value"
                      :label="p.label"
                      :value="p.value"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="账号状态">
                  <el-select v-model="editForm.customer_status" style="width:100%">
                    <el-option label="正常" value="active" />
                    <el-option label="暂停" value="suspended" />
                    <el-option label="封禁" value="banned" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12"><el-form-item label="VIP"><el-switch v-model="editForm.is_vip" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="管理员"><el-switch v-model="editForm.is_staff" /></el-form-item></el-col>
              <el-col :span="24" v-if="current.is_sub_account">
                <el-form-item label="月Token额度">
                  <el-input-number v-model="editForm.monthly_token_limit" :min="0" :step="10000" style="width:100%" />
                  <div class="form-hint">0 表示不单独限制</div>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label="可用模型">
                  <el-select v-model="editForm.allowed_model_ids" multiple filterable collapse-tags collapse-tags-tooltip placeholder="不选表示不限制（按后端组或套餐决定）" style="width:100%">
                    <el-option v-for="m in adminModels" :key="m.id" :label="`${m.name} (${m.model_id})`" :value="m.id" />
                  </el-select>
                  <div class="form-hint">选择后仅允许使用指定模型；留空则按下方后端组或用户套餐决定</div>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label="可用后端组">
                  <el-select v-model="editForm.allowed_backend_group_ids" multiple filterable collapse-tags collapse-tags-tooltip placeholder="不选表示不限制" style="width:100%">
                    <el-option v-for="g in backendGroups" :key="g.id" :label="g.name" :value="g.id" />
                  </el-select>
                  <div class="form-hint">选择后端组后，该组内后端提供的所有模型均可用</div>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label="备注">
                  <el-input v-model="editForm.notes" type="textarea" :rows="2" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-space wrap>
              <el-button type="primary" :loading="saving" @click="saveCustomer" size="small">保存修改</el-button>
              <el-button size="small" @click="openRecharge(current)">充值</el-button>
              <el-button size="small" type="warning" plain @click="openAdjust(current)">调额</el-button>
              <el-button size="small" type="danger" plain @click="openResetPassword(current)">修改密码</el-button>
            </el-space>
          </el-form>
        </el-tab-pane>

        <!-- === 使用量汇总（主账号: 含子账号汇总; 子账号: 自身） === -->
        <el-tab-pane :label="current.is_sub_account ? '用量统计' : '用量汇总(含子账号)'" name="usage">
          <div v-loading="usageLoading">
            <!-- 主账号: 显示自身+子账号汇总 -->
            <template v-if="!current.is_sub_account && subUsageData">
              <el-alert type="info" :closable="false" show-icon style="margin-bottom:12px">
                <template #title>
                  主账号 @{{ current.username }} 及其 {{ subUsageData.sub_account_count ?? 0 }} 个子账号的综合使用情况
                </template>
              </el-alert>
              <div class="sub-usage-toolbar">
                <span class="label">统计周期</span>
                <el-radio-group v-model="usageDays" size="small" @change="loadUsageForDrawer">
                  <el-radio-button :value="7">近 7 天</el-radio-button>
                  <el-radio-button :value="30">近 30 天</el-radio-button>
                  <el-radio-button :value="90">近 90 天</el-radio-button>
                </el-radio-group>
              </div>
              <el-row :gutter="8" class="mb12">
                <el-col :span="8">
                  <div class="us-card"><div class="us-val">{{ (subUsageData.totals?.total_messages || 0).toLocaleString() }}</div><div class="us-label">消息次数</div></div>
                </el-col>
                <el-col :span="8">
                  <div class="us-card"><div class="us-val">{{ (subUsageData.totals?.total_tokens || 0).toLocaleString() }}</div><div class="us-label">Tokens</div></div>
                </el-col>
                <el-col :span="8">
                  <div class="us-card"><div class="us-val">¥{{ Number(subUsageData.totals?.total_cost || 0).toFixed(4) }}</div><div class="us-label">费用(元)</div></div>
                </el-col>
              </el-row>
              <div style="font-size:13px;font-weight:600;color:#333;margin-bottom:8px">按用户汇总</div>
              <el-table :data="subUsageData.by_user || []" size="small" stripe max-height="300">
                <el-table-column label="用户名" min-width="120" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.user__username }}</template>
                </el-table-column>
                <el-table-column label="类型" width="88" align="center">
                  <template #default="{ row }">
                    <el-tag :type="row.user__is_sub_account ? 'info' : 'success'" size="small">{{ row.user__is_sub_account ? '子账号' : '主账号' }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="messages" label="消息" width="72" align="right" />
                <el-table-column label="Tokens" width="100" align="right">
                  <template #default="{ row }">{{ (row.tokens || 0).toLocaleString() }}</template>
                </el-table-column>
                <el-table-column label="费用" width="90" align="right">
                  <template #default="{ row }">¥{{ Number(row.cost || 0).toFixed(4) }}</template>
                </el-table-column>
              </el-table>
            </template>

            <!-- 子账号 / 无子账号的个人用量 -->
            <template v-else-if="userUsage">
              <div class="sub-usage-toolbar">
                <span class="label">统计周期</span>
                <el-radio-group v-model="usageDays" size="small" @change="loadUsageForDrawer">
                  <el-radio-button :value="7">近 7 天</el-radio-button>
                  <el-radio-button :value="30">近 30 天</el-radio-button>
                  <el-radio-button :value="90">近 90 天</el-radio-button>
                </el-radio-group>
              </div>
              <el-row :gutter="8" class="mb12">
                <el-col :span="8" v-for="s in personalUsageCards" :key="s.label">
                  <div class="us-card"><div class="us-val">{{ s.val }}</div><div class="us-label">{{ s.label }}</div></div>
                </el-col>
              </el-row>
              <div style="font-size:13px;font-weight:600;color:#333;margin-bottom:8px">模型用量</div>
              <el-table :data="userUsage.by_model || []" size="small" max-height="200" stripe>
                <el-table-column prop="model_id" label="模型" show-overflow-tooltip />
                <el-table-column prop="messages" label="消息" width="70" align="right" />
                <el-table-column label="Tokens" width="90" align="right">
                  <template #default="{ row }">{{ (row.tokens || 0).toLocaleString() }}</template>
                </el-table-column>
                <el-table-column label="费用" width="80" align="right">
                  <template #default="{ row }">¥{{ Number(row.cost || 0).toFixed(4) }}</template>
                </el-table-column>
              </el-table>
            </template>
            <el-empty v-else-if="!usageLoading" description="暂无用量数据" :image-size="80" />
          </div>
        </el-tab-pane>

        <!-- === 子账号列表 (仅主账号) === -->
        <el-tab-pane v-if="!current.is_sub_account && current.sub_account_count > 0" label="子账号列表" name="subs">
          <el-table :data="current.sub_accounts_info || []" size="small" stripe max-height="400">
            <el-table-column prop="id" label="ID" width="64" />
            <el-table-column prop="username" label="用户名" min-width="120" />
            <el-table-column prop="nickname" label="昵称" min-width="100">
              <template #default="{ row }">{{ row.nickname || '—' }}</template>
            </el-table-column>
            <el-table-column label="套餐" width="96">
              <template #default="{ row }">
                <el-tag :type="TIER_TAG[row.tier]" size="small">{{ row.plan_name || TIER_LABEL[row.tier] || row.tier }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="88">
              <template #default="{ row }">
                <el-tag :type="STATUS_TAG[row.customer_status]" size="small">{{ STATUS_LABEL[row.customer_status] || row.customer_status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="余额" width="100" align="right">
              <template #default="{ row }">¥{{ Number(row.balance || 0).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="80">
              <template #default="{ row }">
                <el-button size="small" type="primary" text @click="openDrawerById(row.id)">详情</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- === 账单流水 === -->
        <el-tab-pane label="账单流水" name="billing">
          <el-table :data="userBilling" size="small" max-height="420" stripe>
            <el-table-column label="时间" width="148">
              <template #default="{ row }">{{ fmtDatetime(row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="类型" width="80">
              <template #default="{ row }">
                <el-tag :type="TYPE_TAG[row.record_type]" size="small">{{ row.record_type_display }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="金额" width="100" align="right">
              <template #default="{ row }">
                <span :style="{ color: Number(row.amount) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }">
                  {{ Number(row.amount) >= 0 ? '+' : '' }}{{ Number(row.amount).toFixed(4) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="余额后" width="100" align="right">
              <template #default="{ row }">¥{{ Number(row.balance_after).toFixed(4) }}</template>
            </el-table-column>
            <el-table-column prop="description" label="说明" show-overflow-tooltip />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-drawer>

    <!-- ── 新增主账号弹窗 ── -->
    <el-dialog v-model="createMainVisible" title="新增主账号" width="480px" destroy-on-close @closed="resetCreateMainForm">
      <el-form ref="createMainFormRef" :model="createMainForm" :rules="createMainRules" label-width="100px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="createMainForm.username" autocomplete="off" placeholder="登录用户名（必填）" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="createMainForm.password" type="password" show-password autocomplete="new-password" placeholder="至少6位" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="昵称"><el-input v-model="createMainForm.nickname" placeholder="可选" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="套餐">
              <el-select v-model="createMainForm.tier" style="width:100%">
                <el-option label="免费版" value="free" />
                <el-option label="基础版" value="basic" />
                <el-option label="专业版" value="pro" />
                <el-option label="企业版" value="enterprise" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="邮箱"><el-input v-model="createMainForm.email" placeholder="可选" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="手机"><el-input v-model="createMainForm.phone" placeholder="可选" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="公司"><el-input v-model="createMainForm.company" placeholder="可选" /></el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="createMainVisible = false">取消</el-button>
        <el-button type="primary" :loading="creatingMain" @click="submitCreateMain">创建</el-button>
      </template>
    </el-dialog>

    <!-- ── 创建子账号 ── -->
    <el-dialog v-model="createSubVisible" title="创建子账号" width="440px" destroy-on-close @closed="resetCreateSubForm">
      <div class="dialog-user-info" v-if="subParent">
        <span>主账号：<strong>@{{ subParent.username }}</strong></span>
        <span>ID：{{ subParent.id }}</span>
      </div>
      <el-form ref="createSubFormRef" :model="createSubForm" :rules="createSubRules" label-width="120px" style="margin-top:12px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="createSubForm.username" autocomplete="off" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="createSubForm.password" type="password" show-password autocomplete="new-password" />
        </el-form-item>
        <el-form-item label="昵称"><el-input v-model="createSubForm.nickname" placeholder="可选" /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="createSubForm.email" placeholder="可选" /></el-form-item>
        <el-form-item label="月Token额度">
          <el-input-number v-model="createSubForm.monthly_token_limit" :min="0" :step="10000" style="width:100%" />
        </el-form-item>
        <el-form-item label="可用模型">
          <el-select v-model="createSubForm.allowed_model_ids" multiple filterable collapse-tags collapse-tags-tooltip placeholder="不选则不限定" style="width:100%">
            <el-option v-for="m in adminModels" :key="m.id" :label="`${m.name} (${m.model_id})`" :value="m.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createSubVisible = false">取消</el-button>
        <el-button type="primary" :loading="creatingSub" @click="submitCreateSub">创建</el-button>
      </template>
    </el-dialog>

    <!-- ── 充值弹窗 ── -->
    <el-dialog v-model="rechargeVisible" title="给用户充值" width="380px" destroy-on-close>
      <div class="dialog-user-info" v-if="opTarget">
        <span>用户：<strong>{{ opTarget.nickname || opTarget.username }}</strong></span>
        <span>当前余额：<span class="balance">¥{{ Number(opTarget.balance).toFixed(2) }}</span></span>
      </div>
      <el-form :model="rechargeForm" label-width="80px" style="margin-top:12px">
        <el-form-item label="充值金额"><el-input-number v-model="rechargeForm.amount" :min="0.01" :precision="2" :step="10" style="width:100%" /></el-form-item>
        <el-form-item label="支付方式">
          <el-select v-model="rechargeForm.payment_method" style="width:100%">
            <el-option label="人工充值" value="manual" />
            <el-option label="支付宝" value="alipay" />
            <el-option label="微信支付" value="wechat" />
            <el-option label="银行转账" value="bank" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="rechargeForm.remark" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rechargeVisible = false">取消</el-button>
        <el-button type="primary" :loading="operating" @click="doRecharge">确认充值</el-button>
      </template>
    </el-dialog>

    <!-- ── 调整余额弹窗 ── -->
    <el-dialog v-model="adjustVisible" title="调整账户余额" width="360px" destroy-on-close>
      <div class="dialog-user-info" v-if="opTarget">
        <span>用户：<strong>{{ opTarget.nickname || opTarget.username }}</strong></span>
        <span>当前余额：<span class="balance">¥{{ Number(opTarget.balance).toFixed(2) }}</span></span>
      </div>
      <el-form :model="adjustForm" label-width="80px" style="margin-top:12px">
        <el-form-item label="调整金额">
          <el-input-number v-model="adjustForm.amount" :precision="4" :step="1" style="width:100%" />
          <div class="form-hint">正数为增加，负数为减少</div>
        </el-form-item>
        <el-form-item label="原因"><el-input v-model="adjustForm.remark" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustVisible = false">取消</el-button>
        <el-button type="warning" :loading="operating" @click="doAdjust">确认调整</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="resetPasswordVisible" title="修改用户密码" width="420px" destroy-on-close @closed="resetResetPasswordForm">
      <div class="dialog-user-info" v-if="passwordTarget">
        <span>用户：<strong>{{ passwordTarget.nickname || passwordTarget.username }}</strong></span>
        <span>ID：{{ passwordTarget.id }}</span>
      </div>
      <el-form ref="resetPasswordFormRef" :model="resetPasswordForm" :rules="resetPasswordRules" label-width="100px" style="margin-top:12px">
        <el-form-item label="新密码" prop="new_password">
          <el-input v-model="resetPasswordForm.new_password" type="password" show-password autocomplete="new-password" />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirm_password">
          <el-input v-model="resetPasswordForm.confirm_password" type="password" show-password autocomplete="new-password" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetPasswordVisible = false">取消</el-button>
        <el-button type="primary" :loading="resettingPassword" @click="submitResetPassword">确认修改</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="batchUpgradeVisible" title="批量升级套餐" width="420px" destroy-on-close>
      <el-form label-width="90px">
        <el-form-item label="目标套餐">
          <el-select v-model="batchUpgradeTier" placeholder="请选择套餐" style="width:100%">
            <el-option
              v-for="p in upgradablePlanTierOptions"
              :key="p.value"
              :label="p.label"
              :value="p.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchUpgradeVisible = false">取消</el-button>
        <el-button type="primary" @click="submitBatchUpgrade">确认升级</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Download, Plus } from '@element-plus/icons-vue'
import {
  getCustomers, getCustomerDetail, updateCustomer, deleteCustomer,
  createMainAccount, createSubAccount, getSubAccountUsage,
  rechargeUser, adjustBalance, getAdminModels, getBackendGroups,
  getBillingRecords, getUserUsage, resetCustomerPassword, getPlans,
} from '../../api/admin'

const TIER_TAG = { free: 'info', basic: '', pro: 'warning', enterprise: 'danger' }
const TIER_LABEL = { free: '免费版', basic: '基础版', pro: '专业版', enterprise: '企业版' }
const STATUS_TAG = { active: 'success', suspended: 'warning', banned: 'danger' }
const STATUS_LABEL = { active: '正常', suspended: '暂停', banned: '封禁' }
const TYPE_TAG = { recharge: 'success', deduction: 'danger', refund: 'warning', adjustment: 'info', reward: '', subscription: '' }
const AVATAR_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']
const avatarColor = (name = '') => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]

// ── 列表 ──
const customers = ref([])
const loading = ref(false)
const search = ref('')
const filterAccountType = ref('')
const filterTier = ref('')
const filterStatus = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const selection = ref([])
const adminModels = ref([])
const backendGroups = ref([])
const planTierOptions = ref([])
let debounceTimer = null

// ── 详情抽屉 ──
const drawerVisible = ref(false)
const drawerTab = ref('info')
const current = ref(null)
const editForm = reactive({ tier: '', customer_status: '', is_vip: false, is_staff: false, notes: '', monthly_token_limit: 0, allowed_model_ids: [], allowed_backend_group_ids: [] })
const saving = ref(false)
const userBilling = ref([])
const userUsage = ref(null)
const subUsageData = ref(null)
const usageLoading = ref(false)
const usageDays = ref(30)

// ── 新增主账号 ──
const createMainVisible = ref(false)
const creatingMain = ref(false)
const createMainFormRef = ref(null)
const createMainForm = reactive({ username: '', password: '', nickname: '', email: '', phone: '', company: '', tier: 'free' })
const createMainRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }, { min: 6, message: '密码至少6位', trigger: 'blur' }],
}

// ── 创建子账号 ──
const createSubVisible = ref(false)
const subParent = ref(null)
const createSubFormRef = ref(null)
const creatingSub = ref(false)
const createSubForm = reactive({ username: '', password: '', nickname: '', email: '', monthly_token_limit: 0, allowed_model_ids: [] })
const createSubRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }, { min: 6, message: '密码至少6位', trigger: 'blur' }],
}

// ── 操作弹窗 ──
const opTarget = ref(null)
const operating = ref(false)
const rechargeVisible = ref(false)
const rechargeForm = reactive({ amount: 100, payment_method: 'manual', remark: '' })
const adjustVisible = ref(false)
const adjustForm = reactive({ amount: 0, remark: '人工调整' })
const resetPasswordVisible = ref(false)
const resettingPassword = ref(false)
const passwordTarget = ref(null)
const resetPasswordFormRef = ref(null)
const resetPasswordForm = reactive({ new_password: '', confirm_password: '' })
const resetPasswordRules = {
  new_password: [{ required: true, message: '请输入新密码', trigger: 'blur' }, { min: 6, message: '密码至少6位', trigger: 'blur' }],
  confirm_password: [{ required: true, message: '请确认新密码', trigger: 'blur' }],
}
const batchUpgradeVisible = ref(false)
const batchUpgradeTier = ref('')

const personalUsageCards = computed(() => {
  if (!userUsage.value) return []
  const s = userUsage.value.totals || userUsage.value.summary || {}
  return [
    { label: '消息次数', val: (s.total_messages || 0).toLocaleString() },
    { label: 'Tokens', val: (s.total_tokens || 0).toLocaleString() },
    { label: '费用(元)', val: '¥' + Number(s.total_cost || 0).toFixed(4) },
  ]
})
const upgradablePlanTierOptions = computed(() =>
  planTierOptions.value.filter(p => p.value !== 'free')
)

function parseAllowedModelIds(res) {
  if (Array.isArray(res.allowed_model_ids)) return [...res.allowed_model_ids]
  if (Array.isArray(res.allowed_models)) return res.allowed_models.map(x => typeof x === 'object' && x !== null ? x.id : x)
  return []
}

// ── 加载 ──
const loadAdminModels = async () => {
  try { adminModels.value = (await getAdminModels({})).results || (await getAdminModels({})) || [] } catch { adminModels.value = [] }
  try { const r = await getBackendGroups(); backendGroups.value = r.results || r || [] } catch { backendGroups.value = [] }
  try {
    const r = await getPlans()
    const plans = (r.results || r || []).filter(p => p?.tier)
    const seen = new Set()
    planTierOptions.value = plans
      .filter(p => !seen.has(p.tier) && seen.add(p.tier))
      .map(p => ({ value: p.tier, label: p.name || TIER_LABEL[p.tier] || p.tier }))
  } catch {
    planTierOptions.value = Object.keys(TIER_LABEL).map(tier => ({ value: tier, label: TIER_LABEL[tier] }))
  }
}
const loadCustomers = async () => {
  loading.value = true
  try {
    const params = { q: search.value || undefined, tier: filterTier.value || undefined, status: filterStatus.value || undefined, page: page.value, page_size: pageSize.value }
    if (filterAccountType.value) params.account_type = filterAccountType.value
    const res = await getCustomers(params)
    customers.value = res.results || res
    total.value = res.count ?? customers.value.length
  } finally { loading.value = false }
}
const reloadPage = () => { page.value = 1; loadCustomers() }
const debounceSearch = () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(reloadPage, 400) }

// ── 详情抽屉 ──
const openDrawer = async (row) => { await openDrawerById(row.id) }
const openDrawerById = async (id) => {
  drawerTab.value = 'info'
  userBilling.value = []
  userUsage.value = null
  subUsageData.value = null
  usageDays.value = 30
  const res = await getCustomerDetail(id)
  current.value = res
  editForm.tier = res.tier
  editForm.customer_status = res.customer_status
  editForm.is_vip = res.is_vip
  editForm.is_staff = res.is_staff
  editForm.notes = res.notes || ''
  editForm.monthly_token_limit = Number(res.monthly_token_limit) || 0
  editForm.allowed_model_ids = parseAllowedModelIds(res)
  editForm.allowed_backend_group_ids = Array.isArray(res.allowed_backend_group_ids) ? [...res.allowed_backend_group_ids] : []
  drawerVisible.value = true
  getBillingRecords({ user_id: id }).then(r => { userBilling.value = (r.results || r).slice(0, 50) })
  loadUsageForDrawer()
}

const loadUsageForDrawer = async () => {
  if (!current.value) return
  usageLoading.value = true
  try {
    if (!current.value.is_sub_account) {
      subUsageData.value = await getSubAccountUsage(current.value.id, { days: usageDays.value })
    } else {
      userUsage.value = await getUserUsage(current.value.id, { days: usageDays.value })
      subUsageData.value = null
    }
  } catch {
    subUsageData.value = null
    userUsage.value = null
  } finally { usageLoading.value = false }
}

const saveCustomer = async () => {
  saving.value = true
  try {
    const payload = { tier: editForm.tier, customer_status: editForm.customer_status, is_vip: editForm.is_vip, is_staff: editForm.is_staff, notes: editForm.notes, allowed_model_ids: editForm.allowed_model_ids, allowed_backend_group_ids: editForm.allowed_backend_group_ids }
    if (current.value?.is_sub_account) payload.monthly_token_limit = editForm.monthly_token_limit
    const res = await updateCustomer(current.value.id, payload)
    ElMessage.success(res.msg || '保存成功')
    const refreshed = res.data ? { ...current.value, ...res.data } : await getCustomerDetail(current.value.id)
    current.value = refreshed
    editForm.allowed_model_ids = parseAllowedModelIds(refreshed)
    editForm.allowed_backend_group_ids = Array.isArray(refreshed.allowed_backend_group_ids) ? [...refreshed.allowed_backend_group_ids] : []
    await loadCustomers()
  } finally { saving.value = false }
}

const doDeleteCustomer = async (row) => {
  try {
    const res = await deleteCustomer(row.id)
    ElMessage.success(res.msg || '已删除')
    if (current.value?.id === row.id) drawerVisible.value = false
    await loadCustomers()
  } catch {}
}

// ── 新增主账号 ──
const openCreateMain = () => {
  Object.assign(createMainForm, { username: '', password: '', nickname: '', email: '', phone: '', company: '', tier: 'free' })
  createMainVisible.value = true
}
const resetCreateMainForm = () => { createMainFormRef.value?.resetFields?.() }
const submitCreateMain = async () => {
  if (!createMainFormRef.value) return
  await createMainFormRef.value.validate(async (ok) => {
    if (!ok) return
    creatingMain.value = true
    try {
      const res = await createMainAccount(createMainForm)
      ElMessage.success(res.msg || '创建成功')
      createMainVisible.value = false
      await loadCustomers()
    } finally { creatingMain.value = false }
  })
}

// ── 创建子账号 ──
const openCreateSub = (row) => {
  subParent.value = row
  Object.assign(createSubForm, { username: '', password: '', nickname: '', email: '', monthly_token_limit: 0, allowed_model_ids: [] })
  createSubVisible.value = true
}
const resetCreateSubForm = () => { subParent.value = null; createSubFormRef.value?.resetFields?.() }
const submitCreateSub = async () => {
  if (!createSubFormRef.value || !subParent.value) return
  await createSubFormRef.value.validate(async (ok) => {
    if (!ok) return
    creatingSub.value = true
    try {
      const res = await createSubAccount(subParent.value.id, { ...createSubForm })
      ElMessage.success(res.msg || '创建成功')
      createSubVisible.value = false
      await loadCustomers()
    } finally { creatingSub.value = false }
  })
}

// ── 充值 / 调额 ──
const openRecharge = (row) => { opTarget.value = row; rechargeForm.amount = 100; rechargeForm.payment_method = 'manual'; rechargeForm.remark = ''; rechargeVisible.value = true }
const doRecharge = async () => {
  operating.value = true
  try {
    const res = await rechargeUser(opTarget.value.id, rechargeForm)
    ElMessage.success(res.msg || '充值成功')
    rechargeVisible.value = false
    await loadCustomers()
    if (current.value?.id === opTarget.value.id) current.value = await getCustomerDetail(opTarget.value.id)
  } finally { operating.value = false }
}
const openAdjust = (row) => { opTarget.value = row; adjustForm.amount = 0; adjustForm.remark = '人工调整'; adjustVisible.value = true }
const doAdjust = async () => {
  if (adjustForm.amount === 0) return ElMessage.warning('调整金额不能为 0')
  operating.value = true
  try {
    const res = await adjustBalance(opTarget.value.id, adjustForm)
    ElMessage.success(res.msg || '调整成功')
    adjustVisible.value = false
    await loadCustomers()
    if (current.value?.id === opTarget.value.id) current.value = await getCustomerDetail(opTarget.value.id)
  } finally { operating.value = false }
}
const openResetPassword = (row) => {
  passwordTarget.value = row
  resetPasswordForm.new_password = ''
  resetPasswordForm.confirm_password = ''
  resetPasswordVisible.value = true
}
const resetResetPasswordForm = () => {
  resetPasswordFormRef.value?.resetFields?.()
  passwordTarget.value = null
}
const submitResetPassword = async () => {
  if (!resetPasswordFormRef.value || !passwordTarget.value) return
  await resetPasswordFormRef.value.validate(async (ok) => {
    if (!ok) return
    if (resetPasswordForm.new_password !== resetPasswordForm.confirm_password) {
      ElMessage.warning('两次输入的新密码不一致')
      return
    }
    resettingPassword.value = true
    try {
      const res = await resetCustomerPassword(passwordTarget.value.id, { new_password: resetPasswordForm.new_password })
      ElMessage.success(res.msg || '密码修改成功')
      resetPasswordVisible.value = false
    } finally {
      resettingPassword.value = false
    }
  })
}

// ── 批量操作 ──
const openBatchUpgrade = () => {
  batchUpgradeTier.value = upgradablePlanTierOptions.value[0]?.value || ''
  batchUpgradeVisible.value = true
}
const submitBatchUpgrade = async () => {
  if (!batchUpgradeTier.value) return ElMessage.warning('请选择目标套餐')
  const ids = selection.value.map(r => r.id)
  const targetLabel = planTierOptions.value.find(p => p.value === batchUpgradeTier.value)?.label || batchUpgradeTier.value
  await ElMessageBox.confirm(`确认将 ${ids.length} 位用户升级到「${targetLabel}」？`, '批量升级套餐', { type: 'warning' })
  await Promise.all(ids.map(id => updateCustomer(id, { tier: batchUpgradeTier.value })))
  ElMessage.success('批量升级完成')
  batchUpgradeVisible.value = false
  selection.value = []
  await loadCustomers()
}
const batchSuspend = async () => {
  const ids = selection.value.map(r => r.id)
  await ElMessageBox.confirm(`确认暂停 ${ids.length} 位用户的账号？`, '批量暂停', { type: 'warning' })
  await Promise.all(ids.map(id => updateCustomer(id, { customer_status: 'suspended' })))
  ElMessage.success('批量暂停完成')
  selection.value = []
  await loadCustomers()
}

// ── 导出 ──
const exportCSV = () => {
  const header = ['ID', '用户名', '昵称', '套餐', '账号类型', '主账号', '状态', '余额', '子账号数', '总Tokens', '总费用', '请求数', '最后活跃', '注册时间']
  const rows = customers.value.map(r => [r.id, r.username, r.nickname, r.plan_name || r.tier_display, r.is_sub_account ? '子账号' : '主账号', r.parent_username || '', r.customer_status_display, r.balance, r.is_sub_account ? '' : (r.sub_account_count ?? 0), r.total_tokens, Number(r.total_cost || 0).toFixed(4), r.request_count || 0, r.last_active_at ? fmtDate(r.last_active_at) : '', fmtDate(r.date_joined)])
  const csv = [header, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `customers_${Date.now()}.csv`
  a.click()
}

const fmtDate = d => d ? new Date(d).toLocaleDateString('zh-CN') : '—'
const fmtDatetime = d => d ? new Date(d).toLocaleString('zh-CN', { hour12: false }).slice(0, 16) : '—'

onMounted(() => { loadAdminModels(); loadCustomers() })
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 10px; }
.page-title { font-size: 20px; font-weight: 700; color: #1a1a2e; }
.header-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.batch-bar { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 8px 16px; margin-bottom: 10px; display: flex; align-items: center; gap: 10px; font-size: 13px; }
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.2s; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-8px); }
.table-card { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.table-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; }
.total-hint { font-size: 13px; color: #888; }
.balance { font-weight: 700; color: #10b981; }
.drawer-head { display: flex; align-items: center; gap: 12px; }
.mb12 { margin-bottom: 12px; }
.us-card { background: #f8f9ff; border-radius: 10px; padding: 14px; text-align: center; }
.us-val { font-size: 20px; font-weight: 800; color: #1a1a2e; }
.us-label { font-size: 12px; color: #888; margin-top: 4px; }
.form-hint { font-size: 12px; color: #888; margin-top: 4px; }
.sub-usage-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.sub-usage-toolbar .label { font-size: 13px; color: #666; }
.dialog-user-info { display: flex; justify-content: space-between; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
</style>
