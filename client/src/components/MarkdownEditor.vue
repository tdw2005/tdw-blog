<template>
  <div class="markdown-editor">
    <!-- 编辑器模式切换 -->
    <div class="editor-mode">
      <button 
        type="button"
        :class="['mode-btn', { active: mode === 'edit' }]"
        @click="mode = 'edit'"
      >
        ✏️ 编辑
      </button>
      <button 
        type="button"
        :class="['mode-btn', { active: mode === 'preview' }]"
        @click="mode = 'preview'"
      >
        👁️ 预览
      </button>
      <button 
        type="button"
        :class="['mode-btn', { active: mode === 'split' }]"
        @click="mode = 'split'"
      >
        📊 分屏
      </button>
    </div>

    <!-- 分屏模式 -->
    <div v-if="mode === 'split'" class="split-editor">
      <div class="editor-pane">
        <h4 class="pane-title">编辑</h4>
        <textarea
          ref="textareaRef"
          v-model="markdownContent"
          @input="handleInput"
          class="markdown-textarea"
          :placeholder="placeholder"
          spellcheck="false"
        ></textarea>
      </div>
      <div class="preview-pane">
        <h4 class="pane-title">预览</h4>
        <div 
          class="markdown-preview"
          v-html="renderedHTML"
        ></div>
      </div>
    </div>

    <!-- 编辑模式 -->
    <div v-else-if="mode === 'edit'" class="edit-mode">
      <textarea
        ref="textareaRef"
        v-model="markdownContent"
        @input="handleInput"
        class="markdown-textarea full-height"
        :placeholder="placeholder"
        spellcheck="false"
      ></textarea>
    </div>

    <!-- 预览模式 -->
    <div v-else class="preview-mode">
      <div 
        class="markdown-preview full-height"
        v-html="renderedHTML"
      ></div>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-section">
        <button type="button" @click="insertText('**', '**')" class="toolbar-btn" title="粗体">
          <strong>B</strong>
        </button>
        <button type="button" @click="insertText('*', '*')" class="toolbar-btn" title="斜体">
          <em>I</em>
        </button>
        <button type="button" @click="insertText('`', '`')" class="toolbar-btn" title="行内代码">
          <code>`</code>
        </button>
        <button type="button" @click="insertText('```\n', '\n```')" class="toolbar-btn" title="代码块">
          <code>```</code>
        </button>
        <div class="toolbar-divider"></div>
        <button type="button" @click="insertText('# ', '')" class="toolbar-btn" title="一级标题">
          H1
        </button>
        <button type="button" @click="insertText('## ', '')" class="toolbar-btn" title="二级标题">
          H2
        </button>
        <button type="button" @click="insertText('### ', '')" class="toolbar-btn" title="三级标题">
          H3
        </button>
        <div class="toolbar-divider"></div>
        <button type="button" @click="insertText('- ', '')" class="toolbar-btn" title="无序列表">
          • 
        </button>
        <button type="button" @click="insertText('1. ', '')" class="toolbar-btn" title="有序列表">
          1.
        </button>
        
        
      </div>
      
      <div class="toolbar-section">
        <button type="button" @click="undo" class="toolbar-btn" title="撤销">
          ↩️
        </button>
        <button type="button" @click="redo" class="toolbar-btn" title="重做">
          ↪️
        </button>
        <div class="toolbar-divider"></div>
        <button type="button" @click="clearContent" class="toolbar-btn clear-btn" title="清空">
          清空
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: false
})

// 自定义渲染器用于代码高亮
const renderer = new marked.Renderer()
renderer.code = function(code, language) {
  const validLanguage = language || 'text'
  return `<pre><code class="language-${validLanguage}">${code}</code></pre>`
}

marked.use({ renderer })

export default {
  name: 'MarkdownEditor',
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    placeholder: {
      type: String,
      default: '开始使用 Markdown 编写文章...'
    },
    height: {
      type: [String, Number],
      default: 400
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const markdownContent = ref(props.modelValue || '')
    const mode = ref('split')
    const textareaRef = ref(null)
    const history = ref([props.modelValue || ''])
    const historyIndex = ref(0)

    // 计算渲染后的 HTML
    const renderedHTML = computed(() => {
      if (!markdownContent.value.trim()) {
        return '<p class="empty-preview">输入 Markdown 内容后，预览将显示在这里...</p>'
      }
      const rawHTML = marked(markdownContent.value)
      return DOMPurify.sanitize(rawHTML)
    })

    // 处理输入
    const handleInput = () => {
      emit('update:modelValue', markdownContent.value)
      addToHistory(markdownContent.value)
    }

    // 历史记录管理
    const addToHistory = (content) => {
      // 移除当前索引之后的历史记录
      history.value = history.value.slice(0, historyIndex.value + 1)
      history.value.push(content)
      historyIndex.value = history.value.length - 1
      
      // 限制历史记录数量
      if (history.value.length > 50) {
        history.value = history.value.slice(-50)
        historyIndex.value = history.value.length - 1
      }
    }

    // 撤销
    const undo = () => {
      if (historyIndex.value > 0) {
        historyIndex.value--
        markdownContent.value = history.value[historyIndex.value]
        emit('update:modelValue', markdownContent.value)
      }
    }

    // 重做
    const redo = () => {
      if (historyIndex.value < history.value.length - 1) {
        historyIndex.value++
        markdownContent.value = history.value[historyIndex.value]
        emit('update:modelValue', markdownContent.value)
      }
    }

    // 插入文本
    const insertText = (before, after) => {
      if (!textareaRef.value) return
      
      const textarea = textareaRef.value
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selectedText = markdownContent.value.substring(start, end)
      
      // 构建新内容
      const newText = before + selectedText + after
      const newContent = 
        markdownContent.value.substring(0, start) + 
        newText + 
        markdownContent.value.substring(end)
      
      // 更新内容
      markdownContent.value = newContent
      emit('update:modelValue', markdownContent.value)
      addToHistory(markdownContent.value)
      
      // 更新光标位置
      nextTick(() => {
        textarea.focus()
        const newPosition = start + (selectedText ? 0 : before.length)
        textarea.setSelectionRange(newPosition, newPosition + selectedText.length)
      })
    }

    // 清空内容
    const clearContent = () => {
      if (confirm('确定要清空所有内容吗？')) {
        markdownContent.value = ''
        emit('update:modelValue', '')
        addToHistory('')
      }
    }

    // 监听外部值变化
    watch(() => props.modelValue, (newValue) => {
      if (newValue !== markdownContent.value) {
        markdownContent.value = newValue
        addToHistory(newValue)
      }
    })

    return {
      markdownContent,
      mode,
      textareaRef,
      renderedHTML,
      handleInput,
      undo,
      redo,
      insertText,
      clearContent
    }
  }
}
</script>

<style scoped>
.markdown-editor {
  border: 2px solid var(--border-color);
  border-radius: 12px;
  background: var(--card-bg);
  overflow: hidden;
}

.editor-mode {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.mode-btn {
  flex: 1;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-secondary);
  transition: all 0.3s ease;
  border-bottom: 3px solid transparent;
}

.mode-btn:hover {
  background: var(--border-color);
}

.mode-btn.active {
  color: #667eea;
  border-bottom-color: #667eea;
  background: var(--card-bg);
}

.split-editor {
  display: grid;
  grid-template-columns: 1fr 1fr;
  height: 400px;
}

.editor-pane,
.preview-pane {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
}

.editor-pane:last-child {
  border-right: none;
}

.pane-title {
  padding: 0.75rem 1rem;
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.markdown-textarea {
  flex: 1;
  padding: 1rem;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  outline: none;
  tab-size: 2;
}

.markdown-textarea.full-height {
  height: 400px;
}

.markdown-textarea::placeholder {
  color: var(--text-secondary);
  opacity: 0.6;
}

.markdown-preview {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
  background: var(--card-bg);
  color: var(--text-primary);
  line-height: 1.6;
}

.markdown-preview.full-height {
  height: 400px;
}

.markdown-preview :deep(h1) {
  font-size: 2rem;
  margin: 1.5rem 0 1rem;
  color: var(--text-primary);
  border-bottom: 2px solid var(--border-color);
  padding-bottom: 0.5rem;
}

.markdown-preview :deep(h2) {
  font-size: 1.75rem;
  margin: 1.25rem 0 0.75rem;
  color: var(--text-primary);
}

.markdown-preview :deep(h3) {
  font-size: 1.5rem;
  margin: 1rem 0 0.5rem;
  color: var(--text-primary);
}

.markdown-preview :deep(p) {
  margin: 0.75rem 0;
}

.markdown-preview :deep(a) {
  color: #667eea;
  text-decoration: none;
}

.markdown-preview :deep(a:hover) {
  text-decoration: underline;
}

.markdown-preview :deep(code) {
  background: var(--bg-secondary);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9em;
  color: #e74c3c;
}

.markdown-preview :deep(pre) {
  background: var(--bg-secondary);
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 1rem 0;
  border: 1px solid var(--border-color);
}

.markdown-preview :deep(pre code) {
  background: none;
  padding: 0;
  color: var(--text-primary);
  font-size: 0.9em;
}

.markdown-preview :deep(blockquote) {
  border-left: 4px solid #667eea;
  margin: 1rem 0;
  padding-left: 1rem;
  color: var(--text-secondary);
  font-style: italic;
}

.markdown-preview :deep(ul),
.markdown-preview :deep(ol) {
  margin: 0.75rem 0;
  padding-left: 1.5rem;
}

.markdown-preview :deep(li) {
  margin: 0.25rem 0;
}

.markdown-preview :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 1rem 0;
}

.markdown-preview :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.markdown-preview :deep(th),
.markdown-preview :deep(td) {
  border: 1px solid var(--border-color);
  padding: 0.5rem 0.75rem;
  text-align: left;
}

.markdown-preview :deep(th) {
  background: var(--bg-secondary);
  font-weight: 600;
}

.markdown-preview .empty-preview {
  color: var(--text-secondary);
  font-style: italic;
  text-align: center;
  padding: 2rem;
  opacity: 0.6;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toolbar-btn {
  padding: 0.5rem 0.75rem;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--text-primary);
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
}

.toolbar-btn:hover {
  background: var(--border-color);
  border-color: #667eea;
  color: #667eea;
}

.toolbar-btn :deep(strong),
.toolbar-btn :deep(em),
.toolbar-btn :deep(code) {
  font-style: normal;
  font-weight: 600;
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--border-color);
  margin: 0 0.25rem;
}

.clear-btn {
  background: #fee;
  color: #e74c3c;
  border-color: #e74c3c;
}

.clear-btn:hover {
  background: #fcc;
}

/* 暗色主题调整 */
.dark .markdown-preview :deep(pre) {
  background: #2d2d2d;
}

.dark .markdown-preview :deep(code) {
  background: #3d3d3d;
  color: #f8f8f2;
}

.dark .clear-btn {
  background: #442;
  color: #ff6b6b;
  border-color: #ff6b6b;
}

.dark .clear-btn:hover {
  background: #553;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .split-editor {
    grid-template-columns: 1fr;
    height: 600px;
  }
  
  .editor-pane {
    border-right: none;
    border-bottom: 1px solid var(--border-color);
  }
  
  .toolbar {
    flex-direction: column;
    gap: 0.5rem;
    align-items: stretch;
  }
  
  .toolbar-section {
    justify-content: center;
  }
}
</style>
