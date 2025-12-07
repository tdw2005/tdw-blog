require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const redisClient = require('./redis-client');
const { ServiceMonitor } = require('./fallback-utils');
const CacheFallback = require('./cache-fallback');
const aiService = require('./ai-service');
const addCacheHeaders = require('./middlewares/add-cache-headers');
const { createFallbackResponse, createWithFallback } = require('./middlewares/fallback');
const createCacheMiddleware = require('./middlewares/cache');
const createRateLimitMiddleware = require('./middlewares/rate-limit');
const createAuthenticateJWT = require('./middlewares/authenticate-jwt');
const htmlCacheMiddleware = require('./middlewares/html-cache');
const { generateETag } = require('./utils/etag');
const { parseTagsField } = require('./utils/parse');
const createClearRelatedCaches = require('./utils/cache-utils');
const initDatabase = require('./db/init');
const registerSSRRoutes = require('./routes/ssr');
const registerSystemRoutes = require('./routes/system');
const registerAuthRoutes = require('./routes/auth');
const registerArticleRoutes = require('./routes/articles');
const registerCommentRoutes = require('./routes/comments');
const registerNotificationRoutes = require('./routes/notifications');
const registerTagRoutes = require('./routes/tags');
const registerDraftRoutes = require('./routes/drafts');
const registerAIRoutes = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 3600;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret')) { console.error('JWT_SECRET is required'); process.exit(1); }

// 初始化服务监控和缓存降级
const serviceMonitor = new ServiceMonitor();
const cacheFallback = new CacheFallback(redisClient, null);
const withFallback = createWithFallback(serviceMonitor, cacheFallback);
const cacheMiddleware = createCacheMiddleware(cacheFallback, CACHE_TTL);
const rateLimitMiddleware = createRateLimitMiddleware(redisClient);
const authenticateJWT = createAuthenticateJWT(JWT_SECRET);

// 中间件
app.disable('x-powered-by');
app.set('trust proxy', 1);

const allowOrigins = process.env.NODE_ENV === 'production'
  ? (process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : [])
  : ['http://localhost:3000', 'http://localhost:3001'];
app.use(cors({ origin: allowOrigins.length > 0 ? allowOrigins : true, credentials: true }));
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});
app.use(express.json({ limit: '2mb' }));

// 服务状态监控中间件
app.use(async (req, res, next) => {
    req.serviceStatus = serviceMonitor.getStatus();
    next();
});

// ETag 生成函数由 utils/etag 提供

// 静态资源缓存配置
const staticOptions = {
    maxAge: process.env.NODE_ENV === 'production' ? '7d' : '0',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath);
        const fileStats = fs.statSync(filePath);

        // 强缓存：CSS、JS、图片、字体等静态资源
        if (['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.svg'].includes(ext)) {
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
            res.setHeader('Expires', new Date(Date.now() + 604800000).toUTCString());
        }

        // 协商缓存：设置 ETag 和 Last-Modified
        res.setHeader('ETag', fileStats.mtime.getTime().toString(36));
        res.setHeader('Last-Modified', fileStats.mtime.toUTCString());
    }
};

app.use('/assets', express.static(path.join(__dirname, '../client/dist/assets'), staticOptions));

// 数据库连接池
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'blog_ssr',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
});

cacheFallback.pool = pool;

initDatabase(pool).catch(e => {});


app.use(addCacheHeaders);

// 缓存键生成函数
const generateCacheKey = (req) => {
    const baseKey = `blog:${req.path}`;
    const queryString = Object.keys(req.query)
        .sort()
        .map(key => `${key}=${req.query[key]}`)
        .join('&');
    return queryString ? `${baseKey}?${queryString}` : baseKey;
};

app.use(createFallbackResponse());

// 缓存中间件由 middlewares/cache 提供

// 速率限制中间件由 middlewares/rate-limit 提供

// 速率限制应用到关键路由（需在路由注册之前）
app.use('/api/auth', rateLimitMiddleware({ windowMs: 60000, max: 10 }));
app.use('/api/ai', rateLimitMiddleware({ windowMs: 60000, max: 10 }));
app.use('/api/articles', rateLimitMiddleware({ windowMs: 60000, max: 50 }));
app.use('/api/comments', rateLimitMiddleware({ windowMs: 60000, max: 30 }));
app.use('/api/notifications', rateLimitMiddleware({ windowMs: 60000, max: 60 }));

const clearRelatedCaches = createClearRelatedCaches(cacheFallback);

const setArticleTags = require('./services/tags')(pool);

registerTagRoutes(app, { pool, cacheMiddleware, withFallback });
registerArticleRoutes(app, { pool, JWT_SECRET, authenticateJWT, withFallback, cacheMiddleware, clearRelatedCaches, setArticleTags });
registerDraftRoutes(app, { pool, authenticateJWT, withFallback, clearRelatedCaches });
registerNotificationRoutes(app, { pool, authenticateJWT, withFallback, cacheMiddleware, clearRelatedCaches });
registerCommentRoutes(app, { pool, JWT_SECRET, authenticateJWT, withFallback, cacheMiddleware, clearRelatedCaches });
registerAIRoutes(app, { aiService });














// 系统状态检查API
 
// 管理员：昵称回填任务（将所有评论的 user_name 回填为当前昵称）
app.use(htmlCacheMiddleware);
registerSystemRoutes(app, { pool, redisClient, authenticateJWT, withFallback, clearRelatedCaches });
registerAuthRoutes(app, { pool, JWT_SECRET, authenticateJWT, withFallback, clearRelatedCaches });


 

registerSSRRoutes(app, { pool, JWT_SECRET, withFallback });

// 启动服务器
app.listen(PORT, async () => {
    // 等待Redis连接完全就绪
    try {
        await redisClient.waitForConnection();
        // 检查Redis是否已连接
        if (redisClient.isConnected) {
            // 给Redis一点时间完全初始化
            await new Promise(resolve => setTimeout(resolve, 3000));

            // 测试Redis连接
            const pingResult = await redisClient.client.ping();

            // 手动设置Redis状态为健康
            redisClient.isConnected = pingResult === 'PONG';
        }
    } catch (error) {
    }

    console.log('Redis 连接状态:', redisClient.isConnected ? '已连接' : '未连接（降级缓存启用）');

    // 等待服务监控初始化完成
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 启动服务监控（带有延迟检查）
    serviceMonitor.startMonitoring(pool, redisClient);

    console.log('服务监控已启动');

    // 等待第一次检查完成
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log(`服务器已启动，端口: ${PORT}，环境: ${process.env.NODE_ENV || 'development'}`);
});
// 错误处理
process.on('unhandledRejection', (err) => {
    console.error('未处理的 Promise 拒绝:', err);
});

process.on('uncaughtException', (err) => {
    console.error('未捕获的异常:', err);
});

// 优雅关闭
process.on('SIGTERM', async () => {
    console.log('收到 SIGTERM，正在退出...');
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('收到 SIGINT，正在退出...');
    process.exit(0);
});
