const jwt = require('jsonwebtoken');
const puppeteer = require('puppeteer');
const { generateETag } = require('../utils/etag');

function registerArticleRoutes(app, { pool, JWT_SECRET, authenticateJWT, withFallback, cacheMiddleware, clearRelatedCaches, setArticleTags }) {
  app.get('/api/articles', cacheMiddleware(600), withFallback(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const search = req.query.search;
    const searchType = req.query.searchType || 'title';
    const tags = req.query.tags ? req.query.tags.split(',') : [];
    const sortBy = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder || 'DESC';

    try {
      let whereConditions = ["a.status = 'published'"];
      let queryParams = [];

      if (search && search.trim() !== '') {
        switch (searchType) {
          case 'title':
            whereConditions.push(`a.title LIKE ?`);
            queryParams.push(`%${search}%`);
            break;
          case 'content':
            whereConditions.push(`a.content LIKE ?`);
            queryParams.push(`%${search}%`);
            break;
          case 'author':
            whereConditions.push(`(u.user_id LIKE ? OR u.nickname LIKE ?)`);
            queryParams.push(`%${search}%`);
            queryParams.push(`%${search}%`);
            break;
          case 'tags':
            whereConditions.push(`EXISTS (SELECT 1 FROM article_tags t JOIN tags g ON g.id = t.tag_id WHERE t.article_id = a.id AND g.name LIKE ?)`);
            queryParams.push(`%${search}%`);
            break;
        }
      }

      const authorParam = (req.query.author || '').toString().trim();
      if (authorParam) {
        whereConditions.push('u.user_id = ?');
        queryParams.push(authorParam);
      }

      if (tags.length > 0 && tags[0] !== '') {
        const ph = tags.map(() => '?').join(',');
        whereConditions.push(`EXISTS (SELECT 1 FROM article_tags t JOIN tags g ON g.id = t.tag_id WHERE t.article_id = a.id AND g.name IN (${ph}))`);
        queryParams.push(...tags);
      }

      const whereClause = whereConditions.length > 0 ?
        `WHERE ${whereConditions.join(' AND ')}` : '';

      const validSortFields = ['created_at', 'view_count', 'like_count', 'title'];
      const validOrders = ['ASC', 'DESC'];
      const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';
      const safeSortOrder = validOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

      let orderBy = `ORDER BY a.${safeSortBy} ${safeSortOrder}`;
      if (safeSortBy === 'view_count' || safeSortBy === 'like_count') {
        orderBy += ', a.created_at DESC';
      } else if (safeSortBy === 'created_at') {
        orderBy += ', a.id DESC';
      }

      const [articles] = await pool.execute(`
            SELECT DISTINCT
                a.id, a.title, a.excerpt, a.author AS author, a.author_id, u.nickname AS author_nickname, u.user_id AS author_uid,
                a.editor_type, a.view_count, a.comment_count, a.like_count,
                a.created_at, a.updated_at
            FROM articles a
            LEFT JOIN users u ON u.id = a.author_id
            ${whereClause}
            ${orderBy}
            LIMIT ? OFFSET ?
        `, [...queryParams, limit.toString(), offset.toString()]);

      const countQuery = `SELECT COUNT(DISTINCT a.id) as total FROM articles a LEFT JOIN users u ON u.id = a.author_id ${whereClause}`;
      const countParams = queryParams;
      const [[{ total }]] = await pool.execute(countQuery, countParams);

      const ids = articles.map(a => a.id);
      let tagMap = {};
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        const [tagRows] = await pool.execute(`
                SELECT t.article_id, g.name 
                FROM article_tags t 
                JOIN tags g ON g.id = t.tag_id 
                WHERE t.article_id IN (${placeholders})
            `, ids);
        for (const r of tagRows) {
          if (!tagMap[r.article_id]) tagMap[r.article_id] = [];
          tagMap[r.article_id].push(r.name);
        }
      }
      const parsedArticles = articles.map(article => ({ ...article, tags: tagMap[article.id] || [] }));

      const resultData = {
        success: true,
        data: {
          articles: parsedArticles,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      };

      const etag = generateETag(resultData);
      res.setHeader('ETag', etag);
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        return res.status(304).end();
      }
      res.json(resultData);
    } catch (error) {
      try {
        const [articles] = await pool.execute(`
                SELECT id, title, excerpt, author_id, editor_type, view_count, like_count, comment_count, created_at, updated_at
                FROM articles 
                WHERE status = 'published'
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `, [limit.toString(), offset.toString()]);
        const idsFb = articles.map(a => a.id);
        let tagMapFb = {};
        if (idsFb.length > 0) {
          const phFb = idsFb.map(() => '?').join(',');
          const [tagRowsFb] = await pool.execute(`SELECT t.article_id, g.name FROM article_tags t JOIN tags g ON g.id = t.tag_id WHERE t.article_id IN (${phFb})`, idsFb);
          for (const r of tagRowsFb) {
            if (!tagMapFb[r.article_id]) tagMapFb[r.article_id] = [];
            tagMapFb[r.article_id].push(r.name);
          }
        }
        const articlesFb = articles.map(a => ({ ...a, tags: tagMapFb[a.id] || [] }));

        const [[{ total }]] = await pool.execute(
          "SELECT COUNT(*) as total FROM articles WHERE status = 'published'"
        );

        res.json({
          success: true,
          data: {
            articles: articlesFb,
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit)
            }
          }
        });
      } catch (fallbackError) {
        res.status(500).json({ success: false, message: '获取文章列表失败', error: error.message });
      }
    }
  }));

  app.post('/api/articles', authenticateJWT, withFallback(async (req, res) => {
    const { title, content, excerpt, tags = [], status = 'published', editor_type = 'rich' } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: '标题和内容不能为空' });
    }
    const authorStr = req.user.user_id;
    const authorId = req.user.uid;
    const [result] = await pool.execute(
      'INSERT INTO articles (title, content, excerpt, author, author_id, tags, status, editor_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title, content, excerpt, authorStr, authorId, JSON.stringify(tags), status, editor_type]
    );
    await setArticleTags(result.insertId, tags);
    await clearRelatedCaches();
    res.json({ success: true, data: { id: result.insertId } });
  }));

  app.put('/api/articles/:id', authenticateJWT, withFallback(async (req, res) => {
    const articleId = req.params.id;
    const { title, content, excerpt, tags, status, editor_type = 'rich' } = req.body;
    const [rows] = await pool.execute('SELECT author_id, status AS current_status FROM articles WHERE id = ? LIMIT 1', [articleId]);
    if (rows.length === 0) { return res.status(404).json({ success: false, message: '文章不存在' }); }
    const isOwner = rows[0].author_id === req.user.uid;
    if (!isOwner) { return res.status(403).json({ success: false, message: '无权限编辑该文章' }); }
    const transitioningToPublished = String(rows[0].current_status) === 'draft' && String(status) === 'published';
    const updateSql = transitioningToPublished
      ? `UPDATE articles 
           SET title = ?, content = ?, excerpt = ?, tags = ?, status = ?, editor_type = ?, created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`
      : `UPDATE articles 
           SET title = ?, content = ?, excerpt = ?, tags = ?, status = ?, editor_type = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`;
    const [result] = await pool.execute(updateSql, [title, content, excerpt, JSON.stringify(tags), status, editor_type, articleId]);
    if (Array.isArray(tags)) { await setArticleTags(articleId, tags); }
    if (result.affectedRows === 0) { return res.status(404).json({ success: false, message: '文章不存在' }); }
    await clearRelatedCaches(articleId);
    res.json({ success: true, message: '更新成功' });
  }));

  app.delete('/api/articles/:id', authenticateJWT, withFallback(async (req, res) => {
    const articleId = req.params.id;
    const [rows] = await pool.execute('SELECT author_id FROM articles WHERE id = ? LIMIT 1', [articleId]);
    if (rows.length === 0) { return res.status(404).json({ success: false, message: '文章不存在' }); }
    const isOwner = rows[0].author_id === req.user.uid;
    if (!(isOwner || req.user.is_admin)) { return res.status(403).json({ success: false, message: '无权限删除该文章' }); }
    const [result] = await pool.execute('DELETE FROM articles WHERE id = ?', [articleId]);
    if (result.affectedRows === 0) { return res.status(404).json({ success: false, message: '文章不存在' }); }
    await clearRelatedCaches(articleId);
    res.json({ success: true, message: '删除成功' });
  }));

  app.post('/api/articles/batch-delete', authenticateJWT, withFallback(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(id => parseInt(id)).filter(id => Number.isFinite(id)) : [];
    if (ids.length === 0) { return res.status(400).json({ success: false, message: '请提供要删除的文章ID列表' }); }
    if (!req.user.is_admin) { return res.status(403).json({ success: false, message: '仅管理员可批量删除文章' }); }
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const placeholders = ids.map(() => '?').join(',');
      const [existing] = await conn.execute(`SELECT id FROM articles WHERE id IN (${placeholders})`, ids);
      const existingIds = existing.map(r => r.id);
      if (existingIds.length > 0) {
        const delPlaceholders = existingIds.map(() => '?').join(',');
        await conn.execute(`DELETE FROM articles WHERE id IN (${delPlaceholders})`, existingIds);
      }
      await conn.commit();
      await clearRelatedCaches();
      res.json({ success: true, data: { requested: ids.length, deleted: existingIds.length, deleted_ids: existingIds } });
    } catch (e) {
      await conn.rollback();
      res.status(500).json({ success: false, message: '批量删除失败' });
    } finally {
      conn.release();
    }
  }));

  app.get('/api/articles/:id', cacheMiddleware(600), withFallback(async (req, res) => {
    const articleId = req.params.id;
    try {
      const [articles] = await pool.execute(
        'SELECT a.id, a.title, a.content, a.excerpt, a.author AS author, a.author_id, u.nickname AS author_nickname, a.editor_type, a.status, a.view_count, a.comment_count, a.like_count, a.created_at, a.updated_at FROM articles a LEFT JOIN users u ON u.id = a.author_id WHERE a.id = ?',
        [articleId.toString()]
      );
      if (articles.length === 0) { return res.status(404).json({ success: false, message: '文章不存在' }); }
      const article = articles[0];
      const [[likedRow]] = await pool.execute('SELECT COUNT(*) AS cnt FROM article_likes WHERE article_id = ? AND user_id = ?', [articleId.toString(), req.user?.uid || 0]);
      const [tagRows] = await pool.execute('SELECT g.name FROM article_tags t JOIN tags g ON g.id = t.tag_id WHERE t.article_id = ?', [articleId.toString()]);
      article.tags = tagRows.map(r => r.name);
      pool.execute('UPDATE articles SET view_count = view_count + 1 WHERE id = ?', [articleId.toString()]).catch(() => {});
      try {
        const authHeader = req.headers.authorization || '';
        const t = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (t) {
          const payload = jwt.verify(t, JWT_SECRET);
          const [[exists]] = await pool.execute('SELECT COUNT(*) AS cnt FROM article_likes WHERE article_id = ? AND user_id = ?', [articleId.toString(), payload.uid]);
          article.liked_by_current_user = exists.cnt > 0;
        }
      } catch (e) {}
      const resultData = { success: true, data: article };
      const etag = generateETag(resultData);
      res.setHeader('ETag', etag);
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) { return res.status(304).end(); }
      res.json(resultData);
    } catch (error) {
      res.status(500).json({ success: false, message: '获取文章详情失败', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
  }));

  app.get('/api/articles/:id/export/pdf', authenticateJWT, withFallback(async (req, res) => {
    const articleId = req.params.id;
    const { pageSize = 'A4', orientation = 'portrait', margin = '10', includeMetadata = 'true', includeTags = 'true', includeStats = 'true' } = req.query;
    const [rows] = await pool.execute('SELECT a.id, a.title, a.content, a.excerpt, a.author_id, u.nickname AS author_nickname, a.editor_type, a.status, a.view_count, a.comment_count, a.created_at, a.updated_at FROM articles a LEFT JOIN users u ON u.id = a.author_id WHERE a.id = ?', [articleId]);
    if (rows.length === 0) { return res.status(404).json({ success: false, message: '文章不存在' }); }
    const article = rows[0];
    const [tagRows] = await pool.execute('SELECT g.name FROM article_tags t JOIN tags g ON g.id = t.tag_id WHERE t.article_id = ?', [articleId]);
    article.tags = tagRows.map(r => r.name);
    const sanitize = (str) => (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const formatDate = (d) => { if (!d) return ''; const date = new Date(d); return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }); };
    const headerMeta = (includeMetadata === 'true') ? `
        <div class="meta">
          <span>作者：${sanitize(article.author_nickname || article.author)}</span>
          <span style="margin:0 10px">|</span>
          <span>发布日期：${formatDate(article.created_at)}</span>
          ${article.updated_at !== article.created_at ? `<span style="margin:0 10px">|</span><span>最后更新：${formatDate(article.updated_at)}</span>` : ''}
        </div>` : '';
    const tagsHtml = (includeTags === 'true' && Array.isArray(article.tags) && article.tags.length > 0) ? `
        <div class="tags">${article.tags.map(t => `<span class="tag">${sanitize(t)}</span>`).join('')}</div>` : '';
    const statsHtml = (includeStats === 'true') ? `
        <div class="stats">
           <div class="stat-item"><span>阅读量</span><span class="stat-value">${article.view_count || 0}</span></div>
           <div class="stat-item"><span>评论数</span><span class="stat-value">${article.comment_count || 0}</span></div>
        </div>` : '';
    const markdownToHtml = (content) => {
      return (content || '')
        .replace(/^# (.*$)/gm, '<h2>$1</h2>')
        .replace(/^## (.*$)/gm, '<h3>$1</h3>')
        .replace(/^### (.*$)/gm, '<h4>$1</h4>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
        .replace(/^- (.*$)/gm, '<li>$1</li>')
        .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
        .replace(/!\[(.*?)\]\((.*?)\)/g, '<img alt="$1" src="$2" style="max-width:100%;height:auto;margin:10px 0;">')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
        .replace(/\n/g, '<br>');
    };
    let contentHtml = article.content || '';
    if (article.editor_type === 'markdown') { contentHtml = markdownToHtml(contentHtml); }
    const html = `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>${sanitize(article.title)} - 导出</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:#2c3e50; }
        .page { padding: ${parseInt(margin)}mm; max-width: ${pageSize === 'A3' ? '297mm' : '210mm'}; margin: 0 auto; }
        .header { text-align:center; margin-bottom:30px; padding-bottom:20px; border-bottom:2px solid #667eea; }
        h1 { font-size:28px; margin-bottom:10px; }
        .meta { color:#7f8c8d; font-size:14px; margin-bottom:15px; }
        .tags { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-bottom:20px; }
        .tag { background: linear-gradient(135deg, #667eea, #764ba2); color:#fff; padding:4px 12px; border-radius:12px; font-size:12px; }
        .stats { display:flex; justify-content:center; gap:30px; margin:25px 0; color:#95a5a6; font-size:14px; }
        .stat-item { display:flex; flex-direction:column; align-items:center; }
        .stat-value { font-weight:700; color:#2c3e50; }
        .content { line-height:1.8; font-size:16px; }
        .content pre { background:#f5f5f5; padding:10px; border-radius:6px; overflow-x:auto; }
        .content code { background:#f5f5f5; padding:2px 4px; border-radius:4px; }
        .content blockquote { border-left:4px solid #ddd; padding-left:12px; color:#666; }
        @page { size: ${pageSize} ${orientation}; margin: 0; }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <h1>${sanitize(article.title)}</h1>
          ${headerMeta}
        </div>
        ${tagsHtml}
        ${statsHtml}
        <div class="content">${contentHtml}</div>
      </div>
    </body>
    </html>`;
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: pageSize === 'Letter' || pageSize === 'Legal' ? undefined : pageSize,
        printBackground: true,
        landscape: orientation === 'landscape',
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
      });
      const safeTitle = (article.title || 'article').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '_').slice(0, 50);
      const fileName = `${safeTitle}_${new Date().toISOString().split('T')[0]}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(pdfBuffer);
    } finally {
      await browser.close();
    }
  }));

  app.post('/api/articles/:id/like', authenticateJWT, withFallback(async (req, res) => {
    const articleId = parseInt(req.params.id);
    const uid = req.user.uid;
    const [[exists]] = await pool.execute('SELECT COUNT(*) AS cnt FROM article_likes WHERE article_id = ? AND user_id = ?', [articleId, uid]);
    let liked, likeCount;
    if (exists.cnt > 0) {
      await pool.execute('DELETE FROM article_likes WHERE article_id = ? AND user_id = ?', [articleId, uid]);
      await pool.execute('UPDATE articles SET like_count = GREATEST(like_count - 1, 0) WHERE id = ?', [articleId]);
      const [[row]] = await pool.execute('SELECT like_count FROM articles WHERE id = ?', [articleId]);
      liked = false; likeCount = row.like_count;
    } else {
      await pool.execute('INSERT INTO article_likes (article_id, user_id) VALUES (?, ?)', [articleId, uid]);
      await pool.execute('UPDATE articles SET like_count = like_count + 1 WHERE id = ?', [articleId]);
      const [[row]] = await pool.execute('SELECT like_count FROM articles WHERE id = ?', [articleId]);
      liked = true; likeCount = row.like_count;
    }
    await clearRelatedCaches(articleId);
    try {
      if (liked) {
        const [[rec]] = await pool.execute('SELECT author_id AS recipient_id FROM articles WHERE id = ? LIMIT 1', [articleId]);
        if (rec && rec.recipient_id && rec.recipient_id !== uid) {
          await pool.execute('INSERT INTO notifications (user_id, recipient_id, type, actor_id, article_id) VALUES (?, ?, ?, ?, ?)', [rec.recipient_id, rec.recipient_id, 'article_like', uid, articleId]);
          try { await clearRelatedCaches(null, rec.recipient_id); } catch {}
        }
      }
    } catch (e) {}
    return res.json({ success: true, data: { liked, like_count: likeCount } });
  }));

  app.get('/api/articles/:id/comments/stats', async (req, res) => {
    const articleId = req.params.id;
    try {
      const [[stats]] = await pool.execute(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN parent_id IS NULL THEN 1 END) as main_comments,
                COUNT(CASE WHEN parent_id IS NOT NULL THEN 1 END) as replies
            FROM comments 
            WHERE article_id = ?
        `, [articleId]);
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, message: '获取评论统计失败' });
    }
  });

  app.get('/api/articles/:id/related', cacheMiddleware(300), withFallback(async (req, res) => {
    const articleId = req.params.id;
    const limit = parseInt(req.query.limit) || 5;
    try {
      const [currentArticle] = await pool.execute('SELECT id, title, excerpt, content FROM articles WHERE id = ?', [articleId]);
      if (currentArticle.length === 0) { return res.json({ success: true, data: { articles: [] } }); }
      const currentArticleData = currentArticle[0];
      const [ctagRows] = await pool.execute('SELECT g.name FROM article_tags t JOIN tags g ON g.id = t.tag_id WHERE t.article_id = ?', [articleId]);
      currentArticleData.tags = ctagRows.map(r => r.name);
      const [tagRelated, contentRelated, latestArticles] = await Promise.all([
        getTagRelatedArticles(currentArticleData, articleId, limit),
        getContentRelatedArticles(currentArticleData, articleId, limit),
        getLatestArticles(articleId, limit)
      ]);
      const combinedArticles = [];
      const usedIds = new Set([parseInt(articleId)]);
      for (const article of tagRelated) {
        if (!usedIds.has(article.id) && combinedArticles.length < limit) {
          article.recommendation_score = 1.0;
          article.recommendation_type = 'tags';
          combinedArticles.push(article);
          usedIds.add(article.id);
        }
      }
      for (const article of contentRelated) {
        if (!usedIds.has(article.id) && combinedArticles.length < limit) {
          article.recommendation_score = 0.7;
          article.recommendation_type = 'content';
          combinedArticles.push(article);
          usedIds.add(article.id);
        }
      }
      for (const article of latestArticles) {
        if (!usedIds.has(article.id) && combinedArticles.length < limit) {
          article.recommendation_score = 0.3;
          article.recommendation_type = 'latest';
          combinedArticles.push(article);
          usedIds.add(article.id);
        }
      }
      combinedArticles.sort((a, b) => b.recommendation_score - a.recommendation_score);
      const ids = combinedArticles.map(a => a.id);
      let tagMap = {};
      if (ids.length > 0) {
        const ph = ids.map(() => '?').join(',');
        const [rows2] = await pool.execute(`SELECT t.article_id, g.name FROM article_tags t JOIN tags g ON g.id = t.tag_id WHERE t.article_id IN (${ph})`, ids);
        for (const r of rows2) { if (!tagMap[r.article_id]) tagMap[r.article_id] = []; tagMap[r.article_id].push(r.name); }
      }
      const parsedArticles = combinedArticles.map(article => {
        delete article.recommendation_score;
        delete article.recommendation_type;
        return { ...article, tags: tagMap[article.id] || [] };
      });
      res.json({ success: true, data: { articles: parsedArticles, total: parsedArticles.length, recommendation_summary: { tag_based: tagRelated.length, content_based: contentRelated.length, latest_based: latestArticles.length } } });
    } catch (error) {
      res.json({ success: true, data: { articles: [] } });
    }
  }));

  async function getTagRelatedArticles(currentArticle, articleId, limit) {
    try {
      const currentTags = currentArticle.tags;
      if (!currentTags || currentTags === 'null' || currentTags === '[]') { return []; }
      let tagsArray = [];
      if (typeof currentTags === 'string') {
        try { tagsArray = JSON.parse(currentTags); } catch (e) { tagsArray = currentTags.replace(/[\[\]"]/g, '').split(',').map(tag => tag.trim()); }
      } else if (Array.isArray(currentTags)) { tagsArray = currentTags; }
      if (tagsArray.length === 0 || tagsArray[0] === '') { return []; }
      const ph = tagsArray.map(() => '?').join(',');
      const [tagRelated] = await pool.execute(`
      SELECT DISTINCT a.id, a.title, a.excerpt, a.author_id, u.nickname AS author_nickname, a.view_count, a.like_count, a.comment_count, a.created_at
      FROM article_tags t
      JOIN tags g ON g.id = t.tag_id
      JOIN articles a ON a.id = t.article_id
      LEFT JOIN users u ON u.id = a.author_id
      WHERE a.id != ? AND a.status = 'published' AND g.name IN (${ph})
      ORDER BY a.view_count DESC
      LIMIT ?
    `, [articleId, ...tagsArray, (limit * 2).toString()]);
      return tagRelated;
    } catch (error) { return []; }
  }

  async function getContentRelatedArticles(currentArticle, articleId, limit) {
    try {
      const currentTitle = (currentArticle.title || '').toLowerCase();
      const currentExcerpt = (currentArticle.excerpt || '').toLowerCase();
      const currentContent = (currentArticle.content || '').toLowerCase().substring(0, 1000);
      const extractKeywords = (text) => { return text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ').split(/\s+/).filter(word => word.length > 2 && !isStopWord(word)).slice(0, 15); };
      const stopWords = new Set(['的','了','在','是','我','有','和','就','不','人','都','一','一个','上','也','很','到','说','要','去','你','会','着','没有','看','好','自己','这','the','and','in','to','of','a','is','that','it','with','for','as','on','was','be','are']);
      const isStopWord = (word) => stopWords.has(word.toLowerCase());
      const titleKeywords = extractKeywords(currentTitle);
      const excerptKeywords = extractKeywords(currentExcerpt);
      const contentKeywords = extractKeywords(currentContent);
      const allKeywords = [...new Set([...titleKeywords, ...excerptKeywords, ...contentKeywords])];
      if (allKeywords.length === 0) { return []; }
      const keywordConditions = allKeywords.map(keyword => { return `(a.title LIKE ? OR a.excerpt LIKE ? OR a.content LIKE ?)`; });
      const whereClause = `WHERE a.id != ? AND a.status = 'published' AND (${keywordConditions.join(' OR ')})`;
      const queryParams = [articleId];
      allKeywords.forEach(keyword => { queryParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); });
      const [contentRelated] = await pool.execute(`
      SELECT 
        a.id, 
        a.title, 
        a.excerpt, 
        a.author_id, 
        u.nickname AS author_nickname,
        a.view_count, 
        a.like_count,
        a.comment_count,
        a.created_at,
        (
          (CASE WHEN a.title LIKE ? THEN 3 ELSE 0 END) +
          (CASE WHEN a.excerpt LIKE ? THEN 2 ELSE 0 END) +
          (CASE WHEN a.content LIKE ? THEN 1 ELSE 0 END)
        ) as relevance_score
      FROM articles a
      LEFT JOIN users u ON u.id = a.author_id
      ${whereClause}
      ORDER BY relevance_score DESC, a.view_count DESC
      LIMIT ?
    `, [...queryParams, `%${allKeywords[0]}%`, `%${allKeywords[0]}%`, `%${allKeywords[0]}%`, (limit * 2).toString()]);
      return contentRelated;
    } catch (error) { return []; }
  }

  async function getLatestArticles(articleId, limit) {
    try {
      const [latestArticles] = await pool.execute(`
      SELECT a.id, a.title, a.excerpt, a.author_id, u.nickname AS author_nickname, a.view_count, a.like_count, a.comment_count, a.created_at
      FROM articles a
      LEFT JOIN users u ON u.id = a.author_id
      WHERE a.id != ? AND a.status = 'published'
      ORDER BY a.created_at DESC
      LIMIT ?
    `, [articleId, (limit * 2).toString()]);
      return latestArticles;
    } catch (error) { return []; }
  }
}

module.exports = registerArticleRoutes;
