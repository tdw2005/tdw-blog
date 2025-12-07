<template>
  <div>
    <div v-if="open" class="auth-overlay" @click.self="close">
      <div class="auth-modal">
      <div class="modal-header">
        <h3 v-if="mode !== 'prompt'">{{ mode === 'login' ? '登录' : '注册' }}</h3>
        <button class="close-btn" @click="close">✕</button>
      </div>

      <div v-if="mode === 'login'" class="modal-body">
        <div class="form-group">
          <input v-model="loginForm.id" type="text" placeholder="账号(ID) *" class="form-input">
        </div>
        <div class="form-group password-group">
          <input :type="loginForm.show ? 'text' : 'password'" v-model="loginForm.password" placeholder="密码 *" class="form-input password-input">
          <button class="eye-icon" type="button" @click="loginForm.show = !loginForm.show">{{ loginForm.show ? '👁️' : '👁️‍🗨️' }}</button>
        </div>
        <div class="form-group options">
          <label><input type="checkbox" v-model="loginForm.rememberAccount"> 记住账号</label>
          <label><input type="checkbox" v-model="loginForm.rememberPassword"> 记住密码</label>
        </div>
        <div class="form-actions">
          <button class="switch-btn" @click="mode = 'register'">没有账号，去注册</button>
          <button class="submit-btn" :disabled="submitting" @click="doLogin">{{ submitting ? '登录中...' : '登录' }}</button>
        </div>
      </div>

      <div v-else-if="mode === 'register'" class="modal-body">
        <div class="form-group">
          <input v-model="registerForm.nickname" type="text" placeholder="昵称 *" class="form-input" @input="validateNickname">
          <div v-if="nicknameError" class="error">{{ nicknameError }}</div>
        </div>
        <div class="form-group">
          <input v-model="registerForm.id" type="text" placeholder="账号(ID) *" class="form-input">
        </div>
        <div class="form-group password-group">
          <input :type="registerForm.show ? 'text' : 'password'" v-model="registerForm.password" placeholder="密码 *" class="form-input password-input">
          <button class="eye-icon" type="button" @click="registerForm.show = !registerForm.show">{{ registerForm.show ? '👁️' : '👁️‍🗨️' }}</button>
        </div>
        <div class="form-group password-group">
          <input :type="registerForm.showConfirm ? 'text' : 'password'" v-model="registerForm.confirm" placeholder="确认密码 *" class="form-input password-input" @input="confirmError = ''">
          <button class="eye-icon" type="button" @click="registerForm.showConfirm = !registerForm.showConfirm">{{ registerForm.showConfirm ? '👁️' : '👁️‍🗨️' }}</button>
          <div v-if="confirmError" class="error">{{ confirmError }}</div>
        </div>
        <div class="form-actions">
          <button class="switch-btn" @click="mode = 'login'">返回登录界面</button>
          <button class="submit-btn" :disabled="submitting" @click="doRegister">{{ submitting ? '注册中...' : '注册' }}</button>
        </div>
      </div>

      <div v-else class="modal-body">
        <div class="prompt">
          <p class="prompt-text">请先登录</p>
          <div class="prompt-actions">
            <button class="switch-btn" @click="close">暂不登录</button>
            <button class="submit-btn" @click="toLogin">去登录/注册</button>
          </div>
        </div>
      </div>

      </div>
    </div>

    <div v-if="successPopup" class="success-popup">
      <div class="success-icon">✅</div>
      <div class="success-text">
        <div class="success-title">{{ successPopup.title }}</div>
        <div v-if="successPopup.subtitle" class="success-subtitle">{{ successPopup.subtitle }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

export default {
  name: 'AuthModal',
  setup() {
    const router = useRouter()
    const { authModalOpen, authModalMode, closeAuthModal, setAuth } = useAuth()
    const open = authModalOpen
    const mode = authModalMode
    const submitting = ref(false)
    const loginForm = ref({ id: '', password: '', rememberAccount: false, rememberPassword: false, show: false })
    const registerForm = ref({ nickname: '', id: '', password: '', confirm: '', show: false, showConfirm: false })
    const nicknameError = ref('')
    const confirmError = ref('')
    const successPopup = ref(null)

    onMounted(() => {
      const rememberAcc = localStorage.getItem('remember_account') === 'true'
      if (rememberAcc) {
        loginForm.value.rememberAccount = true
        loginForm.value.id = localStorage.getItem('saved_id') || ''
      }
      const rememberPwd = localStorage.getItem('remember_password') === 'true'
      if (rememberPwd) {
        loginForm.value.rememberPassword = true
        loginForm.value.password = localStorage.getItem('saved_password') || ''
      }
    })

    const close = () => closeAuthModal()
    const toggleMode = () => { authModalMode.value = (authModalMode.value === 'login' ? 'register' : 'login') }
    const toLogin = () => { authModalMode.value = 'login' }

    const validateNickname = () => {
      nicknameError.value = registerForm.value.nickname === '管理员' ? '昵称不可为“管理员”' : ''
    }

    const doLogin = async () => {
      if (submitting.value) return
      if (!loginForm.value.id.trim() || !loginForm.value.password.trim()) {
        alert('请输入ID和密码')
        return
      }
      submitting.value = true
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: loginForm.value.id, password: loginForm.value.password })
        })
        const result = await res.json()
        if (result.success) {
          const { token, user } = result.data
          setAuth(token, user)
          localStorage.setItem('remember_account', loginForm.value.rememberAccount ? 'true' : 'false')
          localStorage.setItem('remember_password', loginForm.value.rememberPassword ? 'true' : 'false')
          if (loginForm.value.rememberAccount) localStorage.setItem('saved_id', loginForm.value.id)
          else localStorage.removeItem('saved_id')
          if (loginForm.value.rememberPassword) localStorage.setItem('saved_password', loginForm.value.password)
          else localStorage.removeItem('saved_password')
          close()
          successPopup.value = { title: '登录成功' }
          setTimeout(() => { successPopup.value = null }, 500)
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

    const doRegister = async () => {
      if (submitting.value) return
      const f = registerForm.value
      confirmError.value = ''
      if (!f.nickname.trim() || !f.id.trim() || !f.password.trim() || !f.confirm.trim()) {
        alert('请输入完整信息')
        return
      }
      if (f.nickname === '管理员') {
        alert('昵称不可为“管理员”')
        return
      }
      if (f.password !== f.confirm) {
        confirmError.value = '两次输入的密码不一致！'
        return
      }
      submitting.value = true
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: f.id, nickname: f.nickname, password: f.password })
        })
        const result = await res.json()
        if (result.success) {
          successPopup.value = { title: '注册成功', subtitle: '请登录' }
          authModalMode.value = 'login'
          setTimeout(() => { successPopup.value = null }, 1000)
        } else {
          alert(result.message || '注册失败')
        }
      } catch (e) {
        alert('注册失败，请重试')
      } finally {
        submitting.value = false
      }
    }

    return { open, mode, loginForm, registerForm, nicknameError, confirmError, validateNickname, submitting, close, toggleMode, toLogin, doLogin, doRegister, successPopup }
  }
}
</script>

<style scoped>
.auth-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; z-index: 2000; }
.auth-modal { position: relative; width: 380px; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
.modal-header { display:flex; justify-content:space-between; align-items:center; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color); }
.modal-body { padding: 1rem; }
.modal-footer { display:flex; justify-content:flex-end; padding: 0.75rem 1rem; border-top: 1px solid var(--border-color); }
.close-btn { position:absolute; top:0.5rem; right:0.5rem; border:none; background:transparent; cursor:pointer; font-size: 1rem; color: var(--text-secondary); }
.form-group { margin-bottom: 0.75rem; }
.form-input { width: 100%; padding: 0.6rem 0.75rem; border: 1px solid var(--border-color); background: var(--card-bg); color: var(--text-primary); border-radius: 8px; }
 .password-group { position: relative; }
 .password-input { width: 100%; padding-right: 2.5rem; }
 .eye-icon { position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); border: none; background: transparent; cursor: pointer; font-size: 1rem; }
 .toggle-btn { border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); border-radius: 8px; padding: 0.6rem 0.9rem; cursor: pointer; }
.options { display:flex; justify-content:space-between; color: var(--text-secondary); }
.form-actions { display:flex; justify-content:flex-end; }
.submit-btn { background:#667eea; color:#fff; border:none; border-radius:8px; padding:0.6rem 1.2rem; cursor:pointer; }
.switch-btn { background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 8px; padding: 0.4rem 0.8rem; cursor: pointer; }
.error { color: #e63946; font-size: 0.85rem; margin-top: 0.25rem; }
.prompt { display:flex; flex-direction:column; gap:0.75rem; }
.prompt-text { color: var(--text-primary); font-size: 1rem; }
.prompt-actions { display:flex; justify-content:flex-end; gap:0.5rem; }
.success-popup { position: fixed; top: 1rem; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 0.5rem; background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 10px; padding: 0.5rem 0.75rem; box-shadow: 0 6px 20px rgba(0,0,0,0.15); pointer-events: none; z-index: 3000; }
.success-title { font-weight: 600; }
.success-subtitle { color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.15rem; }
.success-icon { font-size: 1.1rem; }
</style>
