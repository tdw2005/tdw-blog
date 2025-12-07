<template>
  <div class="article-list">
  <div class="page-header">
    <h1>博客文章</h1>
    <div class="header-actions">
        <button class="create-btn" @click="handleCreate">写文章</button>
        <button v-if="isAdmin" class="backup-btn" @click="openBackup">数据备份</button>
    </div>
  </div>

    <!-- 标签云 -->
    <TagCloud :articles="articles" />

    <!-- 搜索和筛选区域 -->
    <div class="search-filter">
      <!-- 搜索框 -->
      <div class="search-box">
        <input 
          type="text" 
          v-model="searchKeyword"
          placeholder="搜索文章..."
          @input="handleSearch"
          class="search-input"
        >
        <select v-model="searchType" @change="handleSearch" class="search-type">
          <option value="title">按标题</option>
          <option value="content">按内容</option>
          <option value="author">按作者</option>
          <option value="tags">按标签</option>
        </select>
      </div>

      <!-- 标签筛选 -->
      <div class="tag-filter">
        <span class="filter-label">标签筛选:</span>
        <div class="tag-options">
          <button 
            v-for="tag in availableTags" 
            :key="tag"
            @click="toggleTagFilter(tag)"
            :class="{ 
              'tag-option': true, 
              'active': selectedTags.includes(tag) 
            }"
          >
            {{ tag }}
          </button>
        </div>
        <button 
          v-if="selectedTags.length > 0"
          @click="clearTagFilter"
          class="clear-filter-btn"
        >
          清除筛选
        </button>
      </div>

      <!-- 排序选项 -->
      <div class="sort-options">
        <span class="filter-label">排序:</span>
        <div class="sort-controls">
          <button 
            class="sort-pill" 
            :class="{ active: sortField === 'created_at' }"
            @click="setSort('created_at')"
          >按时间</button>
          <button 
            class="sort-pill" 
            :class="{ active: sortField === 'view_count' }"
            @click="setSort('view_count')"
          >按阅读量</button>
          <button 
            class="sort-pill" 
            :class="{ active: sortField === 'like_count' }"
            @click="setSort('like_count')"
          >按点赞数</button>
          <button 
            class="order-toggle" 
            @click="toggleOrder" 
            :title="sortOrder === 'asc' ? '正序' : '倒序'"
          >{{ sortOrder === 'asc' ? '↑ 正序' : '↓ 倒序' }}</button>
        </div>
      </div>
    </div>

    <!-- 批量模式切换按钮（位于搜索组件之下、文章之上，靠右） -->
    <div class="batch-toggle-bar">
      <button 
        v-if="isAdmin" 
        @click="toggleBatchMode" 
        class="batch-btn" 
        :class="{ active: batchMode }"
      >
        {{ batchMode ? '取消批量' : '批量删除' }}
      </button>
    </div>

    

    <!-- 搜索状态提示 -->
    <div v-if="isSearching" class="search-status">
      <span v-if="searchKeyword">
        搜索"{{ searchKeyword }}" ({{ searchType }}) 
      </span>
      <span v-if="selectedTags.length > 0">
        标签: {{ selectedTags.join(', ') }}
      </span>
      <button v-if="isSearching" @click="clearSearch" class="clear-search-btn">
        清除搜索
      </button>
    </div>

    <!-- 批量操作栏 -->
    <div v-if="batchMode && selectedArticles.length > 0" class="batch-actions">
      <span>已选择 {{ selectedArticles.length }} 篇文章</span>
      <button @click="batchDelete" class="batch-delete-btn">
        批量删除
      </button>
    </div>
    
    <div class="articles">
      <div 
        v-for="article in articles" 
        :key="article.id" 
        class="article-card"
        :class="{ selected: isSelected(article.id) }"
      >
        <div class="article-main" @click="goToDetail(article.id)">
          <h2>{{ article.title }}</h2>
          <p class="excerpt">{{ article.excerpt }}</p>
          <div class="meta">
            <span class="author">作者: {{ shortAuthor(article.author_nickname || article.author) }}</span>
            <span class="date">
              <template v-if="article.updated_at && article.updated_at !== article.created_at">
                最近编辑: {{ formatDate(article.updated_at) }}
              </template>
              <template v-else>
                发布时间: {{ formatDate(article.created_at) }}
              </template>
            </span>
            <span class="views">阅读: {{ article.view_count }}</span>
            <span class="likes">点赞: {{ article.like_count || 0 }}</span>
            <span class="comments">评论: {{ article.comment_count || 0 }}</span>
          </div>
          <div class="tags">
            <span 
              v-for="tag in article.tags" 
              :key="tag" 
              class="tag"
            >
              {{ tag }}
            </span>
          </div>
        </div>
        
        <div class="article-actions">
          <!-- 批量模式显示复选框 -->
          <label v-if="batchMode" class="checkbox-container">
            <input 
              type="checkbox" 
              :checked="isSelected(article.id)"
              @change="toggleSelect(article.id)"
            >
            <span class="checkmark"></span>
          </label>
          
          <!-- 非批量模式显示删除按钮 -->
          <button 
            v-else-if="isAdmin"
            @click.stop="deleteArticle(article.id, article.title)"
            class="delete-btn"
            title="删除文章"
          >
            🗑️ 删除
          </button>
        </div>
      </div>
    </div>

    <!-- 无结果提示 -->
    <div v-if="articles.length === 0 && !loading" class="no-results">
      <p v-if="isSearching">没有找到符合条件的文章</p>
      <p v-else>暂无文章，<router-link to="/create">创建第一篇</router-link></p>
    </div>

    <!-- 分页组件 -->
    <div class="pagination" v-if="pagination.totalPages > 1 && articles.length > 0">
      <button 
        @click="changePage(pagination.page - 1)"
        :disabled="pagination.page === 1"
        class="page-btn"
      >
        上一页
      </button>
      
      <button 
        v-for="page in getPageNumbers()" 
        :key="page"
        @click="changePage(page)"
        :class="{ 
          'page-btn': true, 
          'active': pagination.page === page,
          'ellipsis': page === '...'
        }"
        :disabled="page === '...'"
      >
        {{ page }}
      </button>
      
      <button 
        @click="changePage(pagination.page + 1)"
        :disabled="pagination.page === pagination.totalPages"
        class="page-btn"
      >
        下一页
      </button>

      <!-- 跳转到指定页面 -->
      <div class="page-jump">
        <span class="jump-label">跳转到</span>
        <input 
          type="number" 
          v-model.number="jumpPage" 
          :min="1" 
          :max="pagination.totalPages"
          @keyup.enter="jumpToPage"
          class="jump-input"
          placeholder="页"
        >
        <span class="jump-label">页</span>
        <button 
          @click="jumpToPage"
          :disabled="!jumpPage || jumpPage < 1 || jumpPage > pagination.totalPages"
          class="jump-btn"
        >
          跳转
        </button>
      </div>
    </div>

    <div class="pagination-info" v-if="pagination.total > 0">
      第 {{ pagination.page }} 页，共 {{ pagination.totalPages }} 页，总计 {{ pagination.total }} 篇文章
    </div>
    <div v-if="showBackup" class="backup-overlay" @click.self="closeBackup">
      <div class="backup-panel">
        <div class="backup-header">
          <h3>数据备份</h3>
          <button class="close-btn" @click="closeBackup">×</button>
        </div>
        <div class="backup-actions">
          <button class="export-btn" :disabled="backupLoading" @click="createBackup">
            {{ backupLoading ? '正在导出…' : '导出为备份文件' }}
          </button>
          <label class="import-label">
            <input type="file" accept="application/json" @change="onFileChange" hidden>
            <span class="import-btn">选择备份文件</span>
          </label>
          <button class="import-btn-primary" :disabled="!selectedFile || importing" @click="importBackup">
            {{ importing ? '正在导入…' : '导入备份' }}
          </button>
        </div>
        <div class="backup-list">
          <h4>现有备份</h4>
          <div v-if="backups.length === 0" class="empty-tip">暂无备份</div>
          <ul v-else>
            <li v-for="b in backups" :key="b.id" class="backup-item">
              <div class="backup-meta">
                <div class="id">ID: {{ b.id }}</div>
                <div class="time">创建: {{ (b.timestamp || b.mtime) }}</div>
                <div class="size">大小: {{ (b.size / 1024).toFixed(1) }} KB</div>
              </div>
              <div class="backup-item-actions">
                <button class="download-btn" @click="downloadBackup(b.id)">下载</button>
                <button class="delete-btn" @click="deleteBackup(b.id)">删除</button>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch, computed, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TagCloud from './TagCloud.vue'
import { useAuth } from '../composables/useAuth'

export default {
  name: 'ArticleList',
  components: {
    TagCloud
  },
  setup() {
    const { isLoggedIn, isAdmin, openAuthModal } = useAuth()
    const articles = ref([])
    const pagination = ref({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0
    })
    const batchMode = ref(false)
    const selectedArticles = ref([])
    const searchKeyword = ref('')
    const searchType = ref('title')
    const selectedTags = ref([])
    const globalTagNames = ref([])
    const sortField = ref('created_at')
    const sortOrder = ref('desc')
    const loading = ref(false)
    const jumpPage = ref('')
    const route = useRoute()
    const router = useRouter()

    const token = () => localStorage.getItem('token') || ''
    const showBackup = ref(false)
    const backups = ref([])
    const backupLoading = ref(false)
    const selectedFile = ref(null)
    const importing = ref(false)

    const openBackup = async () => {
      showBackup.value = true
      await fetchBackups()
    }

    const closeBackup = () => {
      showBackup.value = false
      selectedFile.value = null
    }

    const fetchBackups = async () => {
      try {
        const res = await fetch('/api/backup/list', { headers: { Authorization: `Bearer ${token()}` } })
        const data = await res.json()
        backups.value = Array.isArray(data.data) ? data.data : []
      } catch {}
    }

    const createBackup = async () => {
      backupLoading.value = true
      try {
        const res = await fetch('/api/backup/create', { method: 'POST', headers: { Authorization: `Bearer ${token()}` } })
        const r = await res.json()
        if (r.success && r.data && r.data.backupId) {
          await fetchBackups()
          alert('备份创建成功')
        } else {
          alert(r.message || '备份创建失败')
        }
      } catch {
        alert('备份创建失败')
      } finally {
        backupLoading.value = false
      }
    }

    const downloadBackup = async (id) => {
      try {
        const res = await fetch(`/api/backup/download/${id}`, { headers: { Authorization: `Bearer ${token()}` } })
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${id}.json`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      } catch {}
    }

    const deleteBackup = async (id) => {
      if (!confirm('确定删除该备份吗？')) return
      try {
        const res = await fetch(`/api/backup/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } })
        const r = await res.json()
        if (r.success) { await fetchBackups(); } else { alert(r.message || '删除失败') }
      } catch {}
    }

    const onFileChange = (e) => {
      const f = e.target.files && e.target.files[0]
      selectedFile.value = f || null
    }

    const importBackup = async () => {
      if (!selectedFile.value) return
      importing.value = true
      try {
        const text = await selectedFile.value.text()
        const json = JSON.parse(text)
        const res = await fetch('/api/backup/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
          body: JSON.stringify(json)
        })
        const r = await res.json()
        if (r.success) { alert('导入成功'); closeBackup(); location.reload(); } else { alert(r.message || '导入失败') }
      } catch {
        alert('导入失败，请确认文件格式正确')
      } finally {
        importing.value = false
      }
    }

    const injected = inject('initialData', null)
    if (injected && injected.route === '/' && injected.data && Array.isArray(injected.data.articles)) {
      articles.value = injected.data.articles
      pagination.value = {
        page: 1,
        limit: pagination.value.limit,
        total: injected.data.articles.length,
        totalPages: 1
      }
    }
    const isSearching = computed(() => {
      return searchKeyword.value !== '' || selectedTags.value.length > 0
    })

    const availableTags = computed(() => {
      if (globalTagNames.value.length > 0) {
        return [...new Set(globalTagNames.value)].sort()
      }
      const allTags = articles.value.flatMap(article => article.tags || [])
      return [...new Set(allTags)].sort()
    })

    const fetchGlobalTags = async () => {
      try {
        const res = await fetch('/api/tags')
        const data = await res.json()
        if (data && data.success && data.data && Array.isArray(data.data.tags)) {
          globalTagNames.value = data.data.tags.map(t => t.name)
        }
      } catch (e) {}
    }

    const fetchArticles = async (page = 1) => {
      loading.value = true
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: pagination.value.limit.toString()
        })

        if (searchKeyword.value) {
          params.append('search', searchKeyword.value)
          params.append('searchType', searchType.value)
        }

        if (selectedTags.value.length > 0) {
          params.append('tags', selectedTags.value.join(','))
        }

        params.append('sortBy', sortField.value)
        params.append('sortOrder', sortOrder.value)

        const response = await fetch(`/api/articles?${params}`)
        const result = await response.json()
        
        if (result.success) {
          articles.value = result.data.articles
          pagination.value = {
            ...result.data.pagination,
            limit: pagination.value.limit
          }
          selectedArticles.value = []
        }
      } catch (error) {
        // 错误处理
      } finally {
        loading.value = false
      }
    }

    const changePage = (page) => {
      if (page < 1 || page > pagination.value.totalPages || page === pagination.value.page) {
        return
      }
      pagination.value.page = page
      fetchArticles(page)
      router.push({ query: { page } })
    }

    const jumpToPage = () => {
      if (!jumpPage.value || jumpPage.value < 1 || jumpPage.value > pagination.value.totalPages) {
        return
      }
      changePage(parseInt(jumpPage.value))
      jumpPage.value = ''
    }

    let searchTimeout
    const handleSearch = () => {
      clearTimeout(searchTimeout)
      searchTimeout = setTimeout(() => {
        pagination.value.page = 1
        fetchArticles(1)
      }, 300)
    }

    const toggleTagFilter = (tag) => {
      const index = selectedTags.value.indexOf(tag)
      if (index > -1) {
        selectedTags.value.splice(index, 1)
      } else {
        selectedTags.value.push(tag)
      }
      pagination.value.page = 1
      fetchArticles(1)
    }

    const clearTagFilter = () => {
      selectedTags.value = []
      fetchArticles(1)
    }

    const clearSearch = () => {
      searchKeyword.value = ''
      selectedTags.value = []
      sortField.value = 'created_at'
      sortOrder.value = 'desc'
      pagination.value.page = 1
      fetchArticles(1)
    }

    const setSort = (field) => {
      sortField.value = field
      pagination.value.page = 1
      fetchArticles(1)
    }

    const toggleOrder = () => {
      sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
      pagination.value.page = 1
      fetchArticles(1)
    }

    const getPageNumbers = () => {
      const current = pagination.value.page
      const total = pagination.value.totalPages
      const delta = 2
      const range = []
      const rangeWithDots = []

      for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
          range.push(i)
        }
      }

      let prev
      for (let i of range) {
        if (prev) {
          if (i - prev === 2) {
            rangeWithDots.push(prev + 1)
          } else if (i - prev !== 1) {
            rangeWithDots.push('...')
          }
        }
        rangeWithDots.push(i)
        prev = i
      }

      return rangeWithDots
    }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('zh-CN')
  }

  const shortAuthor = (name) => {
    const n = typeof name === 'string' ? name : String(name || '')
    const limit = 8
    return n.length > limit ? n.slice(0, limit) + '…' : n
  }

    const goToDetail = (id) => {
      if (!batchMode.value) {
        router.push(`/article/${id}`)
      }
    }

    const toggleBatchMode = () => {
      batchMode.value = !batchMode.value
      selectedArticles.value = []
    }

    const handleCreate = () => {
      if (!isLoggedIn.value) {
        openAuthModal('prompt')
        return
      }
      router.push('/create')
    }

    const toggleSelect = (id) => {
      const index = selectedArticles.value.indexOf(id)
      if (index > -1) {
        selectedArticles.value.splice(index, 1)
      } else {
        selectedArticles.value.push(id)
      }
    }

    const isSelected = (id) => {
      return selectedArticles.value.includes(id)
    }

    const deleteArticle = async (id, title) => {
    if (!confirm(`确定要删除文章《${title}》吗？此操作不可恢复！`)) {
        return
    }

    try {
        const response = await fetch(`/api/articles/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
        })
        const result = await response.json()

        if (result.success) {
            alert('文章删除成功！')
            fetchArticles(pagination.value.page)
        } else {
            alert('删除失败: ' + result.message)
        }
    } catch (error) {
        alert('删除失败，请重试')
     }
    }

    const batchDelete = async () => {
    if (selectedArticles.value.length === 0) {
        alert('请先选择要删除的文章')
        return
    }

    if (!confirm(`确定要删除选中的 ${selectedArticles.value.length} 篇文章吗？此操作不可恢复！`)) {
        return
    }

    try {
        const res = await fetch('/api/articles/batch-delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`
          },
          body: JSON.stringify({ ids: selectedArticles.value })
        })
        const result = await res.json()
        if (result.success) {
          alert(`成功删除 ${result.data.deleted} 篇文章！`)
          batchMode.value = false
          selectedArticles.value = []
          fetchArticles(pagination.value.page)
        } else {
          alert(result.message || '批量删除失败，请重试')
        }
    } catch (error) {
        alert('批量删除失败，请重试')
    }
}

    onMounted(() => {
      const page = parseInt(route.query.page) || 1
      if (articles.value.length === 0) {
        fetchArticles(page)
      }
      fetchGlobalTags()
    })

    watch(() => route.query.page, (newPage) => {
      const page = parseInt(newPage) || 1
      if (page !== pagination.value.page) {
        fetchArticles(page)
      }
    })

    return {
      articles,
      pagination,
      batchMode,
      selectedArticles,
      searchKeyword,
      searchType,
      selectedTags,
      sortField,
      sortOrder,
      loading,
      jumpPage,
      isSearching,
      availableTags,
      changePage,
      jumpToPage,
      getPageNumbers,
      formatDate,
      goToDetail,
      toggleBatchMode,
      toggleSelect,
      isSelected,
      deleteArticle,
      batchDelete,
      handleSearch,
      toggleTagFilter,
      clearTagFilter,
      clearSearch,
      handleCreate,
      isAdmin,
      shortAuthor,
      setSort,
      toggleOrder
      , showBackup, backups, backupLoading, selectedFile, importing,
      openBackup, closeBackup, fetchBackups, createBackup, downloadBackup, deleteBackup, onFileChange, importBackup
    }
  }
}
</script>

<style scoped>
.article-list {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.page-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.batch-btn, .create-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.3s ease;
  cursor: pointer;
  font-size: 0.9rem;
}

.batch-btn {
  background: #6c757d;
  color: white;
  box-shadow: 0 2px 4px rgba(108, 117, 125, 0.2);
}

.batch-btn:hover {
  background: #5a6268;
}

.batch-toggle-bar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin: 1rem 0 1.5rem;
}


.batch-btn.active {
  background: #dc3545;
  box-shadow: 0 2px 4px rgba(220, 53, 69, 0.2);
}

.batch-btn.active:hover {
  background: #c82333;
  box-shadow: 0 4px 8px rgba(220, 53, 69, 0.3);
}

.create-btn {
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
  box-shadow: 0 2px 4px rgba(40, 167, 69, 0.2);
}
.backup-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.9rem;
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  color: #fff;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.25);
}

.backup-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 8px rgba(99, 102, 241, 0.3); }

.backup-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1000; display: flex; align-items: center; justify-content: center; }
.backup-panel { width: 720px; max-width: 95vw; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 16px; box-shadow: var(--shadow-lg); padding: 1rem 1.25rem; }
.backup-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; margin-bottom: 1rem; }
.close-btn { border: none; background: var(--bg-secondary); padding: 0.4rem 0.6rem; border-radius: 8px; cursor: pointer; }
.backup-actions { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 1rem; }
.export-btn, .import-btn-primary, .import-label .import-btn, .download-btn { padding: 0.6rem 1rem; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
.export-btn { background: linear-gradient(135deg, #10b981, #22c55e); color: #fff; }
.import-btn-primary { background: linear-gradient(135deg, #f59e0b, #f97316); color: #fff; }
.import-label .import-btn { background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); }
.backup-list { border-top: 1px solid var(--border-color); padding-top: 0.75rem; }
.backup-item { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0; }
.backup-item-actions { display: flex; gap: 0.5rem; }
.download-btn { background: linear-gradient(135deg, #3b82f6, #6366f1); color: #fff; }
.delete-btn { background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; border: none; padding: 0.5rem 0.9rem; border-radius: 8px; cursor: pointer; font-weight: 600; }
.empty-tip { color: var(--text-secondary); padding: 0.5rem 0; }

.create-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(40, 167, 69, 0.3);
}

.search-filter {
  background: var(--bg-secondary);
  padding: 2rem;
  border-radius: 16px;
  margin-bottom: 2rem;
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  backdrop-filter: saturate(150%) blur(4px);
}

.search-box {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1.5rem;
}

.search-input {
  flex: 1;
  padding: 1rem 1.5rem;
  border: 2px solid var(--border-color);
  border-radius: 12px;
  font-size: 1rem;
  transition: all 0.3s ease;
  background: var(--card-bg);
  color: var(--text-primary);
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.search-type, .sort-select {
  padding: 1rem;
  border: 2px solid var(--border-color);
  border-radius: 12px;
  background: var(--card-bg);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.search-type:focus, .sort-select:focus {
  outline: none;
  border-color: #667eea;
}

.tag-filter {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.filter-label {
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  margin-top: 0.5rem;
  font-size: 0.9rem;
}

.tag-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  flex: 1;
}

.tag-option {
  padding: 0.5rem 1rem;
  border: 2px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-primary);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.85rem;
  font-weight: 500;
}

.tag-option:hover {
  border-color: #667eea;
  transform: translateY(-1px);
}

.tag-option.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border-color: #667eea;
  box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
}

.clear-filter-btn, .clear-search-btn {
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.3s ease;
}

.clear-filter-btn:hover, .clear-search-btn:hover {
  background: #5a6268;
  transform: translateY(-1px);
}

.sort-options {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.sort-controls { display: flex; gap: 0.5rem; align-items: center; }
.sort-pill { padding: 0.5rem 1rem; border: 2px solid var(--border-color); background: var(--card-bg); color: var(--text-primary); border-radius: 20px; cursor: pointer; transition: all 0.3s ease; font-size: 0.85rem; font-weight: 500; }
.sort-pill.active { background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-color: #667eea; box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3); }
.order-toggle { padding: 0.5rem 0.8rem; border: 2px solid var(--border-color); background: var(--card-bg); color: var(--text-primary); border-radius: 999px; cursor: pointer; font-size: 0.85rem; transition: all 0.3s ease; }
.order-toggle:hover { border-color: #667eea; transform: translateY(-1px); }

.search-status {
  background: linear-gradient(135deg, #e3f2fd, #bbdefb);
  padding: 1rem 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-left: 4px solid #2196f3;
}

.batch-actions {
  background: linear-gradient(135deg, #fff3cd, #ffeaa7);
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-left: 4px solid #ffc107;
  font-weight: 600;
}

.batch-delete-btn {
  background: linear-gradient(135deg, #dc3545, #c82333);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
  margin-left: auto;
}

.batch-delete-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(220, 53, 69, 0.3);
}

.articles {
  display: grid;
  gap: 1.5rem;
  margin-bottom: 2rem;
  grid-template-columns: 1fr;
}

.article-card {
  background: var(--card-bg);
  padding: 2rem;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border: 1px solid var(--border-color);
  position: relative;
  overflow: hidden;
}

.article-card::before {
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

.article-card:hover::before {
  opacity: 1;
}

.article-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
  border-color: var(--brand);
}

.article-card.selected {
  border: 2px solid #667eea;
  background: linear-gradient(135deg, #f8f9ff, #f0f2ff);
}

.article-main {
  flex: 1;
  cursor: pointer;
  padding-right: 1rem;
}

.article-main h2 {
  color: var(--text-primary);
  margin-bottom: 1rem;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.3;
  transition: color 0.3s ease;
}

.article-main h2:hover {
  color: #667eea;
}

.excerpt {
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
  line-height: 1.6;
  font-size: 1rem;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.meta {
  display: flex;
  gap: 1.5rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.meta span {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.tags {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tag {
  background: linear-gradient(135deg, #e3f2fd, #bbdefb);
  color: #1976d2;
  padding: 0.4rem 0.8rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid #bbdefb;
}

.article-actions {
  margin-left: 1rem;
  display: flex;
  align-items: center;
}

.checkbox-container {
  display: block;
  position: relative;
  cursor: pointer;
  width: 24px;
  height: 24px;
}

.checkbox-container input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
}

.checkmark {
  display: block;
  width: 24px;
  height: 24px;
  background: var(--card-bg);
  border: 2px solid var(--border-color);
  border-radius: 6px;
  position: relative;
  transition: all 0.3s ease;
}

.checkbox-container input:checked + .checkmark {
  background: #667eea;
  border-color: #667eea;
}

.checkbox-container input:checked + .checkmark:after {
  content: "✓";
  color: white;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 14px;
  font-weight: bold;
}

.delete-btn {
  background: linear-gradient(135deg, #dc3545, #c82333);
  color: white;
  border: none;
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 600;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.delete-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(220, 53, 69, 0.3);
}

.no-results {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-secondary);
}

.no-results p {
  font-size: 1.1rem;
  margin-bottom: 1rem;
}

.no-results a {
  color: #667eea;
  text-decoration: none;
  font-weight: 600;
  transition: color 0.3s ease;
}

.no-results a:hover {
  color: #764ba2;
  text-decoration: underline;
}

.pagination {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  align-items: center;
  margin: 3rem 0;
  flex-wrap: wrap;
}

.page-btn {
  padding: 0.75rem 1rem;
  border: 2px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-primary);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.3s ease;
  min-width: 44px;
  font-weight: 600;
}

.page-btn:hover:not(:disabled) {
  border-color: #667eea;
  color: #667eea;
  transform: translateY(-1px);
}

.page-btn.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border-color: #667eea;
  box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
}

.page-btn:disabled {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-color: var(--border-color);
  cursor: not-allowed;
  transform: none;
}

.page-btn.ellipsis {
  background: transparent;
  border: none;
  cursor: default;
  color: var(--text-secondary);
}

.page-jump {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: 1rem;
  padding: 0.5rem;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.jump-label {
  font-size: 0.9rem;
  color: var(--text-primary);
  white-space: nowrap;
}

.jump-input {
  width: 60px;
  padding: 0.5rem;
  border: 2px solid var(--border-color);
  border-radius: 4px;
  text-align: center;
  font-size: 0.9rem;
  transition: all 0.3s ease;
  background: var(--card-bg);
  color: var(--text-primary);
}

.jump-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
}

.jump-input::placeholder {
  color: var(--text-secondary);
}

.jump-btn {
  background: #667eea;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.jump-btn:hover:not(:disabled) {
  background: #5a6fd8;
  transform: translateY(-1px);
}

.jump-btn:disabled {
  background: var(--text-secondary);
  cursor: not-allowed;
  transform: none;
}

.pagination-info {
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-top: 1rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 8px;
}

@media (max-width: 768px) {
  .article-list {
    padding: 1rem;
  }
  
  .page-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
  
  .page-header h1 {
    font-size: 2rem;
  }
  
  .search-box {
    flex-direction: column;
  }
  
  .tag-filter, .sort-options {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .article-card {
    flex-direction: column;
    padding: 1.5rem;
  }
  
  .article-actions {
    margin-left: 0;
    margin-top: 1rem;
    align-self: flex-end;
  }
  
  .meta {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .pagination {
    flex-direction: column;
    gap: 1rem;
  }
  
  .page-jump {
    margin-left: 0;
    justify-content: center;
  }
}
</style>
