<template>
  <div class="article-detail" v-if="article">
    <div class="detail-header">
      <!-- 使用 router-link 确保能正常跳转 -->
      <router-link to="/" class="back-btn">← 返回列表</router-link>
      <div class="detail-actions">
        <!-- 添加导出按钮（未登录点击提示登录） -->
        <ArticleExport v-if="isLoggedIn" :article="article" />
        <button v-else class="edit-btn" @click="promptLogin">导出PDF</button>
        <button v-if="canEdit" @click="editArticle" class="edit-btn">✏️ 编辑</button>
        <button v-if="canDelete" @click="deleteArticle" class="delete-btn">🗑️ 删除</button>
      </div>
    </div>
    
    <article class="article">
      <header class="article-header">
        <h1>{{ article.title }}</h1>
        <div class="meta">
          <span class="author">作者: {{ article.author_nickname || article.author }}</span>
          <span class="date">发布时间: {{ formatDate(article.created_at) }}</span>
          <span class="views">
            👁️ {{ article.view_count }} 阅读
          </span>
          <span class="comments-count">
            💬 {{ article.comment_count || 0 }}
          </span>
          <span class="updated" v-if="article.updated_at !== article.created_at">
            最近编辑: {{ formatDate(article.updated_at) }}
          </span>
        </div>
        <div class="tags" v-if="article.tags && article.tags.length > 0">
          <span 
            v-for="tag in article.tags" 
            :key="tag" 
            class="tag"
            @click="navigateToTag(tag)"
          >
            {{ tag }}
          </span>
        </div>
      </header>
      
      <!-- 文章内容区域 -->
      <div class="content-section">
        <div class="content" v-html="formatContent(article.content)"></div>
        
        <!-- 文章统计信息 -->
        <div class="article-stats">
          <div class="stats-grid">
            
            <div class="stat-item" @click="scrollToComments" style="cursor:pointer">
              <div class="stat-icon">💬</div>
              <div class="stat-content">
                <div class="stat-label">评论</div>
                <div class="stat-value">{{ article.comment_count || 0 }}</div>
              </div>
            </div>

            <div class="stat-item like" @click="toggleLikeArticle" :class="{ liked: article.liked_by_current_user }" style="cursor:pointer">
              <div class="stat-icon">👍</div>
              <div class="stat-content">
                <div class="stat-label">点赞</div>
                <div class="stat-value">{{ article.like_count || 0 }}</div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <footer class="article-footer">
        <div class="actions">
          <button v-if="canEdit" @click="editArticle" class="action-btn edit">
            ✏️ 编辑文章
          </button>
          <button v-if="canDelete" @click="deleteArticle" class="action-btn delete">
            🗑️ 删除文章
          </button>
          <router-link to="/" class="action-btn back">
            📄 返回列表
          </router-link>
          <button @click="shareArticle" class="action-btn share">
            🔗 分享文章
          </button>
        </div>
      </footer>
    </article>

    <!-- 相关文章推荐（置于评论之前） -->
    <RelatedArticles 
      :current-article-id="article.id"
      :current-article-tags="article.tags"
      :max-articles="3"
    />

    <!-- 评论组件 -->
    <ArticleComments :article-id="article.id" />

  </div>
  <div v-else-if="loading" class="loading">
    <div class="loading-spinner"></div>
    <p>加载中...</p>
  </div>
  <div v-else class="error">
    <h2>文章不存在</h2>
    <p>抱歉，您访问的文章不存在或已被删除。</p>
    <router-link to="/" class="back-link">返回文章列表</router-link>
  </div>
</template>

<script>
import { ref, onMounted, watch, computed, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import ArticleComments from './ArticleComments.vue'
import ArticleExport from './ArticleExport.vue'
import RelatedArticles from './RelatedArticles.vue'
import { useAuth } from '../composables/useAuth'

export default {
  name: 'ArticleDetail',
  components: {
    ArticleComments,
    ArticleExport,
    RelatedArticles
  },
  props: ['id'],
  setup(props) {
    const article = ref(null)
    const loading = ref(true)
    const route = useRoute()
    const router = useRouter()
    const { isLoggedIn, isAdmin, user, openAuthModal } = useAuth()
    const isAuthor = computed(() => !!article.value && !!user.value && article.value.author === user.value.user_id)
    const canEdit = computed(() => !!article.value && isAuthor.value)
    const canDelete = computed(() => !!article.value && (isAuthor.value || isAdmin.value))
    const promptLogin = () => { openAuthModal('prompt') }
    
    // 优先使用props中的id（SSR注入），如果没有则使用路由参数
    const articleId = ref(props.id || route.params.id)

    const injected = inject('initialData', null)
    const checkSSRData = () => {
      if (injected && injected.data && injected.data.article) {
        article.value = injected.data.article
        loading.value = false
        return true
      }
      if (injected && injected.error) {
        article.value = null
        loading.value = false
        return true
      }
      if (typeof window !== 'undefined' && window.__INITIAL_DATA__) {
        if (window.__INITIAL_DATA__.data && window.__INITIAL_DATA__.data.article) {
          article.value = window.__INITIAL_DATA__.data.article
          loading.value = false
          return true
        }
        if (window.__INITIAL_DATA__.error) {
          article.value = null
          loading.value = false
          return true
        }
      }
      return false
    }

    checkSSRData()



    const navigateToTag = (tag) => {
      router.push(`/?search=${encodeURIComponent(tag)}&searchType=tags`)
    }

    const fetchArticle = async () => {
      try {
        loading.value = true
        
        const response = await fetch(`/api/articles/${articleId.value}`)
        const result = await response.json()
        
        if (result.success) {
          article.value = result.data
          
          // 更新页面标题
          document.title = `${article.value.title} - 星云博客系统`
        } else {
          article.value = null
        }
      } catch (error) {
        article.value = null
      } finally {
        loading.value = false
      }
    }

    const formatDate = (dateString) => {
      if (!dateString) return ''
      const date = new Date(dateString)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    }

    const formatContent = (content) => {
      if (!content) return ''
      if (typeof window === 'undefined') {
        if (article.value && article.value.editor_type === 'markdown') {
          return marked.parse(content)
        }
        return content
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;')
          .replace(/\n/g, '<br>')
          .replace(/\r/g, '')
      }
      if (article.value && article.value.editor_type === 'markdown') {
        const raw = marked.parse(content)
        return DOMPurify.sanitize(raw)
      }
      return content
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\n/g, '<br>')
        .replace(/\r/g, '')
    }

    const editArticle = () => {
      if (!isLoggedIn.value) { openAuthModal('prompt'); return }
      if (!canEdit.value) { alert('无权限'); return }
      if (article.value && article.value.id) {
        router.push(`/edit/${article.value.id}`)
      }
    }

    const deleteArticle = async () => {
      if (!article.value) return
      if (!isLoggedIn.value) { openAuthModal('prompt'); return }
      if (!canDelete.value) { alert('无权限'); return }

      if (!confirm(`确定要删除文章《${article.value.title}》吗？此操作不可恢复！`)) {
        return
      }

      try {
        const response = await fetch(`/api/articles/${articleId.value}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`
          }
        })
        const result = await response.json()

        if (result.success) {
          alert('文章删除成功！')
          window.dispatchEvent(new Event('tags-refresh'))
          router.push('/')
        } else {
          alert('删除失败: ' + result.message)
        }
      } catch (error) {
        alert('删除失败，请重试')
      }
    }

    const shareArticle = () => {
      const url = window.location.href
      navigator.clipboard.writeText(url)
        .then(() => { alert('文章链接已复制到剪贴板！\n\n' + url) })
        .catch(() => { prompt('请复制以下链接分享给朋友：', url) })
    }

    const scrollToComments = () => {
      const el = document.querySelector('.article-comments')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    const toggleLikeArticle = async () => {
      if (!isLoggedIn.value) { openAuthModal('prompt'); return }
      try {
        const res = await fetch(`/api/articles/${articleId.value}/like`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } })
        const result = await res.json()
        if (result.success) {
          article.value.like_count = result.data.like_count
          article.value.liked_by_current_user = result.data.liked
        }
      } catch (e) {}
    }

    onMounted(() => {
      
      // 先检查SSR数据
      const hasSSRData = checkSSRData()
      
      // 如果没有SSR数据，则从API获取
      if (!hasSSRData) {
        fetchArticle()
      }
    })

    // 监听路由参数变化
    watch(() => route.params.id, (newId) => {
      if (newId && newId !== articleId.value) {
        articleId.value = newId
        article.value = null
        loading.value = true
        fetchArticle()
      }
    })

    return {
      article,
      loading,
      formatDate,
      formatContent,
      editArticle,
      deleteArticle,
      shareArticle,
      navigateToTag,
      canEdit,
      canDelete,
      isLoggedIn,
      isAdmin,
      promptLogin,
      scrollToComments,
      toggleLikeArticle
    }
  }
}
</script>

<style scoped>
.article-detail {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--border-color);
}

.back-btn {
  background: #6c757d;
  color: white;
  text-decoration: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: none;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(108, 117, 125, 0.2);
}

.back-btn:hover {
  background: #5a6268;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(108, 117, 125, 0.3);
}

.detail-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.edit-btn, .delete-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.edit-btn {
  background: #3498db;
  color: white;
}

.edit-btn:hover {
  background: #2980b9;
  transform: translateY(-1px);
}

.delete-btn {
  background: #e74c3c;
  color: white;
}

.delete-btn:hover {
  background: #c0392b;
  transform: translateY(-1px);
}

.article {
  background: var(--card-bg);
  padding: 3rem;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  margin-bottom: 2rem;
  border: 1px solid var(--border-color);
}

.article-header {
  border-bottom: 2px solid var(--border-color);
  padding-bottom: 2rem;
  margin-bottom: 2rem;
}

.article-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  line-height: 1.3;
  margin-bottom: 1.5rem;
  background: linear-gradient(135deg, var(--brand), var(--brand-2));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.meta {
  display: flex;
  gap: 2rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.meta span {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.comments-count {
  color: #667eea;
  font-weight: 600;
}

.tags {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tag {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.tag:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
}

.content-section {
  margin: 2rem 0;
}

.content {
  line-height: 1.8;
  font-size: 1.1rem;
  color: var(--text-primary);
  min-height: 300px;
  word-break: break-word;
}

.content h2, .content h3, .content h4 {
  color: var(--text-primary);
  margin: 1.5rem 0 1rem;
}

.content pre {
  background: var(--bg-secondary);
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  border: 1px solid var(--border-color);
}

.content code {
  background: var(--bg-secondary);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
}

.content blockquote {
  border-left: 4px solid var(--border-color);
  padding-left: 1rem;
  color: var(--text-secondary);
}

.content a {
  color: var(--brand);
}

.content a:hover {
  color: var(--brand-2);
}

.content :deep(br) {
  margin-bottom: 1rem;
  display: block;
}

.article-stats {
  margin: 3rem 0;
  padding: 2rem;
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--card-bg);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.stat-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  font-size: 1.5rem;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border-radius: 10px;
}

.stat-item.like .stat-icon { background: var(--card-bg); color: var(--text-primary); }
@media (prefers-color-scheme: dark) { .stat-item.like .stat-icon { background: #777; } }
.stat-item.like.liked .stat-label, .stat-item.like.liked .stat-value { color: var(--brand); }
.stat-item.like.liked .stat-icon { box-shadow: 0 0 0 2px var(--brand) inset; }

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--text-primary);
}

.article-footer {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid var(--border-color);
}

.actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.action-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  text-decoration: none;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.action-btn.edit {
  background: #3498db;
  color: white;
}

.action-btn.delete {
  background: #e74c3c;
  color: white;
}

.action-btn.back {
  background: #6c757d;
  color: white;
}

.action-btn.share {
  background: #2ecc71;
  color: white;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.loading {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-secondary);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--border-color);
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-secondary);
}

.error h2 {
  color: #e74c3c;
  margin-bottom: 1rem;
}

.back-link {
  display: inline-block;
  margin-top: 1rem;
  padding: 0.75rem 1.5rem;
  background: #3498db;
  color: white;
  text-decoration: none;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.back-link:hover {
  background: #2980b9;
  transform: translateY(-1px);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .article {
    padding: 2rem 1.5rem;
  }
  
  .article-header h1 {
    font-size: 2rem;
  }
  
  .meta {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .detail-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
  
  .detail-actions {
    width: 100%;
    justify-content: space-between;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .stat-item {
    flex-direction: column;
    text-align: center;
    gap: 0.5rem;
  }
  
  .stat-icon {
    width: 40px;
    height: 40px;
    font-size: 1.2rem;
  }
  
  .actions {
    flex-direction: column;
  }
  
  .action-btn {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .tag {
    font-size: 0.7rem;
    padding: 0.4rem 0.8rem;
  }
}
</style>
