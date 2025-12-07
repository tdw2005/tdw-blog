<template>
  <div class="tag-cloud">
    <h3 class="tag-cloud-title">标签云</h3>
    <div class="tags-container">
      <span
        v-for="tag in tags"
        :key="tag.name"
        class="tag-cloud-item"
        :style="{
          fontSize: `${tag.size}rem`,
          opacity: tag.opacity,
          transform: `scale(${tag.scale})`
        }"
        @click="handleTagClick(tag.name)"
      >
        {{ tag.name }}
      </span>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'

export default {
  name: 'TagCloud',
  props: {
    articles: {
      type: Array,
      default: () => []
    }
  },
  setup(props) {
    const router = useRouter()
    const tags = ref([])

    const fetchTags = async () => {
      try {
        const res = await fetch('/api/tags')
        const data = await res.json()
        if (data && data.success && data.data && Array.isArray(data.data.tags) && data.data.tags.length > 0) {
          const max = data.data.tags.reduce((mx, x) => x.count > mx ? x.count : mx, 1)
          tags.value = data.data.tags.map(function (x) {
            return {
              name: x.name,
              count: x.count,
              size: 0.8 + (x.count / max) * 1.2,
              opacity: 0.6 + (x.count / max) * 0.4,
              scale: 0.9 + (x.count / max) * 0.2
            }
          }).sort(function (a, b) { return b.count - a.count })
          return
        }
      } catch (e) {}
      tags.value = [{ name: '暂无标签', count: 1, size: 1, opacity: 1, scale: 1 }]
    }

    const handleRefresh = () => { fetchTags() }

    onMounted(() => {
      fetchTags()
      window.addEventListener('tags-refresh', handleRefresh)
    })

    onBeforeUnmount(() => {
      window.removeEventListener('tags-refresh', handleRefresh)
    })

    const handleTagClick = (tagName) => {
      router.push(`/?search=${encodeURIComponent(tagName)}&searchType=tags`)
    }

    return {
      tags,
      handleTagClick
    }
  }
}
</script>

<style scoped>
.tag-cloud {
  background: var(--card-bg);
  padding: 2rem;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--border-color);
  margin-bottom: 2rem;
}

.tag-cloud-title {
  color: var(--text-primary);
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
  font-weight: 700;
  text-align: center;
  border-bottom: 2px solid var(--border-color);
  padding-bottom: 0.5rem;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
  align-items: center;
  min-height: 120px;
}

.tag-cloud-item {
  display: inline-block;
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.tag-cloud-item:hover {
  transform: translateY(-3px) scale(1.1);
  box-shadow: 0 6px 12px rgba(102, 126, 234, 0.4);
}

/* 暗色模式调整 */
.dark .tag-cloud-item {
  background: linear-gradient(135deg, #4a5568, #2d3748);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .tag-cloud {
    padding: 1.5rem;
  }
  
  .tags-container {
    gap: 0.75rem;
  }
  
  .tag-cloud-item {
    padding: 0.4rem 0.8rem;
    font-size: 0.9rem !important;
  }
}
</style>
