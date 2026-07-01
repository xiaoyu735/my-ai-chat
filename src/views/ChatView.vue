<template>
  <div class="app">
    <!-- 左侧栏 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="avatar">星</div>
        <h2 class="sidebar-title">历史对话</h2>
      </div>

      <button class="new-chat-btn" @click="handleNewChat">+ 新建对话</button>

      <nav class="history">
        <button
          v-for="item in sortedConversations"
          :key="item.id"
          class="history-item"
          :class="{ active: item.id === currentConversationId }"
          @click="switchConversation(item.id)"
        >
          <span class="history-name">{{ item.title }}</span>
          <span class="history-time">{{ formatTime(item.updatedAt) }}</span>
        </button>
      </nav>

      <button class="stats-entry" @click="goStats">
        <span>数据统计</span>
        <span class="arrow">›</span>
      </button>
    </aside>

    <!-- 右侧主聊天区 -->
    <main class="main">
      <header class="chat-header">
        <h1 class="chat-title">{{ currentTitle }}</h1>
        <div v-if="userStore.isLoggedIn" class="user-info">
          <span v-if="userStore.user?.username" class="username">
            {{ userStore.user.username }}
          </span>
          <button class="logout-btn" @click="handleLogout">退出登录</button>
        </div>
      </header>

      <template v-if="currentConversation">
        <section ref="messagesRef" class="messages">
          <div
            v-for="msg in currentMessages"
            :key="msg.id"
            class="row"
            :class="msg.role === 'me' ? 'row-right' : 'row-left'"
          >
            <div class="bubble" :class="msg.role === 'me' ? 'bubble-me' : 'bubble-ai'">
              <span v-if="msg.loading && !(msg.content ?? msg.text)" class="typing-dots">
                <span></span><span></span><span></span>
              </span>
              <template v-else>{{ msg.content ?? msg.text }}</template>
            </div>
          </div>
        </section>

        <footer class="input-bar">
          <input
            ref="inputRef"
            v-model="draft"
            class="input"
            type="text"
            placeholder="输入消息，开启一段星际对话…"
            :disabled="isSending"
            @keyup.enter="send"
          />
          <button class="send" :disabled="isSending" @click="send">发送</button>
        </footer>
      </template>

      <div v-else class="empty-state">
        <p class="empty-title">开始新对话</p>
        <p class="empty-desc">点击左侧「新建对话」，开启你的星际探索之旅</p>
        <button class="empty-btn" @click="handleNewChat">+ 新建对话</button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { fetchConversations, saveConversation } from '@/api/conversations'

const API_URL = 'https://api.deepseek.com/v1/chat/completions'
const MODEL = 'deepseek-chat'

const router = useRouter()
const userStore = useUserStore()

const conversations = ref([])
const currentConversationId = ref(null)
const draft = ref('')
const isSending = ref(false)
const inputRef = ref(null)
const messagesRef = ref(null)

const sortedConversations = computed(() =>
  [...conversations.value].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  ),
)

const currentConversation = computed(() =>
  conversations.value.find((c) => c.id === currentConversationId.value),
)

const currentMessages = computed(() => currentConversation.value?.messages ?? [])

const currentTitle = computed(() => currentConversation.value?.title ?? '新对话')

function createConversation() {
  const now = new Date().toISOString()
  const conversation = {
    id: Date.now(),
    title: '新对话',
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
  conversations.value.unshift(conversation)
  currentConversationId.value = conversation.id
  draft.value = ''
  nextTick(() => inputRef.value?.focus())
  return conversation
}

async function loadConversations() {
  try {
    const data = await fetchConversations()
    conversations.value = Array.isArray(data) ? data : []
    if (conversations.value.length > 0) {
      currentConversationId.value = conversations.value[0].id
    } else {
      createConversation()
    }
  } catch {
    createConversation()
  }
}

async function persistConversation(conversation) {
  if (!conversation || !userStore.user?.id) return

  try {
    const saved = await saveConversation({
      id: conversation.id,
      userId: userStore.user.id,
      title: conversation.title,
      messages: conversation.messages
        .filter((m) => !(m.loading && !(m.content ?? m.text)))
        .map(({ loading, ...rest }) => rest),
    })

    const index = conversations.value.findIndex((item) => item.id == conversation.id)
    if (index >= 0) {
      conversations.value[index] = saved
    }
  } catch (error) {
    console.error('保存对话失败', error)
  }
}

function handleNewChat() {
  createConversation()
}

function switchConversation(id) {
  currentConversationId.value = id
  draft.value = ''
  nextTick(() => inputRef.value?.focus())
}

function touchConversation(conversation) {
  conversation.updatedAt = new Date().toISOString()
}

function generateTitle(text) {
  if (text.length <= 20) return text
  return `${text.slice(0, 20)}…`
}

function formatTime(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) {
    return date.toLocaleDateString('zh-CN', { weekday: 'short' })
  }
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

function toApiMessages(msgs) {
  return msgs
    .filter((m) => m.role === 'me' || ((m.role === 'assistant' || m.role === 'ai') && (m.content ?? m.text)))
    .map((m) => ({
      role: m.role === 'me' ? 'user' : 'assistant',
      content: m.content ?? m.text ?? '',
    }))
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}

async function send() {
  const text = draft.value.trim()
  let conversation = currentConversation.value
  if (!text || !conversation || isSending.value) return

  const now = Date.now()
  conversation.messages.push({ id: now, role: 'me', text })
  draft.value = ''

  const hasUserMessage = conversation.messages.filter((m) => m.role === 'me').length === 1
  if (conversation.title === '新对话' && hasUserMessage) {
    conversation.title = generateTitle(text)
  }
  touchConversation(conversation)
  conversation.messages = [...conversation.messages]

  await persistConversation(conversation)

  // persist 会用后端返回对象替换列表项，必须重新绑定当前对话引用
  conversation = currentConversation.value
  if (!conversation) return

  const assistantMsg = {
    id: now + 1,
    role: 'assistant',
    content: '',
    loading: true,
  }
  conversation.messages.push(assistantMsg)
  conversation.messages = [...conversation.messages]
  scrollToBottom()

  isSending.value = true

  try {
    const historyMessages = conversation.messages.filter(
      (m) =>
        m.role === 'me' ||
        ((m.role === 'assistant' || m.role === 'ai') && (m.content ?? m.text) && !m.loading),
    )
    const recentMessages = historyMessages.slice(-5)
    const apiMessages = toApiMessages(recentMessages)

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: apiMessages,
        stream: true,
        max_tokens: 2048,
      }),
    })

    if (!response.ok) {
      throw new Error(`请求失败: ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let sseBuffer = ''
    let chunkCount = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        console.log(`流结束，共接收 ${chunkCount} 个数据块`)
        if (chunkCount < 20) {
          console.warn(`警告：流式数据块过少（${chunkCount} < 20），回复可能被提前截断`)
        }
        break
      }

      chunkCount++
      sseBuffer += decoder.decode(value, { stream: true })
      const lines = sseBuffer.split('\n')
      sseBuffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue

        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) {
            assistantMsg.content += delta
            conversation.messages = [...conversation.messages]
            scrollToBottom()
          }
        } catch {
          // 跳过无法解析的数据块
        }
      }
    }
  } catch {
    assistantMsg.content = '抱歉，AI 暂时无法回复，请稍后重试。'
    conversation.messages = [...conversation.messages]
  } finally {
    assistantMsg.loading = false
    touchConversation(conversation)
    conversation.messages = [...conversation.messages]
    isSending.value = false
    scrollToBottom()
    await persistConversation(conversation)
  }
}

function goStats() {
  router.push('/stats')
}

function handleLogout() {
  userStore.logout()
  router.push('/login')
}

onMounted(() => {
  loadConversations()
})
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.app {
  display: flex;
  height: 100vh;
  width: 100%;
  font-family: -apple-system, 'Segoe UI', 'PingFang SC', sans-serif;
  overflow: hidden;
}

.sidebar {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  color: #e2e8f0;
  border-right: 1px solid rgba(99, 102, 241, 0.2);
  background-color: #0b1026;
  background-image:
    radial-gradient(1px 1px at 20% 30%, #fff 50%, transparent),
    radial-gradient(1px 1px at 60% 70%, #cbd5ff 50%, transparent),
    radial-gradient(1.5px 1.5px at 80% 20%, #fff 50%, transparent),
    radial-gradient(1px 1px at 35% 85%, #a5b4fc 50%, transparent),
    radial-gradient(1px 1px at 90% 60%, #fff 50%, transparent);
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 16px 12px;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #4338ca, #7c3aed);
  box-shadow: 0 0 12px rgba(124, 58, 237, 0.6);
}

.sidebar-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: #f1f5f9;
}

.new-chat-btn {
  margin: 0 12px 12px;
  padding: 10px 14px;
  border: none;
  border-radius: 10px;
  background: rgba(241, 245, 249, 0.95);
  color: #4338ca;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.new-chat-btn:hover {
  background: #fff;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
}

.history {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: #cbd5e1;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s;
}

.history-item:hover {
  background: rgba(99, 102, 241, 0.15);
}

.history-item.active {
  background: rgba(99, 102, 241, 0.28);
  box-shadow: inset 0 0 0 1px rgba(129, 140, 248, 0.5);
}

.history-name {
  font-size: 14px;
  font-weight: 500;
  color: #f1f5f9;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.history-time {
  font-size: 12px;
  color: #94a3b8;
}

.stats-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12px 8px;
  padding: 18px 20px;
  border: 1px solid rgba(129, 140, 248, 0.45);
  border-radius: 12px;
  background: rgba(99, 102, 241, 0.32);
  color: #f1f5f9;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.25);
  transition: background 0.2s, box-shadow 0.2s;
}

.stats-entry:hover {
  background: rgba(99, 102, 241, 0.48);
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.35);
}

.arrow {
  font-size: 22px;
  color: #c7d2fe;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f1f5f9;
  min-width: 0;
}

.chat-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 60px;
  padding: 0 24px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
}

.chat-title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.username {
  font-size: 14px;
  color: #64748b;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.logout-btn {
  padding: 6px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #fff;
  color: #64748b;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.logout-btn:hover {
  border-color: #6366f1;
  color: #6366f1;
  background: #f8fafc;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #64748b;
}

.empty-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #334155;
}

.empty-desc {
  margin: 0;
  font-size: 14px;
}

.empty-btn {
  margin-top: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 22px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: linear-gradient(135deg, #4338ca, #7c3aed);
}

.empty-btn:hover {
  box-shadow: 0 4px 16px rgba(124, 58, 237, 0.4);
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.row {
  display: flex;
}

.row-left {
  justify-content: flex-start;
}

.row-right {
  justify-content: flex-end;
}

.bubble {
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.bubble-ai {
  background: #e2e8f0;
  color: #1e293b;
  border-bottom-left-radius: 4px;
}

.bubble-me {
  background: #2563eb;
  color: #fff;
  border-bottom-right-radius: 4px;
}

.input-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  background: #fff;
  border-top: 1px solid #e2e8f0;
}

.input {
  flex: 1;
  height: 44px;
  padding: 0 16px;
  border: 1px solid #cbd5e1;
  border-radius: 22px;
  font-size: 14px;
  outline: none;
}

.input:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.input:disabled {
  background: #f8fafc;
  cursor: not-allowed;
}

.send {
  height: 44px;
  padding: 0 24px;
  border: none;
  border-radius: 22px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: linear-gradient(135deg, #4338ca, #7c3aed);
}

.send:hover:not(:disabled) {
  box-shadow: 0 4px 16px rgba(124, 58, 237, 0.4);
}

.send:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.typing-dots {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 36px;
  height: 1.6em;
}

.typing-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #64748b;
  animation: dotBlink 1.4s infinite ease-in-out both;
}

.typing-dots span:nth-child(1) {
  animation-delay: 0s;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes dotBlink {
  0%,
  80%,
  100% {
    opacity: 0.3;
    transform: scale(0.85);
  }

  40% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
