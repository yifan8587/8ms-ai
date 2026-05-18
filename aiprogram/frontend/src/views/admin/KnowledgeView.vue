<template>
  <div class="kb-shell">
    <!-- 左侧：文档树（参照 Apifox 左侧导航） -->
    <aside class="kb-sidenav">
      <div class="sidenav-brand">
        <div class="brand-title">文档中心</div>
        <div class="brand-sub">知识库管理</div>
      </div>
      <el-input
        v-model="treeFilter"
        class="tree-search"
        placeholder="筛选分类或栏目"
        clearable
        size="small"
      />
      <el-scrollbar class="tree-scroll">
        <div
          class="tree-all"
          :class="{ active: selectedNav.mode === 'all' }"
          @click="selectAll"
        >
          <span class="tree-icon">📑</span>
          全部文章
        </div>
        <div v-for="block in filteredNav" :key="block.cat.id" class="tree-block">
          <div
            class="tree-cat"
            :class="{
              active: selectedNav.mode === 'category' && selectedNav.categoryId === block.cat.id,
              expanded: isCatExpanded(block.cat.id),
            }"
          >
            <span class="caret-wrap" @click.stop="toggleCat(block.cat.id)">
              <el-icon class="caret"><ArrowRight /></el-icon>
            </span>
            <span v-if="block.cat.icon" class="cat-ico">{{ block.cat.icon }}</span>
            <span class="tree-label" @click="onCatLabelClick(block.cat)">{{ block.cat.name }}</span>
            <span class="tree-badge">{{ block.columns.length }}</span>
            <el-dropdown trigger="click" @command="onCatCommand($event, block.cat)">
              <span class="tree-more" @click.stop>
                <el-icon><MoreFilled /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">编辑分类</el-dropdown-item>
                  <el-dropdown-item command="addcol">在此下新增栏目</el-dropdown-item>
                  <el-dropdown-item command="del" divided>删除分类</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <div v-show="isCatExpanded(block.cat.id)" class="tree-children">
            <div
              v-for="col in block.columns"
              :key="col.id"
              class="tree-col"
              :class="{
                active: selectedNav.mode === 'column' && selectedNav.columnId === col.id,
              }"
              @click.stop="selectColumn(block.cat, col)"
            >
              <span class="col-dot" />
              <span class="tree-label">{{ col.name }}</span>
              <el-tag v-if="col.article_count != null" size="small" effect="plain" class="col-count">
                {{ col.article_count }}
              </el-tag>
              <el-dropdown trigger="click" @command="onColCommand($event, col)">
                <span class="tree-more col-more" @click.stop>
                  <el-icon><MoreFilled /></el-icon>
                </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="edit">编辑栏目</el-dropdown-item>
                    <el-dropdown-item command="del" divided>删除栏目</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <div v-if="!block.columns.length" class="tree-empty">暂无栏目</div>
          </div>
        </div>
        <el-empty v-if="!categories.length && !catLoading" description="请先创建分类" :image-size="64" />
      </el-scrollbar>
      <div class="sidenav-actions">
        <el-button type="primary" size="small" :icon="Plus" @click="openCatForm()">新增分类</el-button>
        <el-button size="small" :icon="FolderAdd" :disabled="!categories.length" @click="openColForm()">
          新增栏目
        </el-button>
      </div>
    </aside>

    <!-- 右侧：主内容区 -->
    <main class="kb-main">
      <header class="kb-main-header">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item>知识库</el-breadcrumb-item>
          <el-breadcrumb-item v-if="breadcrumb.length === 0">全部文章</el-breadcrumb-item>
          <el-breadcrumb-item v-for="(b, i) in breadcrumb" :key="i">{{ b }}</el-breadcrumb-item>
        </el-breadcrumb>
        <div class="header-actions">
          <el-button :icon="Refresh" circle size="small" @click="refreshMain" />
        </div>
      </header>

      <div class="kb-toolbar">
        <el-select v-model="artFilterStatus" placeholder="状态" clearable style="width: 110px" size="small" @change="loadArticles">
          <el-option label="草稿" value="draft" />
          <el-option label="已发布" value="published" />
          <el-option label="已归档" value="archived" />
        </el-select>
        <el-input
          v-model="artFilterQ"
          placeholder="搜索标题"
          clearable
          style="width: 200px"
          size="small"
          @clear="loadArticles"
          @keyup.enter="loadArticles"
        />
        <el-button type="primary" size="small" :icon="Plus" @click="openArticleForm()">新增文章</el-button>
      </div>

      <div class="kb-table-wrap" v-loading="artLoading">
        <el-table :data="articles" stripe size="default" class="kb-table">
          <el-table-column prop="id" label="ID" width="68" />
          <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
          <el-table-column prop="category_name" label="分类" width="100" />
          <el-table-column prop="column_name" label="栏目" width="100" />
          <el-table-column label="状态" width="88" align="center">
            <template #default="{ row }">
              <el-tag :type="statusTagType(row.status)" size="small">{{ row.status_display }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="置顶" width="56" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.is_top" type="warning" size="small">顶</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="view_count" label="浏览" width="72" align="center" />
          <el-table-column prop="author_name" label="作者" width="88" />
          <el-table-column label="发布时间" width="158">
            <template #default="{ row }">{{ row.published_at || '-' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="148" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="primary" link @click="openArticleForm(row)">编辑</el-button>
              <el-popconfirm title="确定删除？" @confirm="removeArticle(row.id)">
                <template #reference>
                  <el-button size="small" type="danger" link>删除</el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </main>

    <!-- 分类表单 -->
    <el-dialog v-model="catVisible" :title="catForm.id ? '编辑分类' : '新增分类'" width="480px" destroy-on-close>
      <el-form :model="catForm" :rules="catRules" ref="catFormRef" label-width="80px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="catForm.name" />
        </el-form-item>
        <el-form-item label="别名" prop="slug">
          <el-input v-model="catForm.slug" placeholder="URL 用：英文、数字、连字符或中文等" />
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="catForm.icon" placeholder="如 📚" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="catForm.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="catForm.sort_order" :min="0" />
        </el-form-item>
        <el-form-item label="是否显示">
          <el-switch v-model="catForm.is_active" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="catVisible = false">取消</el-button>
        <el-button type="primary" :loading="catSaving" @click="submitCat">保存</el-button>
      </template>
    </el-dialog>

    <!-- 栏目表单 -->
    <el-dialog v-model="colVisible" :title="colForm.id ? '编辑栏目' : '新增栏目'" width="480px" destroy-on-close>
      <el-form :model="colForm" :rules="colRules" ref="colFormRef" label-width="80px">
        <el-form-item label="分类" prop="category">
          <el-select v-model="colForm.category" style="width:100%">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="名称" prop="name">
          <el-input v-model="colForm.name" />
        </el-form-item>
        <el-form-item label="别名" prop="slug">
          <el-input v-model="colForm.slug" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="colForm.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="colForm.sort_order" :min="0" />
        </el-form-item>
        <el-form-item label="是否显示">
          <el-switch v-model="colForm.is_active" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="colVisible = false">取消</el-button>
        <el-button type="primary" :loading="colSaving" @click="submitCol">保存</el-button>
      </template>
    </el-dialog>

    <!-- 文章编辑（全屏，双栏 Markdown 与 Apifox 文档编辑体验接近） -->
    <el-dialog
      v-model="artVisible"
      :title="artForm.id ? '编辑文章' : '新增文章'"
      fullscreen
      destroy-on-close
      class="article-dialog"
    >
      <el-form :model="artForm" :rules="artRules" ref="artFormRef" label-width="80px" class="article-form">
        <el-row :gutter="16">
          <el-col :xs="24" :md="12">
            <el-form-item label="标题" prop="title">
              <el-input v-model="artForm.title" placeholder="文档标题" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="6">
            <el-form-item label="位置" prop="column">
              <el-cascader
                v-model="artCascader"
                :options="cascaderOptions"
                :props="{ value: 'id', label: 'name', children: 'children' }"
                style="width:100%"
                placeholder="分类 / 栏目"
                @change="onCascaderChange"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="6">
            <el-form-item label="状态" prop="status">
              <el-select v-model="artForm.status" style="width:100%">
                <el-option label="草稿" value="draft" />
                <el-option label="已发布" value="published" />
                <el-option label="已归档" value="archived" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="URL别名">
              <el-input v-model="artForm.slug" placeholder="可选" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="标签">
              <el-input v-model="artForm.tags" placeholder="逗号分隔" />
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item label="排序">
              <el-input-number v-model="artForm.sort_order" :min="0" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item label="置顶">
              <el-switch v-model="artForm.is_top" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="摘要">
          <el-input v-model="artForm.summary" type="textarea" :rows="2" maxlength="500" show-word-limit placeholder="列表页摘要，支持 Markdown 纯文本" />
        </el-form-item>
        <el-form-item label="封面URL">
          <el-input v-model="artForm.cover_image" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="正文" prop="content">
          <div class="markdown-editor-wrap">
            <div class="editor-toolbar">
              <el-button-group>
                <el-button size="small" @click="insertMd('# 标题')">H1</el-button>
                <el-button size="small" @click="insertMd('## 标题')">H2</el-button>
                <el-button size="small" @click="insertMd('### 标题')">H3</el-button>
              </el-button-group>
              <el-button-group>
                <el-button size="small" @click="insertMd('**加粗**')"><strong>B</strong></el-button>
                <el-button size="small" @click="insertMd('*斜体*')"><em>I</em></el-button>
              </el-button-group>
              <el-button-group>
                <el-button size="small" @click="insertMd('- 列表项')">列表</el-button>
                <el-button size="small" @click="insertMd('> 引用')">引用</el-button>
              </el-button-group>
              <el-button size="small" @click="insertMd('[文字](https://)')">链接</el-button>
              <el-button size="small" @click="insertMd('![](https://)')">图片</el-button>
              <el-button size="small" @click="insertMd('```\n代码\n```')">代码</el-button>
              <el-divider direction="vertical" />
              <el-switch v-model="showPreview" inline-prompt active-text="预览" inactive-text="编辑" />
            </div>
            <div class="markdown-main" :class="{ 'preview-hidden': !showPreview }">
              <el-input
                ref="mdInputRef"
                v-model="artForm.content"
                type="textarea"
                :autosize="{ minRows: 18, maxRows: 40 }"
                class="markdown-input"
                placeholder="使用 Markdown 编写正文，前台 `/docs` 将以文档站样式展示"
              />
              <div v-if="showPreview" class="markdown-preview markdown-body-preview" v-html="renderedMarkdown" />
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="artVisible = false">取消</el-button>
        <el-button type="primary" :loading="artSaving" @click="submitArticle">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { Plus, Refresh, ArrowRight, FolderAdd, MoreFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { marked } from 'marked'
import {
  getKbCategories, createKbCategory, updateKbCategory, deleteKbCategory,
  getKbColumns, createKbColumn, updateKbColumn, deleteKbColumn,
  getKbArticles, createKbArticle, getKbArticle, updateKbArticle, deleteKbArticle,
} from '../../api/admin'

/* ─── 导航状态（Apifox 式树选中） ───────────────────────────── */
const selectedNav = ref({ mode: 'all' })
const expandedCatIds = ref(new Set())
const treeFilter = ref('')

const categories = ref([])
const columnsAll = ref([])
const catLoading = ref(false)

const filteredNav = computed(() => {
  const q = treeFilter.value.trim().toLowerCase()
  return categories.value
    .map((cat) => {
      const cols = columnsAll.value.filter((c) => c.category === cat.id)
      let showCols = cols
      if (q) {
        const catHit = cat.name.toLowerCase().includes(q)
        showCols = catHit ? cols : cols.filter((c) => c.name.toLowerCase().includes(q))
      }
      const visible = !q || cat.name.toLowerCase().includes(q) || showCols.length > 0
      return { cat, columns: showCols, visible }
    })
    .filter((x) => x.visible)
})

const breadcrumb = computed(() => {
  const nav = selectedNav.value
  if (nav.mode === 'all') return []
  if (nav.mode === 'category') {
    const c = categories.value.find((x) => x.id === nav.categoryId)
    return c ? [c.name] : []
  }
  if (nav.mode === 'column') {
    const c = categories.value.find((x) => x.id === nav.categoryId)
    const col = columnsAll.value.find((x) => x.id === nav.columnId)
    return [c?.name, col?.name].filter(Boolean)
  }
  return []
})

const isCatExpanded = (id) => expandedCatIds.value.has(id)
const toggleCat = (id) => {
  const next = new Set(expandedCatIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedCatIds.value = next
}

const expandAllCats = () => {
  expandedCatIds.value = new Set(categories.value.map((c) => c.id))
}

const onCatLabelClick = (cat) => {
  const next = new Set(expandedCatIds.value)
  next.add(cat.id)
  expandedCatIds.value = next
  selectCategory(cat.id)
}

const onCatCommand = async (cmd, cat) => {
  if (cmd === 'edit') openCatForm(cat)
  else if (cmd === 'addcol') {
    colForm.value = {
      id: null,
      category: cat.id,
      name: '',
      slug: '',
      description: '',
      sort_order: 0,
      is_active: true,
    }
    colVisible.value = true
  } else if (cmd === 'del') {
    try {
      await ElMessageBox.confirm('删除分类将可能影响其下栏目与文章，确定删除？', '提示', { type: 'warning' })
      await deleteKbCategory(cat.id)
      ElMessage.success('已删除')
      await loadCategories()
      await loadAllColumns()
      selectedNav.value = { mode: 'all' }
      await loadArticles()
    } catch (e) {
      if (e !== 'cancel') throw e
    }
  }
}

const onColCommand = async (cmd, col) => {
  if (cmd === 'edit') openColForm(col)
  else if (cmd === 'del') {
    try {
      await ElMessageBox.confirm('确定删除该栏目？', '提示', { type: 'warning' })
      await deleteKbColumn(col.id)
      ElMessage.success('已删除')
      await loadAllColumns()
      selectedNav.value = { mode: 'all' }
      await loadArticles()
    } catch (e) {
      if (e !== 'cancel') throw e
    }
  }
}

const selectAll = () => {
  selectedNav.value = { mode: 'all' }
  loadArticles()
}

const selectCategory = (categoryId) => {
  selectedNav.value = { mode: 'category', categoryId }
  loadArticles()
}

const selectColumn = (cat, col) => {
  selectedNav.value = { mode: 'column', categoryId: cat.id, columnId: col.id }
  loadArticles()
}

/* ─── 分类 ────────────────────────────────────────────── */
const catVisible = ref(false)
const catSaving = ref(false)
const catFormRef = ref(null)
const catForm = ref({ id: null, name: '', slug: '', icon: '', description: '', sort_order: 0, is_active: true })
const catRules = { name: [{ required: true, message: '必填' }], slug: [{ required: true, message: '必填' }] }

const loadCategories = async () => {
  catLoading.value = true
  try {
    const res = await getKbCategories()
    categories.value = res.results || res || []
  } finally {
    catLoading.value = false
  }
}

const loadAllColumns = async () => {
  const res = await getKbColumns()
  columnsAll.value = res.results || res || []
}

const openCatForm = (row) => {
  if (row) {
    catForm.value = { ...row }
  } else {
    catForm.value = { id: null, name: '', slug: '', icon: '', description: '', sort_order: 0, is_active: true }
  }
  catVisible.value = true
}

const buildCatPayload = () => {
  const f = catForm.value
  return {
    name: f.name,
    slug: f.slug,
    icon: f.icon || '',
    description: f.description || '',
    sort_order: f.sort_order ?? 0,
    is_active: !!f.is_active,
  }
}

const submitCat = async () => {
  await catFormRef.value.validate()
  catSaving.value = true
  try {
    const payload = buildCatPayload()
    if (catForm.value.id) {
      await updateKbCategory(catForm.value.id, payload)
      ElMessage.success('已更新')
    } else {
      await createKbCategory(payload)
      ElMessage.success('已创建')
    }
    catVisible.value = false
    await loadCategories()
    await loadAllColumns()
    expandAllCats()
  } finally {
    catSaving.value = false
  }
}

/* ─── 栏目 ────────────────────────────────────────────── */
const colVisible = ref(false)
const colSaving = ref(false)
const colFormRef = ref(null)
const colForm = ref({ id: null, category: null, name: '', slug: '', description: '', sort_order: 0, is_active: true })
const colRules = {
  category: [{ required: true, message: '请选择分类' }],
  name: [{ required: true, message: '必填' }],
  slug: [{ required: true, message: '必填' }],
}

const openColForm = (row) => {
  const preCat =
    selectedNav.value.mode === 'category'
      ? selectedNav.value.categoryId
      : selectedNav.value.mode === 'column'
        ? selectedNav.value.categoryId
        : categories.value[0]?.id || null
  if (row) {
    colForm.value = { ...row }
  } else {
    colForm.value = {
      id: null,
      category: preCat,
      name: '',
      slug: '',
      description: '',
      sort_order: 0,
      is_active: true,
    }
  }
  colVisible.value = true
}

const buildColPayload = () => {
  const f = colForm.value
  return {
    category: f.category,
    name: f.name,
    slug: f.slug,
    description: f.description || '',
    sort_order: f.sort_order ?? 0,
    is_active: !!f.is_active,
  }
}

const submitCol = async () => {
  await colFormRef.value.validate()
  colSaving.value = true
  try {
    const payload = buildColPayload()
    if (colForm.value.id) {
      await updateKbColumn(colForm.value.id, payload)
      ElMessage.success('已更新')
    } else {
      await createKbColumn(payload)
      ElMessage.success('已创建')
    }
    colVisible.value = false
    await loadAllColumns()
  } finally {
    colSaving.value = false
  }
}

/* ─── 文章 ────────────────────────────────────────────── */
const articles = ref([])
const artLoading = ref(false)
const artVisible = ref(false)
const artSaving = ref(false)
const artFormRef = ref(null)
const artFilterStatus = ref('')
const artFilterQ = ref('')
const showPreview = ref(true)
const mdInputRef = ref(null)
const artCascader = ref([])

const renderedMarkdown = computed(() => {
  const content = artForm.value.content || ''
  return marked.parse(content)
})

const artForm = ref({
  id: null,
  column: null,
  title: '',
  slug: '',
  summary: '',
  cover_image: '',
  content: '',
  status: 'draft',
  tags: '',
  sort_order: 0,
  is_top: false,
})
const artRules = {
  title: [{ required: true, message: '标题必填' }],
  column: [{ required: true, message: '请选择栏目' }],
  content: [{ required: true, message: '正文必填' }],
}

const cascaderOptions = computed(() =>
  categories.value.map((c) => ({
    id: c.id,
    name: c.name,
    children: columnsAll.value
      .filter((col) => col.category === c.id)
      .map((col) => ({
        id: col.id,
        name: col.name,
      })),
  }))
)

const onCascaderChange = (val) => {
  if (val && val.length === 2) {
    artForm.value.column = val[1]
  }
}

const loadArticles = async () => {
  artLoading.value = true
  try {
    const params = {}
    const nav = selectedNav.value
    if (nav.mode === 'category') params.category = nav.categoryId
    if (nav.mode === 'column') params.column = nav.columnId
    if (artFilterStatus.value) params.status = artFilterStatus.value
    if (artFilterQ.value) params.q = artFilterQ.value
    const res = await getKbArticles(params)
    articles.value = res.results || res || []
  } finally {
    artLoading.value = false
  }
}

const refreshMain = async () => {
  await loadCategories()
  await loadAllColumns()
  await loadArticles()
}

const openArticleForm = async (row) => {
  if (row) {
    const data = await getKbArticle(row.id)
    artForm.value = { ...data }
    const col = columnsAll.value.find((c) => c.id === data.column)
    artCascader.value = col ? [col.category, col.id] : []
  } else {
    artForm.value = {
      id: null,
      column: null,
      title: '',
      slug: '',
      summary: '',
      cover_image: '',
      content: '',
      status: 'draft',
      tags: '',
      sort_order: 0,
      is_top: false,
    }
    artCascader.value = []
    const nav = selectedNav.value
    if (nav.mode === 'column') {
      artForm.value.column = nav.columnId
      artCascader.value = [nav.categoryId, nav.columnId]
    } else if (nav.mode === 'category') {
      const firstCol = columnsAll.value.find((c) => c.category === nav.categoryId)
      if (firstCol) {
        artForm.value.column = firstCol.id
        artCascader.value = [nav.categoryId, firstCol.id]
      }
    }
  }
  artVisible.value = true
}

const insertMd = (snippet) => {
  const textarea = mdInputRef.value?.textarea
  if (!textarea) {
    artForm.value.content = `${artForm.value.content || ''}\n${snippet}\n`
    return
  }
  const start = textarea.selectionStart ?? 0
  const end = textarea.selectionEnd ?? 0
  const raw = artForm.value.content || ''
  const prefix = raw.slice(0, start)
  const suffix = raw.slice(end)
  const needsNewline = prefix && !prefix.endsWith('\n')
  const inserted = `${needsNewline ? '\n' : ''}${snippet}\n`
  artForm.value.content = `${prefix}${inserted}${suffix}`
  textarea.focus()
  const cursor = start + inserted.length
  textarea.setSelectionRange(cursor, cursor)
}

const submitArticle = async () => {
  await artFormRef.value.validate()
  artSaving.value = true
  try {
    const payload = { ...artForm.value }
    if (payload.id) {
      await updateKbArticle(payload.id, payload)
      ElMessage.success('已更新')
    } else {
      delete payload.id
      await createKbArticle(payload)
      ElMessage.success('已创建')
    }
    artVisible.value = false
    await loadArticles()
    await loadAllColumns()
  } finally {
    artSaving.value = false
  }
}

const removeArticle = async (id) => {
  await deleteKbArticle(id)
  ElMessage.success('已删除')
  await loadArticles()
  await loadAllColumns()
}

const statusTagType = (s) => ({ draft: 'info', published: 'success', archived: 'warning' }[s] || 'info')

onMounted(async () => {
  await loadCategories()
  await loadAllColumns()
  expandAllCats()
  const firstCol = columnsAll.value[0]
  if (firstCol) {
    selectedNav.value = { mode: 'column', categoryId: firstCol.category, columnId: firstCol.id }
  } else if (categories.value[0]) {
    selectedNav.value = { mode: 'category', categoryId: categories.value[0].id }
  } else {
    selectedNav.value = { mode: 'all' }
  }
  await loadArticles()
})
</script>

<style scoped>
.kb-shell {
  display: flex;
  min-height: calc(100vh - 120px);
  margin: -8px -12px 0;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #e8e8e8;
  background: #fff;
}

.kb-sidenav {
  width: 268px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #fafbfc 0%, #f4f5f7 100%);
  border-right: 1px solid #ebeef5;
}

.sidenav-brand {
  padding: 16px 14px 10px;
  border-bottom: 1px solid #edf0f5;
}
.brand-title {
  font-size: 15px;
  font-weight: 700;
  color: #1a1a2e;
  letter-spacing: 0.02em;
}
.brand-sub {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.tree-search {
  padding: 10px 12px 8px;
}
.tree-search :deep(.el-input__wrapper) {
  border-radius: 8px;
}

.tree-scroll {
  flex: 1;
  min-height: 280px;
}

.tree-all {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 10px 6px;
  padding: 9px 10px;
  border-radius: 8px;
  font-size: 13px;
  color: #303133;
  cursor: pointer;
  transition: background 0.15s;
}
.tree-all:hover {
  background: rgba(99, 102, 241, 0.08);
}
.tree-all.active {
  background: #eef2ff;
  color: #4338ca;
  font-weight: 600;
}
.tree-icon {
  font-size: 15px;
}

.tree-block {
  margin-bottom: 2px;
}
.tree-cat {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 8px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: #303133;
  user-select: none;
}
.tree-cat:hover {
  background: rgba(0, 0, 0, 0.04);
}
.tree-cat.active {
  color: #4338ca;
  font-weight: 600;
}
.caret-wrap {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  margin-right: 2px;
  border-radius: 4px;
}
.caret-wrap:hover {
  background: rgba(0, 0, 0, 0.06);
}
.tree-cat .caret {
  font-size: 12px;
  color: #c0c4cc;
  transition: transform 0.2s;
}
.tree-cat.expanded .caret {
  transform: rotate(90deg);
}
.tree-more {
  display: inline-flex;
  align-items: center;
  padding: 2px 4px;
  margin-left: 2px;
  border-radius: 4px;
  color: #c0c4cc;
  cursor: pointer;
}
.tree-more:hover {
  color: #6366f1;
  background: rgba(99, 102, 241, 0.08);
}
.col-more {
  margin-left: auto;
}
.cat-ico {
  margin-right: 2px;
}
.tree-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tree-badge {
  font-size: 11px;
  color: #909399;
  background: #e8eaed;
  padding: 0 6px;
  border-radius: 8px;
}

.tree-children {
  padding: 2px 0 6px 6px;
}
.tree-col {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 1px 8px 1px 18px;
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 12px;
  color: #606266;
  cursor: pointer;
}
.tree-col .tree-label {
  flex: 1;
  min-width: 0;
}
.tree-col:hover {
  background: rgba(99, 102, 241, 0.06);
}
.tree-col.active {
  background: #e8ebff;
  color: #4338ca;
  font-weight: 600;
}
.col-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #c0c4cc;
  flex-shrink: 0;
}
.tree-col.active .col-dot {
  background: #6366f1;
}
.col-count {
  transform: scale(0.92);
}
.tree-empty {
  font-size: 12px;
  color: #c0c4cc;
  padding: 4px 28px 8px;
}

.sidenav-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #edf0f5;
  background: rgba(255, 255, 255, 0.6);
}

.kb-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.kb-main-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px 10px;
  border-bottom: 1px solid #f0f2f5;
}
.header-actions {
  display: flex;
  gap: 8px;
}

.kb-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 18px;
  background: #fafbfc;
  border-bottom: 1px solid #f0f2f5;
}

.kb-table-wrap {
  flex: 1;
  padding: 0 18px 18px;
  min-height: 360px;
}
.kb-table {
  border-radius: 8px;
}

.markdown-editor-wrap {
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  overflow: hidden;
  width: 100%;
}
.editor-toolbar {
  background: #f8f9fb;
  padding: 8px 10px;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.markdown-main {
  display: flex;
  min-height: 420px;
  align-items: stretch;
}
.markdown-main.preview-hidden {
  display: block;
}
.markdown-input {
  width: 50%;
  border-right: 1px solid #ebeef5;
}
.markdown-main.preview-hidden .markdown-input {
  width: 100%;
  border-right: 0;
}
.markdown-input :deep(textarea) {
  min-height: 420px !important;
  border: none;
  border-radius: 0;
  font-family: ui-monospace, 'Cascadia Code', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
}
.markdown-preview {
  width: 50%;
  padding: 16px 18px;
  overflow-y: auto;
  max-height: min(70vh, 720px);
  background: #fff;
  font-size: 14px;
}
.markdown-body-preview :deep(h1),
.markdown-body-preview :deep(h2),
.markdown-body-preview :deep(h3) {
  margin-top: 0.8em;
  margin-bottom: 0.5em;
}
.markdown-body-preview :deep(p),
.markdown-body-preview :deep(li) {
  line-height: 1.75;
}
.markdown-body-preview :deep(pre) {
  background: #f5f7fa;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
}
.markdown-body-preview :deep(code) {
  background: #f0f2f5;
  padding: 2px 5px;
  border-radius: 4px;
  font-size: 0.9em;
}
.markdown-body-preview :deep(img) {
  max-width: 100%;
  border-radius: 6px;
}
.markdown-body-preview :deep(table) {
  border-collapse: collapse;
  width: 100%;
}
.markdown-body-preview :deep(th),
.markdown-body-preview :deep(td) {
  border: 1px solid #e5e7eb;
  padding: 6px 10px;
}

@media (max-width: 960px) {
  .kb-shell {
    flex-direction: column;
    margin: 0;
    min-height: auto;
  }
  .kb-sidenav {
    width: 100%;
    max-height: 320px;
    border-right: none;
    border-bottom: 1px solid #ebeef5;
  }
  .tree-scroll {
    min-height: 160px;
    max-height: 220px;
  }
  .markdown-main {
    flex-direction: column;
  }
  .markdown-input,
  .markdown-preview {
    width: 100%;
    border-right: none;
    max-height: none;
  }
  .markdown-input :deep(textarea) {
    min-height: 240px !important;
  }
}
</style>
