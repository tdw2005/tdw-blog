<template>
  <div class="related-articles" v-if="filteredArticles.length > 0">
    <h3 class="related-title">
      <span class="title-icon">📚</span>
      相关文章推荐
    </h3>
    
    <div class="articles-container">
      <div 
        v-for="article in filteredArticles" 
        :key="article.id" 
        class="related-article-card"
        @click="goToArticle(article.id)"
      >
        <!-- 文章缩略信息 -->
        <div class="article-header">
          <h4 class="article-title">{{ article.title }}</h4>
          <div class="article-meta">
            <span class="meta-item">
              <span class="meta-icon">👤</span>
              {{ shortAuthor(article.author_nickname || article.author) }}
            </span>
            <span class="meta-item">
              <span class="meta-icon">📅</span>
              {{ formatDate(article.created_at) }}
            </span>
            <span v-if="article.view_count" class="meta-item">
              <span class="meta-icon">👁️</span>
              {{ article.view_count }}
            </span>
            <span class="meta-item">
              <span class="meta-icon">👍</span>
              {{ article.like_count || 0 }}
            </span>
            <span class="meta-item">
              <span class="meta-icon">💬</span>
              {{ article.comment_count || 0 }}
            </span>
          </div>
        </div>
        
        <!-- 文章摘要 -->
        <div class="article-excerpt">
          {{ getArticleExcerpt(article) }}
        </div>
        
        <!-- 文章标签 -->
        <div v-if="article.tags && article.tags.length > 0" class="article-tags">
          <span 
            v-for="tag in article.tags.slice(0, 3)" 
            :key="tag" 
            class="tag"
            @click.stop="navigateToTag(tag)"
          >
            {{ tag }}
          </span>
          <span v-if="article.tags.length > 3" class="tag-more">
            +{{ article.tags.length - 3 }}
          </span>
        </div>
        
        <!-- 阅读按钮 -->
        <div class="article-footer">
          <button 
            @click.stop="goToArticle(article.id)" 
            class="read-btn"
          >
            阅读全文 →
          </button>
        </div>
      </div>
    </div>
    
    <!-- 查看更多 -->
    <div v-if="hasMoreArticles" class="view-more">
      <button @click="visibleCount = Math.min(visibleCount + maxArticles, totalRelatedArticles)" class="view-more-btn">
        查看更多相关文章 ({{ totalRelatedArticles - visibleCount }})
      </button>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'

export default {
  name: 'RelatedArticles',
  props: {
    currentArticleId: {
      type: [String, Number],
      required: true
    },
    currentArticleTags: {
      type: Array,
      default: () => []
    },
    maxArticles: {
      type: Number,
      default: 3
    }
  },
  setup(props) {
    const router = useRouter()
    const articles = ref([])
    const loading = ref(false)
    const visibleCount = ref(props.maxArticles)
    const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
    
    const shortAuthor = (name) => {
      const n = typeof name === 'string' ? name : String(name || '')
      const limit = 8
      return n.length > limit ? n.slice(0, limit) + '…' : n
    }
    
    // 获取相关文章
    const fetchRelatedArticles = async () => {
      loading.value = true
      try {
        const response = await fetch(`${API_BASE}/api/articles/${props.currentArticleId}/related?limit=10`)
        const result = await response.json()
        
        if (result.success) {
          articles.value = result.data.articles
        }
      } catch (error) {
        // 错误处理
      } finally {
        loading.value = false
      }
    }
    
    // 过滤掉当前文章并限制数量
    const filteredArticles = computed(() => {
      return articles.value
        .filter(article => article.id !== props.currentArticleId)
        .slice(0, visibleCount.value)
    })
    
    // 相关文章总数
    const totalRelatedArticles = computed(() => {
      return articles.value.filter(article => article.id !== props.currentArticleId).length
    })
    
    // 是否还有更多文章
    const hasMoreArticles = computed(() => {
      return totalRelatedArticles.value > visibleCount.value
    })
    
    // 获取文章摘要
    const getArticleExcerpt = (article) => {
      if (article.excerpt) {
        return article.excerpt.length > 80 
          ? article.excerpt.substring(0, 80) + '...' 
          : article.excerpt
      }
      
      if (article.content) {
        // 移除HTML标签
        const plainText = article.content.replace(/<[^>]*>/g, '')
        return plainText.length > 80 
          ? plainText.substring(0, 80) + '...' 
          : plainText
      }
      
      return '暂无摘要'
    }
    
    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return ''
      const date = new Date(dateString)
      const now = new Date()
      const diffMs = now - date
      const diffDays = Math.floor(diffMs / 86400000)
      
      if (diffDays < 1) return '今天'
      if (diffDays < 7) return `${diffDays}天前`
      
      return date.toLocaleDateString('zh-CN', {
        month: '2-digit',
        day: '2-digit'
      })
    }
    
    // 跳转到文章
    const goToArticle = (articleId) => {
      router.push(`/article/${articleId}`)
    }
    
    // 跳转到标签
    const navigateToTag = (tag) => {
      router.push(`/?search=${encodeURIComponent(tag)}&searchType=tags`)
    }
    
    onMounted(() => {
      fetchRelatedArticles()
    })
    
    // 监听当前文章ID变化
    watch(() => props.currentArticleId, () => {
      fetchRelatedArticles()
      visibleCount.value = props.maxArticles
    })
    
    return {
      articles,
      loading,
      visibleCount,
      filteredArticles,
      totalRelatedArticles,
      hasMoreArticles,
      getArticleExcerpt,
      formatDate,
      goToArticle,
      navigateToTag,
      shortAuthor
    }
  }
}
</script>

<style scoped>
.related-articles {
  margin: 3rem 0;
  padding: 2rem;
  background: var(--bg-secondary);
  border-radius: 16px;
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.related-title {
  color: var(--text-primary);
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.title-icon {
  font-size: 1.2rem;
}

.articles-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

@media (max-width: 768px) {
  .articles-container {
    grid-template-columns: 1fr;
  }
}

.related-article-card {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 1.5rem;
  transition: all 0.3s ease;
  border: 1px solid var(--border-color);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.related-article-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.related-article-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  border-color: #667eea;
}

.related-article-card:hover::before {
  opacity: 1;
}

.article-header {
  margin-bottom: 1rem;
}

.article-title {
  color: var(--text-primary);
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: 0.5rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.article-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.meta-icon {
  opacity: 0.7;
}

.article-excerpt {
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
  margin-bottom: 1rem;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.article-tags {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.tag {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.3s ease;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.tag:hover {
  background: var(--text-primary);
  transform: translateY(-1px);
}

.tag-more {
  background: var(--border-color);
  color: var(--text-secondary);
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.article-footer {
  margin-top: auto;
}

.read-btn {
  width: 100%;
  padding: 0.75rem 1rem;
  background: transparent;
  color: #667eea;
  border: 1px solid #667eea;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.read-btn:hover {
  background: #667eea;
  color: white;
}

.view-more {
  text-align: center;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-color);
}

.view-more-btn {
  padding: 0.75rem 1.5rem;
  background: var(--card-bg);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.3s ease;
}

.view-more-btn:hover {
  background: var(--border-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

/* 加载状态 */
.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 3rem;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top: 3px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 3rem 2rem;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-text {
  font-size: 1rem;
  margin-bottom: 1rem;
}

.discover-btn {
  padding: 0.75rem 1.5rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.3s ease;
}

.discover-btn:hover {
  background: #5a6fd8;
  transform: translateY(-2px);
}

/* 暗色主题调整 */
.dark .related-article-card {
  background: var(--card-bg);
  border-color: #495057;
}

.dark .read-btn {
  border-color: #667eea;
}

.dark .view-more-btn {
  background: var(--card-bg);
  border-color: #495057;
}

.dark .view-more-btn:hover {
  background: #495057;
}

/* 动画效果 */
.related-article-card {
  animation: fadeInUp 0.5s ease forwards;
  opacity: 0;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 为每个卡片添加延迟动画 */
.related-article-card:nth-child(1) { animation-delay: 0.1s; }
.related-article-card:nth-child(2) { animation-delay: 0.2s; }
.related-article-card:nth-child(3) { animation-delay: 0.3s; }
.related-article-card:nth-child(4) { animation-delay: 0.4s; }
.related-article-card:nth-child(5) { animation-delay: 0.5s; }
</style>
