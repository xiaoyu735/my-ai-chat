import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const require = createRequire(import.meta.url)
const jsonServer = require('json-server')
const cors = require('cors')

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_FILE = join(__dirname, 'db.json')
const PORT = 3000
const JWT_SECRET = 'your-secret-key'
const DAY_MS = 1000 * 60 * 60 * 24

const server = jsonServer.create()
const router = jsonServer.router(DB_FILE)
const middlewares = jsonServer.defaults()

server.use(cors())
server.use(jsonServer.bodyParser)
server.use(middlewares)

function readDatabase() {
  return JSON.parse(readFileSync(DB_FILE, 'utf-8'))
}

function writeDatabase(data) {
  writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8')
  router.db.read()
}

function getUsers() {
  const db = readDatabase()
  return db.users || []
}

function getConversations() {
  const db = readDatabase()
  return db.conversations || []
}

function saveUser(user) {
  const db = readDatabase()
  if (!Array.isArray(db.users)) db.users = []
  db.users.push(user)
  writeDatabase(db)
}

function findUserByUsername(username) {
  return getUsers().find((user) => user.username === username)
}

function findUserById(id) {
  return getUsers().find((user) => user.id == id)
}

function stripPassword(user) {
  const { password, ...userWithoutPassword } = user
  return userWithoutPassword
}

function createToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: '7d',
  })
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: '未提供有效的认证令牌' })
  }

  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET)
    req.userId = decoded.id
    next()
  } catch {
    return res.status(401).json({ message: '无效或已过期的令牌' })
  }
}

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatDayLabel(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}-${day}`
}

function isValidMessage(msg) {
  if (msg.loading && !(msg.content ?? msg.text)) return false
  const role = msg.role
  return role === 'me' || role === 'user' || role === 'assistant' || role === 'ai'
}

function getMessageDate(msg, conversation) {
  if (msg.timestamp) return new Date(msg.timestamp)
  const idNum = Number(msg.id)
  if (!Number.isNaN(idNum) && idNum > 1e12) return new Date(idNum)
  return new Date(conversation.updatedAt || conversation.createdAt || Date.now())
}

function collectAllMessages(conversations) {
  const all = []
  for (const conversation of conversations) {
    for (const msg of conversation.messages || []) {
      if (!isValidMessage(msg)) continue
      all.push({ msg, conversation })
    }
  }
  return all
}

function computeGlobalStats() {
  const conversations = getConversations()
  const allMessages = collectAllMessages(conversations)
  const today = startOfDay(new Date())

  const totalConversations = conversations.length
  const totalMessages = allMessages.length
  const todayMessages = allMessages.filter(({ msg, conversation }) =>
    isSameDay(getMessageDate(msg, conversation), today),
  ).length

  let activeDays = 0
  if (allMessages.length > 0) {
    const firstDate = allMessages.reduce((earliest, { msg, conversation }) => {
      const date = getMessageDate(msg, conversation)
      return date < earliest ? date : earliest
    }, getMessageDate(allMessages[0].msg, allMessages[0].conversation))
    const diffDays = Math.floor((today - startOfDay(firstDate)) / DAY_MS)
    activeDays = Math.max(diffDays + 1, 1)
  }

  const days = []
  for (let i = 6; i >= 0; i--) {
    const date = startOfDay(new Date())
    date.setDate(date.getDate() - i)
    days.push(date)
  }

  const last7Days = {
    labels: days.map(formatDayLabel),
    counts: days.map(
      (day) =>
        allMessages.filter(({ msg, conversation }) =>
          isSameDay(getMessageDate(msg, conversation), day),
        ).length,
    ),
  }

  const ranked = conversations
    .map((conversation) => ({
      name: conversation.title || '新对话',
      value: (conversation.messages || []).filter(isValidMessage).length,
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)

  const topTopics = ranked.slice(0, 5)
  const othersCount = ranked.slice(5).reduce((sum, item) => sum + item.value, 0)
  if (othersCount > 0) {
    topTopics.push({ name: '其他', value: othersCount })
  }

  return {
    totalConversations,
    totalMessages,
    todayMessages,
    activeDays,
    last7Days,
    topTopics,
  }
}

server.post('/register', async (req, res) => {
  const { username, password } = req.body || {}

  if (!username || !password) {
    return res.status(400).json({ message: '用户名和密码不能为空' })
  }

  const exists = getUsers().some((user) => user.username === username)
  if (exists) {
    return res.status(400).json({ message: '用户名已存在' })
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10)
    const newUser = {
      id: Date.now(),
      username,
      password: hashedPassword,
    }

    saveUser(newUser)
    const token = createToken(newUser)

    return res.status(201).json({
      message: '注册成功',
      user: stripPassword(newUser),
      token,
    })
  } catch {
    return res.status(500).json({ message: '注册失败，请稍后重试' })
  }
})

server.post('/login', async (req, res) => {
  const { username, password } = req.body || {}

  if (!username || !password) {
    return res.status(400).json({ message: '用户名和密码不能为空' })
  }

  const user = findUserByUsername(username)
  if (!user) {
    return res.status(401).json({ message: '用户名或密码错误' })
  }

  const isMatch = await bcrypt.compare(password, user.password)
  if (!isMatch) {
    return res.status(401).json({ message: '用户名或密码错误' })
  }

  const token = createToken(user)
  return res.json({
    message: '登录成功',
    user: stripPassword(user),
    token,
  })
})

server.get('/me', authMiddleware, (req, res) => {
  const user = findUserById(req.userId)
  if (!user) {
    return res.status(404).json({ message: '用户不存在' })
  }
  return res.json({ user: stripPassword(user) })
})

server.get('/api/conversations', authMiddleware, (req, res) => {
  const list = getConversations()
    .filter((item) => item.userId == req.userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  return res.json(list)
})

server.post('/api/conversations', authMiddleware, (req, res) => {
  const { id, title, messages, userId } = req.body || {}

  if (id === undefined || id === null) {
    return res.status(400).json({ message: '缺少对话 id' })
  }

  if (userId != req.userId) {
    return res.status(403).json({ message: '无权操作该对话' })
  }

  const db = readDatabase()
  if (!Array.isArray(db.conversations)) db.conversations = []

  const index = db.conversations.findIndex(
    (item) => item.id == id && item.userId == req.userId,
  )
  const now = new Date().toISOString()
  const conversation = {
    id,
    userId: req.userId,
    title: title || '新对话',
    messages: Array.isArray(messages) ? messages : [],
    createdAt: index >= 0 ? db.conversations[index].createdAt : now,
    updatedAt: now,
  }

  if (index >= 0) {
    db.conversations[index] = conversation
  } else {
    db.conversations.push(conversation)
  }

  writeDatabase(db)
  return res.json(conversation)
})

server.delete('/api/conversations/:id', authMiddleware, (req, res) => {
  const db = readDatabase()
  if (!Array.isArray(db.conversations)) db.conversations = []

  const index = db.conversations.findIndex(
    (item) => item.id == req.params.id && item.userId == req.userId,
  )

  if (index < 0) {
    return res.status(404).json({ message: '对话不存在' })
  }

  db.conversations.splice(index, 1)
  writeDatabase(db)
  return res.json({ message: '删除成功' })
})

server.get('/api/stats', authMiddleware, (req, res) => {
  return res.json(computeGlobalStats())
})

server.use((req, res, next) => {
  if (req.path.startsWith('/users') && req.method !== 'GET') {
    return res.status(403).json({ message: '请使用 /register 或 /login 接口' })
  }
  if (req.path.startsWith('/conversations')) {
    return res.status(403).json({ message: '请使用 /api/conversations 接口' })
  }
  next()
})

server.use(router)

server.listen(PORT, () => {
  console.log(`JSON Server is running on http://localhost:${PORT}`)
})
