<template>
  <div class="article-export">
    <!-- 导出按钮 -->
    <button @click="toggleExportPanel" class="export-btn">
      📤 导出文章
    </button>

    <!-- 导出面板 -->
    <div v-if="showExportPanel" class="export-panel">
      <div class="panel-header">
        <h3>导出文章</h3>
        <button @click="closeExportPanel" class="close-btn">×</button>
      </div>

      <!-- 导出选项 -->
      <div class="export-options">
        <div class="option-group">
          <h4>导出格式</h4>
          <div class="format-options">
            <label class="format-option">
              <input type="radio" v-model="exportFormat" value="pdf">
              <div class="format-card">
                <span class="format-icon">📄</span>
                <div class="format-content">
                  <h5>PDF 文档</h5>
                  <p>适合打印和正式分享</p>
                </div>
              </div>
            </label>

            <label class="format-option">
              <input type="radio" v-model="exportFormat" value="markdown">
              <div class="format-card">
                <span class="format-icon">📝</span>
                <div class="format-content">
                  <h5>Markdown 文件</h5>
                  <p>保持原始格式，适合在其他平台使用</p>
                </div>
              </div>
            </label>
          </div>
        </div>

        <!-- PDF 设置 -->
        <div v-if="exportFormat === 'pdf'" class="option-group">
          <h4>PDF 设置</h4>
          <div class="pdf-settings">
            <div class="setting-item">
              <label>页面尺寸</label>
              <select v-model="pdfSettings.pageSize">
                <option value="A4">A4</option>
                <option value="A3">A3</option>
                <option value="Letter">Letter</option>
                <option value="Legal">Legal</option>
              </select>
            </div>

            <div class="setting-item">
              <label>页面方向</label>
              <select v-model="pdfSettings.orientation">
                <option value="portrait">纵向</option>
                <option value="landscape">横向</option>
              </select>
            </div>

            <div class="setting-item">
              <label>边距（毫米）</label>
              <input 
                type="number" 
                v-model.number="pdfSettings.margin"
                min="0"
                max="50"
                step="1"
                class="margin-input"
              >
            </div>

            <div class="setting-item checkbox">
              <label>
                <input type="checkbox" v-model="pdfSettings.includeMetadata">
                包含元数据
              </label>
            </div>

            <div class="setting-item checkbox">
              <label>
                <input type="checkbox" v-model="pdfSettings.includeTags">
                包含标签
              </label>
            </div>

            <div class="setting-item checkbox">
              <label>
                <input type="checkbox" v-model="pdfSettings.includeStats">
                包含统计信息
              </label>
            </div>
          </div>
        </div>

        <!-- Markdown 设置 -->
        <div v-if="exportFormat === 'markdown'" class="option-group">
          <h4>Markdown 设置</h4>
          <div class="markdown-settings">
            <div class="setting-item checkbox">
              <label>
                <input type="checkbox" v-model="mdSettings.includeFrontMatter">
                包含 Front Matter
              </label>
            </div>

            <div class="setting-item checkbox">
              <label>
                <input type="checkbox" v-model="mdSettings.includeSeparator">
                包含分隔线
              </label>
            </div>

            <div class="setting-item checkbox">
              <label>
                <input type="checkbox" v-model="mdSettings.includeTimestamp">
                包含时间戳
              </label>
            </div>
          </div>
        </div>

        <!-- 文件名设置 -->
        <div class="option-group">
          <h4>文件设置</h4>
          <div class="file-settings">
            <div class="setting-item">
              <label>文件名</label>
              <input 
                type="text" 
                v-model="fileName"
                :placeholder="defaultFileName"
                class="filename-input"
              >
              <small class="file-extension">.{{ exportFormat === 'pdf' ? 'pdf' : 'md' }}</small>
            </div>
          </div>
        </div>

        <!-- 预览 -->
        <div class="option-group">
          <h4>预览</h4>
          <div class="preview-container">
            <div class="preview-header">
              <span class="preview-title">{{ article.title }}</span>
              <span class="preview-size">{{ previewSize }}</span>
            </div>
            <div class="preview-content">
              <div v-if="exportFormat === 'pdf'" class="pdf-preview">
                <div class="preview-page">
                  <h3 class="preview-heading">{{ article.title }}</h3>
                  <div class="preview-meta">
                    <span>作者: {{ article.author }}</span>
                    <span>日期: {{ formatDate(article.created_at) }}</span>
                  </div>
                  
                  <div v-if="pdfSettings.includeTags && article.tags && article.tags.length > 0" class="preview-tags">
                    <span v-for="tag in article.tags" :key="tag" class="preview-tag">{{ tag }}</span>
                  </div>
                  
                  <div class="preview-text">
                    <div v-for="(line, index) in previewLines" :key="index" class="preview-line" :style="{ width: `${line.width}%` }"></div>
                  </div>
                  
                  <div v-if="pdfSettings.includeStats" class="preview-stats">
                    <div class="preview-stat">
                      <span class="stat-label">阅读量</span>
                      <span class="stat-value">{{ article.view_count || 0 }}</span>
                    </div>
                    <div class="preview-stat">
                      <span class="stat-label">评论数</span>
                      <span class="stat-value">{{ article.comment_count || 0 }}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div v-else class="markdown-preview">
                <pre class="preview-markdown">{{ previewMarkdown }}</pre>
              </div>
            </div>
          </div>
          <p class="preview-note">* 预览为示意内容，实际导出内容会更完整</p>
        </div>

        <!-- 导出按钮 -->
        <div class="export-actions">
          <button @click="closeExportPanel" class="cancel-btn">
            取消
          </button>
          <button @click="exportArticle" :disabled="exporting" class="export-action-btn">
            {{ exporting ? exportProgress : '开始导出' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 遮罩层 -->
    <div v-if="showExportPanel" class="export-overlay" @click="closeExportPanel"></div>
  </div>
</template>

<script>
import { ref, reactive, computed, watch, onMounted } from 'vue'

export default {
  name: 'ArticleExport',
  props: {
    article: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    const showExportPanel = ref(false)
    const exporting = ref(false)
    const exportProgress = ref('')
    const exportFormat = ref('pdf')
    const fileName = ref('')

    // PDF 设置
    const pdfSettings = reactive({
      pageSize: 'A4',
      orientation: 'portrait',
      margin: 10,
      includeMetadata: true,
      includeTags: true,
      includeStats: true
    })

    // Markdown 设置
    const mdSettings = reactive({
      includeFrontMatter: true,
      includeSeparator: true,
      includeTimestamp: true
    })

    // 预览线条（用于PDF预览）
    const previewLines = ref([
      { width: 90 },
      { width: 85 },
      { width: 95 },
      { width: 80 },
      { width: 88 },
      { width: 82 },
      { width: 91 },
      { width: 78 }
    ])

    // 计算预览尺寸
    const previewSize = computed(() => {
      if (exportFormat.value === 'pdf') {
        const orientation = pdfSettings.orientation === 'portrait' ? '纵向' : '横向'
        return `${pdfSettings.pageSize} ${orientation}`
      } else {
        return 'Markdown 文件'
      }
    })

    // 默认文件名
    const defaultFileName = computed(() => {
      const title = props.article.title || '文章'
      const safeTitle = title
        .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 50)
      
      const date = new Date().toISOString().split('T')[0]
      return `${safeTitle}_${date}`
    })

    // 完整文件名
    const fullFileName = computed(() => {
      const name = fileName.value || defaultFileName.value
      const ext = exportFormat.value === 'pdf' ? '.pdf' : '.md'
      return name.endsWith(ext) ? name : name + ext
    })

    // 预览Markdown内容
    const previewMarkdown = computed(() => {
      const article = props.article
      let md = ''
      
      if (mdSettings.includeFrontMatter) {
        md += `---
title: "${article.title}"
author: "${article.author}"
date: "${article.created_at}"
${article.tags && article.tags.length > 0 ? `tags: [${article.tags.map(tag => `"${tag}"`).join(', ')}]\n` : ''}---
`
      }
      
      md += `# ${article.title}\n\n`
      md += `作者：${article.author}\n\n`
      
      if (article.excerpt) {
        md += `> ${article.excerpt}\n\n`
      }
      
      if (mdSettings.includeSeparator) {
        md += `---\n\n`
      }
      
      // 使用真实内容的前200字符作为预览
      let contentPreview = ''
      if (article.content) {
        if (article.editor_type === 'markdown') {
          contentPreview = article.content.substring(0, 200).replace(/[#*`\[\]]/g, '') + '...'
        } else {
          contentPreview = article.content.substring(0, 200).replace(/<[^>]*>/g, '') + '...'
        }
      }
      md += `${contentPreview}\n\n`
      
      if (mdSettings.includeTimestamp) {
        md += `---\n\n`
        md += `导出时间：${new Date().toLocaleString('zh-CN')}\n`
      }
      
      return md
    })

    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return ''
      const date = new Date(dateString)
      return date.toLocaleDateString('zh-CN')
    }

    // 切换导出面板
    const toggleExportPanel = () => {
      showExportPanel.value = !showExportPanel.value
      if (showExportPanel.value) {
        fileName.value = defaultFileName.value
      }
    }

    // 关闭导出面板
    const closeExportPanel = () => {
      showExportPanel.value = false
      exporting.value = false
      exportProgress.value = ''
    }

    // 生成PDF内容HTML
    const generatePDFHTML = () => {
      const article = props.article
      return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${article.title}</title>
    <style>
${generatePDFCSS()}
    </style>
</head>
<body>
    <div class="header">
        <h1>${article.title}</h1>
        ${generateHeaderMetadata(article)}
        ${generateArticleTags(article)}
        ${generateArticleStats(article)}
    </div>
    
    <div class="content">
        ${processArticleContent(article)}
    </div>
    
    <div class="footer">
        <p>导出时间：${new Date().toLocaleString('zh-CN')}</p>
        <p>来源：星云博客</p>
    </div>
</body>
</html>
`
    }
    
    // 生成PDF样式
    const generatePDFCSS = () => {
      return `
        body {
            font-family: 'Microsoft YaHei', 'SimSun', sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: ${pdfSettings.margin}mm;
            max-width: ${pdfSettings.pageSize === 'A3' ? '297mm' : '210mm'};
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #667eea;
        }
        
        h1 {
            color: #2c3e50;
            font-size: 28px;
            margin-bottom: 10px;
        }
        
        .meta {
            color: #7f8c8d;
            font-size: 14px;
            margin-bottom: 15px;
        }
        
        .tags {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            justify-content: center;
            margin-bottom: 20px;
        }
        
        .tag {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
        }
        
        .stats {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin: 25px 0;
            color: #95a5a6;
            font-size: 14px;
        }
        
        .stat-item {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        
        .stat-value {
            font-weight: bold;
            font-size: 18px;
            color: #2c3e50;
        }
        
        .content {
            margin-top: 30px;
            font-size: 16px;
        }
        
        .content h2 {
            color: #2c3e50;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
            margin-top: 25px;
        }
        
        .content h3 {
            color: #34495e;
        }
        
        .content p {
            margin: 15px 0;
        }
        
        .content code {
            background: #f5f5f5;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: Consolas, monospace;
            font-size: 14px;
        }
        
        .content pre {
            background: #2d2d2d;
            color: #f8f8f2;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            margin: 15px 0;
            font-family: Consolas, monospace;
            font-size: 14px;
            line-height: 1.4;
        }
        
        .content blockquote {
            border-left: 4px solid #667eea;
            margin: 15px 0;
            padding-left: 15px;
            color: #555;
            font-style: italic;
        }
        
        .content ul, .content ol {
            margin: 15px 0;
            padding-left: 30px;
        }
        
        .content li {
            margin: 5px 0;
        }
        
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #95a5a6;
            font-size: 12px;
        }
        
        @media print {
            body {
                padding: ${pdfSettings.margin}mm;
            }
            @page {
                size: ${pdfSettings.pageSize} ${pdfSettings.orientation};
                margin: 0;
            }
        }`
    }
    
    // 生成元数据HTML
    const generateHeaderMetadata = (article) => {
      if (!pdfSettings.includeMetadata) return ''
      
      const date = formatDate(article.created_at)
      const updatedDate = formatDate(article.updated_at)
      const hasUpdate = article.updated_at !== article.created_at
      
      return `
        <div class="meta">
            <span>作者：${article.author_nickname || article.author}</span>
            <span style="margin: 0 10px">|</span>
            <span>发布日期：${date}</span>
            ${hasUpdate ? `<span style="margin: 0 10px">|</span><span>最后更新：${updatedDate}</span>` : ''}
        </div>`
    }
    
    // 生成标签HTML
    const generateArticleTags = (article) => {
      if (!pdfSettings.includeTags || !article.tags || article.tags.length === 0) return ''
      
      return `
        <div class="tags">
            ${article.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
        </div>`
    }
    
    // 生成统计信息HTML
    const generateArticleStats = (article) => {
      if (!pdfSettings.includeStats) return ''
      
      return `
        <div class="stats">
            <div class="stat-item">
                <span>阅读量</span>
                <span class="stat-value">${article.view_count || 0}</span>
            </div>
            <div class="stat-item">
                <span>评论数</span>
                <span class="stat-value">${article.comment_count || 0}</span>
            </div>
        </div>`
    }
    
    // 处理Markdown转HTML
    const markdownToHtml = (content) => {
      return content
        // 标题
        .replace(/^# (.*$)/gm, '<h2>$1</h2>')
        .replace(/^## (.*$)/gm, '<h3>$1</h3>')
        .replace(/^### (.*$)/gm, '<h4>$1</h4>')
        // 粗体
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // 斜体
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // 行内代码
        .replace(/`(.*?)`/g, '<code>$1</code>')
        // 代码块
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        // 引用
        .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
        // 无序列表
        .replace(/^- (.*$)/gm, '<li>$1</li>')
        // 有序列表
        .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
        // 图片
        .replace(/!\[(.*?)\]\((.*?)\)/g, '<img alt="$1" src="$2" style="max-width:100%;height:auto;margin:10px 0;">')
        // 链接
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
        // 换行
        .replace(/\n/g, '<br>')
    }
    
    // 处理文章内容
    const processArticleContent = (article) => {
      let content = article.content || ''
      
      if (article.editor_type === 'markdown') {
        // Markdown转换
        content = markdownToHtml(content)
        // 添加列表容器
        content = content.replace(/<li>/g, '<ul><li>').replace(/<\/li>/g, '</li></ul>')
      } else {
        // 富文本内容，简单处理
        content = content
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>')
      }
      
      return content
    }

    // 生成Markdown内容
    const generateMarkdownContent = () => {
      const article = props.article
      const exportTime = new Date().toLocaleString('zh-CN')
      
      let md = ''

      // 添加 Front Matter
      if (mdSettings.includeFrontMatter) {
        md += `---
title: "${article.title}"
author: "${article.author_nickname || article.author}"
date: "${article.created_at}"
status: "${article.status || 'published'}"
${article.tags && article.tags.length > 0 ? `tags: [${article.tags.map(tag => `"${tag}"`).join(', ')}]\n` : ''}---
`
      }

      // 添加标题
      md += `# ${article.title}\n\n`

      // 添加元数据
      md += `**作者**：${article.author_nickname || article.author}  \n`
      md += `**发布日期**：${formatDate(article.created_at)}  \n`
      if (article.tags && article.tags.length > 0) {
        md += `**标签**：${article.tags.join(', ')}  \n`
      }
      md += `**状态**：${article.status === 'published' ? '已发布' : '草稿'}  \n\n`

      // 添加摘要
      if (article.excerpt) {
        md += `> ${article.excerpt}\n\n`
      }

      // 添加分隔线
      if (mdSettings.includeSeparator) {
        md += `---\n\n`
      }

      // 添加内容
      if (article.editor_type === 'markdown') {
        // 如果是Markdown内容，直接使用
        md += article.content + '\n\n'
      } else {
        // 如果是富文本内容，进行简单的转换
        const lines = (article.content || '').split('\n')
        lines.forEach(line => {
          if (line.trim()) {
            // 尝试识别一些基本格式
            if (line.startsWith('# ')) {
              md += `# ${line.substring(2)}\n\n`
            } else if (line.startsWith('## ')) {
              md += `## ${line.substring(3)}\n\n`
            } else if (line.startsWith('### ')) {
              md += `### ${line.substring(4)}\n\n`
            } else if (line.startsWith('> ')) {
              md += `> ${line.substring(2)}\n\n`
            } else if (line.includes('**') || line.includes('__')) {
              // 简单的粗体处理
              let formatted = line
                .replace(/\*\*(.*?)\*\*/g, '**$1**')
                .replace(/__(.*?)__/g, '**$1**')
              md += formatted + '\n\n'
            } else {
              md += line + '\n\n'
            }
          }
        })
      }

      // 添加分隔线
      if (mdSettings.includeSeparator) {
        md += `---\n\n`
      }

      // 添加统计信息
      const wordCount = article.content ? article.content.replace(/\s/g, '').length : 0
      const readingTime = Math.ceil(wordCount / 300) || 1
      
      md += `## 文章统计\n\n`
      md += `- 阅读量：${article.view_count || 0}\n`
      md += `- 评论数：${article.comment_count || 0}\n`
      md += `- 字数：${wordCount}\n`
      md += `- 预计阅读时间：${readingTime}分钟\n\n`

      // 添加时间戳
      if (mdSettings.includeTimestamp) {
        md += `---\n\n`
        md += `> 导出时间：${exportTime}\n`
        md += `> 来源：星云博客\n`
      }

      return md
    }

    // 导出为 PDF - 使用浏览器打印功能
    const exportToPDF = async () => {
      exporting.value = true
      exportProgress.value = '生成PDF...'
      
      try {
        // 生成PDF HTML内容
        const html = generatePDFHTML()
        
        // 打开新窗口并写入内容
        const printWindow = window.open('', '_blank')
        if (!printWindow) {
          throw new Error('请允许弹出窗口以导出PDF')
        }
        
        printWindow.document.write(html)
        printWindow.document.close()
        
        // 等待内容加载
        await new Promise(resolve => setTimeout(resolve, 500))
        
        exportProgress.value = '准备打印...'
        
        // 给用户提示
        setTimeout(() => {
          printWindow.focus()
          printWindow.print()
          exportProgress.value = '完成！'
          
          // 3秒后关闭窗口
          setTimeout(() => {
            if (!printWindow.closed) {
              printWindow.close()
            }
            exporting.value = false
            closeExportPanel()
          }, 3000)
        }, 1000)
        
      } catch (error) {
        alert('PDF导出失败：' + error.message + '\n\n您可以尝试以下方法：\n1. 允许浏览器弹出窗口\n2. 复制以下HTML内容，保存为.html文件后打印：\n\n' + generatePDFHTML().substring(0, 500) + '...')
        exporting.value = false
        exportProgress.value = ''
      }
    }

    // 导出为 Markdown
    const exportToMarkdown = () => {
      return new Promise((resolve) => {
        exportProgress.value = '生成Markdown...'
        
        // 生成Markdown内容
        const markdown = generateMarkdownContent()
        
        exportProgress.value = '创建文件...'
        
        // 创建Blob和下载链接
        const blob = new Blob([markdown], { 
          type: 'text/markdown;charset=utf-8' 
        })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        
        link.href = url
        link.download = fullFileName.value
        link.style.display = 'none'
        
        document.body.appendChild(link)
        link.click()
        
        // 清理
        setTimeout(() => {
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
          exportProgress.value = '完成！'
          setTimeout(() => {
            exporting.value = false
            closeExportPanel()
            resolve()
          }, 500)
        }, 100)
      })
    }

    // 导出文章主函数
    const exportToPDFServer = async () => {
      exportProgress.value = '生成PDF...'
      const params = new URLSearchParams({
        pageSize: pdfSettings.pageSize,
        orientation: pdfSettings.orientation,
        margin: String(pdfSettings.margin),
        includeMetadata: String(pdfSettings.includeMetadata),
        includeTags: String(pdfSettings.includeTags),
        includeStats: String(pdfSettings.includeStats)
      })

      const res = await fetch(`/api/articles/${props.article.id}/export/pdf?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      })
      if (!res.ok) throw new Error('服务器生成PDF失败')
      exportProgress.value = '创建文件...'
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fullFileName.value
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      setTimeout(() => {
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }, 100)
      exportProgress.value = '完成！'
      setTimeout(() => {
        exporting.value = false
        closeExportPanel()
      }, 500)
    }

    const exportArticle = async () => {
      exporting.value = true
      try {
        if (exportFormat.value === 'pdf') {
          // 优先走服务器直接下载
          try {
            await exportToPDFServer()
          } catch (e) {
            // 回退到浏览器打印
            await exportToPDF()
          }
        } else {
          await exportToMarkdown()
        }
      } catch (error) {
        alert('导出失败：' + error.message)
        exporting.value = false
        exportProgress.value = ''
      }
    }

    // 监听导出格式变化，重置文件名后缀
    watch(exportFormat, (newFormat) => {
      // 移除原有后缀
      let name = fileName.value
      if (name) {
        name = name.replace(/\.(pdf|md|markdown)$/i, '')
        fileName.value = name
      }
    })

    onMounted(() => {
      fileName.value = defaultFileName.value
    })

      return {
        showExportPanel,
        exporting,
        exportProgress,
        exportFormat,
        fileName,
        pdfSettings,
        mdSettings,
        previewLines,
        previewSize,
        previewMarkdown,
        defaultFileName,
        formatDate,
        toggleExportPanel,
        closeExportPanel,
        exportArticle
      }
  }
}
</script>

<style scoped>
.article-export {
  position: relative;
  display: inline-block;
}

.export-btn {
  background: linear-gradient(135deg, #3498db, #2980b9);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 2px 4px rgba(52, 152, 219, 0.2);
}

.export-btn:hover {
  background: linear-gradient(135deg, #2980b9, #21618c);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(52, 152, 219, 0.3);
}

.export-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  background: var(--card-bg);
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  z-index: 1001;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.panel-header h3 {
  margin: 0;
  font-size: 1.5rem;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 2rem;
  cursor: pointer;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.3s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.export-options {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.option-group {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.option-group:last-child {
  margin-bottom: 0;
}

.option-group h4 {
  margin: 0 0 1rem;
  color: var(--text-primary);
  font-size: 1.2rem;
}

.format-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.format-option {
  display: block;
  cursor: pointer;
}

.format-option input[type="radio"] {
  display: none;
}

.format-card {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem;
  border: 2px solid var(--border-color);
  border-radius: 12px;
  background: var(--card-bg);
  transition: all 0.3s ease;
}

.format-option input[type="radio"]:checked + .format-card {
  border-color: #667eea;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
  transform: translateY(-2px);
}

.format-option input[type="radio"]:checked + .format-card .format-icon {
  background: #667eea;
  color: white;
}

.format-icon {
  font-size: 1.75rem;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--border-color);
  border-radius: 10px;
  transition: all 0.3s ease;
}

.format-content {
  flex: 1;
}

.format-content h5 {
  font-size: 1.1rem;
  color: var(--text-primary);
  margin: 0 0 0.25rem;
  font-weight: 600;
}

.format-content p {
  color: var(--text-secondary);
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.4;
}

.pdf-settings,
.markdown-settings,
.file-settings {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;
}

.setting-item.checkbox {
  flex-direction: row;
  align-items: center;
  grid-column: 1 / -1;
}

.setting-item.checkbox label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.setting-item.checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.setting-item label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.setting-item select,
.filename-input,
.margin-input {
  padding: 0.75rem;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.margin-input {
  padding-right: 3rem;
}

.filename-input {
  padding-right: 3.5rem;
}

.setting-item select:focus,
.filename-input:focus,
.margin-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
}

.file-extension {
  position: absolute;
  right: 0.75rem;
  bottom: 0.75rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
  pointer-events: none;
}

.preview-container {
  border: 2px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  background: var(--card-bg);
  margin-bottom: 0.5rem;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.preview-title {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.95rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.preview-size {
  font-size: 0.85rem;
  color: var(--text-secondary);
  background: var(--border-color);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  margin-left: 1rem;
}

.preview-content {
  padding: 1rem;
  min-height: 200px;
}

.pdf-preview {
  display: flex;
  justify-content: center;
}

.preview-page {
  width: 210mm;
  height: 297mm;
  background: white;
  border: 1px solid #ddd;
  transform: scale(0.3);
  transform-origin: top center;
  padding: 20mm;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  position: relative;
}

.preview-heading {
  font-size: 2rem;
  color: #2c3e50;
  text-align: center;
  margin-bottom: 1rem;
  font-weight: bold;
}

.preview-meta {
  display: flex;
  justify-content: center;
  gap: 2rem;
  color: #7f8c8d;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
  text-align: center;
}

.preview-tags {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.preview-tag {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 0.3rem 0.8rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
}

.preview-text {
  margin: 2rem 0;
}

.preview-line {
  height: 0.6rem;
  background: #f0f0f0;
  margin-bottom: 0.8rem;
  border-radius: 3px;
}

.preview-stats {
  display: flex;
  justify-content: center;
  gap: 3rem;
  margin-top: 3rem;
  padding-top: 1.5rem;
  border-top: 1px solid #eee;
}

.preview-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-label {
  font-size: 0.8rem;
  color: #95a5a6;
  margin-bottom: 0.3rem;
}

.stat-value {
  font-size: 1.2rem;
  font-weight: bold;
  color: #2c3e50;
}

.markdown-preview {
  background: var(--bg-secondary);
  border-radius: 6px;
  padding: 1rem;
  max-height: 300px;
  overflow-y: auto;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
  white-space: pre-wrap;
}

.preview-markdown {
  margin: 0;
  color: var(--text-primary);
}

.preview-note {
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-align: center;
  margin-top: 0.5rem;
  font-style: italic;
}

.export-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-color);
}

.cancel-btn, .export-action-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  transition: all 0.3s ease;
}

.cancel-btn {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.cancel-btn:hover {
  background: var(--border-color);
}

.export-action-btn {
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
}

.export-action-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #218838, #1ba87e);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(40, 167, 69, 0.3);
}

.export-action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.export-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .export-panel {
    width: 95%;
    max-height: 95vh;
  }
  
  .format-options {
    grid-template-columns: 1fr;
  }
  
  .pdf-settings,
  .markdown-settings,
  .file-settings {
    grid-template-columns: 1fr;
  }
  
  .preview-page {
    transform: scale(0.2);
  }
  
  .export-actions {
    flex-direction: column;
  }
  
  .cancel-btn, .export-action-btn {
    width: 100%;
  }
}

/* 暗色主题适配 */
.dark .format-card {
  background: var(--card-bg);
  border-color: #495057;
}

.dark .preview-page {
  background: #2d2d2d;
  border-color: #495057;
}

.dark .preview-heading {
  color: #e9ecef;
}

.dark .preview-meta {
  color: #adb5bd;
}

.dark .preview-line {
  background: #495057;
}

.dark .stat-label {
  color: #adb5bd;
}

.dark .stat-value {
  color: #e9ecef;
}

.dark .markdown-preview {
  background: #2d2d2d;
  border: 1px solid #495057;
}

.dark .preview-markdown {
  color: #e9ecef;
}
</style>
