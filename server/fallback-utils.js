/**
 * 服务端降级工具函数
 */

// 数据库健康检查
const checkDatabaseHealth = async (pool) => {
    try {
        const connection = await pool.getConnection();
        await connection.execute('SELECT 1');
        connection.release();
        return true;
    } catch (error) {
        console.error(' Database health check failed:', error);
        return false;
    }
};

// Redis 健康检查
const checkRedisHealth = async (redisClient) => {
    try {
        if (redisClient.isConnected) {
            // 增加超时时间
            await Promise.race([
                redisClient.get('health-check'),
                new Promise(resolve => setTimeout(() => resolve(null), 1000))
            ]);
            return true;
        }
        return false;
    } catch (error) {
        console.error(' Redis health check failed:', error);
        return false;
    }
};

// 生成降级 HTML 页面
const generateFallbackHTML = (title = '服务暂时不可用', message = '系统正在努力恢复中，请稍后重试。') => {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - SSR博客系统</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .fallback-container {
            max-width: 500px;
            width: 90%;
            background: white;
            padding: 3rem;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            text-align: center;
        }
        .fallback-icon {
            font-size: 4rem;
            margin-bottom: 1.5rem;
        }
        .fallback-title {
            font-size: 1.8rem;
            margin-bottom: 1rem;
            color: #2c3e50;
            font-weight: 700;
        }
        .fallback-message {
            margin-bottom: 2rem;
            color: #666;
            line-height: 1.6;
            font-size: 1.1rem;
        }
        .retry-btn {
            background: linear-gradient(135deg, #3498db, #2980b9);
            color: white;
            border: none;
            padding: 1rem 2rem;
            border-radius: 50px;
            font-size: 1.1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            font-weight: 600;
            margin-bottom: 2rem;
            box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);
        }
        .retry-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(52, 152, 219, 0.4);
        }
        .skeleton-loading {
            margin: 2rem 0;
        }
        .skeleton {
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: loading 1.5s infinite;
            border-radius: 8px;
            margin-bottom: 1rem;
        }
        .skeleton-header {
            height: 2rem;
            width: 70%;
            margin: 0 auto 1.5rem;
        }
        .skeleton-line {
            height: 1rem;
            width: 90%;
            margin: 0 auto 0.8rem;
        }
        .skeleton-line.short {
            width: 60%;
        }
        .status-info {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 10px;
            margin-top: 1.5rem;
            font-size: 0.9rem;
            color: #6c757d;
        }
        @keyframes loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
        .fallback-nav {
            background: #2c3e50;
            color: white;
            padding: 1rem 0;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
        }
        .nav-content {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 2rem;
        }
        .fallback-footer {
            margin-top: 2rem;
            padding-top: 1.5rem;
            border-top: 1px solid #e9ecef;
            color: #868e96;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <nav class="fallback-nav">
        <div class="nav-content">
            <div class="logo" style="font-size: 1.5rem; font-weight: bold;">SSR博客</div>
            <div class="nav-links">
                <a href="/" style="color: white; margin-left: 2rem; text-decoration: none;">首页</a>
                <a href="/create" style="color: white; margin-left: 2rem; text-decoration: none;">写文章</a>
            </div>
        </div>
    </nav>

    <div class="fallback-container">
        <div class="fallback-icon"> </div>
        <h1 class="fallback-title">${title}</h1>
        <p class="fallback-message">${message}</p>
        
        <div class="skeleton-loading">
            <div class="skeleton skeleton-header"></div>
            <div class="skeleton skeleton-line"></div>
            <div class="skeleton skeleton-line"></div>
            <div class="skeleton skeleton-line short"></div>
        </div>
        
        <button class="retry-btn" onclick="window.location.reload()">
             刷新重试
        </button>

        <div class="status-info">
            <strong>系统状态:</strong><br>
            • 客户端渲染模式已激活<br>
            • 基础功能可用<br>
            • 数据加载中...
        </div>

        <div class="fallback-footer">
            <p>如果问题持续存在，请联系系统管理员</p>
        </div>
    </div>

    <script>
        let retryCount = parseInt(localStorage.getItem('fallback_retry_count') || '0');
        localStorage.setItem('fallback_retry_count', (retryCount + 1).toString());
        setTimeout(() => {
            const statusElement = document.querySelector('.status-info');
            if (statusElement) {
                statusElement.innerHTML += '<br>• 自动重试机制已就绪';
            }
        }, 2000);
    </script>
</body>
</html>
    `;
};

// API 降级响应
const generateFallbackAPIResponse = (error = '服务暂时不可用') => {
    return {
        success: false,
        message: error,
        fallback: true,
        timestamp: new Date().toISOString(),
        data: null
    };
};

// 服务状态监控
class ServiceMonitor {
    constructor() {
        this.status = {
            database: true,
            redis: true,
            lastCheck: null
        };
        this.checkInterval = 30000; // 30秒检查一次
    }

    async checkServices(pool, redisClient) {
        try {
            const [dbHealth, redisHealth] = await Promise.all([
                checkDatabaseHealth(pool),
                checkRedisHealth(redisClient)
            ]);

            this.status = {
                database: dbHealth,
                redis: redisHealth,
                lastCheck: new Date().toISOString()
            };

            

            return this.status;
        } catch (error) {
            console.error('Service monitor check failed:', error);
            return this.status;
        }
    }

    startMonitoring(pool, redisClient) {
        // 立即执行一次检查
        this.checkServices(pool, redisClient);
        
        // 定期检查
        setInterval(() => {
            this.checkServices(pool, redisClient);
        }, this.checkInterval);
    }

    getStatus() {
        return this.status;
    }

    isSystemHealthy() {
        return this.status.database; // 只要数据库健康就认为系统健康
    }
}

module.exports = {
    checkDatabaseHealth,
    checkRedisHealth,
    generateFallbackHTML,
    generateFallbackAPIResponse,
    ServiceMonitor
};
