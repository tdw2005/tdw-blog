<template>
  <div class="notifications-page">
    <h1 class="title">消息</h1>

    <div class="header-actions">
      <div class="unread-info">未读：{{ unread }}</div>
      <button class="mark-all-btn" @click="markAllRead" :disabled="markingAll">{{ markingAll ? '处理中...' : '全部标记为已读' }}</button>
    </div>

    <div class="tabs">
      <button class="tab-btn" :class="{ active: activeTab === 'likes' }" @click="switchTab('likes')">点赞 <span v-if="likesUnread > 0" class="tab-badge">{{ likesUnread }}</span></button>
      <button class="tab-btn" :class="{ active: activeTab === 'comments' }" @click="switchTab('comments')">评论 <span v-if="commentsUnread > 0" class="tab-badge">{{ commentsUnread }}</span></button>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else>
      <div v-if="filteredItems.length === 0" class="empty">暂无消息</div>

      <ul class="notification-list">
        <li v-for="n in filteredItems" :key="n.id" class="notification-item" :class="{ unread: !n.read }">
          <div class="item-row">
            <div class="icon">{{ typeIcon(n) }}</div>
            <div class="notification-main">
              <div class="message">{{ renderMessage(n) }}</div>
              <div v-if="n.type === 'reply' && n.parent_excerpt" class="context">原评论：{{ n.parent_excerpt }}</div>
              <div class="meta">
                <span>{{ formatDate(n.created_at) }}</span>
                <span 
                  v-if="n.current_like_count != null && (n.type === 'article_like' || n.type === 'comment_like')"
                  class="count-pill"
                >👍（{{ n.current_like_count }}）</span>
              </div>
            </div>
            <div class="actions">
              <button class="open-btn" v-if="n.article_id" @click="openNotification(n)">查看</button>
              <button class="read-btn" v-if="!n.read" @click="markRead(n.id)">标记已读</button>
              <button 
                v-if="n.type === 'comment' || n.type === 'reply'" 
                class="pill-btn like-pill"
                :class="{ liked: !!n.liked_by_current_user }"
                @click="likeCommentFromNotif(n)"
              >👍（{{ n.current_like_count ?? 0 }}）</button>
              <button 
                v-if="n.type === 'comment' || n.type === 'reply'" 
                class="pill-btn reply-pill"
                :class="{ active: !!inlineReplyOpen[n.id] }"
                @click="toggleInlineReply(n)"
              >💬</button>
            </div>
          </div>
          <div v-if="(n.type === 'comment' || n.type === 'reply') && inlineReplyOpen[n.id]" class="inline-reply">
            <textarea 
              v-model="replyContent[n.id]" 
              class="reply-input" 
              rows="2" 
              placeholder="输入回复内容..."
            ></textarea>
            <div class="inline-actions">
              <button 
                class="submit-reply-btn" 
                :disabled="!!replySubmitting[n.id]" 
                @click="submitInlineReply(n)"
              >{{ replySubmitting[n.id] ? '提交中...' : '回复' }}</button>
            </div>
          </div>
        </li>
      </ul>

      <div class="pagination" v-if="pagination.totalPages > 1">
        <button class="page-btn" :disabled="pagination.page === 1" @click="changePage(pagination.page - 1)">上一页</button>
        <span class="page-info">第 {{ pagination.page }} / {{ pagination.totalPages }} 页</span>
        <button class="page-btn" :disabled="pagination.page === pagination.totalPages" @click="changePage(pagination.page + 1)">下一页</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

export default {
  name: 'Notifications',
  setup() {
    const router = useRouter()
    const { isLoggedIn, openAuthModal } = useAuth()
    const items = ref([])
    const loading = ref(false)
    const unread = ref(0)
    const likesUnread = ref(0)
    const commentsUnread = ref(0)
    const markingAll = ref(false)
    const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })
    const activeTab = ref('likes')

    const filteredItems = computed(() => {
      if (activeTab.value === 'likes') {
        return items.value.filter(n => n.type === 'article_like' || n.type === 'comment_like')
      }
      return items.value.filter(n => n.type === 'comment' || n.type === 'reply')
    })

    const token = () => localStorage.getItem('token') || ''
    const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

    const injected = inject('initialData', null)
    const checkSSRData = () => {
      const src = injected || (typeof window !== 'undefined' ? window.__INITIAL_DATA__ : null)
      if (src && src.route === '/messages' && src.data) {
        if (Array.isArray(src.data.notifications)) items.value = src.data.notifications
        if (src.data.pagination) {
          pagination.value.page = src.data.pagination.page || 1
          pagination.value.total = src.data.pagination.total || items.value.length
          pagination.value.totalPages = src.data.pagination.totalPages || 1
        }
        if (typeof src.data.unread === 'number') unread.value = src.data.unread
        if (typeof src.data.likesUnread === 'number') likesUnread.value = src.data.likesUnread
        if (typeof src.data.commentsUnread === 'number') commentsUnread.value = src.data.commentsUnread
        loading.value = false
        return true
      }
      return false
    }

    const fetchUnread = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/notifications/unread-count`, { headers: { Authorization: `Bearer ${token()}` } })
        const result = await res.json()
        if (result.success) unread.value = result.data.unread
      } catch {}
    }

    const fetchUnreadByType = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/notifications/unread-counts`, { headers: { Authorization: `Bearer ${token()}` } })
        const result = await res.json()
        if (result.success && result.data) {
          likesUnread.value = (result.data.article_like || 0) + (result.data.comment_like || 0)
          commentsUnread.value = (result.data.comment || 0) + (result.data.reply || 0)
        }
      } catch {}
    }

    const fetchNotifications = async (page = 1) => {
      if (!isLoggedIn.value) { openAuthModal('prompt'); return }
      loading.value = true
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(pagination.value.limit) })
        const res = await fetch(`${API_BASE}/api/notifications?${params.toString()}`, { headers: { Authorization: `Bearer ${token()}` } })
        const result = await res.json()
        if (result.success) {
          items.value = result.data.notifications || []
          pagination.value.page = page
          pagination.value.total = result.data.pagination.total
          pagination.value.totalPages = result.data.pagination.totalPages
          await markTabRead(activeTab.value)
          await enrichNotifications()
        }
      } finally {
        loading.value = false
      }
      fetchUnread()
      fetchUnreadByType()
    }

    const changePage = (p) => { fetchNotifications(p) }
    const openNotification = (n) => {
      if (n.article_id && n.comment_id) {
        router.push(`/article/${n.article_id}?commentId=${n.comment_id}`)
      } else if (n.article_id) {
        router.push(`/article/${n.article_id}`)
      }
    }

    const markRead = async (id) => {
      try {
        const res = await fetch(`${API_BASE}/api/notifications/mark-read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
          body: JSON.stringify({ ids: [id] })
        })
        const r = await res.json()
        if (r.success) {
          const it = items.value.find(x => x.id === id)
          if (it) it.read = 1
          fetchUnread()
          fetchUnreadByType()
          try { window.dispatchEvent(new CustomEvent('refresh-unread')) } catch {}
        }
      } catch {}
    }

    const markTabRead = async (tab) => {
      const types = tab === 'likes' ? ['article_like', 'comment_like'] : ['comment', 'reply']
      const ids = items.value.filter(n => types.includes(n.type) && !n.read).map(n => n.id)
      if (ids.length === 0) return
      try {
        const res = await fetch(`${API_BASE}/api/notifications/mark-read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
          body: JSON.stringify({ ids })
        })
        const r = await res.json()
        if (r.success) {
          items.value.forEach(n => { if (ids.includes(n.id)) n.read = 1 })
          fetchUnread()
          try { window.dispatchEvent(new CustomEvent('refresh-unread')) } catch {}
        }
      } catch {}
    }

    const switchTab = async (tab) => {
      activeTab.value = tab
      await markTabRead(tab)
      await fetchUnreadByType()
    }

    const typeIcon = (n) => {
      if (n.type === 'article_like' || n.type === 'comment_like') return '👍'
      if (n.type === 'comment') return '💬'
      if (n.type === 'reply') return '↩️'
      return '🔔'
    }

    const markAllRead = async () => {
      if (markingAll.value) return
      markingAll.value = true
      try {
        const res = await fetch(`${API_BASE}/api/notifications/mark-all-read`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` } })
        const r = await res.json()
        if (r.success) {
          items.value.forEach(x => x.read = 1)
          fetchUnread()
          fetchUnreadByType()
          try { window.dispatchEvent(new CustomEvent('refresh-unread')) } catch {}
        }
      } catch {}
      finally { markingAll.value = false }
    }

    const renderMessage = (n) => {
      const actor = n.actor_nickname || '用户'
      if (n.type === 'article_like') {
        return `${actor} 赞了你的文章《${n.article_title || '文章'}》`
      }
      if (n.type === 'comment_like') {
        return `${actor} 赞了你的评论：${n.comment_excerpt || ''}`
      }
      if (n.type === 'comment') {
        return `${actor} 评论了你的文章《${n.article_title || '文章'}》：${n.comment_excerpt || ''}`
      }
      if (n.type === 'reply') {
        return `${actor} 回复了你的评论：${n.comment_excerpt || ''}`
      }
      return n.message || '收到一条消息'
    }

    const formatDate = (d) => { return new Date(d).toLocaleString() }

    const enrichNotifications = async () => {
      const tasks = items.value.map(async (n) => {
        try {
          if (n.type === 'article_like' && n.article_id) {
            const res = await fetch(`${API_BASE}/api/articles/${n.article_id}`, { headers: { Authorization: `Bearer ${token()}` } })
            const r = await res.json()
            if (r.success && r.data) n.current_like_count = r.data.like_count
          } else if (n.type === 'comment_like' && n.comment_id) {
            const res = await fetch(`${API_BASE}/api/comments/${n.comment_id}`, { headers: { Authorization: `Bearer ${token()}` } })
            const r = await res.json()
            if (r.success && r.data) n.current_like_count = r.data.like_count
          } else if ((n.type === 'comment' || n.type === 'reply') && n.comment_id) {
            const res = await fetch(`${API_BASE}/api/comments/${n.comment_id}`, { headers: { Authorization: `Bearer ${token()}` } })
            const r = await res.json()
            if (r.success && r.data) {
              n.current_like_count = r.data.like_count
              n.reply_count = r.data.reply_count
              n.liked_by_current_user = !!r.data.liked_by_current_user
              if (n.type === 'reply' && r.data.parent_id) {
                const p = await fetch(`${API_BASE}/api/comments/${r.data.parent_id}`, { headers: { Authorization: `Bearer ${token()}` } })
                const pr = await p.json()
                if (pr.success && pr.data && pr.data.content) {
                  n.parent_excerpt = String(pr.data.content).slice(0, 120)
                }
              }
            }
          }
        } catch {}
      })
      await Promise.all(tasks)
    }

    onMounted(async () => { const hasSSR = checkSSRData(); if (!hasSSR) { await fetchNotifications(1) } await enrichNotifications(); await fetchUnreadByType() })

    const likeCommentFromNotif = async (n) => {
      const id = n.comment_id
      if (!id) return
      if (!isLoggedIn.value) { openAuthModal('prompt'); return }
      try {
        const res = await fetch(`${API_BASE}/api/comments/${id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } })
        const r = await res.json()
        if (r.success) {
          n.current_like_count = r.data.like_count
          n.liked_by_current_user = r.data.liked
        }
      } catch {}
    }

    const inlineReplyOpen = ref({})
    const replyContent = ref({})
    const replySubmitting = ref({})
    const toggleInlineReply = (n) => {
      inlineReplyOpen.value[n.id] = !inlineReplyOpen.value[n.id]
    }

    const submitInlineReply = async (n) => {
      if (!isLoggedIn.value) { openAuthModal('prompt'); return }
      const content = (replyContent.value[n.id] || '').trim()
      if (!content) { alert('请填写回复内容'); return }
      replySubmitting.value[n.id] = true
      try {
        const res = await fetch(`${API_BASE}/api/articles/${n.article_id}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
          body: JSON.stringify({ content, parent_id: n.comment_id })
        })
        const r = await res.json()
        if (r.success) {
          alert('已回复')
          replyContent.value[n.id] = ''
          inlineReplyOpen.value[n.id] = false
          n.reply_count = (n.reply_count || 0) + 1
        } else {
          alert(r.message || '回复失败')
        }
      } catch (e) { alert('回复失败，请重试') }
      finally { replySubmitting.value[n.id] = false }
    }

    return { items, loading, unread, likesUnread, commentsUnread, pagination, changePage, openNotification, markRead, markAllRead, renderMessage, formatDate, markingAll, activeTab, filteredItems, switchTab, typeIcon, likeCommentFromNotif, inlineReplyOpen, replyContent, replySubmitting, toggleInlineReply, submitInlineReply }
  }
}
</script>

<style scoped>
.notifications-page { max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
.title { margin-bottom: 1rem; color: var(--text-primary); }
.header-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.unread-info { color: var(--text-secondary); }
.mark-all-btn { background: #6c757d; color: #fff; border: none; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; }
.tabs { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
.tab-btn { background: #f1f3f5; color: var(--text-primary); border: 1px solid var(--border-color); padding: 0.4rem 0.8rem; border-radius: 8px; cursor: pointer; }
.tab-btn.active { background: #667eea; color: #fff; border-color: #667eea; }
.tab-badge { display: inline-block; min-width: 18px; padding: 0 6px; height: 18px; line-height: 18px; border-radius: 9px; background: #dc3545; color: #fff; font-size: 12px; margin-left: 6px; text-align: center; }
.loading, .empty { padding: 1rem; color: var(--text-secondary); }
.notification-list { list-style: none; padding: 0; margin: 0; }
.notification-item { display: block; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--card-bg); margin-bottom: 0.5rem; }
.item-row { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
.notification-item.unread { border-left: 4px solid #667eea; }
.icon { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 18px; margin-right: 8px; }
.notification-main { flex: 1; }
.message { color: var(--text-primary); font-weight: 600; }
.meta { color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.25rem; display: flex; justify-content: flex-start; align-items: center; gap: 2rem; }
.actions { display: flex; gap: 0.5rem; }
.open-btn { background: #667eea; color: #fff; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; }
.read-btn { background: #20c997; color: #fff; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; }
.pagination { display: flex; gap: 1rem; justify-content: center; align-items: center; margin-top: 1rem; }
.page-btn { background: #6c757d; color: #fff; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; }
.page-info { color: var(--text-secondary); }

.count-pill { display: inline-flex; align-items: center; gap: 0.25rem; background: var(--card-bg); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 999px; padding: 0.1rem 0.5rem; font-size: 0.85rem; }
.pill-btn { background: var(--card-bg); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 999px; padding: 0.25rem 0.6rem; cursor: pointer; font-size: 0.85rem; }
.pill-btn:hover { background: var(--border-color); }
.inline-reply { margin-top: 0.75rem; display: block; border: 2px solid #4db1ff; border-radius: 8px; padding: 0.75rem; background: var(--bg-secondary); }
.reply-input { width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--card-bg); color: var(--text-primary); }
.inline-actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem; }
.submit-reply-btn { background: #20c997; color: #fff; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; }
.reply-pill.active { background: #667eea; color: #fff; border-color: #667eea; }
.like-pill.liked { background: #ffca2c; color: #212529; border-color: #ffca2c; }
</style>
