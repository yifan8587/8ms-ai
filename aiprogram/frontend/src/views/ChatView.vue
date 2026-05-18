<template>
  <div class="chat-container">
    <!-- ── 顶部栏 ── -->
    <div class="chat-header">
      <div class="model-selector">
        <span class="label">模型：</span>
        <el-select
          v-model="selectedModel"
          placeholder="选择模型"
          size="default"
          style="width: 300px"
          filterable
        >
          <el-option-group label="✅ 免费可用">
            <el-option
              v-for="m in freeModels"
              :key="m.model_id"
              :label="m.name"
              :value="m.model_id"
            >
              <span>{{ m.name }}</span>
              <el-tag type="success" size="small" style="margin-left:8px">免费</el-tag>
            </el-option>
          </el-option-group>
          <el-option-group label="⚠️ 地区受限">
            <el-option
              v-for="m in restrictedModels"
              :key="m.model_id"
              :label="m.name + ' ⚠️'"
              :value="m.model_id"
            >
              <span style="color:#e6a23c">{{ m.name }}</span>
              <el-tag type="warning" size="small" style="margin-left:8px">受限</el-tag>
            </el-option>
          </el-option-group>
          <el-option-group label="💎 付费模型">
            <el-option
              v-for="m in paidModels"
              :key="m.model_id"
              :label="m.name"
              :value="m.model_id"
            />
          </el-option-group>
        </el-select>
        <el-button :icon="Refresh" size="small" @click="syncModels" :loading="syncing" title="同步模型">
          同步
        </el-button>
      </div>

      <div class="header-center">
        <span class="conv-title" v-if="currentConv">{{ currentConv.title }}</span>
      </div>

      <div class="header-right">
        <el-tooltip :content="useContext ? `携带最近 ${maxContext} 条历史上下文` : '不携带历史（每次独立对话）'">
          <div class="ctx-toggle">
            <el-switch v-model="useContext" size="small" />
            <span class="ctx-label">上下文</span>
          </div>
        </el-tooltip>
        <el-tooltip content="设置">
          <el-button :icon="Setting" size="small" text @click="showSettings = !showSettings" />
        </el-tooltip>
      </div>
    </div>

    <!-- ── 设置面板 ── -->
    <transition name="slide-down">
      <div v-if="showSettings" class="settings-panel">
        <div class="settings-grid">
          <div class="setting-item">
            <label>最大上下文条数：<strong>{{ useContext ? maxContext : '关闭' }}</strong></label>
            <el-slider
              v-model="maxContext"
              :min="1"
              :max="50"
              :step="1"
              :disabled="!useContext"
              style="margin-top:8px"
            />
          </div>
          <div class="setting-item">
            <label>系统提示词（System Prompt）</label>
            <el-input
              v-model="systemPrompt"
              type="textarea"
              :rows="2"
              placeholder="可选，例如：你是一名专业的 Python 开发工程师，请用中文回答..."
              resize="none"
              style="margin-top:8px"
            />
          </div>
        </div>
      </div>
    </transition>

    <!-- ── 消息区域 ── -->
    <el-scrollbar ref="scrollRef" class="message-area">
      <div class="messages">
        <!-- 欢迎页 -->
        <div v-if="messages.length === 0 && !streaming" class="welcome">
          <el-icon :size="64" color="#6366f1"><ChatDotRound /></el-icon>
          <h2>有什么我能帮你的？</h2>
          <p>支持文字、图片、文件、语音输入，与 AI 开始对话</p>
          <div class="welcome-chips">
            <el-tag
              v-for="tip in quickTips"
              :key="tip"
              @click="inputText = tip"
              effect="plain"
              style="cursor:pointer;margin:4px"
            >{{ tip }}</el-tag>
          </div>
        </div>

        <!-- 消息列表 -->
        <div
          v-for="msg in messages"
          :key="msg.id || msg._id"
          class="message-item"
          :class="msg.role"
        >
          <div class="msg-avatar">
            <el-avatar
              v-if="msg.role === 'user'"
              :size="36"
              style="background:linear-gradient(135deg,#6366f1,#8b5cf6)"
            >
              {{ userStore.userInfo?.nickname?.[0] || userStore.userInfo?.username?.[0] }}
            </el-avatar>
            <el-avatar v-else :size="36" style="background:linear-gradient(135deg,#10b981,#059669)">
              AI
            </el-avatar>
          </div>

          <div class="msg-bubble">
            <!-- 图片附件预览 -->
            <div v-if="msg.images?.length" class="msg-images">
              <img
                v-for="(img, i) in msg.images"
                :key="i"
                :src="img"
                class="msg-image"
                @click="previewImage(img)"
              />
            </div>
            <!-- 文件附件 -->
            <div v-if="msg.files?.length" class="msg-files">
              <div v-for="(f, i) in msg.files" :key="i" class="msg-file-chip">
                <el-icon><Document /></el-icon> {{ f.name }}
              </div>
            </div>
            <!-- 内容（markdown 或纯文本） -->
            <div
              class="msg-content markdown-body"
              :class="{ user: msg.role === 'user' }"
              v-html="msg.role === 'assistant' ? renderMarkdown(msg.content) : escapeHtml(msg.content)"
            />
            <!-- 底部操作栏 -->
            <div class="msg-footer">
              <span class="msg-time">{{ formatTime(msg.created_at) }}</span>
              <div class="msg-actions">
                <el-button text size="small" :icon="CopyDocument" @click="copyText(msg.content)" title="复制" />
                <el-button
                  v-if="msg.role === 'assistant'"
                  text size="small" :icon="RefreshRight"
                  @click="regenerate"
                  title="重新生成"
                  :disabled="loading || !!streaming"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 流式输出中的消息 -->
        <div v-if="streaming !== null" class="message-item assistant">
          <div class="msg-avatar">
            <el-avatar :size="36" style="background:linear-gradient(135deg,#10b981,#059669)">AI</el-avatar>
          </div>
          <div class="msg-bubble">
            <div
              class="msg-content markdown-body streaming-content"
              v-html="renderMarkdown(streaming) + '<span class=\'cursor-blink\'>▌</span>'"
            />
          </div>
        </div>

        <!-- 非流式加载中 -->
        <div v-if="loading && streaming === null" class="message-item assistant">
          <div class="msg-avatar">
            <el-avatar :size="36" style="background:linear-gradient(135deg,#10b981,#059669)">AI</el-avatar>
          </div>
          <div class="msg-bubble">
            <div class="msg-content typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </div>
    </el-scrollbar>

    <!-- ── 图片预览弹窗 ── -->
    <el-dialog v-model="imageDialogVisible" width="fit-content" :show-close="true" class="img-dialog">
      <img :src="imageDialogSrc" style="max-width:80vw;max-height:80vh;display:block" />
    </el-dialog>

    <!-- ── 输入区域 ── -->
    <div class="input-area">
      <!-- 附件预览 -->
      <div v-if="attachments.length" class="attachments-preview">
        <div v-for="(att, i) in attachments" :key="i" class="att-chip">
          <img v-if="att.type === 'image'" :src="att.dataUrl" class="att-thumb" />
          <el-icon v-else class="att-icon"><Document /></el-icon>
          <span class="att-name">{{ att.name }}</span>
          <el-button :icon="Close" text size="small" circle @click="removeAttachment(i)" class="att-del" />
        </div>
      </div>

      <!-- 工具栏 -->
      <div class="input-toolbar">
        <el-tooltip content="上传图片或文件（支持 JPG/PNG/GIF/WebP/TXT/MD/CSV/JSON）">
          <el-button text size="small" @click="triggerFileInput">
            <el-icon :size="18"><Paperclip /></el-icon>
          </el-button>
        </el-tooltip>

        <el-tooltip :content="isRecording ? '点击停止录音' : '语音输入（中文）'">
          <el-button
            text size="small"
            :class="{ 'voice-active': isRecording }"
            @click="toggleVoice"
          >
            <el-icon :size="18"><Microphone /></el-icon>
          </el-button>
        </el-tooltip>

        <el-tooltip content="截取摄像头画面发送给视觉AI">
          <el-button text size="small" @click="captureCamera">
            <el-icon :size="18"><VideoCamera /></el-icon>
          </el-button>
        </el-tooltip>

        <div class="toolbar-spacer" />

        <transition name="fade">
          <div v-if="useContext && messages.length > 0" class="ctx-info">
            <el-tag size="small" type="info" effect="plain">
              上下文 {{ Math.min(historyCount, maxContext) }}/{{ maxContext }}
            </el-tag>
          </div>
        </transition>

        <el-button
          v-if="loading || streaming !== null"
          text size="small" type="danger"
          @click="stopGenerate"
        >
          <el-icon><VideoPause /></el-icon> 停止
        </el-button>
      </div>

      <!-- 输入框 + 发送 -->
      <div class="input-box">
        <el-input
          v-model="inputText"
          type="textarea"
          :rows="3"
          placeholder="输入消息，Ctrl+Enter 发送..."
          resize="none"
          @keydown.ctrl.enter.prevent="sendMessage"
          @keydown.enter.exact.prevent="handleEnter"
        />
        <div class="input-actions">
          <span class="hint">Ctrl+Enter 发送</span>
          <el-button
            type="primary"
            :icon="Promotion"
            :loading="loading"
            :disabled="(!inputText.trim() && !attachments.length) || !selectedModel || streaming !== null"
            @click="sendMessage"
          >
            发送
          </el-button>
        </div>
      </div>
    </div>

    <!-- 隐藏的文件 input -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp,.txt,.md,.csv,.json"
      multiple
      style="display:none"
      @change="onFileSelected"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import {
  Refresh, Promotion, ChatDotRound, Setting, Document,
  CopyDocument, RefreshRight, Close, Paperclip, Microphone,
  VideoCamera, VideoPause,
} from '@element-plus/icons-vue'
import { Marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import { useUserStore } from '../store/user'
import {
  getModels,
  syncModels as syncModelsApi,
  getConversation,
  sendMessageStream,
} from '../api/chat'

const emit = defineEmits(['conversation-created'])
const route = useRoute()
const userStore = useUserStore()

// ── Markdown 渲染器 ──
const marked = new Marked({
  gfm: true,
  breaks: true,
})
marked.use({
  renderer: {
    code(token) {
      const lang = (token.lang || 'plaintext').trim()
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      const highlighted = hljs.highlight(token.text, { language }).value
      const escapedLang = lang.replace(/</g, '&lt;').replace(/>/g, '&gt;')
      return `<div class="code-block">
        <div class="code-header">
          <span class="code-lang">${escapedLang}</span>
          <button class="code-copy-btn" data-code="${encodeURIComponent(token.text)}">复制</button>
        </div>
        <pre><code class="hljs language-${language}">${highlighted}</code></pre>
      </div>`
    },
  },
})

const renderMarkdown = (text) => {
  if (!text) return ''
  return marked.parse(text)
}

const escapeHtml = (text) => {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}

// 代码块全局复制事件（事件委托）
const handleCodeCopy = (e) => {
  const btn = e.target.closest('.code-copy-btn')
  if (!btn) return
  const code = decodeURIComponent(btn.dataset.code || '')
  navigator.clipboard.writeText(code).then(() => {
    btn.textContent = '已复制!'
    setTimeout(() => { btn.textContent = '复制' }, 2000)
  })
}

// ── 状态 ──
const models = ref([])
const selectedModel = ref('')
const messages = ref([])
const inputText = ref('')
const loading = ref(false)
const syncing = ref(false)
const currentConv = ref(null)
const scrollRef = ref()

// 流式输出
const streaming = ref(null) // null = 未流式中，string = 正在输出的内容
let abortStream = null      // 取消流的函数

// 设置面板
const showSettings = ref(false)
const useContext = ref(true)
const maxContext = ref(20)
const systemPrompt = ref('')

// 附件
const attachments = ref([])  // [{type:'image'|'file', name, dataUrl?, content?}]
const fileInputRef = ref()

// 语音输入
const isRecording = ref(false)
let speechRecognition = null

// 图片预览
const imageDialogVisible = ref(false)
const imageDialogSrc = ref('')

// 快速提示
const quickTips = [
  '帮我写一段 Python 爬虫代码',
  '解释一下量子计算的原理',
  '帮我优化这段 SQL 查询',
  '翻译成英文：你好，世界',
]

// ── 模型分组 ──
const GEO_RESTRICTED = ['google/']
const isGeoRestricted = (id) => GEO_RESTRICTED.some(p => id.startsWith(p))
const freeModels = computed(() => models.value.filter(m => m.is_free && !isGeoRestricted(m.model_id)))
const restrictedModels = computed(() => models.value.filter(m => m.is_free && isGeoRestricted(m.model_id)))
const paidModels = computed(() => models.value.filter(m => !m.is_free))

// 当前历史消息数（用于 UI 展示）
const historyCount = computed(() => messages.value.filter(m => m.role !== 'streaming').length)

// ── 模型加载 & 同步 ──
const loadModels = async () => {
  const res = await getModels()
  models.value = res.results || res
  if (models.value.length > 0 && !selectedModel.value) {
    const free = models.value.find(m => m.is_free && !isGeoRestricted(m.model_id))
    selectedModel.value = free ? free.model_id : models.value[0].model_id
  }
}

const syncModels = async () => {
  syncing.value = true
  try {
    const res = await syncModelsApi()
    ElMessage.success(res.msg || '同步成功')
    await loadModels()
  } finally {
    syncing.value = false
  }
}

// ── 对话加载 ──
const loadConversation = async (id) => {
  const res = await getConversation(id)
  currentConv.value = res
  messages.value = res.messages || []
  if (res.model) selectedModel.value = res.model
  scrollToBottom()
}

const scrollToBottom = async () => {
  await nextTick()
  scrollRef.value?.setScrollTop(999999)
}

// ── 时间格式化 ──
const formatTime = (time) => {
  if (!time) return ''
  return new Date(time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// ── 文件附件 ──
const triggerFileInput = () => fileInputRef.value?.click()

const onFileSelected = async (e) => {
  const files = Array.from(e.target.files || [])
  e.target.value = '' // 允许重复选同一文件

  for (const file of files) {
    if (attachments.value.length >= 5) {
      ElMessage.warning('最多同时附加 5 个文件')
      break
    }
    const isImage = file.type.startsWith('image/')
    if (isImage) {
      const dataUrl = await fileToBase64(file)
      attachments.value.push({ type: 'image', name: file.name, dataUrl })
    } else {
      // 文本文件读取内容
      const content = await fileToText(file)
      attachments.value.push({ type: 'file', name: file.name, content })
    }
  }
}

const removeAttachment = (i) => attachments.value.splice(i, 1)

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = reject
  reader.readAsDataURL(file)
})

const fileToText = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = reject
  reader.readAsText(file, 'utf-8')
})

// ── 语音输入 ──
const toggleVoice = () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) {
    ElMessage.warning('您的浏览器不支持语音输入（建议使用 Chrome）')
    return
  }

  if (isRecording.value) {
    speechRecognition?.stop()
    isRecording.value = false
    return
  }

  speechRecognition = new SR()
  speechRecognition.lang = 'zh-CN'
  speechRecognition.continuous = false
  speechRecognition.interimResults = false

  speechRecognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript
    inputText.value += transcript
    ElMessage.success('语音识别完成')
  }
  speechRecognition.onerror = (event) => {
    ElMessage.error(`语音识别失败：${event.error}`)
    isRecording.value = false
  }
  speechRecognition.onend = () => {
    isRecording.value = false
  }

  speechRecognition.start()
  isRecording.value = true
  ElNotification({ title: '录音中', message: '请说话...（点击麦克风停止）', type: 'info', duration: 3000 })
}

// ── 摄像头截图 ──
const captureCamera = async () => {
  let stream = null
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
  } catch {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true })
    } catch {
      ElMessage.error('无法访问摄像头，请检查权限')
      return
    }
  }

  const video = document.createElement('video')
  video.srcObject = stream
  video.muted = true
  await new Promise((resolve) => {
    video.onloadedmetadata = resolve
    video.play()
  })
  await new Promise(r => setTimeout(r, 500)) // 等待画面稳定

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  canvas.getContext('2d').drawImage(video, 0, 0)
  stream.getTracks().forEach(t => t.stop())

  const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
  if (attachments.value.length >= 5) {
    ElMessage.warning('最多同时附加 5 个文件')
    return
  }
  attachments.value.push({ type: 'image', name: `摄像头截图_${Date.now()}.jpg`, dataUrl })
  ElMessage.success('摄像头截图已添加')
}

// ── 图片预览 ──
const previewImage = (src) => {
  imageDialogSrc.value = src
  imageDialogVisible.value = true
}

// ── 复制文本 ──
const copyText = (text) => {
  navigator.clipboard.writeText(text).then(() => ElMessage.success('已复制'))
}

// ── 停止生成 ──
const stopGenerate = () => {
  abortStream?.()
  abortStream = null
  if (streaming.value !== null) {
    // 将已输出的内容保存为消息
    messages.value.push({
      _id: Date.now() + 1,
      role: 'assistant',
      content: streaming.value,
      created_at: new Date().toISOString(),
    })
    streaming.value = null
  }
  loading.value = false
}

// ── 重新生成 ──
const regenerate = async () => {
  if (loading.value || streaming.value !== null) return
  // 找到最后一条 user 消息重发
  const lastUser = [...messages.value].reverse().find(m => m.role === 'user')
  if (!lastUser) return

  // 移除最后一条 AI 回复
  const lastAI = messages.value.length - 1
  if (messages.value[lastAI]?.role === 'assistant') {
    messages.value.splice(lastAI, 1)
  }

  await doSend(lastUser.content, lastUser.images || [], lastUser.files || [])
}

// ── Enter 键处理（单独 Enter 不发送，只换行）──
const handleEnter = () => {
  // 仅 Ctrl+Enter 触发发送，普通 Enter 交给 textarea 自己处理换行
}

// ── 发送消息 ──
const sendMessage = async () => {
  const text = inputText.value.trim()
  const hasAttachments = attachments.value.length > 0

  if (!text && !hasAttachments) return
  if (!selectedModel.value) { ElMessage.warning('请先选择模型'); return }
  if (loading.value || streaming.value !== null) return

  const imgs = attachments.value.filter(a => a.type === 'image').map(a => a.dataUrl)
  const files = attachments.value.filter(a => a.type === 'file')

  // 构建携带文件内容的消息文本
  let fullText = text
  if (files.length) {
    const fileTexts = files.map(f => `\`\`\`\n[文件: ${f.name}]\n${f.content}\n\`\`\``).join('\n\n')
    fullText = text ? `${text}\n\n${fileTexts}` : fileTexts
  }

  inputText.value = ''
  attachments.value = []

  await doSend(fullText, imgs, files)
}

const doSend = async (text, imgs = [], files = []) => {
  const convId = route.params.id ? Number(route.params.id) : null

  // 乐观渲染用户消息
  messages.value.push({
    _id: Date.now(),
    role: 'user',
    content: text,
    images: imgs,
    files: files,
    created_at: new Date().toISOString(),
  })
  scrollToBottom()

  loading.value = true
  streaming.value = '' // 开启流式输出占位

  const payload = {
    conversation_id: convId,
    model_id: selectedModel.value,
    message: text,
    images: imgs,
    system_prompt: systemPrompt.value,
    max_context: useContext.value ? maxContext.value : 0,
  }

  let newConvId = convId

  abortStream = sendMessageStream(
    payload,
    // onChunk
    (chunk) => {
      streaming.value += chunk
      scrollToBottom()
    },
    // onDone
    (conversationId) => {
      if (conversationId) newConvId = conversationId
      messages.value.push({
        _id: Date.now() + 1,
        role: 'assistant',
        content: streaming.value,
        created_at: new Date().toISOString(),
      })
      streaming.value = null
      loading.value = false
      abortStream = null
      scrollToBottom()

      if (!convId && newConvId) {
        emit('conversation-created', newConvId)
      }
    },
    // onError
    (errMsg) => {
      // 移除乐观渲染的用户消息
      messages.value.pop()
      inputText.value = text
      streaming.value = null
      loading.value = false
      abortStream = null
      const text = errMsg || '发送失败，请换一个模型重试'
      if (text.includes('余额为 0')) {
        ElMessageBox.alert(text, '余额不足', {
          type: 'warning',
          confirmButtonText: '我知道了',
        })
      } else {
        ElMessage.error({ message: text, duration: 6000, showClose: true })
      }
    }
  )
}

// ── 路由监听 ──
watch(() => route.params.id, async (id) => {
  messages.value = []
  currentConv.value = null
  streaming.value = null
  if (id) await loadConversation(Number(id))
})

// ── 生命周期 ──
onMounted(async () => {
  await loadModels()
  if (route.params.id) await loadConversation(Number(route.params.id))
  document.addEventListener('click', handleCodeCopy)
})

onUnmounted(() => {
  abortStream?.()
  speechRecognition?.stop()
  document.removeEventListener('click', handleCodeCopy)
})
</script>

<style scoped>
/* ── 容器 ── */
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8f9ff;
}

/* ── 顶部栏 ── */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: #fff;
  border-bottom: 1px solid #e8eaff;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.06);
  gap: 12px;
  flex-shrink: 0;
}
.model-selector {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.model-selector .label {
  color: #666;
  font-size: 14px;
  white-space: nowrap;
}
.header-center {
  flex: 1;
  text-align: center;
}
.conv-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.ctx-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ctx-label {
  font-size: 13px;
  color: #666;
}

/* ── 设置面板 ── */
.settings-panel {
  background: #fff;
  border-bottom: 1px solid #e8eaff;
  padding: 14px 24px;
  flex-shrink: 0;
}
.settings-grid {
  display: flex;
  gap: 24px;
  max-width: 800px;
  margin: 0 auto;
}
.setting-item {
  flex: 1;
}
.setting-item label {
  font-size: 13px;
  color: #555;
  font-weight: 500;
}

/* ── 消息区域 ── */
.message-area {
  flex: 1;
  overflow: hidden;
}
.messages {
  padding: 20px 24px 8px;
  max-width: 860px;
  margin: 0 auto;
  min-height: 100%;
}

/* ── 欢迎页 ── */
.welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  color: #888;
  text-align: center;
}
.welcome h2 { font-size: 22px; color: #333; margin: 16px 0 8px; }
.welcome p  { font-size: 14px; color: #999; }
.welcome-chips { margin-top: 16px; }

/* ── 消息条目 ── */
.message-item {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  align-items: flex-start;
}
.message-item.user {
  flex-direction: row-reverse;
}
.msg-bubble {
  max-width: 72%;
  min-width: 80px;
}
.message-item.user .msg-bubble {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

/* ── 消息图片 ── */
.msg-images {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 4px;
}
.msg-image {
  max-width: 200px;
  max-height: 200px;
  border-radius: 8px;
  cursor: pointer;
  object-fit: cover;
  border: 1px solid #e0e0e0;
}
.msg-files {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 4px;
}
.msg-file-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #f0f2ff;
  border: 1px solid #c7d2fe;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 12px;
  color: #4338ca;
}

/* ── 消息内容 ── */
.msg-content {
  background: #fff;
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 15px;
  line-height: 1.7;
  color: #333;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  word-break: break-word;
}
.msg-content.user {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
}
.msg-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
  padding: 0 4px;
}
.msg-time { font-size: 11px; color: #bbb; }
.msg-actions { display: flex; gap: 2px; opacity: 0; transition: opacity 0.2s; }
.message-item:hover .msg-actions { opacity: 1; }

/* ── 流式光标 ── */
.streaming-content :deep(.cursor-blink) {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: #6366f1;
  border-radius: 1px;
  vertical-align: text-bottom;
  animation: blink 0.8s infinite;
}
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

/* ── 打字动画 ── */
.typing {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 16px !important;
}
.typing span {
  width: 8px; height: 8px;
  background: #6366f1;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out;
}
.typing span:nth-child(2) { animation-delay: 0.2s; }
.typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-8px); }
}

/* ── 输入区域 ── */
.input-area {
  padding: 12px 20px 16px;
  background: #fff;
  border-top: 1px solid #e8eaff;
  flex-shrink: 0;
}
.input-box {
  max-width: 820px;
  margin: 0 auto;
}
.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}
.hint { font-size: 12px; color: #bbb; }

/* ── 附件预览 ── */
.attachments-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 820px;
  margin: 0 auto 8px;
  padding: 8px 12px;
  background: #f0f2ff;
  border-radius: 10px;
  border: 1px solid #c7d2fe;
}
.att-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #fff;
  border: 1px solid #e0e7ff;
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 12px;
  color: #555;
}
.att-thumb {
  width: 32px;
  height: 32px;
  object-fit: cover;
  border-radius: 4px;
}
.att-icon { color: #6366f1; }
.att-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 工具栏 ── */
.input-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  max-width: 820px;
  margin: 0 auto 6px;
}
.toolbar-spacer { flex: 1; }
.ctx-info { margin-right: 4px; }
.voice-active {
  color: #ef4444 !important;
  animation: pulse 1s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ── 过渡动画 ── */
.slide-down-enter-active,
.slide-down-leave-active { transition: all 0.25s ease; }
.slide-down-enter-from,
.slide-down-leave-to { opacity: 0; transform: translateY(-8px); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* ── Element Plus 覆盖 ── */
:deep(.el-textarea__inner) {
  border-radius: 12px;
  border-color: #e8eaff;
  font-size: 15px;
  line-height: 1.6;
  max-height: 200px;
}
:deep(.el-textarea__inner:focus) {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}
:deep(.el-dialog__body) { padding: 16px; }

/* ── Markdown 样式 ── */
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  font-weight: 600;
  margin: 12px 0 6px;
  line-height: 1.4;
}
.markdown-body :deep(h1) { font-size: 1.4em; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
.markdown-body :deep(h2) { font-size: 1.2em; }
.markdown-body :deep(h3) { font-size: 1.05em; }
.markdown-body :deep(p)  { margin: 6px 0; }
.markdown-body :deep(ul),
.markdown-body :deep(ol) { padding-left: 20px; margin: 6px 0; }
.markdown-body :deep(li) { margin: 3px 0; }
.markdown-body :deep(blockquote) {
  border-left: 4px solid #6366f1;
  margin: 8px 0;
  padding: 6px 12px;
  color: #666;
  background: #f0f2ff;
  border-radius: 0 6px 6px 0;
}
.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 8px 0;
  font-size: 14px;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #e5e7eb;
  padding: 6px 12px;
  text-align: left;
}
.markdown-body :deep(th) { background: #f3f4f6; font-weight: 600; }
.markdown-body :deep(tr:nth-child(even) td) { background: #fafafa; }
.markdown-body :deep(code) {
  background: rgba(0,0,0,0.06);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Fira Code', 'Cascadia Code', Consolas, monospace;
  font-size: 13px;
}
.msg-content.user :deep(code) {
  background: rgba(255,255,255,0.2);
}
.markdown-body :deep(a) {
  color: #6366f1;
  text-decoration: none;
}
.markdown-body :deep(a:hover) { text-decoration: underline; }
.markdown-body :deep(hr) { border: none; border-top: 1px solid #e5e7eb; margin: 12px 0; }
.markdown-body :deep(strong) { font-weight: 600; }
.markdown-body :deep(em) { font-style: italic; color: #555; }

/* ── 代码块 ── */
.markdown-body :deep(.code-block) {
  margin: 10px 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #2d3748;
}
.markdown-body :deep(.code-header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1a202c;
  padding: 6px 14px;
  font-size: 12px;
}
.markdown-body :deep(.code-lang) {
  color: #a0aec0;
  font-family: monospace;
}
.markdown-body :deep(.code-copy-btn) {
  background: transparent;
  border: 1px solid #4a5568;
  border-radius: 4px;
  color: #a0aec0;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}
.markdown-body :deep(.code-copy-btn:hover) {
  background: #4a5568;
  color: #fff;
}
.markdown-body :deep(.code-block pre) {
  margin: 0;
  padding: 14px 16px;
  overflow-x: auto;
  background: #1e2433;
}
.markdown-body :deep(.code-block code) {
  background: transparent;
  padding: 0;
  border-radius: 0;
  font-size: 13px;
  line-height: 1.6;
  font-family: 'Fira Code', 'Cascadia Code', Consolas, monospace;
}
</style>
