<template>
  <div class="ai-assistant">
    <div class="assistant-header">
      <h3>AI 写作助手</h3>
      <button 
        @click="toggleAssistant" 
        class="toggle-btn"
        :class="{ active: isExpanded }"
      >
        {{ isExpanded ? '收起' : '展开' }}
      </button>
    </div>

    <div v-if="isExpanded" class="assistant-content">
      <!-- AI 服务状态 -->
      <div v-if="aiStatus" class="ai-status" :class="{ available: aiStatus.available }">
        <span class="status-dot"></span>
        AI服务: {{ aiStatus.available ? '可用' : '未配置' }}
        <span v-if="!aiStatus.available" class="status-hint">
          (请在服务器.env文件中配置ZHIPUAI_API_KEY)
        </span>
      </div>

      <!-- 段落建议 -->
      <div class="assistant-section">
        <h4>段落建议</h4>
        <div class="input-group">
          <input 
            v-model="suggestionTopic" 
            placeholder="输入标题或关键词获取段落建议..."
            class="input-field"
            :disabled="!aiStatus.available"
          >
          <button 
            @click="getSuggestions" 
            :disabled="loading.suggestions || !aiStatus.available"
            class="action-btn"
          >
            {{ loading.suggestions ? '生成中...' : '获取建议' }}
          </button>
        </div>
        <div v-if="suggestions" class="suggestions">
          <h5>建议段落：</h5>
          <div 
            v-for="(suggestion, index) in parsedSuggestions" 
            :key="index"
            class="suggestion-item"
            @click="appendSuggestion(suggestion)"
          >
            {{ suggestion }}
          </div>
        </div>
      </div>

      <!-- 生成文章 -->
      <div class="assistant-section">
        <h4>AI 生成文章</h4>
        <div class="input-group">
          <input 
            v-model="articleTitle" 
            placeholder="输入文章标题..."
            class="input-field"
            :disabled="!aiStatus.available"
          >
          <input 
            v-model="articleKeywords" 
            placeholder="关键词（可选）..."
            class="input-field"
            :disabled="!aiStatus.available"
          >
          <button 
            @click="generateArticle" 
            :disabled="loading.article || !aiStatus.available"
            class="action-btn generate-btn"
          >
            {{ loading.article ? '生成中...' : '生成文章' }}
          </button>
        </div>
      </div>

      <!-- 生成摘要 -->
      <div class="assistant-section">
        <h4>AI 生成摘要</h4>
        <div class="input-group">
          <textarea 
            v-model="contentForExcerpt" 
            placeholder="输入文章内容生成摘要..."
            rows="3"
            class="textarea-field"
            :disabled="!aiStatus.available"
          ></textarea>
          <button 
            @click="generateExcerpt" 
            :disabled="loading.excerpt || !aiStatus.available"
            class="action-btn"
          >
            {{ loading.excerpt ? '生成中...' : '生成摘要' }}
          </button>
        </div>
        <div v-if="generatedExcerpt" class="generated-content">
          <h5>生成的摘要：</h5>
          <p>{{ generatedExcerpt }}</p>
          <button @click="applyExcerpt" class="apply-btn">
            应用摘要
          </button>
        </div>
      </div>

    <!-- 生成结果 -->
    <div v-if="generatedArticle" class="generated-article">
      <h4>生成的文章：</h4>
      <div class="article-preview">
        <h5>{{ generatedArticle.title }}</h5>
        <div class="article-content" v-html="formatContent(generatedArticle.content)"></div>
      </div>
      <div class="article-actions">
        <button @click="applyGeneratedArticle" class="apply-btn primary">
          应用此文章
        </button>
        <button @click="regenerateArticle" class="apply-btn">
          重新生成
        </button>
      </div>
    </div>
    
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useAuth } from '../composables/useAuth'

export default {
  name: 'AIWritingAssistant',
  emits: ['applyContent', 'applyExcerpt'],
  setup(props, { emit }) {
    const isExpanded = ref(false)
    const suggestionTopic = ref('')
    const articleTitle = ref('')
    const articleKeywords = ref('')
    const contentForExcerpt = ref('')
    
    const loading = reactive({
      suggestions: false,
      article: false,
      excerpt: false
    })
    
    const suggestions = ref('')
    const generatedArticle = ref(null)
    const generatedExcerpt = ref('')
    const aiStatus = ref(null)
    
    const { isLoggedIn, openAuthModal } = useAuth()

    const parsedSuggestions = computed(() => {
      if (!suggestions.value) return []
      return suggestions.value.split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^[•\-*\d.]+\s*/, '').trim())
    })

    // 检查 AI 服务状态
    const checkAIStatus = async () => {
      try {
        const response = await fetch('/api/ai/status')
        const result = await response.json()
        if (result.success) {
          aiStatus.value = result.data
        }
      } catch (error) {
        aiStatus.value = { available: false }
      }
    }

    const getSuggestions = async () => {
      if (!suggestionTopic.value.trim()) {
        alert('请输入主题')
        return
      }

      loading.suggestions = true
      try {
        const response = await fetch('/api/ai/writing-suggestions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            topic: suggestionTopic.value
          })
        })

        const result = await response.json()
        
        if (result.success) {
          suggestions.value = result.data.suggestions
        } else {
          alert('获取建议失败: ' + result.message)
        }
      } catch (error) {
        alert('获取建议失败，请重试')
      } finally {
        loading.suggestions = false
      }
    }

    const generateArticle = async () => {
      if (!articleTitle.value.trim()) {
        alert('请输入文章标题')
        return
      }

      loading.article = true
      try {
        const response = await fetch('/api/ai/generate-article', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: articleTitle.value,
            keywords: articleKeywords.value
          })
        })

        const result = await response.json()
        
        if (result.success) {
          generatedArticle.value = result.data
        } else {
          alert('生成文章失败: ' + result.message)
        }
      } catch (error) {
        alert('生成文章失败，请重试')
      } finally {
        loading.article = false
      }
    }

    const generateExcerpt = async () => {
      if (!contentForExcerpt.value.trim()) {
        alert('请输入文章内容')
        return
      }

      loading.excerpt = true
      try {
        const response = await fetch('/api/ai/generate-excerpt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: contentForExcerpt.value
          })
        })

        const result = await response.json()
        
        if (result.success) {
          generatedExcerpt.value = result.data.excerpt
        } else {
          alert('生成摘要失败: ' + result.message)
        }
      } catch (error) {
        alert('生成摘要失败，请重试')
      } finally {
        loading.excerpt = false
      }
    }

    const appendSuggestion = (suggestion) => {
      const s = suggestion.trim()
      if (!s) return
      emit('applyContent', { content: s, append: true })
    }

    const applyGeneratedArticle = () => {
      if (generatedArticle.value) {
        emit('applyContent', {
          title: generatedArticle.value.title,
          content: generatedArticle.value.content,
          excerpt: generatedArticle.value.excerpt
        })
        generatedArticle.value = null
      }
    }

    const applyExcerpt = () => {
      if (generatedExcerpt.value) {
        emit('applyExcerpt', generatedExcerpt.value)
        generatedExcerpt.value = ''
      }
    }

    const regenerateArticle = () => {
      generatedArticle.value = null
      generateArticle()
    }

    const toggleAssistant = () => {
      isExpanded.value = !isExpanded.value
    }

    const formatContent = (content) => {
      if (!content) return ''
      return content
        .replace(/\n/g, '<br>')
        .replace(/\r/g, '')
    }

    onMounted(() => {
      checkAIStatus()
    })

    // 将生成的文章内容填充到可编辑区域
    // 不再在组件内提供独立编辑发布区，统一通过“应用到编辑器”后在主表单内编辑与发布

    

    return {
      isExpanded,
      suggestionTopic,
      articleTitle,
      articleKeywords,
      contentForExcerpt,
      loading,
      suggestions,
      generatedArticle,
      generatedExcerpt,
      aiStatus,
      
      parsedSuggestions,
      getSuggestions,
      generateArticle,
      generateExcerpt,
      appendSuggestion,
      applyGeneratedArticle,
      applyExcerpt,
      regenerateArticle,
      toggleAssistant,
      formatContent,
      
    }
  }
}
</script>

<style scoped>
.ai-assistant {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  margin-bottom: 2rem;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.assistant-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: rgba(255, 255, 255, 0.1);
}

.assistant-header h3 {
  color: white;
  margin: 0;
  font-size: 1.2rem;
}

.toggle-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.toggle-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.assistant-content {
  background: white;
  padding: 1.5rem;
}

.ai-status {
  background: #f8f9fa;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  font-size: 0.9rem;
  border-left: 4px solid #dc3545;
}

.ai-status.available {
  border-left-color: #28a745;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #dc3545;
  margin-right: 0.5rem;
}

.ai-status.available .status-dot {
  background: #28a745;
}

.status-hint {
  font-size: 0.8rem;
  color: #6c757d;
  margin-left: 0.5rem;
}

.assistant-section {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #e9ecef;
}

.assistant-section:last-child {
  border-bottom: none;
}

.assistant-section h4 {
  color: #2c3e50;
  margin-bottom: 1rem;
  font-size: 1.1rem;
}

.input-group {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.input-field, .textarea-field {
  flex: 1;
  min-width: 200px;
  padding: 0.75rem;
  border: 2px solid #e9ecef;
  border-radius: 6px;
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.input-field:focus, .textarea-field:focus {
  outline: none;
  border-color: #667eea;
}

.textarea-field {
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
}

.action-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.action-btn:hover:not(:disabled) {
  background: #218838;
  transform: translateY(-1px);
}

.action-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  transform: none;
}

.generate-btn {
  background: #007bff;
}

.generate-btn:hover:not(:disabled) {
  background: #0056b3;
}

.suggestions {
  margin-top: 1rem;
}

.suggestions h5 {
  color: #495057;
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.suggestion-item {
  background: #e7f3ff;
  border: 1px solid #b3d9ff;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.suggestion-item:hover {
  background: #d4edff;
  transform: translateX(4px);
}

.generated-content {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
  margin-top: 1rem;
  border-left: 4px solid #28a745;
}

.generated-content h5 {
  color: #495057;
  margin-bottom: 0.5rem;
}

.generated-article {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  margin-top: 1rem;
  border: 2px solid #007bff;
}

.article-preview h5 {
  color: #2c3e50;
  margin-bottom: 1rem;
  font-size: 1.2rem;
}

.article-content {
  line-height: 1.6;
  color: #495057;
  max-height: 300px;
  overflow-y: auto;
  padding: 1rem;
  background: white;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.article-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
  justify-content: center;
}

.apply-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.apply-btn:hover {
  background: #218838;
  transform: translateY(-1px);
}

.apply-btn.primary {
  background: #007bff;
}

.apply-btn.primary:hover {
  background: #0056b3;
}

/* 深色模式适配 */
.dark .ai-assistant {
  background: linear-gradient(135deg, #4b5bbf 0%, #5a3f9a 100%);
  box-shadow: none;
}
.dark .assistant-header {
  background: rgba(255, 255, 255, 0.08);
}
.dark .assistant-content {
  background: var(--card-bg);
  color: var(--text-primary);
}
.dark .ai-status {
  background: var(--bg-secondary);
}
.dark .status-hint {
  color: var(--text-secondary);
}
.dark .assistant-section h4 {
  color: var(--text-primary);
}
.dark .input-field,
.dark .textarea-field {
  background: var(--card-bg);
  color: var(--text-primary);
  border-color: var(--border-color);
}
.dark .suggestions h5,
.dark .generated-content h5,
.dark .article-preview h5 {
  color: var(--text-primary);
}
.dark .suggestion-item {
  background: var(--bg-secondary);
  border-color: var(--border-color);
}
.dark .suggestion-item:hover {
  background: #343a40;
}
.dark .generated-content {
  background: var(--bg-secondary);
  border-left-color: #28a745;
}
.dark .generated-article {
  background: var(--bg-secondary);
  border-color: var(--border-color);
}
.dark .article-content {
  background: var(--card-bg);
  color: var(--text-primary);
  border-color: var(--border-color);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .input-group {
    flex-direction: column;
  }
  
  .action-btn {
    width: 100%;
    justify-content: center;
  }
  
  .article-actions {
    flex-direction: column;
  }
}
</style>
