<template>
  <div class="article-comments">
    <!-- 评论头部 -->
    <div class="comments-header">
      <h3>
        <span class="comments-count">评论 ({{ totalComments }})</span>
      </h3>
      <div class="sort-options" v-if="comments.length > 0">
        <span>排序：</span>
        <select v-model="sortBy" @change="fetchComments">
          <option value="newest">最新</option>
          <option value="oldest">最早</option>
        </select>
      </div>
    </div>

    <!-- 评论表单 -->
    <div class="comment-form">
      <h4>发表评论</h4>
      <form @submit.prevent="submitComment">
        <div class="form-group">
          <textarea 
            v-model="form.content" 
            placeholder="写下你的评论... *" 
            :rows="formExpanded ? 4 : 1"
            @focus="formExpanded = true"
            @blur="onFormBlur"
            required
            maxlength="1000"
            class="form-textarea"
          ></textarea>
          <div class="char-count">{{ form.content.length }}/1000</div>
        </div>
        <div class="form-actions">
          <button 
            type="submit" 
            :disabled="submitting" 
            class="submit-btn"
          >
            {{ submitting ? '提交中...' : '发表评论' }}
          </button>
        </div>
      </form>
    </div>

    <!-- 评论列表 -->
    <div class="comments-list" v-if="comments.length > 0">
      <div 
        v-for="comment in comments" 
        :key="comment.id" 
        class="comment-item"
        :id="'comment-' + comment.id"
        :class="{ 'has-replies': comment.replies && comment.replies.length > 0 }"
      >
        <!-- 主评论 -->
        <div class="comment-main">
          <div class="comment-header">
            <span class="user-name">{{ comment.user_nickname || comment.user_name }}</span>
            <span class="comment-date">{{ formatDate(comment.created_at) }}</span>
          </div>
          <div class="comment-content">{{ comment.content }}</div>
          <div class="comment-actions">
            <button 
              @click="toggleReply(comment.id)"
              class="reply-action-btn"
              aria-label="回复"
            >
              💬
            </button>
            <button 
              class="like-btn"
              :class="{ liked: !!comment.liked_by_current_user }"
              @click="toggleLike(comment)"
            >👍 {{ comment.like_count || 0 }}</button>
            <button 
              v-if="canDeleteComment(comment)"
              class="delete-btn small"
              @click="deleteComment(comment)"
            >删除</button>
          </div>
        </div>

        <!-- 回复表单 -->
        <div v-if="replyingTo === comment.id" class="reply-form">
          <form @submit.prevent="submitReply(comment.id)">
            <div class="form-group">
              <textarea 
                v-model="replyForm.content" 
                :placeholder="`回复 @${comment.user_nickname || comment.user_name}...`"
                rows="3"
                required
                class="form-textarea"
              ></textarea>
            </div>
            <div class="form-actions">
              <button 
                type="button" 
                @click="cancelReply"
                class="cancel-btn"
              >
                取消
              </button>
              <button 
                type="submit" 
                :disabled="submittingReply" 
                class="submit-btn"
              >
                {{ submittingReply ? '提交中...' : '回复' }}
              </button>
            </div>
          </form>
        </div>

        <!-- 回复列表 -->
        <div v-if="comment.replies && comment.replies.length > 0" class="replies-list">
          <div 
            v-for="reply in getVisibleReplies(comment)" 
            :key="reply.id" 
            class="reply-item"
            :id="'comment-' + reply.id"
          >
            <div class="reply-main">
              <div class="reply-header">
                <span class="user-name">{{ reply.user_nickname || reply.user_name }}</span>
                <span class="reply-date">{{ formatDate(reply.created_at) }}</span>
              </div>
              <div class="reply-content">
                <span class="reply-label">回复</span>
                <span class="reply-to">@{{ (reply.parent_id === comment.id) 
                  ? (comment.user_nickname || comment.user_name) 
                  : ((comment.replies || []).find(r => r.id === reply.parent_id)?.user_nickname 
                    || (comment.replies || []).find(r => r.id === reply.parent_id)?.user_name 
                    || (comment.user_nickname || comment.user_name)) }}：</span>
                {{ reply.content }}
              </div>
              <div class="comment-actions">
                <button 
                  @click="toggleReply(reply.id)"
                  class="reply-action-btn"
                  aria-label="回复"
                >
                  💬
                </button>
                <button 
                  class="like-btn"
                  :class="{ liked: !!reply.liked_by_current_user }"
                  @click="toggleLike(reply)"
                >👍 {{ reply.like_count || 0 }}</button>
                <button 
                  v-if="canDeleteComment(reply)"
                  class="delete-btn small"
                  @click="deleteComment(reply)"
                >删除</button>
              </div>
            </div>

            <!-- 针对某条回复的二级回复表单 -->
            <div v-if="replyingTo === reply.id" class="reply-form">
              <form @submit.prevent="submitReply(reply.id)">
                <div class="form-group">
                  <textarea 
                    v-model="replyForm.content" 
                    :placeholder="`回复 @${reply.user_nickname || reply.user_name}...`"
                    rows="3"
                    required
                    class="form-textarea"
                  ></textarea>
                </div>
                <div class="form-actions">
                  <button 
                    type="button" 
                    @click="cancelReply"
                    class="cancel-btn"
                  >
                    取消
                  </button>
                  <button 
                    type="submit" 
                    :disabled="submittingReply" 
                    class="submit-btn"
                  >
                    {{ submittingReply ? '提交中...' : '回复' }}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <!-- 展开更多回复按钮 -->
          <div v-if="(comment.replies || []).length > (getVisibleReplies(comment).length)" class="reply-more">
            <button class="view-more-btn" @click="expandReplies(comment)">
              展开更多回复（剩余 {{ (comment.replies.length - getVisibleReplies(comment).length) }} 条）
            </button>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div class="comments-pagination" v-if="pagination.totalPages > 1">
        <button 
          @click="changePage(pagination.page - 1)"
          :disabled="pagination.page === 1"
          class="page-btn"
        >
          上一页
        </button>
        
        <span class="page-info">
          第 {{ pagination.page }} 页 / 共 {{ pagination.totalPages }} 页
        </span>
        
        <button 
          @click="changePage(pagination.page + 1)"
          :disabled="pagination.page === pagination.totalPages"
          class="page-btn"
        >
          下一页
        </button>
      </div>
    </div>

    <!-- 无评论提示 -->
    <div v-else class="no-comments">
      <p>还没有评论，快来发表第一条评论吧！</p>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <p>加载评论中...</p>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'

export default {
  name: 'ArticleComments',
  props: {
    articleId: {
      type: [String, Number],
      required: true
    }
  },
  setup(props) {
    const route = useRoute()
    const comments = ref([])
    const totalComments = ref(0)
    const loading = ref(false)
    const sortBy = ref('newest')
    const replyingTo = ref(null) // 可为主评论ID或某条回复ID
    const submitting = ref(false)
    const submittingReply = ref(false)
    const repliesVisibleCount = ref({})
    
    const pagination = ref({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0
    })

    const { isLoggedIn, isAdmin, user, openAuthModal } = useAuth()
    const form = ref({
      content: ''
    })
    const formExpanded = ref(false)

    const replyForm = ref({
      content: ''
    })

    const fetchCommentStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/articles/${props.articleId}/comments/stats`)
        const r = await res.json()
        if (r.success && r.data && typeof r.data.total !== 'undefined') {
          totalComments.value = r.data.total
        }
      } catch (e) {}
    }

    const fetchComments = async (page = 1) => {
      loading.value = true
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: pagination.value.limit.toString(),
          sort: sortBy.value
        })

        const headers = {}
        const t = localStorage.getItem('token')
        if (t) headers['Authorization'] = `Bearer ${t}`
        const response = await fetch(`${API_BASE}/api/articles/${props.articleId}/comments?${params}`, { headers })
        const result = await response.json()

        if (result.success) {
          comments.value = (result.data.comments || []).map(c => {
            c.liked_by_current_user = !!c.liked_by_current_user
            c.replies = (c.replies || []).map(r => ({ ...r, liked_by_current_user: !!r.liked_by_current_user }))
            return c
          })
          pagination.value = result.data.pagination
          await fetchCommentStats()
          // 初始化每条主评论的可见回复条数：若超过1条，默认显示1条，否则显示全部
          const initMap = {}
          comments.value.forEach(c => {
            const total = (c.replies && Array.isArray(c.replies)) ? c.replies.length : 0
            initMap[c.id] = total > 1 ? 1 : total
          })
          repliesVisibleCount.value = initMap
          const cid = parseInt(route.query.commentId) || null
          if (cid) {
            await nextTick()
            const el = document.getElementById('comment-' + cid)
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' })
              el.classList.add('highlight-blink')
              setTimeout(() => { el.classList.remove('highlight-blink') }, 1600)
            }
          }
        }
      } catch (error) {
        // 错误处理
      } finally {
        loading.value = false
      }
    }

    const submitComment = async () => {
      if (submitting.value) return
      
      if (!isLoggedIn.value) { openAuthModal('prompt'); return }
      if (!form.value.content.trim()) {
        alert('请填写评论内容')
        return
      }

      submitting.value = true
      try {
        const response = await fetch(`${API_BASE}/api/articles/${props.articleId}/comments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`
          },
          body: JSON.stringify({
            content: form.value.content
          })
        })

        const result = await response.json()
        
        if (result.success) {
          form.value = { content: '' }
          fetchComments(1)
        } else {
          alert('评论发表失败: ' + result.message)
        }
      } catch (error) {
        alert('发表评论失败，请重试')
      } finally {
        submitting.value = false
      }
    }

    const submitReply = async (parentId) => {
      if (submittingReply.value) return
      
      if (!isLoggedIn.value) { openAuthModal('prompt'); return }
      if (!replyForm.value.content.trim()) {
        alert('请填写回复内容')
        return
      }

      submittingReply.value = true
      try {
        // 提交回复 - 明确发送 parent_id
        const response = await fetch(`${API_BASE}/api/articles/${props.articleId}/comments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`
          },
          body: JSON.stringify({
            content: replyForm.value.content,
            parent_id: parentId
          })
        })

        const result = await response.json()
        
        if (result.success) {
          // 优化用户体验：立即将新回复添加到对应的评论中
          const newReply = result.data
          // 找到所属主评论：如果回复的是主评论，直接命中；否则查找其所在的主评论
          let targetComment = comments.value.find(c => c.id === newReply.parent_id)
          if (!targetComment) {
            targetComment = comments.value.find(c => (c.replies || []).some(r => r.id === newReply.parent_id))
          }
          if (targetComment) {
            if (!targetComment.replies) targetComment.replies = []
            targetComment.replies.push(newReply)
            // 更新该主评论的可见回复数（新增后至少显示当前数量）
            const current = repliesVisibleCount.value[targetComment.id] || 0
            repliesVisibleCount.value[targetComment.id] = Math.min(current + 1, targetComment.replies.length)
          }
          
          replyForm.value = { content: '' }
          replyingTo.value = null
          totalComments.value = (totalComments.value || 0) + 1
          
          // 移除自动刷新，让回复持续显示在界面上
          // 用户可以通过分页或手动刷新获取最新数据
        } else {
          alert('回复失败: ' + result.message)
        }
      } catch (error) {
        alert('发表回复失败，请重试')
      } finally {
        submittingReply.value = false
      }
    }

    const toggleReply = (targetId) => {
      replyingTo.value = replyingTo.value === targetId ? null : targetId
      // 自动带上昵称：已废弃，由服务端从令牌获取昵称
    }

    const getVisibleReplies = (comment) => {
      const total = (comment.replies && Array.isArray(comment.replies)) ? comment.replies.length : 0
      const count = repliesVisibleCount.value[comment.id] ?? (total > 1 ? 1 : total)
      return (comment.replies || []).slice(0, count)
    }

    const expandReplies = (comment) => {
      const total = (comment.replies && Array.isArray(comment.replies)) ? comment.replies.length : 0
      const current = repliesVisibleCount.value[comment.id] ?? 0
      repliesVisibleCount.value[comment.id] = Math.min(current + 5, total)
    }

    const cancelReply = () => {
      replyingTo.value = null
      replyForm.value = { content: '' }
    }

    const onFormBlur = () => {
      if (!form.value.content.trim()) {
        formExpanded.value = false
      }
    }

    const changePage = (page) => {
      if (page >= 1 && page <= pagination.value.totalPages) {
        fetchComments(page)
      }
    }

    const formatDate = (dateString) => {
      const date = new Date(dateString)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    onMounted(() => {
      const cid = parseInt(route.query.commentId) || null
      const rid = parseInt(route.query.replyTo) || null
      if (cid) {
        pagination.value.limit = Math.max(pagination.value.limit, 100)
      }
      if (rid) {
        replyingTo.value = rid
      }
      fetchComments()
      fetchCommentStats()
    })

    watch(() => props.articleId, () => {
      fetchComments()
      fetchCommentStats()
    })

    const canDeleteComment = (c) => {
      if (!user.value) return false
      return !!(isAdmin.value || (c.user_id && c.user_id === user.value.id))
    }

    const deleteComment = async (c) => {
      if (!canDeleteComment(c)) { openAuthModal('prompt'); return }
      if (!confirm('确定删除该评论/回复吗？')) return
      try {
        const res = await fetch(`${API_BASE}/api/comments/${c.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } })
        const result = await res.json()
        if (result.success) {
          // 从本地移除
          comments.value = comments.value.map(cm => {
            if (cm.id === c.id) return null
            cm.replies = (cm.replies || []).filter(r => r.id !== c.id)
            return cm
          }).filter(Boolean)
          totalComments.value = Math.max(0, (totalComments.value || 0) - 1)
          if (!c.parent_id) {
            if (pagination.value && typeof pagination.value.total === 'number') {
              pagination.value.total = Math.max(0, pagination.value.total - 1)
              pagination.value.totalPages = Math.max(1, Math.ceil(pagination.value.total / (pagination.value.limit || 10)))
            }
          }
          alert('已删除')
        } else {
          alert(result.message || '删除失败')
        }
      } catch (e) { alert('删除失败，请重试') }
    }

    const toggleLike = async (c) => {
      if (!isLoggedIn.value) { openAuthModal('prompt'); return }
      try {
        const res = await fetch(`${API_BASE}/api/comments/${c.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } })
        const result = await res.json()
        if (result.success) {
          c.like_count = result.data.like_count
          c.liked_by_current_user = result.data.liked
        }
      } catch (e) {}
    }

    return {
      comments,
      totalComments,
      loading,
      sortBy,
      replyingTo,
      submitting,
      submittingReply,
      pagination,
      form,
      formExpanded,
      replyForm,
      fetchComments,
      submitComment,
      submitReply,
      toggleReply,
      getVisibleReplies,
      expandReplies,
      cancelReply,
      onFormBlur,
      changePage,
      formatDate,
      toggleLike,
      deleteComment,
      canDeleteComment
    }
  }
}
</script>

<style scoped>
.article-comments {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid var(--border-color);
}

.comments-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.comments-count {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
}

.sort-options {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sort-options select {
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--card-bg);
  color: var(--text-primary);
  cursor: pointer;
}

.comment-form {
  background: var(--bg-secondary);
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 2rem;
  border: 1px solid var(--border-color);
}

.comment-form h4 {
  margin-bottom: 1rem;
  color: var(--text-primary);
}

.form-group {
  margin-bottom: 1rem;
}

.form-input, .form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--card-bg);
  color: var(--text-primary);
  font-family: inherit;
}

.form-input:focus, .form-textarea:focus {
  outline: none;
  border-color: #667eea;
}

.char-count {
  text-align: right;
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

.submit-btn, .cancel-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
}

.submit-btn {
  background: #667eea;
  color: white;
}

.submit-btn:hover:not(:disabled) {
  background: #5a6fd8;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-btn {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.cancel-btn:hover {
  background: var(--border-color);
}

.comments-list {
  margin-top: 2rem;
}

.comment-item {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: var(--card-bg);
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.comment-item.has-replies {
  margin-bottom: 1rem;
}

.comment-main {
  margin-bottom: 1rem;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.user-name {
  font-weight: 600;
  color: var(--text-primary);
}

.comment-date, .reply-date {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.comment-content {
  line-height: 1.6;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.comment-actions {
  display: flex;
  gap: 1rem;
}

.reply-btn {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  padding: 0;
  font: inherit;
  line-height: inherit;
}

.reply-action-btn {
  border: 1px solid var(--brand);
  background: rgba(102,126,234,0.12);
  color: var(--brand);
  border-radius: 16px;
  padding: 0.25rem 0.8rem;
  cursor: pointer;
}
.reply-action-btn:hover { background: rgba(102,126,234,0.20); }

.reply-label { color: var(--text-primary); margin-right: 0.25rem; }

.like-btn {
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-primary);
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
}
.like-btn.liked { color: #e63946; border-color: #e63946; }

.delete-btn.small {
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
}

.reply-form {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px dashed var(--border-color);
}

.replies-list {
  margin-top: 1.5rem;
  margin-left: 2rem;
  padding-left: 1.5rem;
  border-left: 2px solid var(--border-color);
}

.reply-item {
  margin-bottom: 1rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.reply-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.reply-content {
  line-height: 1.6;
  color: var(--text-primary);
}

.reply-to {
  color: #667eea;
  margin-right: 0.5rem;
}

.comments-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.page-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-primary);
  border-radius: 4px;
  cursor: pointer;
}

.page-btn:hover:not(:disabled) {
  border-color: #667eea;
  color: #667eea;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.reply-more {
  margin-top: 0.75rem;
}

.view-more-btn {
  padding: 0.5rem 1rem;
  background: var(--card-bg);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.view-more-btn:hover {
  background: var(--border-color);
  transform: translateY(-1px);
}

.no-comments {
  text-align: center;
  padding: 3rem 2rem;
  color: var(--text-secondary);
}

.loading {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top: 3px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .comments-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .replies-list {
    margin-left: 1rem;
    padding-left: 1rem;
  }
  
  .comment-item {
    padding: 1rem;
  }
}
.comment-item.highlight-blink, .reply-item.highlight-blink { animation: blink-highlight 0.8s ease-in-out 2; }
@keyframes blink-highlight { 0% { background-color: rgba(255, 230, 150, 0.4); } 50% { background-color: rgba(255, 230, 150, 0.0); } 100% { background-color: rgba(255, 230, 150, 0.4); } }
</style>
