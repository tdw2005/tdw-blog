<template>
  <div class="drafts-page">
    <div class="page-header">
      <h1>草稿箱</h1>
      <div class="header-actions">
        <div class="scope-switch" v-if="isAdmin">
          <label>
            <input type="checkbox" v-model="showAll" />
            显示所有草稿
          </label>
        </div>
      </div>
    <div class="batch-toggle-bar">
        <button 
          class="batch-btn" 
          :class="{ active: batchMode }" 
          @click="toggleBatchMode"
        >
          {{ batchMode ? '取消批量' : '批量删除' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else>
      <div v-if="drafts.length === 0" class="empty">暂无草稿</div>
      <div v-if="batchMode && selectedDrafts.length > 0" class="batch-actions">
        <span>已选择 {{ selectedDrafts.length }} 条草稿</span>
        <button class="batch-delete-btn" @click="batchDelete">批量删除</button>
      </div>

      <ul class="draft-list">
        <li v-for="d in drafts" :key="d.id" class="draft-item">
          <div class="draft-main" @click="edit(d.id)">
            <div class="title">{{ d.title || '未命名草稿' }}</div>
            <div class="meta">
              <span>编辑器: {{ d.editor_type === 'markdown' ? 'Markdown' : '富文本' }}</span>
              <span>创建: {{ formatDate(d.created_at) }}</span>
              <span v-if="d.updated_at !== d.created_at">最近编辑: {{ formatDate(d.updated_at) }}</span>
              <span v-if="isAdmin && showAll && d.author_nickname && d.author_uid">所属: {{ d.author_nickname }}（id：{{ d.author_uid }}）</span>
            </div>
          </div>
          <div class="actions">
            <label v-if="batchMode" class="checkbox-container" @click.stop>
              <input type="checkbox" :checked="isSelected(d.id)" @change="toggleSelect(d.id)" />
              <span class="checkmark"></span>
            </label>
            <button class="publish-btn" @click="publish(d.id)">发布</button>
            <button class="edit-btn" @click="edit(d.id)">编辑</button>
            <button 
              class="delete-btn" 
              @click.stop="deleteDraft(d.id, d.title)"
              title="删除草稿"
            >
              🗑️ 删除
            </button>
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
import { ref, onMounted, watch, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

export default {
  name: 'Drafts',
  setup() {
    const router = useRouter()
    const { isLoggedIn, isAdmin, user, openAuthModal } = useAuth()
    const drafts = ref([])
    const loading = ref(false)
    const showAll = ref(false)
    const pagination = ref({ page: 1, limit: 10, total: 0, totalPages: 0 })
    const batchMode = ref(false)
    const selectedDrafts = ref([])

    const token = () => localStorage.getItem('token') || ''

    const injected = inject('initialData', null)
    const checkSSRData = () => {
      const src = injected || (typeof window !== 'undefined' ? window.__INITIAL_DATA__ : null)
      if (src && src.route === '/drafts' && src.data && Array.isArray(src.data.drafts)) {
        drafts.value = src.data.drafts
        pagination.value.page = 1
        pagination.value.total = src.data.pagination ? (src.data.pagination.total || src.data.drafts.length) : src.data.drafts.length
        pagination.value.totalPages = src.data.pagination ? (src.data.pagination.totalPages || 1) : 1
        loading.value = false
        return true
      }
      return false
    }

    const fetchDrafts = async (page = 1) => {
      if (!isLoggedIn.value) { openAuthModal('prompt'); return }
      loading.value = true
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(pagination.value.limit), scope: (isAdmin.value && showAll.value) ? 'all' : 'mine' })
        const res = await fetch(`/api/drafts?${params.toString()}`, { headers: { Authorization: `Bearer ${token()}` } })
        const result = await res.json()
        if (result.success) {
          drafts.value = result.data.drafts || []
          pagination.value.page = page
          pagination.value.total = result.data.pagination.total
          pagination.value.totalPages = result.data.pagination.totalPages
        }
      } finally {
        loading.value = false
      }
    }

    const changePage = (p) => { fetchDrafts(p) }
    const edit = (id) => { router.push(`/edit/${id}`) }
    const publish = async (id) => {
      if (!isLoggedIn.value) { openAuthModal('prompt'); return }
      try {
        const res = await fetch(`/api/drafts/${id}/publish`, { method: 'PUT', headers: { Authorization: `Bearer ${token()}` } })
        const r = await res.json()
        if (r.success) { alert('发布成功'); fetchDrafts(pagination.value.page) } else { alert(r.message || '发布失败') }
      } catch (e) { alert('发布失败，请重试') }
    }

    const deleteDraft = async (id, title) => {
      if (!isLoggedIn.value) { openAuthModal('prompt'); return }
      const name = title || '未命名草稿'
      if (!confirm(`确定要删除草稿《${name}》吗？此操作不可恢复！`)) return
      try {
        const res = await fetch(`/api/articles/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token()}` }
        })
        const result = await res.json()
        if (result.success) {
          alert('草稿删除成功！')
          fetchDrafts(pagination.value.page)
        } else {
          alert(result.message || '删除失败，请重试')
        }
      } catch (e) {
        alert('删除失败，请重试')
      }
    }

    const toggleBatchMode = () => {
      batchMode.value = !batchMode.value
      selectedDrafts.value = []
    }

    const toggleSelect = (id) => {
      const idx = selectedDrafts.value.indexOf(id)
      if (idx > -1) selectedDrafts.value.splice(idx, 1)
      else selectedDrafts.value.push(id)
    }

    const isSelected = (id) => selectedDrafts.value.includes(id)

    const batchDelete = async () => {
      if (selectedDrafts.value.length === 0) { alert('请先选择要删除的草稿'); return }
      if (!confirm(`确定要删除选中的 ${selectedDrafts.value.length} 条草稿吗？此操作不可恢复！`)) return
      try {
        const endpoint = (isAdmin.value && showAll.value) ? '/api/articles/batch-delete' : '/api/drafts/batch-delete'
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
          body: JSON.stringify({ ids: selectedDrafts.value })
        })
        const result = await res.json()
        if (result.success) {
          alert(`成功删除 ${result.data.deleted} 条草稿！`)
          batchMode.value = false
          selectedDrafts.value = []
          fetchDrafts(pagination.value.page)
        } else {
          alert(result.message || '批量删除失败，请重试')
        }
      } catch (e) {
        alert('批量删除失败，请重试')
      }
    }

    const formatDate = (d) => { return new Date(d).toLocaleString() }

    onMounted(() => { const hasSSR = checkSSRData(); if (!hasSSR) { fetchDrafts(1) } })
    watch(showAll, () => fetchDrafts(1))

    return { drafts, loading, showAll, pagination, changePage, edit, publish, deleteDraft, batchMode, selectedDrafts, toggleBatchMode, toggleSelect, isSelected, batchDelete, isAdmin, isLoggedIn, formatDate }
  }
}
</script>

<style scoped>
.drafts-page { max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
.page-header { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
.header-actions { display: flex; gap: 1rem; align-items: center; }
.header-actions { justify-content: center; }
.scope-switch { color: var(--text-secondary); }
.loading { padding: 1rem; color: var(--text-secondary); }
.empty { padding: 1rem; color: var(--text-secondary); }
.draft-list { list-style: none; padding: 0; margin: 0; }
.draft-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--card-bg); margin-bottom: 0.5rem; }
.draft-main { flex: 1; cursor: pointer; }
.title { font-weight: 600; color: var(--text-primary); }
.meta { display: flex; gap: 0.75rem; color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.25rem; }
.actions { display: flex; gap: 0.5rem; }
.publish-btn { background: #667eea; color: #fff; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; }
.edit-btn { background: #6c757d; color: #fff; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; }
.pagination { display: flex; gap: 1rem; justify-content: center; align-items: center; margin-top: 1rem; }
.page-btn { background: #6c757d; color: #fff; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; }
.page-info { color: var(--text-secondary); }

 /* 复用文章列表的批量样式 */
.batch-toggle-bar { display: flex; justify-content: flex-end; align-items: center; margin: 0.5rem 0 1rem; width: 100%; }
.batch-btn { padding: 0.75rem 1.5rem; border: none; border-radius: 8px; font-weight: 600; transition: all 0.3s ease; cursor: pointer; font-size: 0.9rem; background: #6c757d; color: white; box-shadow: 0 2px 4px rgba(108, 117, 125, 0.2); }
.batch-btn.active { background: #dc3545; box-shadow: 0 2px 4px rgba(220, 53, 69, 0.2); }
.batch-btn:hover { background: #5a6268; }
.batch-actions { background: linear-gradient(135deg, #fff3cd, #ffeaa7); padding: 1rem; border-radius: 12px; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid #ffc107; font-weight: 600; }
.batch-delete-btn { background: linear-gradient(135deg, #dc3545, #c82333); color: white; border: none; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s ease; }
.batch-delete-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 8px rgba(220, 53, 69, 0.3); }

/* 复用文章列表的选择与删除按钮样式 */
.checkbox-container { display: block; position: relative; cursor: pointer; width: 24px; height: 24px; }
.checkbox-container input { position: absolute; opacity: 0; cursor: pointer; }
.checkmark { display: block; width: 24px; height: 24px; background: var(--card-bg); border: 2px solid var(--border-color); border-radius: 6px; position: relative; transition: all 0.3s ease; }
.checkbox-container input:checked + .checkmark { background: #667eea; border-color: #667eea; }
.checkbox-container input:checked + .checkmark:after { content: "✓"; color: white; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 14px; font-weight: bold; }
.delete-btn { background: linear-gradient(135deg, #dc3545, #c82333); color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; transition: all 0.3s ease; font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; gap: 0.4rem; }
.delete-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 8px rgba(220, 53, 69, 0.3); }
</style>
