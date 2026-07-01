<script setup>
import { computed, reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const mode = ref('login')
const formRef = ref()
const loading = ref(false)

const form = reactive({
  username: '',
  password: '',
  confirmPassword: '',
})

const usernamePattern = /^[a-zA-Z0-9_]{3,20}$/

const validateConfirmPassword = (_rule, value, callback) => {
  if (mode.value !== 'register') {
    callback()
    return
  }
  if (!value) {
    callback(new Error('请确认密码'))
    return
  }
  if (value !== form.password) {
    callback(new Error('两次输入的密码不一致'))
    return
  }
  callback()
}

const rules = computed(() => ({
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    {
      pattern: usernamePattern,
      message: '用户名为 3-20 位字母、数字或下划线',
      trigger: 'blur',
    },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度为 6-20 个字符', trigger: 'blur' },
  ],
  confirmPassword:
    mode.value === 'register'
      ? [{ validator: validateConfirmPassword, trigger: 'blur' }]
      : [],
}))

const pageTitle = computed(() => (mode.value === 'login' ? '欢迎回来' : '创建账号'))
const submitText = computed(() => (mode.value === 'login' ? '登录' : '注册'))

onMounted(() => {
  form.username = userStore.getLastUsername?.() || ''
})

function switchMode(target) {
  if (mode.value === target) return
  mode.value = target
  form.confirmPassword = ''
  formRef.value?.clearValidate()
}

async function handleSubmit() {
  if (!formRef.value || loading.value) return

  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true

  try {
    if (mode.value === 'login') {
      await userStore.login(form.username, form.password)
      ElMessage.success('登录成功')
      router.push('/chat')
    } else {
      await userStore.register(form.username, form.password)
      ElMessage.success('注册成功，请登录')
      // 注册成功后自动切换到登录模式
      switchMode('login')
      form.password = ''
    }
  } catch (error) {
    const message =
      error.response?.data?.message || (mode.value === 'login' ? '登录失败' : '注册失败')
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title">AI 对话助手</h1>
      <p class="login-subtitle">{{ pageTitle }}</p>

      <Transition name="form-fade" mode="out-in">
        <el-form
          :key="mode"
          ref="formRef"
          :model="form"
          :rules="rules"
          label-width="0"
          class="auth-form"
        >
          <el-form-item prop="username">
            <el-input
              v-model="form.username"
              placeholder="请输入用户名"
              clearable
              autocomplete="username"
            />
          </el-form-item>

          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="请输入密码"
              show-password
              clearable
              autocomplete="current-password"
              @keyup.enter="handleSubmit"
            />
          </el-form-item>

          <el-form-item v-if="mode === 'register'" prop="confirmPassword">
            <el-input
              v-model="form.confirmPassword"
              type="password"
              placeholder="请确认密码"
              show-password
              clearable
              autocomplete="new-password"
              @keyup.enter="handleSubmit"
            />
          </el-form-item>

          <el-form-item>
            <el-button
              type="primary"
              class="submit-btn"
              :loading="loading"
              @click="handleSubmit"
            >
              {{ submitText }}
            </el-button>
          </el-form-item>

          <div class="mode-switch">
            <template v-if="mode === 'login'">
              <span class="switch-hint">还没有账号？</span>
              <el-link type="primary" :underline="false" @click="switchMode('register')">
                立即注册
              </el-link>
            </template>
            <template v-else>
              <span class="switch-hint">已有账号？</span>
              <el-link type="primary" :underline="false" @click="switchMode('login')">
                去登录
              </el-link>
            </template>
          </div>
        </el-form>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  overflow: hidden;
  background: radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%);
}

.login-page::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(2px 2px at 20px 30px, #fff, transparent),
    radial-gradient(2px 2px at 40px 70px, rgba(255, 255, 255, 0.8), transparent),
    radial-gradient(1px 1px at 90px 40px, #fff, transparent),
    radial-gradient(2px 2px at 130px 80px, rgba(255, 255, 255, 0.6), transparent),
    radial-gradient(1px 1px at 160px 120px, #fff, transparent),
    radial-gradient(2px 2px at 200px 50px, rgba(255, 255, 255, 0.7), transparent),
    radial-gradient(1px 1px at 250px 160px, #fff, transparent),
    radial-gradient(2px 2px at 300px 90px, rgba(255, 255, 255, 0.5), transparent);
  background-repeat: repeat;
  background-size: 350px 200px;
  opacity: 0.8;
  animation: twinkle 4s ease-in-out infinite alternate;
}

.login-page::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 0%, rgba(88, 101, 242, 0.15), transparent 60%);
  pointer-events: none;
}

@keyframes twinkle {
  from { opacity: 0.5; }
  to { opacity: 1; }
}

.login-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 400px;
  padding: 40px 36px 32px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  transition: box-shadow 0.3s ease;
}

.login-card:hover {
  box-shadow: 0 12px 40px rgba(99, 102, 241, 0.25);
}

.login-title {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
  text-align: center;
  color: #303133;
}

.login-subtitle {
  margin: 0 0 28px;
  font-size: 14px;
  text-align: center;
  color: #909399;
  transition: color 0.3s ease;
}

.auth-form {
  min-height: 220px;
}

.submit-btn {
  width: 100%;
}

.mode-switch {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 4px;
}

.switch-hint {
  font-size: 14px;
  color: #909399;
}

.form-fade-enter-active,
.form-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.form-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.form-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>