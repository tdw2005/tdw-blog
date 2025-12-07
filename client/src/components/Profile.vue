<template>
  <div class="profile-page">
    <h2 class="title">个人资料</h2>

    <div class="card">
      <h3 class="section-title">更改昵称</h3>
      <form @submit.prevent="updateNickname">
        <div class="form-group">
          <input v-model="nickname" type="text" class="form-input" placeholder="新昵称 *" required />
        </div>
        <div class="form-actions">
          <button type="submit" :disabled="submittingNickname" class="submit-btn">
            {{ submittingNickname ? '提交中...' : '保存昵称' }}
          </button>
        </div>
      </form>
    </div>

    <div class="card">
      <h3 class="section-title">更改密码</h3>
      <form @submit.prevent="updatePassword">
        <div class="form-group">
          <input v-model="oldPassword" type="password" class="form-input" placeholder="旧密码 *" required />
        </div>
        <div class="form-group">
          <input v-model="newPassword" type="password" class="form-input" placeholder="新密码 *" required />
        </div>
        <div class="form-group">
          <input v-model="confirmPassword" type="password" class="form-input" placeholder="确认新密码 *" required />
        </div>
        <div class="form-actions">
          <button type="submit" :disabled="submittingPassword" class="submit-btn">
            {{ submittingPassword ? '提交中...' : '保存密码' }}
          </button>
        </div>
      </form>
    </div>

  <div class="card">
      <h3 class="section-title">我发布的文章</h3>
      <div v-if="loadingArticles" class="loading">加载中...</div>
      <div v-else>
        <div v-if="myArticles.length === 0" class="empty">暂无文章</div>
        <ul class="article-list">
          <li v-for="a in myArticles" :key="a.id" class="article-item">
            <div class="article-main" @click="goDetail(a.id)">
              <div class="title">{{ a.title }}</div>
              <div class="meta">
                <span v-if="a.updated_at && a.updated_at !== a.created_at">最近编辑 {{ formatDate(a.updated_at) }}</span>
                <span v-else>发布时间 {{ formatDate(a.created_at) }}</span>
                <span>阅读 {{ a.view_count || 0 }}</span>
                <span>点赞 {{ a.like_count || 0 }}</span>
                <span>评论 {{ a.comment_count || 0 }}</span>
              </div>
            </div>
            <div class="actions">
              <button class="view-btn" @click.stop="goDetail(a.id)">查看</button>
            </div>
          </li>
        </ul>
      </div>
  </div>
  <div class="card">
    <h3 class="section-title">我的草稿</h3>
    <div v-if="loadingDrafts" class="loading">加载中...</div>
    <div v-else>
      <div v-if="myDrafts.length === 0" class="empty">暂无草稿</div>
      <ul class="article-list">
        <li v-for="d in myDrafts" :key="d.id" class="article-item">
          <div class="article-main" @click="edit(d.id)">
            <div class="title">{{ d.title || '未命名草稿' }}</div>
            <div class="meta">
              <span>创建: {{ formatDate(d.created_at) }}</span>
              <span v-if="d.updated_at !== d.created_at">最近编辑: {{ formatDate(d.updated_at) }}</span>
            </div>
          </div>
          <div class="actions">
            <button class="edit-btn" @click="edit(d.id)">继续编辑</button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

export default {
  name: 'Profile',
  setup() {
    const router = useRouter()
    const { user } = useAuth()
    const nickname = ref('')
    const submittingNickname = ref(false)
    const oldPassword = ref('')
    const newPassword = ref('')
    const confirmPassword = ref('')
    const submittingPassword = ref(false)

    const token = () => localStorage.getItem('token') || ''
    const myArticles = ref([])
    const loadingArticles = ref(true)
    const myDrafts = ref([])
    const loadingDrafts = ref(true)
    const meUserId = ref('')

    const goDetail = (id) => router.push(`/article/${id}`)
    const edit = (id) => router.push(`/edit/${id}`)
    const formatDate = (d) => { const dt = new Date(d); return dt.toLocaleString() }

    const injected = inject('initialData', null)
    const checkSSRData = () => {
      const src = injected || (typeof window !== 'undefined' ? window.__INITIAL_DATA__ : null)
      if (src && src.route === '/profile' && src.data) {
        if (typeof src.data.nickname === 'string') nickname.value = src.data.nickname
        if (Array.isArray(src.data.myArticles)) { myArticles.value = src.data.myArticles; loadingArticles.value = false }
        if (Array.isArray(src.data.myDrafts)) { myDrafts.value = src.data.myDrafts; loadingDrafts.value = false }
        return true
      }
      return false
    }

    const fetchMyProfile = async () => {
      try {
        const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token()}` } })
        const result = await res.json()
        if (result.success) { nickname.value = result.data.nickname || ''; meUserId.value = result.data.user_id || '' }
      } catch (e) {}
    }

    const fetchMyArticles = async () => {
      loadingArticles.value = true
      try {
        const authorId = meUserId.value || (user.value?.user_id || '')
        const qs = new URLSearchParams({ page: '1', limit: '10', author: authorId })
        const res2 = await fetch(`/api/articles?${qs.toString()}`)
        const r2 = await res2.json()
        if (r2.success) { myArticles.value = r2.data?.articles || [] }
      } catch (e) {}
      finally { loadingArticles.value = false }
    }

    const fetchMyDrafts = async () => {
      loadingDrafts.value = true
      try {
        const qs3 = new URLSearchParams({ page: '1', limit: '10', scope: 'mine' })
        const res3 = await fetch(`/api/drafts?${qs3.toString()}`, { headers: { Authorization: `Bearer ${token()}` } })
        const r3 = await res3.json()
        if (r3.success) { myDrafts.value = r3.data?.drafts || [] }
      } catch (e) {}
      finally { loadingDrafts.value = false }
    }

    const handleArticlesRefresh = () => { fetchMyArticles(); fetchMyDrafts() }
    const handleDraftsRefresh = () => { fetchMyDrafts() }

    onMounted(async () => {
      const hasSSR = checkSSRData()
      if (hasSSR) return
      await fetchMyProfile()
      await fetchMyArticles()
      await fetchMyDrafts()
      window.addEventListener('articles-refresh', handleArticlesRefresh)
      window.addEventListener('drafts-refresh', handleDraftsRefresh)
    })

    onBeforeUnmount(() => { 
      window.removeEventListener('articles-refresh', handleArticlesRefresh)
      window.removeEventListener('drafts-refresh', handleDraftsRefresh)
    })

    const updateNickname = async () => {
      if (submittingNickname.value) return
      if (!nickname.value.trim()) {
        alert('请输入昵称')
        return
      }
      submittingNickname.value = true
      try {
        const res = await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token()}`
          },
          body: JSON.stringify({ nickname: nickname.value })
        })
        const result = await res.json()
        if (result.success) {
          alert('昵称已更新')
          const userStr = localStorage.getItem('user')
          if (userStr) {
            const user = JSON.parse(userStr)
            user.nickname = nickname.value
            localStorage.setItem('user', JSON.stringify(user))
          }
        } else {
          alert(result.message || '更新失败')
        }
      } catch (e) {
        alert('更新失败，请重试')
      } finally {
        submittingNickname.value = false
      }
    }

    const updatePassword = async () => {
      if (submittingPassword.value) return
      if (!oldPassword.value.trim() || !newPassword.value.trim() || !confirmPassword.value.trim()) {
        alert('请输入完整信息')
        return
      }
      if (newPassword.value !== confirmPassword.value) {
        alert('两次输入的新密码不一致')
        return
      }
      submittingPassword.value = true
      try {
        const res = await fetch('/api/auth/password', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token()}`
          },
          body: JSON.stringify({ oldPassword: oldPassword.value, newPassword: newPassword.value })
        })
        const result = await res.json()
        if (result.success) {
          alert('密码已更新')
          oldPassword.value = ''
          newPassword.value = ''
          confirmPassword.value = ''
        } else {
          alert(result.message || '更新失败')
        }
      } catch (e) {
        alert('更新失败，请重试')
      } finally {
        submittingPassword.value = false
      }
    }

    return {
      nickname,
      submittingNickname,
      oldPassword,
      newPassword,
      confirmPassword,
      submittingPassword,
      updateNickname,
      updatePassword,
      myArticles,
      loadingArticles,
      myDrafts,
      loadingDrafts,
      goDetail,
      edit,
      formatDate
    }
  }
}
</script>

<style scoped>
.profile-page {
  max-width: 640px;
  margin: 2rem auto;
  padding: 0 1rem;
}
.title { margin-bottom: 1rem; color: var(--text-primary); }
.card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1rem;
}
.section-title { margin-bottom: 0.75rem; color: var(--text-primary); }
.form-group { margin-bottom: 0.75rem; }
.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--card-bg);
  color: var(--text-primary);
}
.form-actions { display: flex; justify-content: flex-end; }
.submit-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  background: #667eea;
  color: #fff;
  cursor: pointer;
}
.article-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr; gap: 0.75rem; }
.article-item { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0.75rem; border: 1px solid var(--border-color); border-radius: 10px; background: var(--card-bg); box-shadow: var(--shadow-sm); }
.article-item:hover { transform: translateY(-1px); box-shadow: var(--shadow-md); }
.article-main { flex: 1; cursor: pointer; }
.title { font-size: 1rem; font-weight: 600; margin-bottom: 0.35rem; }
.meta { display: flex; flex-wrap: wrap; gap: 0.75rem; color: var(--text-secondary); font-size: 0.9rem; }
.actions { margin-left: 1rem; display: flex; align-items: center; }
.view-btn { padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--card-bg); color: var(--text-primary); box-shadow: var(--shadow-sm); cursor: pointer; }
.view-btn:hover { color: var(--brand); background: rgba(102, 126, 234, 0.12); }
</style>
