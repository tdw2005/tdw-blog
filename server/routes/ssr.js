const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const jwt = require('jsonwebtoken');
const { parseTagsField } = require('../utils/parse');
const { generateETag } = require('../utils/etag');

function registerSSRRoutes(app, { pool, JWT_SECRET, withFallback }) {
  async function sendSSRHtml(req, res, initialData = null) {
    try {
      const isProd = process.env.NODE_ENV === 'production'
      const distIndexPath = path.resolve(__dirname, '..', '..', 'client', 'dist', 'index.html');
      if (isProd && fs.existsSync(distIndexPath)) {
        try {
          const ssrEntryPath = path.resolve(__dirname, '..', '..', 'client', 'dist', 'server', 'entry-server.js');
          let appHtml = '';
          if (fs.existsSync(ssrEntryPath)) {
            const mod = await import(pathToFileURL(ssrEntryPath).href);
            const route = initialData && initialData.route ? initialData.route : '/';
            const rendered = await mod.render(route, initialData || null);
            appHtml = rendered && rendered.appHtml ? rendered.appHtml : '';
          }
          let html = fs.readFileSync(distIndexPath, 'utf-8');
          if (appHtml) {
            html = html.replace('<div id="app"></div>', `<div id="app">${appHtml}</div>`);
          }
          const inject = `\n<script>\nwindow.__SSR__ = true;\nwindow.__INITIAL_DATA__ = ${initialData ? JSON.stringify(initialData) : 'null'};\n</script>\n`;
          html = html.replace('</body>', `${inject}</body>`);
          const etag = generateETag(html);
          let mtimeMs = 0;
          try { const s = fs.statSync(distIndexPath); mtimeMs = s.mtimeMs; } catch {}
          if (fs.existsSync(ssrEntryPath)) { try { const s2 = fs.statSync(ssrEntryPath); if (s2.mtimeMs > mtimeMs) mtimeMs = s2.mtimeMs; } catch {} }
          const lastModified = new Date(mtimeMs || Date.now()).toUTCString();
          if (res.getHeader && res.getHeader('Vary')) { res.setHeader('Vary', String(res.getHeader('Vary')) + ', Authorization'); } else { res.setHeader('Vary', 'Accept-Encoding, Authorization'); }
          res.setHeader('ETag', etag);
          res.setHeader('Last-Modified', lastModified);
          const clientETag = req.headers['if-none-match'];
          if (clientETag === etag) { res.status(304).end(); return; }
          res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
          return;
        } catch (e) {
          let html = fs.readFileSync(distIndexPath, 'utf-8');
          const inject = `\n<script>\nwindow.__SSR__ = true;\nwindow.__INITIAL_DATA__ = ${initialData ? JSON.stringify(initialData) : 'null'};\n</script>\n`;
          html = html.replace('</body>', `${inject}</body>`);
          const etag = generateETag(html);
          let lastModified = new Date().toUTCString();
          try { const s = fs.statSync(distIndexPath); lastModified = s.mtime.toUTCString(); } catch {}
          if (res.getHeader && res.getHeader('Vary')) { res.setHeader('Vary', String(res.getHeader('Vary')) + ', Authorization'); } else { res.setHeader('Vary', 'Accept-Encoding, Authorization'); }
          res.setHeader('ETag', etag);
          res.setHeader('Last-Modified', lastModified);
          const clientETag = req.headers['if-none-match'];
          if (clientETag === etag) { res.status(304).end(); return; }
          res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
          return;
        }
      }

      const devHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>星云博客系统</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; }
      #app { min-height: 100vh; display: flex; flex-direction: column; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script>
      window.__SSR__ = true;
      window.__INITIAL_DATA__ = ${initialData ? JSON.stringify(initialData) : 'null'};
      const s = document.createElement('script');
      s.type = 'module';
      s.src = 'http://localhost:3001/src/main.js';
      document.body.appendChild(s);
    </script>
  </body>
</html>`;

      const etag = generateETag(devHtml);
      const lastModified = new Date().toUTCString();
      if (res.getHeader && res.getHeader('Vary')) { res.setHeader('Vary', String(res.getHeader('Vary')) + ', Authorization'); } else { res.setHeader('Vary', 'Accept-Encoding, Authorization'); }
      res.setHeader('ETag', etag);
      res.setHeader('Last-Modified', lastModified);
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) { res.status(304).end(); return; }
      res.status(200).set({ 'Content-Type': 'text/html' }).end(devHtml);
    } catch (e) {
      res.status(500).send('SSR 页面生成失败');
    }
  }

  app.get('/', withFallback(async (req, res) => {
    try {
      const [articles] = await pool.execute(`
        SELECT 
          a.id, a.title, a.excerpt, a.author_id, u.nickname AS author_nickname,
          a.editor_type, a.view_count, a.comment_count, a.like_count, a.created_at
        FROM articles a
        LEFT JOIN users u ON u.id = a.author_id
        WHERE a.status = 'published'
        ORDER BY a.created_at DESC
        LIMIT 10
      `);
      const ids = articles.map(a => a.id);
      let tagMapHome = {};
      if (ids.length > 0) {
        const ph = ids.map(() => '?').join(',');
        const [rows2] = await pool.execute(`SELECT t.article_id, g.name FROM article_tags t JOIN tags g ON g.id = t.tag_id WHERE t.article_id IN (${ph})`, ids);
        for (const r of rows2) { if (!tagMapHome[r.article_id]) tagMapHome[r.article_id] = []; tagMapHome[r.article_id].push(r.name); }
      }
      const articlesWithTags = articles.map(a => ({ ...a, tags: tagMapHome[a.id] || [] }));
      const initialData = { route: '/', data: { articles: articlesWithTags } };
      await sendSSRHtml(req, res, initialData);
    } catch (error) {
      await sendSSRHtml(req, res);
    }
  }));

  app.get('/article/:id', withFallback(async (req, res) => {
    try {
      const articleId = req.params.id;
      const [articles] = await pool.execute(
        'SELECT a.*, u.nickname AS author_nickname FROM articles a LEFT JOIN users u ON u.id = a.author_id WHERE a.id = ? AND a.status = "published"',
        [articleId]
      );
      if (articles.length === 0) {
        const initialData = { route: '/article/' + articleId, error: '文章不存在' };
        await sendSSRHtml(req, res, initialData);
        return;
      }
      const article = articles[0];
      const [tagsRows] = await pool.execute('SELECT g.name FROM article_tags t JOIN tags g ON g.id = t.tag_id WHERE t.article_id = ?', [articleId]);
      const initialData = { route: '/article/' + articleId, data: { article: { ...article, tags: tagsRows.map(r => r.name) } } };
      await sendSSRHtml(req, res, initialData);
    } catch (error) {
      await sendSSRHtml(req, res);
    }
  }));

  app.get('/create', withFallback(async (req, res) => {
    const initialData = { route: '/create' };
    await sendSSRHtml(req, res, initialData);
  }));

  app.get('/edit/:id', withFallback(async (req, res) => {
    try {
      const articleId = req.params.id;
      const [articles] = await pool.execute('SELECT * FROM articles WHERE id = ?', [articleId]);
      let articleData = null;
      if (articles.length > 0) {
        const [tagRows] = await pool.execute('SELECT g.name FROM article_tags t JOIN tags g ON g.id = t.tag_id WHERE t.article_id = ?', [articleId]);
        articleData = { article: { ...articles[0], tags: tagRows.map(r => r.name) } };
      }
      const initialData = { route: '/edit/' + articleId, data: articleData };
      await sendSSRHtml(req, res, initialData);
    } catch (error) {
      await sendSSRHtml(req, res);
    }
  }));

  app.get('/login', withFallback(async (req, res) => {
    await sendSSRHtml(req, res, { route: '/login' });
  }));

  app.get('/register', withFallback(async (req, res) => {
    await sendSSRHtml(req, res, { route: '/register' });
  }));

  app.get('/profile', withFallback(async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const cookieStr = req.headers.cookie || '';
      const tokenCookie = cookieStr.split(';').map(s => s.trim()).find(s => s.startsWith('token='));
      const t = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (tokenCookie ? decodeURIComponent(tokenCookie.slice(6)) : null);
      let initialData = { route: '/profile' };
      if (t) {
        try {
          const payload = jwt.verify(t, JWT_SECRET);
          const [[me]] = await pool.execute('SELECT id, user_id, nickname, is_admin FROM users WHERE id = ? LIMIT 1', [payload.uid]);
          if (me) {
            const [articles] = await pool.execute(`
              SELECT DISTINCT
                  a.id, a.title, a.excerpt, a.author AS author, a.author_id, u.nickname AS author_nickname, u.user_id AS author_uid,
                  a.editor_type, a.view_count, a.comment_count, a.like_count,
                  a.created_at, a.updated_at
              FROM articles a
              LEFT JOIN users u ON u.id = a.author_id
              WHERE a.status = 'published' AND u.user_id = ?
              ORDER BY a.created_at DESC
              LIMIT 10
            `, [me.user_id]);
            const ids = articles.map(a => a.id);
            let tagMap = {};
            if (ids.length > 0) {
              const ph = ids.map(() => '?').join(',');
              const [tagRows] = await pool.execute(`SELECT t.article_id, g.name FROM article_tags t JOIN tags g ON g.id = t.tag_id WHERE t.article_id IN (${ph})`, ids);
              for (const r of tagRows) { if (!tagMap[r.article_id]) tagMap[r.article_id] = []; tagMap[r.article_id].push(r.name); }
            }
            const myArticles = articles.map(a => ({ ...a, tags: tagMap[a.id] || [] }));
            const [drafts] = await pool.execute(`
              SELECT a.id, a.title, a.excerpt, a.author_id, u.nickname AS author_nickname, u.user_id AS author_uid, a.editor_type, a.view_count, a.created_at, a.updated_at
              FROM articles a
              LEFT JOIN users u ON u.id = a.author_id
              WHERE a.status = 'draft' AND a.author_id = ?
              ORDER BY a.updated_at DESC
              LIMIT 10
            `, [me.id]);
            initialData = { route: '/profile', data: { nickname: me.nickname, myArticles, myDrafts: drafts } };
          }
        } catch (e) {}
      }
      await sendSSRHtml(req, res, initialData);
    } catch (error) {
      await sendSSRHtml(req, res, { route: '/profile' });
    }
  }));

  app.get('/drafts', withFallback(async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const cookieStr = req.headers.cookie || '';
      const tokenCookie = cookieStr.split(';').map(s => s.trim()).find(s => s.startsWith('token='));
      const t = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (tokenCookie ? decodeURIComponent(tokenCookie.slice(6)) : null);
      let initialData = { route: '/drafts' };
      if (t) {
        try {
          const payload = jwt.verify(t, JWT_SECRET);
          const page = 1; const limit = 10; const offset = 0;
          const [drafts] = await pool.execute(
            `SELECT a.id, a.title, a.excerpt, a.author_id, u.nickname AS author_nickname, u.user_id AS author_uid, a.editor_type, a.view_count, a.created_at, a.updated_at
             FROM articles a
             LEFT JOIN users u ON u.id = a.author_id
             WHERE a.status = 'draft' AND a.author_id = ?
             ORDER BY a.updated_at DESC
             LIMIT ? OFFSET ?`,
            [payload.uid, limit.toString(), offset.toString()]
          );
          const [[{ total }]] = await pool.execute(`SELECT COUNT(*) as total FROM articles a WHERE a.status = 'draft' AND a.author_id = ?`, [payload.uid]);
          initialData = { route: '/drafts', data: { drafts, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } };
        } catch (e) {}
      }
      await sendSSRHtml(req, res, initialData);
    } catch (error) {
      await sendSSRHtml(req, res, { route: '/drafts' });
    }
  }));

  app.get('/messages', withFallback(async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const cookieStr = req.headers.cookie || '';
      const tokenCookie = cookieStr.split(';').map(s => s.trim()).find(s => s.startsWith('token='));
      const t = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (tokenCookie ? decodeURIComponent(tokenCookie.slice(6)) : null);
      let initialData = { route: '/messages' };
      if (t) {
        try {
          const payload = jwt.verify(t, JWT_SECRET);
          const page = 1; const limit = 20; const offset = 0;
          const [rows] = await pool.execute(
            `SELECT 
                n.id, n.type, n.actor_id, u.nickname AS actor_nickname,
                n.article_id, a.title AS article_title,
                n.comment_id, SUBSTRING(c.content, 1, 120) AS comment_excerpt,
                n.message, n.\`read\`, n.created_at, n.read_at
             FROM notifications n
             LEFT JOIN users u ON u.id = n.actor_id
             LEFT JOIN articles a ON a.id = n.article_id
             LEFT JOIN comments c ON c.id = n.comment_id
             WHERE n.recipient_id = ?
             ORDER BY n.created_at DESC
             LIMIT ? OFFSET ?`,
            [payload.uid, limit.toString(), offset.toString()]
          );
          const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM notifications n WHERE n.recipient_id = ?`, [payload.uid]);
          const [typeRows] = await pool.execute('SELECT type, COUNT(*) AS cnt FROM notifications WHERE recipient_id = ? AND \`read\` = 0 GROUP BY type', [payload.uid]);
          const counts = { article_like: 0, comment_like: 0, comment: 0, reply: 0 };
          let unread = 0;
          for (const r of typeRows) { const tt = String(r.type); const c = parseInt(r.cnt, 10) || 0; if (counts.hasOwnProperty(tt)) counts[tt] = c; unread += c; }
          const likesUnread = (counts.article_like || 0) + (counts.comment_like || 0);
          const commentsUnread = (counts.comment || 0) + (counts.reply || 0);
          initialData = { route: '/messages', data: { notifications: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }, unread, likesUnread, commentsUnread } };
        } catch (e) {}
      }
      await sendSSRHtml(req, res, initialData);
    } catch (error) {
      await sendSSRHtml(req, res, { route: '/messages' });
    }
  }));

  app.use(async (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ success: false, message: 'API 路由不存在' });
    }
    await sendSSRHtml(req, res);
  });
}

module.exports = registerSSRRoutes;
