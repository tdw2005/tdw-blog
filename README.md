# SSR 博客系统（tdw-blog）

- 一体化的 Vue 3 + Express SSR 博客项目，支持文章管理、评论、通知、草稿、标签、数据备份与 AI 写作辅助。
- 采用服务端渲染与客户端水合，结合 Redis/内存缓存与 HTTP ETag，实现稳定、可回退的高性能接口。

## 目录
- 环境搭建
- 启动步骤
- 目录结构
- 接口文档
- 技术选型
 - 架构设计
- SSR 实现方案
- 缓存策略设计
 - 难点与解决方案
- 数据备份说明
- 验证与测试建议
- 安全与部署注意事项

## 环境搭建
- 必需环境
  - `Node.js` ≥ 18（建议 LTS）
  - `MySQL` ≥ 8（或兼容版本，默认数据库名 `blog_ssr`）
- 可选环境
  - `Redis` ≥ 6（用于缓存与限流，不启用时自动降级为内存缓存）
  - 智谱清言 `ZHIPUAI` 账号（用于 AI 写作建议与自动摘要）
- 目录安装
  - 在 `server` 与 `client` 目录分别安装依赖；根目录安装并提供并发启动脚本
    - `cd server && npm install`
    - `cd ../client && npm install`
    - `cd .. && npm install`
- 服务端环境变量（`server/.env`）
  - 基础配置
    - `PORT=3000`
    - `NODE_ENV=development` 或 `production`
    - `JWT_SECRET=<生产环境必须设置为强随机值>`
    - `CORS_ORIGIN=https://your-domain.com`（生产环境建议设置）
  - 数据库配置
    - `DB_HOST=localhost`
    - `DB_USER=root`
    - `DB_PASSWORD=`
    - `DB_NAME=blog_ssr`
  - 缓存与限流
    - `CACHE_TTL=3600`（默认接口缓存 TTL，秒）
    - `REDIS_HOST=localhost`
    - `REDIS_PORT=6379`
    - `REDIS_PASSWORD=`
    - `REDIS_DB=0`
  - AI 服务（可选）
    - `ZHIPUAI_API_KEY=...`
    - `ZHIPUAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4`
    - `ZHIPUAI_MODEL=glm-4`
    - `MAX_TOKENS=1000`

## 启动步骤
- 开发环境
  - 准备好数据库并确保可连接（首次启动自动建表与种子数据）
  - 在项目根目录运行：`npm run dev`
    - 同时启动前端 `Vite`（端口 `3001`）与后端 `Express`（端口 `3000`）
    - 打开 `http://localhost:3000/`
  - Windows 可直接运行根目录 `进入网站.bat`
- 生产环境
  - 构建：`npm run build`（打包前端并生成 SSR 入口，服务器侧无额外打包）
  - 启动：`npm start`（在 `server` 目录运行 `node index.js`）
  - 生产部署建议
    - 设置反向代理与 HTTPS
    - 配置 `CORS_ORIGIN` 为实际域名
    - 必须设置强随机 `JWT_SECRET`

## 目录结构
- 根目录
  - `package.json`：并发启动、构建与部署脚本
  - `进入网站.bat`：Windows 一键开发启动
  - `client/`：前端应用（Vite + Vue 3）
  - `server/`：后端应用（Express + MySQL + Redis）
- `client/`
  - `src/main.js`：客户端入口与水合
  - `src/entry-server.js`：SSR 入口，服务端渲染用
  - `src/router/index.js`：路由与前端访问控制
  - `src/components/`：页面组件（文章列表、详情、编辑、登录注册、通知、个人中心、草稿等）
  - `vite.config.js`：开发代理至后端 `/api`
- `server/`
  - `index.js`：应用入口、路由注册与中间件配置（端口、CORS、限流、缓存、SSR）
  - `routes/*.js`：模块路由（文章、评论、通知、草稿、标签、系统、AI、SSR）
  - `middlewares/*.js`：缓存、速率限制、鉴权、降级、HTML 缓存等中间件
  - `utils/*`：`etag`、解析函数、缓存键生成与缓存清理
  - `db/init.js`：数据库初始化（建表与种子数据）
  - `services/tags.js`：标签服务（文章标签落库与关联）
  - `cache-fallback.js`：Redis → 内存缓存降级
  - `redis-client.js`：Redis 客户端封装与工具（含 `setNX`、`scan`）
  - `ai-service.js`：智谱 AI 写作辅助

## 架构设计
- 前端层（`Vue 3 + Vite`）：
  - 路由与视图：`client/src/router/index.js` 负责页面路由与访问控制。
  - 客户端入口与水合：`client/src/main.js` 在浏览器端挂载并读取 `window.__INITIAL_DATA__` 完成水合。
  - SSR 入口：`client/src/entry-server.js` 使用 `renderToString` 在服务器端渲染 HTML 字符串。
- 服务端层（`Express`）：
  - 应用入口：`server/index.js` 完成中间件、路由注册、缓存与速率限制配置。
  - SSR 路由：`server/routes/ssr.js` 在生产模式读取打包产物并注入初始数据与 `SSR` 标记。
  - 业务路由：文章、评论、通知、草稿、标签、系统等模块划分清晰，便于维护与扩展。
- 数据层：
  - `MySQL` 作为主存储，`server/database/schema.sql` 提供初始化脚本，`server/db/init.js` 负责增量建表与种子数据。
  - `Redis` 用于接口缓存、短锁与速率限制；断连自动降级到进程内存（`cache-fallback.js`）。
- 缓存与协商：
  - 接口层缓存（带用户维度）：`middlewares/cache.js` 生成键并返回 304；写操作后调用 `utils/cache-utils.js` 精确清理。
  - 静态资源协商缓存：`/assets` 目录设置 `ETag/Last-Modified` 与强缓存头。

## 接口文档
- 认证与用户
  - `POST /api/auth/register`（注册）
  - `POST /api/auth/login`（登录，返回 `token` 与用户信息）
  - `GET /api/auth/me`（需登录，当前用户信息）
  - `PUT /api/auth/profile`（需登录，修改昵称并回填评论昵称）
  - `PUT /api/auth/password`（需登录，更改密码）
  - `POST /api/auth/logout`（需登录，清除登录 Cookie）
- 文章
  - `GET /api/articles`（分页、搜索与排序，支持 `search`、`searchType`、`tags`、`author`、`sortBy`、`sortOrder`）
  - `GET /api/articles/:id`（详情，含点赞状态与标签，自动增加浏览量）
  - `POST /api/articles`（需登录，创建文章，支持 `tags` 与 `editor_type`）
  - `PUT /api/articles/:id`（需登录，更新文章；草稿发布时自动写入 `created_at`）
  - `DELETE /api/articles/:id`（需登录，作者或管理员可删除）
  - `POST /api/articles/batch-delete`（需管理员，批量删除）
  - `POST /api/articles/:id/like`（需登录，文章点赞/取消点赞，自动通知作者）
  - `GET /api/articles/:id/comments/stats`（评论统计：总数、主评、回复）
  - `GET /api/articles/:id/related?limit=5`（关联推荐：标签/内容/最新）
  - `GET /api/articles/:id/export/pdf`（需登录，按参数导出 PDF）
- 评论
  - `GET /api/articles/:id/comments?page=1&limit=20&sort=newest|oldest|popular`（带二级回复与点赞态）
  - `POST /api/articles/:id/comments`（需登录，发表评论，支持 `parent_id` 回复）
  - `DELETE /api/comments/:id`（需登录，作者或管理员可删）
  - `POST /api/comments/:id/like`（需登录，评论点赞/取消点赞，自动通知评论作者）
  - `GET /api/comments/:id`（单条评论详情，含点赞态与回复数）
- 通知
  - `GET /api/notifications?page=1&limit=20&unread=0|1`（需登录，按用户缓存与分页）
  - `POST /api/notifications/mark-read`（需登录，批量设为已读）
  - `POST /api/notifications/mark-all-read`（需登录，全部设为已读）
  - `GET /api/notifications/unread-count`（需登录，未读总数）
  - `GET /api/notifications/unread-counts`（需登录，按类型的未读数）
- 草稿
  - `GET /api/drafts?scope=mine|all&sortBy=updated_at&sortOrder=DESC`（需登录，草稿列表）
  - `PUT /api/drafts/:id/publish`（需登录，发布草稿为文章）
  - `POST /api/drafts/batch-delete`（需登录，批量删除草稿）
- 标签
  - `GET /api/tags`（热门标签与计数）
- 系统与备份
  - `GET /api/health`（数据库与 Redis 健康）
  - `POST /api/backup/create`（管理员，导出 JSON 备份）
  - `POST /api/backup/import`（管理员，导入 JSON，事务化清表与回填）
  - `GET /api/backup/list`（管理员，列出现有备份）
  - `GET /api/backup/download/:id`（管理员，下载备份）
  - `DELETE /api/backup/:id`（管理员，删除备份）
- AI 写作
  - `POST /api/ai/generate-article`（标题+关键词生成文章与摘要）
  - `POST /api/ai/generate-excerpt`（根据正文生成摘要）
  - `POST /api/ai/writing-suggestions`（主题写作建议）
  - `GET /api/ai/status`（服务可用性与模型信息）

## 技术选型
- 前端：`Vue 3`、`Vite`、`Vue Router`
  - 快速开发与良好的 SSR 支持；路由与访问控制简单直观
- 后端：`Express 5`、`mysql2/promise`
  - 轻量易扩展；使用参数化查询，规避 SQL 注入风险
- 渲染：`@vue/server-renderer` + SSR 入口
  - 服务端预渲染，客户端水合，兼顾 SEO 与性能
- 缓存：`Redis` + 内存降级
  - 优先 Redis，断连自动回退到进程内存；接口与静态资源协商缓存（ETag）
- 安全：`JWT` 鉴权、`CORS` 控制、输入校验、速率限制
- 文档与导出：`Puppeteer` 生成 PDF；`marked`/`dompurify` 内容处理
- AI：`ZHIPUAI`（`glm-4`）用于写作辅助与摘要

## SSR 实现方案
- 入口与渲染
  - 前端 SSR 入口：`client/src/entry-server.js` 使用 `renderToString` 将应用渲染为 HTML 字符串
  - 服务端路由：`server/routes/ssr.js` 在生产模式读取打包的 `index.html`，注入 `window.__INITIAL_DATA__` 与 `SSR` 标记并返回页面
- 初始数据注入
  - 针对首页、文章详情、个人中心、草稿、消息等路由预取数据，作为初始状态传入客户端进行水合
- 开发模式
  - 开发时以客户端渲染为主（由 Vite 提供热更新），接口与 SSR 路由逻辑一致

## 缓存策略设计
- 分层缓存
  - 接口缓存中间件：`server/middlewares/cache.js` 按 `path+query` 生成键，默认 `TTL=3600`
  - 用户级缓存：支持 `allowAuthCache + varyByUser`，将 `uid` 纳入键；响应头 `Vary: Authorization`
  - 反击穿与抖动：Redis `setNX` 实现短锁，未命中轮询等待；设置 `TTL` 加随机抖动避免雪崩
  - 降级缓存：`cache-fallback.js` 优先 Redis，失败回退内存（进程内 `Map`）
- 协商缓存
  - 接口返回 `ETag`，若客户端携带相同 `If-None-Match` 则返回 `304`
  - 静态资源设置 `Cache-Control: immutable` 与 `ETag/Last-Modified`
- 失效策略
  - 文章/评论/点赞等写操作完成后，清理相关缓存键（文章列表、详情、评论列表、统计、与用户通知）
  - 清理函数：`server/utils/cache-utils.js` 支持按 `articleId` 与 `userId` 精确删除

## 数据备份说明
- 管理员在首页可见“数据备份”按钮（前端 `ArticleList.vue`）
- 备份导出生成 JSON 文件，导入时以事务清表并回填用户、文章、评论等数据
- 后端接口：创建、导入、列出、下载、删除备份，均需管理员权限

## 验证与测试建议
- 开发环境验证
  - 打开首页、登录、发文、评论、点赞、查看通知与草稿，确认功能与权限
- 接口验证示例（Windows）
  - 使用 PowerShell：`Invoke-RestMethod -Uri 'http://localhost:3000/api/health' -Method GET`
  - 查询文章列表：`Invoke-RestMethod -Uri 'http://localhost:3000/api/articles?page=1&limit=10' -Method GET`
  - 需授权接口在 `Headers` 中加入 `Authorization: Bearer <token>`

## 安全与部署注意事项
- 在生产环境必须设置强随机 `JWT_SECRET`；避免将密钥与数据库密码提交到仓库
- 配置 `CORS_ORIGIN` 以限制跨域来源
- 数据库账号仅授予最小权限；备份与导入操作需严格控制管理员权限
- 合理设置速率限制窗口与阈值，避免接口被暴力请求
## 难点与解决方案
- 通过schema.sql注入数据时易因为中文内容而产生报错：
  - 改为由server/db/init.js初始化数据库建立空表，进行操作后直接完成数据的CRUD。
- SSR 数据注入与水合一致性：
  - 通过在服务端渲染时将首屏数据写入 `window.__INITIAL_DATA__`，客户端入口读取该变量并提供给组件（`client/src/main.js:8`）。
  - 详情页优先消费 SSR 数据并在无数据时回退到 API（`client/src/components/ArticleDetail.vue:143` 与 `client/src/components/ArticleDetail.vue:178`）。
- 缓存击穿与抖动控制：
  - 读取前使用 `setNX` 短锁避免并发穿透（`server/middlewares/cache.js:39`）。
  - 写操作统一清理相关键（文章列表/详情/评论/通知），并在 Redis 不可用时回退内存（`server/utils/cache-utils.js:27` + `server/cache-fallback.js`）。
- ETag 协商与 304：
  - 将响应 JSON 计算哈希作为 ETag，匹配 `If-None-Match` 直接返回 304（`server/routes/articles.js:116` 与 `server/routes/articles.js:264`）。
- 访问控制与速率限制：
  - 受保护路由在前端路由守卫拦截并弹出登录提示（`client/src/router/index.js:67`）。
  - 后端对认证、AI 与高频接口施加速率限制（`server/index.js:132`）。
- 数据一致性与回填：
  - 用户昵称修改后，历史评论与文章作者昵称回填并清理缓存（`server/routes/auth.js:55` 与 `server/routes/auth.js:59`）。
- 可回退的 SSR：
  - SSR 渲染失败时自动降级为 CSR，保证页面始终可用（`server/routes/ssr.js` 逻辑与 `withFallback` 组合使用）。
