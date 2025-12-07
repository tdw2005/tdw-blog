/**
 * 缓存降级策略
 */

class CacheFallback {
    constructor(redisClient, pool) {
        this.redisClient = redisClient;
        this.pool = pool;
        this.memoryCache = new Map();
    }

    // 尝试从 Redis 获取，失败则从内存缓存获取
    async getWithFallback(key) {
        try {
            // 首先尝试 Redis
            if (this.redisClient.isConnected) {
                const result = await this.redisClient.get(key);
                if (result) {
                    return result;
                }
            }

            // Redis 不可用或未命中，尝试内存缓存
            const memoryItem = this.memoryCache.get(key);
            if (memoryItem && memoryItem.expire > Date.now()) {
                return memoryItem.value;
            }

            return null;
        } catch (error) {
            console.error(' Cache fallback error:', error);
            return null;
        }
    }

    // 设置缓存，优先 Redis，失败则使用内存缓存
    async setWithFallback(key, value, ttl = 3600) {
        try {
            // 首先尝试 Redis
            if (this.redisClient.isConnected) {
                const success = await this.redisClient.set(key, value, ttl);
                if (success) {
                    return true;
                }
            }

            // Redis 不可用，使用内存缓存
            this.memoryCache.set(key, {
                value,
                expire: Date.now() + (ttl * 1000)
            });
            return true;
        } catch (error) {
            console.error(' Cache set fallback error:', error);
            return false;
        }
    }

    // 获取文章数据的降级策略
    async getArticleFallback(articleId) {
        try {
            // 如果数据库不可用，返回基础文章数据
            const fallbackArticle = {
                id: articleId,
                title: '文章加载中...',
                content: '系统正在恢复，请稍后刷新页面。',
                author: '系统',
                view_count: 0,
                created_at: new Date().toISOString(),
                fallback: true
            };

            return fallbackArticle;
        } catch (error) {
            console.error('Article fallback error:', error);
            return null;
        }
    }

    // 获取文章列表的降级策略
    async getArticlesFallback(page = 1, limit = 10) {
        try {
            const fallbackArticles = Array.from({ length: 5 }, (_, index) => ({
                id: `fallback-${index}`,
                title: '文章加载中...',
                excerpt: '系统正在努力恢复数据...',
                author: '系统',
                view_count: 0,
                created_at: new Date().toISOString(),
                fallback: true
            }));

            return {
                articles: fallbackArticles,
                pagination: {
                    page,
                    limit,
                    total: 0,
                    totalPages: 0
                },
                fallback: true
            };
        } catch (error) {
            console.error('Articles fallback error:', error);
            return { articles: [], pagination: { page, limit, total: 0, totalPages: 0 }, fallback: true };
        }
    }

    // 清理过期内存缓存
    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.memoryCache.entries()) {
            if (item.expire && item.expire < now) {
                this.memoryCache.delete(key);
            }
        }
    }
}

module.exports = CacheFallback;
