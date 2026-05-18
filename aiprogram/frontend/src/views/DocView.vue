<template>
  <div class="doc-wrapper">
    <header class="top-nav">
      <div class="top-nav-left">
        <el-button
          class="nav-menu-btn"
          :icon="Menu"
          circle
          text
          @click="toggleSidebar"
          aria-label="打开目录"
        />
        <div class="brand" @click="goDocs">知识库</div>
      </div>
      <nav class="nav-links">
        <el-button text @click="goHome">首页</el-button>
        <el-button text type="primary" @click="goDocs">知识库</el-button>
        <el-button
          v-if="isMobile && article && tocItems.length"
          class="nav-toc-btn"
          text
          type="primary"
          @click="tocDrawerVisible = true"
        >
          本页目录
        </el-button>
      </nav>
    </header>

    <div
      v-show="isMobile && sidebarOpen"
      class="doc-sidebar-backdrop"
      @click="closeSidebar"
    />

    <div class="doc-page">
      <aside
        class="doc-sidebar"
        :class="{ 'is-open': sidebarOpen || !isMobile }"
        v-loading="loadingCategories"
      >
      <div class="sidebar-header">
        <div class="title">知识库文档</div>
        <el-input
          v-model="searchKeyword"
          placeholder="搜索文档"
          clearable
          :prefix-icon="Search"
          @keyup.enter="doSearch"
          @clear="resetSearch"
        >
          <template #append>
            <el-button @click="doSearch">搜索</el-button>
          </template>
        </el-input>
      </div>

      <el-scrollbar class="sidebar-scroll">
        <template v-if="searchMode">
          <div class="group-title">搜索结果</div>
          <div
            v-for="item in searchResults"
            :key="item.id"
            class="article-item"
            :class="{ active: item.id === currentArticleId }"
            @click="selectArticle(item.id)"
          >
            <div class="article-title">{{ item.title }}</div>
            <div class="article-meta">{{ item.category_name }} / {{ item.column_name }}</div>
          </div>
          <el-empty v-if="!searchResults.length" description="暂无匹配文档" :image-size="72" />
        </template>

        <template v-else>
          <div v-for="cat in docTree" :key="cat.id" class="category-block">
            <div class="group-title">
              <span v-if="cat.icon" class="cat-icon">{{ cat.icon }}</span>
              {{ cat.name }}
            </div>
            <div v-for="col in cat.columns || []" :key="col.id" class="column-block">
              <div
                class="column-title"
                :class="{ active: col.id === currentColumnId, expanded: isColumnExpanded(col.id) }"
                @click="toggleColumn(col.id)"
              >
                <el-icon class="column-caret"><ArrowRight /></el-icon>
                <span class="column-name">{{ col.name }}</span>
                <span class="column-count">{{ (col.articles || []).length }}</span>
              </div>
              <div v-if="isColumnExpanded(col.id)" class="articles-wrap">
                <div
                  v-for="art in (col.articles || [])"
                  :key="art.id"
                  class="article-item"
                  :class="{ active: art.id === currentArticleId }"
                  @click="selectArticle(art.id, col.id)"
                >
                  <span v-if="art.is_top" class="top-dot" />
                  <span class="article-label">{{ art.title }}</span>
                </div>
                <el-empty v-if="!(col.articles || []).length" description="该栏目暂无文章" :image-size="56" />
              </div>
            </div>
          </div>
          <el-empty v-if="!docTree.length && !loadingCategories" description="暂无文档" :image-size="72" />
        </template>
      </el-scrollbar>
      </aside>

      <main class="doc-content" v-loading="loadingDetail">
        <div v-if="article" class="article-panel">
          <h1 class="article-title-main">{{ article.title }}</h1>
          <div class="article-info">
            <el-tag size="small" type="info">{{ article.category_name }}</el-tag>
            <el-tag size="small">{{ article.column_name }}</el-tag>
            <span class="time">更新于：{{ article.updated_at || article.created_at || '-' }}</span>
          </div>
          <el-divider />
          <article ref="articleBodyRef" class="markdown-body" v-html="articleHtml" />
        </div>
        <el-empty :description="isMobile ? '点击左上角「目录」打开文档导航' : '请选择左侧文档开始阅读'" />
      </main>

      <aside class="doc-toc doc-toc-desktop">
        <div class="toc-title">目录</div>
        <el-scrollbar class="toc-scroll">
          <div v-if="tocItems.length">
            <div
              v-for="item in tocItems"
              :key="item.id"
              class="toc-item"
              :class="[`level-${item.level}`, { active: activeTocId === item.id }]"
              @click="scrollToHeading(item.id)"
            >
              {{ item.text }}
            </div>
          </div>
          <el-empty v-else description="暂无目录" :image-size="56" />
        </el-scrollbar>
      </aside>
    </div>

    <el-drawer
      v-model="tocDrawerVisible"
      title="本页目录"
      direction="rtl"
      size="82%"
      class="doc-toc-drawer"
    >
      <div
        v-for="item in tocItems"
        :key="item.id"
        class="toc-item toc-item-drawer"
        :class="[`level-${item.level}`, { active: activeTocId === item.id }]"
        @click="onTocClickInDrawer(item.id)"
      >
        {{ item.text }}
      </div>
      <el-empty v-if="!tocItems.length" description="暂无目录" :image-size="56" />
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, ArrowRight, Menu } from '@element-plus/icons-vue'
import { marked } from 'marked'
import {
  getPublicKbTree,
  getPublicKbArticle,
  searchPublicKbArticles,
} from '../api/knowledge'

const router = useRouter()
const docTree = ref([])
const expandedColumns = ref(new Set())
const currentColumnId = ref(null)
const currentArticleId = ref(null)
const article = ref(null)

const loadingCategories = ref(false)
const loadingDetail = ref(false)

const searchKeyword = ref('')
const searchMode = ref(false)
const searchResults = ref([])
const articleBodyRef = ref(null)
const tocItems = ref([])
const activeTocId = ref('')
let headingObserver = null

const isMobile = ref(false)
const sidebarOpen = ref(false)
const tocDrawerVisible = ref(false)
let mqListener = null

const articleHtml = computed(() => {
  if (!article.value) return ''
  return article.value.content_html || marked.parse(article.value.content || '')
})

const loadDocTree = async () => {
  loadingCategories.value = true
  try {
    const res = await getPublicKbTree()
    docTree.value = res.results || res || []
    // 默认展开每个分类下的第一个栏目，以及全部包含文章的栏目
    for (const cat of docTree.value) {
      for (const col of cat.columns || []) {
        if ((col.articles || []).length) {
          expandedColumns.value.add(col.id)
        }
      }
    }
  } finally {
    loadingCategories.value = false
  }
}

const isColumnExpanded = (colId) => expandedColumns.value.has(colId)
const toggleColumn = (colId) => {
  const next = new Set(expandedColumns.value)
  if (next.has(colId)) next.delete(colId)
  else next.add(colId)
  expandedColumns.value = next
}

const loadArticleDetail = async (id) => {
  if (!id) return
  loadingDetail.value = true
  try {
    const data = await getPublicKbArticle(id)
    article.value = data
    currentArticleId.value = data.id
  } finally {
    loadingDetail.value = false
  }
}

const buildToc = async () => {
  await nextTick()
  const container = articleBodyRef.value
  if (!container) {
    tocItems.value = []
    return
  }
  const headings = container.querySelectorAll('h1, h2, h3, h4')
  const nextToc = []
  headings.forEach((h, idx) => {
    const text = h.textContent?.trim()
    if (!text) return
    const id = `toc-${idx}-${text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fa5-]/g, '')}`
    h.id = id
    nextToc.push({
      id,
      text,
      level: Number(h.tagName?.replace('H', '')) || 2,
    })
  })
  tocItems.value = nextToc
  activeTocId.value = nextToc[0]?.id || ''

  // 滚动联动高亮
  if (headingObserver) {
    headingObserver.disconnect()
  }
  if (nextToc.length && window.IntersectionObserver) {
    headingObserver = new IntersectionObserver((entries) => {
      // 选最靠近顶部且进入可视区的标题
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible.length) {
        activeTocId.value = visible[0].target.id
      }
    }, {
      root: null,
      rootMargin: '-80px 0px -60% 0px',
      threshold: [0, 1],
    })
    headings.forEach((h) => headingObserver.observe(h))
  }
}

onBeforeUnmount(() => {
  if (headingObserver) headingObserver.disconnect()
  if (mqListener) {
    window.matchMedia('(max-width: 900px)').removeEventListener('change', mqListener)
  }
})

const scrollToHeading = (id) => {
  const target = document.getElementById(id)
  if (!target) return
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  activeTocId.value = id
}

const goDocs = () => {
  router.push('/docs')
}

const goHome = () => {
  const hasToken = !!localStorage.getItem('access_token')
  router.push(hasToken ? '/chat' : '/login')
}

const toggleSidebar = () => {
  sidebarOpen.value = !sidebarOpen.value
}

const closeSidebar = () => {
  sidebarOpen.value = false
}

const onTocClickInDrawer = (id) => {
  scrollToHeading(id)
  tocDrawerVisible.value = false
}

const selectArticle = async (articleId, columnId) => {
  searchMode.value = false
  if (columnId) currentColumnId.value = columnId
  if (columnId) expandedColumns.value.add(columnId)
  await loadArticleDetail(articleId)
  if (isMobile.value) sidebarOpen.value = false
}

const findFirstArticle = () => {
  for (const cat of docTree.value) {
    for (const col of cat.columns || []) {
      if ((col.articles || []).length) {
        return { columnId: col.id, articleId: col.articles[0].id }
      }
    }
  }
  return null
}

const doSearch = async () => {
  const q = searchKeyword.value.trim()
  if (!q) return
  searchMode.value = true
  const res = await searchPublicKbArticles({ q })
  searchResults.value = res.results || res || []
  if (!searchResults.value.length) {
    article.value = null
    currentArticleId.value = null
    ElMessage.info('未找到匹配文档')
    return
  }
  await loadArticleDetail(searchResults.value[0].id)
  if (isMobile.value) sidebarOpen.value = false
}

const resetSearch = () => {
  searchKeyword.value = ''
  searchMode.value = false
  searchResults.value = []
}

onMounted(async () => {
  const mq = window.matchMedia('(max-width: 900px)')
  const applyMq = () => {
    isMobile.value = mq.matches
    if (!mq.matches) sidebarOpen.value = false
  }
  applyMq()
  mqListener = applyMq
  mq.addEventListener('change', applyMq)

  await loadDocTree()
  const first = findFirstArticle()
  if (first) {
    await selectArticle(first.articleId, first.columnId)
  }
})

watch(articleHtml, async () => {
  await buildToc()
})
</script>

<style scoped>
.doc-wrapper {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f7f8fa;
}
.top-nav {
  height: 56px;
  border-bottom: 1px solid #ebeef5;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
}
.top-nav-left {
  display: flex;
  align-items: center;
  gap: 4px;
}
.nav-menu-btn {
  display: none;
}
.brand {
  font-size: 18px;
  font-weight: 700;
  color: #303133;
  cursor: pointer;
}
.nav-links {
  display: flex;
  align-items: center;
  gap: 8px;
}
.doc-page {
  height: calc(100vh - 56px);
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr) 250px;
  min-height: 0;
}
.doc-sidebar-backdrop {
  display: none;
}
.doc-sidebar {
  border-right: 1px solid #ebeef5;
  background: #fff;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.sidebar-header {
  padding: 14px;
  border-bottom: 1px solid #f0f2f5;
}
.title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 10px;
}
.sidebar-scroll {
  flex: 1;
}
.group-title {
  font-size: 13px;
  color: #909399;
  margin: 12px 14px 6px;
}
.category-block {
  margin-bottom: 8px;
}
.column-block {
  margin-bottom: 4px;
}
.column-title {
  padding: 8px 14px;
  cursor: pointer;
  font-size: 14px;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
}
.column-title:hover {
  background: #f6f8ff;
}
.column-title.active {
  color: #6366f1;
  font-weight: 600;
}
.column-caret {
  transition: transform 0.18s ease;
  color: #9ca3af;
  font-size: 12px;
}
.column-title.expanded .column-caret {
  transform: rotate(90deg);
}
.column-name {
  flex: 1;
}
.column-count {
  font-size: 11px;
  color: #9ca3af;
  background: #f2f3f5;
  padding: 0 6px;
  border-radius: 8px;
}
.cat-icon { margin-right: 4px; }
.articles-wrap {
  padding-left: 18px;
}
.top-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #f59e0b;
  display: inline-block;
  margin-right: 6px;
  vertical-align: middle;
}
.article-label {
  vertical-align: middle;
}
.article-item {
  padding: 8px 14px;
  font-size: 13px;
  color: #606266;
  cursor: pointer;
  border-radius: 6px;
  margin: 2px 8px;
}
.article-item:hover {
  background: #f6f8ff;
}
.article-item.active {
  background: #eef2ff;
  color: #4338ca;
  font-weight: 600;
}
.article-meta {
  margin-top: 2px;
  color: #909399;
  font-size: 12px;
}
.doc-content {
  overflow: auto;
  padding: 28px 36px;
}
.article-panel {
  max-width: 980px;
  margin: 0 auto;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  padding: 24px 28px;
}
.article-title-main {
  margin: 0;
  font-size: 32px;
  line-height: 1.3;
}
.article-info {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.time {
  color: #909399;
  font-size: 13px;
}
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin-top: 1em;
  margin-bottom: 0.6em;
}
.markdown-body :deep(p),
.markdown-body :deep(li) {
  line-height: 1.85;
}
.markdown-body :deep(pre) {
  background: #f5f7fa;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
}
.markdown-body :deep(code) {
  background: #f2f4f8;
  border-radius: 4px;
  padding: 2px 4px;
}
.markdown-body :deep(img) {
  max-width: 100%;
}
.doc-toc {
  border-left: 1px solid #ebeef5;
  background: #fff;
  display: flex;
  flex-direction: column;
}
.toc-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  padding: 14px;
  border-bottom: 1px solid #f0f2f5;
}
.toc-scroll {
  flex: 1;
}
.toc-item {
  margin: 4px 8px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  color: #606266;
  font-size: 13px;
  line-height: 1.5;
}
.toc-item:hover {
  background: #f6f8ff;
}
.toc-item.active {
  background: #eef2ff;
  color: #4338ca;
  font-weight: 600;
}
.toc-item.level-1 { font-weight: 600; }
.toc-item.level-3 { padding-left: 20px; }
.toc-item.level-4 { padding-left: 32px; font-size: 12px; }

.toc-item-drawer {
  margin: 2px 0;
}

@media (max-width: 900px) {
  .nav-menu-btn {
    display: inline-flex;
  }
  .doc-page {
    grid-template-columns: 1fr;
  }
  .doc-sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 56px 0 0 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 200;
  }
  .doc-sidebar {
    position: fixed;
    top: 56px;
    left: 0;
    bottom: 0;
    width: min(300px, 88vw);
    z-index: 210;
    transform: translateX(-100%);
    transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 8px 0 32px rgba(0, 0, 0, 0.12);
  }
  .doc-sidebar.is-open {
    transform: translateX(0);
  }
  .doc-toc-desktop {
    display: none !important;
  }
  .doc-content {
    padding: 16px 12px;
  }
  .article-panel {
    padding: 16px 14px;
    border-radius: 10px;
  }
  .article-title-main {
    font-size: 22px;
  }
}
</style>
