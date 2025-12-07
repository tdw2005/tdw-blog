import { ref, computed } from 'vue'

const token = ref('')
const user = ref(null)
if (typeof window !== 'undefined') {
  try { token.value = localStorage.getItem('token') || '' } catch {}
  try { user.value = JSON.parse(localStorage.getItem('user') || 'null') } catch {}
  try {
    if (!token.value) {
      const c = document.cookie || ''
      const m = c.split(';').map(s => s.trim()).find(s => s.startsWith('token='))
      if (m) {
        const v = decodeURIComponent(m.slice(6))
        token.value = v
        try { localStorage.setItem('token', v) } catch {}
      }
    }
  } catch {}
}

const authModalOpen = ref(false)
const authModalMode = ref('login') // 'login' | 'register'

const isLoggedIn = computed(() => !!token.value)
const isAdmin = computed(() => !!(user.value && user.value.is_admin))

const setAuth = (newToken, newUser) => {
  token.value = newToken || ''
  user.value = newUser || null
  if (typeof window !== 'undefined') {
    if (newToken) localStorage.setItem('token', newToken)
    else localStorage.removeItem('token')
    if (newUser) localStorage.setItem('user', JSON.stringify(newUser))
    else localStorage.removeItem('user')
  }
}

const logout = () => {
  setAuth('', null)
}

const openAuthModal = (mode = 'login') => {
  authModalMode.value = mode
  authModalOpen.value = true
}

const closeAuthModal = () => {
  authModalOpen.value = false
}

export function useAuth() {
  return {
    token,
    user,
    isLoggedIn,
    isAdmin,
    setAuth,
    logout,
    authModalOpen,
    authModalMode,
    openAuthModal,
    closeAuthModal
  }
}
