<template>
  <div class="article-form">
  <div class="page-header">
      <h1>{{ isEditMode ? (form.status === 'draft' ? '编辑草稿' : '编辑文章') : '写文章' }}</h1>
      <button @click="goBack" class="back-btn">
        ← {{ isEditMode ? (form.status === 'draft' ? '返回至草稿列表' : '返回详情') : '返回列表' }}
      </button>
      <button v-if="!isEditMode" @click="openDraftPicker" class="back-btn">选择草稿</button>
    </div>
    
    <!-- AI 写作助手组件 -->
    <AIWritingAssistant 
      @apply-content="handleAIContent"
      @apply-excerpt="handleAIExcerpt"
    />
    
    <!-- 编辑器选择 -->
    <div class="editor-selector" v-if="!loading">
      <div class="selector-header">
        <h3>选择编辑器</h3>
      </div>
      <div class="selector-options">
        <label class="selector-option">
          <input 
            type="radio" 
            v-model="editorType" 
            value="rich"
          >
          <div class="option-card">
            <span class="option-icon">📝</span>
            <div class="option-content">
              <h4>富文本编辑器</h4>
              <p>使用简单的文本框编辑，适合普通文章</p>
            </div>
          </div>
        </label>
        
        <label class="selector-option">
          <input 
            type="radio" 
            v-model="editorType" 
            value="markdown"
          >
          <div class="option-card">
            <span class="option-icon">📄</span>
            <div class="option-content">
              <h4>Markdown 编辑器</h4>
              <p>使用 Markdown 语法编辑，支持实时预览和丰富的排版</p>
            </div>
          </div>
        </label>
      </div>
    </div>
    
    <div v-if="loading && isEditMode" class="loading">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>
    
    <form v-else @submit.prevent="submitArticle" class="article-form">
      <div class="form-group">
        <label for="title">标题 <span class="required">*</span></label>
        <input 
          type="text" 
          id="title" 
          v-model="form.title" 
          required 
          placeholder="请输入文章标题"
          maxlength="255"
          class="form-input"
        >
        <div class="char-count">{{ form.title.length }}/255</div>
      </div>

      <div class="form-group">
        <label for="excerpt">摘要</label>
        <textarea 
          id="excerpt" 
          v-model="form.excerpt" 
          rows="3" 
          placeholder="请输入文章摘要（可选）"
          maxlength="500"
          class="form-textarea"
        ></textarea>
        <div class="char-count">{{ form.excerpt.length }}/500</div>
      </div>

      <div class="form-group">
        <label for="content">内容 <span class="required">*</span></label>
        
        <!-- Markdown 编辑器 -->
        <MarkdownEditor
          v-if="editorType === 'markdown'"
          v-model="form.content"
          placeholder="开始使用 Markdown 编写文章..."
          class="markdown-editor-container"
        />
        
        <!-- 普通富文本编辑器 -->
        <template v-else>
          <textarea 
            id="content" 
            v-model="form.content" 
            rows="15" 
            required 
            placeholder="请输入文章内容"
            class="form-textarea content-textarea"
          ></textarea>
          <div class="editor-help">
            <span class="help-text">提示：切换到 Markdown 编辑器可获得更好的排版体验</span>
          </div>
        </template>
      </div>

      <div class="form-group">
        <label>标签</label>
        <div class="tag-input-container">
          <input 
            type="text" 
            v-model="tagInput" 
            placeholder="输入标签后按回车添加（例如：Vue,SSR,Express）"
            @keydown.enter.prevent="addTag"
            class="form-input"
          >
          <button type="button" @click="addTag" class="add-tag-btn">添加</button>
        </div>
        <div class="tags-preview" v-if="form.tags.length > 0">
          <span 
            v-for="tag in form.tags" 
            :key="tag" 
            class="tag"
            @click="removeTag(tag)"
          >
            {{ tag }} ×
          </span>
        </div>
        <div class="help-text">点击标签可以删除</div>
      </div>

      

      <div class="form-actions">
        <button type="button" @click="goBack" class="cancel-btn">取消</button>
        
        
        
        <!-- 创建模式：保存草稿按钮 -->
        <button 
          v-if="!isEditMode"
          type="button" 
          @click="saveDraft" 
          :disabled="submitting"
          class="draft-btn"
        >
          {{ submitting ? '保存中...' : '存为草稿' }}
        </button>
        <!-- 编辑模式：更新草稿按钮（仅草稿状态显示） -->
        <button 
          v-if="isEditMode && form.status === 'draft'"
          type="button" 
          @click="saveDraftEdit" 
          :disabled="submitting"
          class="draft-btn"
        >
          {{ submitting ? '保存中...' : '更新草稿' }}
        </button>
        
        <!-- 主提交按钮 -->
        <button type="submit" class="submit-btn" :disabled="submitting">
          {{ submitting ? (isEditMode ? (form.status === 'draft' ? '发布中...' : '更新中...') : '发布中...') : (isEditMode ? (form.status === 'draft' ? '发布' : '更新文章') : '发布文章') }}
        </button>
      </div>
    </form>

    <div v-if="showDraftPicker" class="picker-overlay" @click="closeDraftPicker"></div>
    <div v-if="showDraftPicker" class="picker-modal">
      <div class="picker-header">
        <h3>选择草稿</h3>
        <button class="close-btn" @click="closeDraftPicker">×</button>
      </div>
      <div class="picker-body">
        <div v-if="loadingDrafts" class="loading">加载中...</div>
        <div v-else>
          <div v-if="drafts.length === 0" class="empty">暂无草稿</div>
          <ul class="picker-list">
            <li v-for="d in drafts" :key="d.id" class="picker-item">
              <div class="picker-main">
                <div class="title">{{ d.title || '未命名草稿' }}</div>
                <div class="meta">
                  <span>编辑器: {{ d.editor_type === 'markdown' ? 'Markdown' : '富文本' }}</span>
                  <span class="updated">最近编辑时间: {{ formatDate(d.updated_at || d.created_at) }}</span>
                </div>
              </div>
              <div class="picker-actions">
                <button class="select-btn" @click="selectDraft(d.id)">继续编辑</button>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AIWritingAssistant from './AIWritingAssistant.vue'
import MarkdownEditor from './MarkdownEditor.vue'
import { useAuth } from '../composables/useAuth'

export default {
  name: 'ArticleForm',
  components: {
    AIWritingAssistant,
    MarkdownEditor
  },
  props: {
    articleId: {
      type: String,
      default: null
    }
  },
  setup(props) {
    const { isLoggedIn, openAuthModal } = useAuth()
    const form = reactive({
      title: '',
      excerpt: '',
      content: '',
      tags: [],
      status: 'published'
    })
    const tagInput = ref('')
    const loading = ref(false)
    const submitting = ref(false)
    const editorType = ref('rich') // 'rich' 或 'markdown'
    const route = useRoute()
    const router = useRouter()
    const showDraftPicker = ref(false)
    const loadingDrafts = ref(false)
    const drafts = ref([])
    
    // 计算属性
    const articleId = computed(() => {
      return props.articleId || route.params.id
    })
    
    const isEditMode = computed(() => {
      return !!articleId.value
    })

    const markdownToPlainText = (md) => {
      if (!md) return ''
      let s = md
      s = s.replace(/!\[([^\]]*)\]\([^\)]*\)/g, '$1')
      s = s.replace(/\[([^\]]+)\]\([^\)]*\)/g, '$1')
      s = s.replace(/^#{1,6}\s*/gm, '')
      s = s.replace(/^\s*[-*+]\s+/gm, '')
      s = s.replace(/^\s*\d+\.\s+/gm, '')
      s = s.replace(/^\s{0,3}>\s?/gm, '')
      s = s.replace(/```/g, '')
      s = s.replace(/`/g, '')
      s = s.replace(/[*_]{1,3}/g, '')
      s = s.replace(/<[^>]+>/g, '')
      s = s.replace(/\r/g, '')
      return s
    }

    // AI助手相关方法
    const handleAIContent = (contentData) => {
      if (contentData.title) {
        form.title = contentData.title
      }
      if (contentData.content) {
        const text = editorType.value === 'markdown' ? contentData.content : markdownToPlainText(contentData.content)
        if (contentData.append) {
          const prefix = form.content ? '\n\n' : ''
          form.content = form.content + prefix + text
        } else {
          form.content = text
        }
      }
      if (contentData.excerpt) {
        form.excerpt = contentData.excerpt
      }
      if (contentData.title || contentData.content || contentData.excerpt) {
        alert('AI生成的内容已应用到表单中！')
      }
    }

    const handleAIExcerpt = (excerpt) => {
      form.excerpt = excerpt
      alert('AI生成的摘要已应用到表单中！')
    }

    // 返回按钮功能
    const goBack = () => {
      // 使用 router.go(-1) 返回到上一个页面
      router.go(-1)
    }

    const token = () => localStorage.getItem('token') || ''
    const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
    const openDraftPicker = async () => {
      if (!isLoggedIn.value) { openAuthModal('prompt'); return }
      showDraftPicker.value = true
      loadingDrafts.value = true
      try {
        const qs = new URLSearchParams({ page: '1', limit: '20', scope: 'mine' })
        const res = await fetch(`${API_BASE}/api/drafts?${qs.toString()}`, { headers: { Authorization: `Bearer ${token()}` } })
        const r = await res.json()
        drafts.value = r.success ? (r.data?.drafts || []) : []
      } finally {
        loadingDrafts.value = false
      }
    }
    const closeDraftPicker = () => { showDraftPicker.value = false }
    const selectDraft = (id) => { showDraftPicker.value = false; router.push(`/edit/${id}`) }

    // 加载文章数据（编辑模式）
    const fetchArticle = async () => {
      if (!isEditMode.value) return
      
      try {
        loading.value = true
        const response = await fetch(`${API_BASE}/api/articles/${articleId.value}`)
        const result = await response.json()
        
        if (result.success) {
          const article = result.data
          form.title = article.title || ''
          form.excerpt = article.excerpt || ''
          form.content = article.content || ''
          form.tags = article.tags || []
          form.status = article.status || 'published'
          editorType.value = article.editor_type === 'markdown' ? 'markdown' : 'rich'
        } else {
          alert('加载文章失败: ' + result.message)
          router.push('/')
        }
      } catch (error) {
        alert('加载文章失败，请重试')
        router.push('/')
      } finally {
        loading.value = false
      }
    }

    // 标签管理
    const addTag = () => {
      if (!tagInput.value.trim()) return
      
      const tags = tagInput.value.split(',')
        .map(tag => tag.trim())
        .filter(tag => {
          if (!tag) return false
          if (form.tags.includes(tag)) {
            alert(`标签 "${tag}" 已存在`)
            return false
          }
          return true
        })
      
      form.tags.push(...tags)
      tagInput.value = ''
    }

    const removeTag = (tagToRemove) => {
      form.tags = form.tags.filter(tag => tag !== tagToRemove)
    }

    // 提交文章
    const submitArticle = async () => {
      if (submitting.value) return
      
      // 验证表单
      if (!form.title.trim()) {
        alert('请输入文章标题')
        return
      }
      
      if (!form.content.trim()) {
        alert('请输入文章内容')
        return
      }

      if (!isLoggedIn.value) { openAuthModal('prompt'); return }

      submitting.value = true
      try {
        const url = isEditMode.value 
          ? `${API_BASE}/api/articles/${articleId.value}`
          : `${API_BASE}/api/articles`
        
        const method = isEditMode.value ? 'PUT' : 'POST'
        const bodyData = {
          ...form,
          editor_type: editorType.value,
          status: isEditMode.value ? (form.status === 'draft' ? 'published' : form.status) : 'published'
        }

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`
          },
          body: JSON.stringify(bodyData)
        })

        const result = await response.json()

        if (result.success) {
          const successMessage = isEditMode.value ? (form.status === 'draft' ? '文章发布成功！' : '文章更新成功！') : '文章发布成功！'
          alert(successMessage)
          window.dispatchEvent(new Event('tags-refresh'))
          
          // 跳转到文章详情页
          const targetId = result.data?.id || articleId.value
          if (targetId) {
            router.push(`/article/${targetId}`)
          } else {
            router.push('/')
          }
        } else {
          alert(`${isEditMode.value ? '更新' : '发布'}失败: ` + result.message)
        }
      } catch (error) {
        alert(`${isEditMode.value ? '更新' : '发布'}失败，请重试`)
      } finally {
        submitting.value = false
      }
    }

    // 保存草稿（仅创建模式）
    const saveDraft = async () => {
      if (submitting.value) return
      
      if (!form.title.trim() && !form.content.trim()) {
        alert('请至少输入标题或内容')
        return
      }

      if (!isLoggedIn.value) { openAuthModal('prompt'); return }

      submitting.value = true
      try {
        const response = await fetch(`${API_BASE}/api/articles`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`
          },
          body: JSON.stringify({
            ...form,
            editor_type: editorType.value,
            status: 'draft'
          })
        })

        const result = await response.json()

        if (result.success) {
          alert('草稿保存成功！')
          router.push('/')
        } else {
          alert('保存失败: ' + result.message)
        }
      } catch (error) {
        alert('保存失败，请重试')
      } finally {
        submitting.value = false
      }
    }

    // 更新草稿（编辑模式）
    const saveDraftEdit = async () => {
      if (submitting.value) return
      if (!form.title.trim() && !form.content.trim()) {
        alert('请至少输入标题或内容')
        return
      }
      if (!isLoggedIn.value) { openAuthModal('prompt'); return }

      submitting.value = true
      try {
        const response = await fetch(`${API_BASE}/api/articles/${articleId.value}` , {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`
          },
          body: JSON.stringify({
            ...form,
            editor_type: editorType.value,
            status: 'draft'
          })
        })

        const result = await response.json()

        if (result.success) {
          alert('草稿更新成功！')
          router.push('/drafts')
        } else {
          alert('更新失败: ' + result.message)
        }
      } catch (error) {
        alert('更新失败，请重试')
      } finally {
        submitting.value = false
      }
    }


    const formatDate = (d) => {
      if (!d) return ''
      return new Date(d).toLocaleString()
    }

    onMounted(() => {
      if (isEditMode.value) {
        fetchArticle()
      }
    })

    watch(articleId, (newId, oldId) => {
      if (newId && newId !== oldId) {
        fetchArticle()
      }
    })

    return {
      form,
      tagInput,
      loading,
      submitting,
      editorType,
      isEditMode,
      addTag,
      removeTag,
      submitArticle,
      saveDraft,
      saveDraftEdit,
      goBack,
      handleAIContent,
      handleAIExcerpt,
      showDraftPicker,
      openDraftPicker,
      closeDraftPicker,
      drafts,
      loadingDrafts,
      selectDraft,
      formatDate
    }
  }
}
</script>


<style scoped>
.article-form {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
  min-height: calc(100vh - 4rem);
}

.picker-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); }
.picker-modal { position: fixed; top: 10%; left: 50%; transform: translateX(-50%); width: 720px; max-width: 95vw; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
.picker-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid var(--border-color); }
.picker-body { padding: 1rem; }
.close-btn { background: transparent; border: none; font-size: 1.25rem; cursor: pointer; color: var(--text-primary); }
.picker-list { list-style: none; padding: 0; margin: 0; }
.picker-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); margin-bottom: 0.5rem; }
.picker-main { flex: 1; }
.picker-main .meta { display: flex; gap: 0.75rem; align-items: center; }
.picker-actions { display: flex; gap: 0.5rem; }
.select-btn { background: #667eea; color: #fff; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; }

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

.back-btn {
  background: #6c757d;
  color: white;
  text-decoration: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.3s ease;
  display: flex;
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

.editor-selector {
  background: var(--card-bg);
  border: 2px solid var(--border-color);
  border-radius: 16px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

.selector-header {
  margin-bottom: 1.5rem;
}

.selector-header h3 {
  font-size: 1.5rem;
  color: var(--text-primary);
  font-weight: 600;
  margin: 0;
}

.selector-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.selector-option {
  display: block;
  cursor: pointer;
}

.selector-option input[type="radio"] {
  display: none;
}

.option-card {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.5rem;
  border: 2px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-secondary);
  transition: all 0.3s ease;
  height: 100%;
}

.selector-option input[type="radio"]:checked + .option-card {
  border-color: #667eea;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
  transform: translateY(-2px);
}

.selector-option input[type="radio"]:checked + .option-card .option-icon {
  background: #667eea;
  color: white;
}

.option-icon {
  font-size: 2rem;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--border-color);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.option-content {
  flex: 1;
}

.option-content h4 {
  font-size: 1.2rem;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
  font-weight: 600;
}

.option-content p {
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
  font-size: 0.9rem;
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

.form-container {
  background: var(--card-bg);
  padding: 3rem;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--border-color);
  position: relative;
  overflow: hidden;
}

.form-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.form-group {
  margin-bottom: 2.5rem;
  position: relative;
}

.form-group:last-of-type {
  margin-bottom: 2rem;
}

label {
  display: block;
  margin-bottom: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.required {
  color: #dc3545;
  font-size: 0.9em;
}

.form-input, .form-textarea {
  width: 100%;
  padding: 1rem 1.25rem;
  border: 2px solid var(--border-color);
  border-radius: 12px;
  font-size: 1rem;
  transition: all 0.3s ease;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-family: inherit;
}

.form-input:focus, .form-textarea:focus {
  outline: none;
  border-color: #667eea;
  background: var(--card-bg);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input::placeholder, .form-textarea::placeholder {
  color: var(--text-secondary);
  opacity: 0.6;
}

.markdown-editor-container {
  border: 2px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
}

.content-textarea {
  resize: vertical;
  min-height: 500px;
  line-height: 1.8;
  font-size: 1.1rem;
}

.editor-help {
  margin-top: 0.5rem;
  display: flex;
  justify-content: flex-end;
}

.help-text {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-style: italic;
}

.char-count {
  text-align: right;
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: 0.5rem;
  font-weight: 500;
}

.char-count.warning {
  color: #ff9800;
}

.char-count.error {
  color: #dc3545;
}

.tag-input-container {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.add-tag-btn {
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(40, 167, 69, 0.2);
}

.add-tag-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(40, 167, 69, 0.3);
}

.add-tag-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.tags-preview {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px dashed var(--border-color);
}

.tag {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 0.5rem 1.25rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 2px 4px rgba(102, 126, 234, 0.2);
}

.tag:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
}

 

 

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid var(--border-color);
}

.cancel-btn, .draft-btn, .submit-btn {
  padding: 1rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 120px;
  justify-content: center;
}

.cancel-btn {
  background: #6c757d;
  color: white;
  box-shadow: 0 2px 4px rgba(108, 117, 125, 0.2);
}

.cancel-btn:hover {
  background: #5a6268;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(108, 117, 125, 0.3);
}

.draft-btn {
  background: linear-gradient(135deg, #ffc107, #ff9800);
  color: #212529;
  box-shadow: 0 2px 4px rgba(255, 193, 7, 0.2);
}

.draft-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(255, 193, 7, 0.3);
}


.submit-btn {
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
  box-shadow: 0 2px 4px rgba(40, 167, 69, 0.2);
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(40, 167, 69, 0.3);
}

.cancel-btn:disabled, .draft-btn:disabled, .submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .article-form {
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
  
  .editor-selector {
    padding: 1.5rem;
  }
  
  .selector-options {
    grid-template-columns: 1fr;
  }
  
  .option-card {
    flex-direction: column;
    text-align: center;
  }
  
  .option-icon {
    width: 50px;
    height: 50px;
    font-size: 1.5rem;
  }
  
  .form-container {
    padding: 1.5rem;
  }
  
  .tag-input-container {
    flex-direction: column;
    align-items: stretch;
  }
  
  .add-tag-btn {
    width: 100%;
  }
  
  
  
  .form-actions {
    flex-direction: column;
  }
  
  .cancel-btn, .draft-btn, .submit-btn {
    width: 100%;
    min-width: unset;
  }
  
  .content-textarea {
    min-height: 400px;
  }
}

@media (max-width: 480px) {
  .form-container {
    padding: 1rem;
  }
  
  .form-group {
    margin-bottom: 1.5rem;
  }
  
  .form-input, .form-textarea {
    padding: 0.875rem 1rem;
  }
}
</style>
