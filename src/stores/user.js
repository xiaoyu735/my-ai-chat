import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { register as registerApi, login as loginApi } from '@/api/auth'
import request from '@/utils/request'

const TOKEN_KEY = 'token'
const USER_KEY = 'user'
const LAST_USERNAME_KEY = 'lastUsername'

export const useUserStore = defineStore('user', () => {
  const user = ref(JSON.parse(localStorage.getItem(USER_KEY) || 'null'))
  const token = ref(localStorage.getItem(TOKEN_KEY) || '')

  const isLoggedIn = computed(() => !!token.value)

  function persistAuth(userData, tokenValue) {
    user.value = userData
    token.value = tokenValue
    localStorage.setItem(USER_KEY, JSON.stringify(userData))
    localStorage.setItem(TOKEN_KEY, tokenValue)
    localStorage.setItem(LAST_USERNAME_KEY, userData.username)
  }

  function getLastUsername() {
    return localStorage.getItem(LAST_USERNAME_KEY) || ''
  }

  async function register(username, password) {
    const data = await registerApi(username, password)
    persistAuth(data.user, data.token)
    return data
  }

  async function login(username, password) {
    const data = await loginApi(username, password)
    persistAuth(data.user, data.token)
    return data
  }

  function logout() {
    if (user.value?.username) {
      localStorage.setItem(LAST_USERNAME_KEY, user.value.username)
    }

    user.value = null
    token.value = ''
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(TOKEN_KEY)
  }

  async function checkAuth() {
    if (!token.value) return false

    try {
      const data = await request.get('/me')
      user.value = data.user
      localStorage.setItem(USER_KEY, JSON.stringify(data.user))
      return true
    } catch {
      user.value = null
      token.value = ''
      localStorage.removeItem(USER_KEY)
      localStorage.removeItem(TOKEN_KEY)
      return false
    }
  }

  return { user, token, isLoggedIn, register, login, logout, checkAuth, getLastUsername }
})
