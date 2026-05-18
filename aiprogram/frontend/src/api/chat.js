import request, { BASE_URL } from './request'

export const getModels = () => request.get('/chat/models/')
export const syncModels = () => request.post('/chat/models/sync/')
export const getConversations = () => request.get('/chat/conversations/')
export const createConversation = (data) => request.post('/chat/conversations/', data)
export const getConversation = (id) => request.get(`/chat/conversations/${id}/`)
export const deleteConversation = (id) => request.delete(`/chat/conversations/${id}/`)
export const sendMessage = (data) => request.post('/chat/send/', data)

/**
 * 流式发送消息（SSE）
 * @param {object} data - { conversation_id, model_id, message, images, system_prompt, max_context }
 * @param {function} onChunk - 每收到一个文本块调用 (content: string)
 * @param {function} onDone  - 流结束时调用 (conversation_id: number)
 * @param {function} onError - 出错时调用 (message: string)
 * @returns {function} abort - 调用可取消请求
 */
export const sendMessageStream = (data, onChunk, onDone, onError) => {
  const controller = new AbortController()

  const run = async () => {
    const token = localStorage.getItem('access_token')
    let response
    try {
      response = await fetch(`${BASE_URL}/chat/send/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...data, stream: true }),
        signal: controller.signal,
      })
    } catch (e) {
      if (e.name !== 'AbortError') onError(e.message || '网络错误')
      return
    }

    if (!response.ok) {
      try {
        const err = await response.json()
        onError(err.msg || err.detail || `HTTP ${response.status}`)
      } catch {
        onError(`HTTP ${response.status}`)
      }
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let conversationId = null

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // 按行解析 SSE
        const lines = buffer.split('\n')
        buffer = lines.pop() // 保留未完整的行

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const raw = trimmed.slice(5).trim()
          if (raw === '[DONE]') {
            onDone(conversationId)
            return
          }
          try {
            const parsed = JSON.parse(raw)
            if (parsed.error) { onError(parsed.error); return }
            if (parsed.conversation_id) conversationId = parsed.conversation_id
            if (parsed.content) onChunk(parsed.content)
          } catch { /* 忽略解析失败的行 */ }
        }
      }
    } finally {
      reader.releaseLock()
    }
    onDone(conversationId)
  }

  run()
  return () => controller.abort()
}
