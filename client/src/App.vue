<template>
  <div id="app" :class="{ 'dark': isDark }">
    <header class="header">
      <nav class="nav">
        <router-link to="/" class="logo">星云博客系统</router-link>
        <div class="nav-links">
          <router-link to="/">首页</router-link>
          <router-link to="/create">写文章</router-link>
          <button v-if="!isLoggedIn" class="auth-btn" type="button" @click.prevent="openAuthModal('login')">登录/注册</button>
          <div v-else class="user-actions">
            <div class="avatar" :title="user.nickname">
              {{ user.nickname?.slice(0,1) || 'U' }}
              <span v-if="unreadCount > 0" class="unread-dot"></span>
            </div>
            <div class="dropdown" ref="dropdownRef">
              <button class="dropdown-toggle" @click="dropdownOpen = !dropdownOpen">{{ user.nickname }} ▾</button>
              <div class="dropdown-menu" :class="{ show: dropdownOpen }">
                <router-link to="/profile" class="dropdown-item">个人资料</router-link>
                <router-link to="/messages" class="dropdown-item">消息 <span v-if="unreadCount > 0" class="notif-badge">{{ unreadCount }}</span></router-link>
                <router-link to="/drafts" class="dropdown-item">草稿箱</router-link>
                <button class="dropdown-item" @click="logout">退出登录</button>
              </div>
            </div>
          </div>
          <button @click="toggleDarkMode" class="theme-toggle" aria-label="切换主题">
            <span class="toggle-icon">{{ isDark ? '☀️' : '🌙' }}</span>
            <span class="toggle-text">{{ isDark ? '日间模式' : '夜间模式' }}</span>
          </button>
        </div>
      </nav>
    </header>
    <AuthModal />
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<script>
import { useDarkMode } from './composables/useDarkMode'
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from './composables/useAuth'
import AuthModal from './components/AuthModal.vue'

export default {
  name: 'App',
  components: { AuthModal },
  setup() {
    const { isDark, toggleDarkMode } = useDarkMode()
    const { isLoggedIn, user, logout, openAuthModal } = useAuth()
    const dropdownOpen = ref(false)
    const dropdownRef = ref(null)
    const route = useRoute()
    const router = useRouter()
    const unreadCount = ref(0)
    let poller = null
    const token = () => localStorage.getItem('token') || ''

    const handleDocumentClick = (e) => {
      const el = dropdownRef.value
      if (!el) return
      if (dropdownOpen.value && !el.contains(e.target)) {
        dropdownOpen.value = false
      }
    }

    onMounted(() => {
      document.addEventListener('click', handleDocumentClick)
      if (route.path === '/login') openAuthModal('login')
      if (route.path === '/register') openAuthModal('register')
      if (isLoggedIn.value) startPolling()
      window.addEventListener('refresh-unread', fetchUnread)
    })
    onBeforeUnmount(() => {
      document.removeEventListener('click', handleDocumentClick)
      stopPolling()
      window.removeEventListener('refresh-unread', fetchUnread)
    })
    
    const forceReload = () => {
      if (window.location.pathname === '/') {
        window.location.reload()
      }
    }

    const fetchUnread = async () => {
      if (!isLoggedIn.value) { unreadCount.value = 0; return }
      try {
        const res = await fetch('/api/notifications/unread-count', { headers: { Authorization: `Bearer ${token()}` } })
        const result = await res.json()
        if (result.success) unreadCount.value = result.data.unread || 0
      } catch {}
    }

    const startPolling = () => {
      stopPolling()
      fetchUnread()
      poller = setInterval(fetchUnread, 30000)
    }

    const stopPolling = () => {
      if (poller) { clearInterval(poller); poller = null }
    }

    watch(isLoggedIn, (v) => { if (v) startPolling(); else { stopPolling(); unreadCount.value = 0 } })
    watch(() => route.path, (p) => {
      if (p === '/login') openAuthModal('login')
      if (p === '/register') openAuthModal('register')
    })

    return {
      isDark,
      toggleDarkMode,
      isLoggedIn,
      user,
      logout,
      openAuthModal,
      dropdownOpen,
      dropdownRef,
      route,
      router,
      unreadCount
    }
  }
}
</script>
<style scoped>
.avatar { position: relative; }
.unread-dot { position: absolute; top: -2px; right: -2px; width: 10px; height: 10px; border-radius: 50%; background: #dc3545; border: 2px solid #fff; }
.notif-badge { display: inline-block; min-width: 18px; padding: 0 6px; height: 18px; line-height: 18px; border-radius: 9px; background: #dc3545; color: #fff; font-size: 12px; margin-left: 6px; text-align: center; }
</style>
    
