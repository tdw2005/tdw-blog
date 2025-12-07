<template>
  <div class="auth-page">
    <h2 class="title">登录</h2>
    <div class="alt-actions">
      <button class="switch-btn" type="button" @click="openAuth('register')">打开注册弹窗</button>
      <button class="switch-btn" type="button" @click="openAuth('login')">打开登录弹窗</button>
    </div>
    <form @submit.prevent="submit" class="auth-form">
      <div class="form-group">
        <input
          v-model="form.id"
          type="text"
          placeholder="ID *"
          class="form-input"
          required
        />
      </div>
      <div class="form-group password-group">
        <input
          :type="form.showPassword ? 'text' : 'password'"
          v-model="form.password"
          placeholder="密码 *"
          class="form-input"
          required
        />
        <button type="button" class="toggle-btn" @click="form.showPassword = !form.showPassword">
          {{ form.showPassword ? '隐藏密码' : '显示密码' }}
        </button>
      </div>
      <div class="form-group remember-group">
        <label class="remember-label">
          <input type="checkbox" v-model="form.remember" />
          记住密码
        </label>
      </div>
      <div class="form-actions">
        <button type="submit" :disabled="submitting" class="submit-btn">
          {{ submitting ? '登录中...' : '登录' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

export default {
  name: 'Login',
  setup() {
    const router = useRouter()
    const submitting = ref(false)
    const form = ref({ id: '', password: '', remember: false, showPassword: false })
    const { openAuthModal } = useAuth()

    onMounted(() => {
      openAuthModal('login')
      const remember = localStorage.getItem('remember') === 'true'
      if (remember) {
        form.value.remember = true
        form.value.id = localStorage.getItem('saved_id') || ''
        form.value.password = localStorage.getItem('saved_password') || ''
      }
    })

    const submit = async () => {
      if (submitting.value) return
      if (!form.value.id.trim() || !form.value.password.trim()) {
        alert('请输入ID和密码')
        return
      }
      submitting.value = true
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: form.value.id, password: form.value.password })
        })
        const result = await res.json()
        if (result.success) {
          const { token, user } = result.data
          localStorage.setItem('token', token)
          localStorage.setItem('user', JSON.stringify(user))
          localStorage.setItem('remember', form.value.remember ? 'true' : 'false')
          if (form.value.remember) {
            localStorage.setItem('saved_id', form.value.id)
            localStorage.setItem('saved_password', form.value.password)
          } else {
            localStorage.removeItem('saved_id')
            localStorage.removeItem('saved_password')
          }
          alert('登录成功')
          router.push('/').then(() => { window.location.reload() })
        } else {
          alert(result.message || '登录失败')
        }
      } catch (e) {
        alert('登录失败，请重试')
      } finally {
        submitting.value = false
      }
    }

    return { form, submitting, submit, openAuth }
  }
}
</script>

<style scoped>
.auth-page {
  max-width: 480px;
  margin: 2rem auto;
  padding: 1.5rem;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
}
.title {
  margin-bottom: 1rem;
  color: var(--text-primary);
}
.alt-actions { display:flex; gap:0.5rem; justify-content:flex-end; margin-bottom: 0.75rem; }
.form-group { margin-bottom: 1rem; }
.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--card-bg);
  color: var(--text-primary);
}
.password-group { display: flex; gap: 0.5rem; }
.toggle-btn {
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  border-radius: 6px;
  cursor: pointer;
}
.remember-group { display: flex; justify-content: flex-start; }
.remember-label { color: var(--text-secondary); }
.form-actions { display: flex; justify-content: flex-end; }
.submit-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  background: #667eea;
  color: #fff;
  cursor: pointer;
}
</style>
    const openAuth = (mode) => openAuthModal(mode)
