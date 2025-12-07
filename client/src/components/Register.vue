<template>
  <div class="auth-page">
    <h2 class="title">注册</h2>
    <form @submit.prevent="submit" class="auth-form">
      <div class="form-group">
        <input
          v-model="form.nickname"
          type="text"
          placeholder="昵称 *"
          class="form-input"
          required
          @input="validateNickname"
        />
        <div v-if="nicknameError" class="error">{{ nicknameError }}</div>
      </div>
      <div class="form-group">
        <input
          v-model="form.id"
          type="text"
          placeholder="ID *"
          class="form-input"
          required
        />
      </div>
      <div class="form-group">
        <input
          v-model="form.password"
          type="password"
          placeholder="密码 *"
          class="form-input"
          required
        />
      </div>
      <div class="form-actions">
        <button type="submit" :disabled="submitting" class="submit-btn">
          {{ submitting ? '注册中...' : '注册' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

export default {
  name: 'Register',
  setup() {
    const router = useRouter()
    const submitting = ref(false)
    const form = ref({ nickname: '', id: '', password: '' })
    const nicknameError = ref('')

    const validateNickname = () => {
      nicknameError.value = form.value.nickname === '管理员' ? '昵称不可为“管理员”' : ''
    }

    const submit = async () => {
      if (submitting.value) return
      if (!form.value.nickname.trim() || !form.value.id.trim() || !form.value.password.trim()) {
        alert('请输入完整信息')
        return
      }
      if (form.value.nickname === '管理员') {
        alert('昵称不可为“管理员”')
        return
      }
      submitting.value = true
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: form.value.id, nickname: form.value.nickname, password: form.value.password })
        })
        const result = await res.json()
        if (result.success) {
          alert('注册成功，请登录')
          router.push('/login')
        } else {
          alert(result.message || '注册失败')
        }
      } catch (e) {
        alert('注册失败，请重试')
      } finally {
        submitting.value = false
      }
    }

    return { form, submitting, nicknameError, validateNickname, submit }
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
.title { margin-bottom: 1rem; color: var(--text-primary); }
.form-group { margin-bottom: 1rem; }
.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--card-bg);
  color: var(--text-primary);
}
.error { color: #e63946; font-size: 0.9rem; margin-top: 0.25rem; }
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
