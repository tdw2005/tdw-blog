const jwt = require('jsonwebtoken');

function registerCommentRoutes(app, { pool, JWT_SECRET, authenticateJWT, withFallback, cacheMiddleware, clearRelatedCaches }) {
  app.get('/api/articles/:id/comments', cacheMiddleware(300), withFallback(async (req, res) => {
    const articleId = req.params.id;
    const { page = 1, limit = 20, sort = 'newest' } = req.query;
    const offset = (page - 1) * limit;
    try {
      let orderBy = 'c.created_at DESC';
      if (sort === 'oldest') orderBy = 'c.created_at ASC';
      if (sort === 'popular') orderBy = 'c.created_at DESC';
      const [comments] = await pool.execute(`
            SELECT 
                c.id, c.article_id, c.user_id, c.user_name, u.nickname AS user_nickname, c.content,
                c.parent_id, c.created_at, c.updated_at, c.like_count,
                COUNT(r.id) as reply_count
            FROM comments c
            LEFT JOIN comments r ON r.parent_id = c.id
            LEFT JOIN users u ON u.id = c.user_id
            WHERE c.article_id = ? 
                AND c.parent_id IS NULL
            GROUP BY c.id
            ORDER BY ${orderBy}
            LIMIT ? OFFSET ?
        `, [articleId, limit.toString(), offset.toString()]);
      const [[{ total }]] = await pool.execute(`
            SELECT COUNT(*) as total 
            FROM comments 
            WHERE article_id = ? AND parent_id IS NULL
        `, [articleId]);
      if (comments.length > 0) {
        const commentIds = comments.map(c => c.id);
        const placeholders = commentIds.map(() => '?').join(',');
        const [firstLevelReplies] = await pool.execute(`
                SELECT 
                    c.id, c.article_id, c.user_id, c.user_name, u.nickname AS user_nickname, c.content,
                    c.parent_id, c.created_at, c.updated_at, c.like_count
                FROM comments c
                LEFT JOIN users u ON u.id = c.user_id
                WHERE c.parent_id IN (${placeholders})
                ORDER BY c.created_at ASC
            `, commentIds);
        const repliesMap = {};
        const replyToMainMap = new Map();
        firstLevelReplies.forEach(reply => {
          if (!repliesMap[reply.parent_id]) repliesMap[reply.parent_id] = [];
          repliesMap[reply.parent_id].push(reply);
          replyToMainMap.set(reply.id, reply.parent_id);
        });
        if (firstLevelReplies.length > 0) {
          const replyIds = firstLevelReplies.map(r => r.id);
          const replyPlaceholders = replyIds.map(() => '?').join(',');
          const [secondLevelReplies] = await pool.execute(`
                    SELECT 
                        c.id, c.article_id, c.user_id, c.user_name, u.nickname AS user_nickname, c.content,
                        c.parent_id, c.created_at, c.updated_at, c.like_count
                    FROM comments c
                    LEFT JOIN users u ON u.id = c.user_id
                    WHERE c.parent_id IN (${replyPlaceholders})
                    ORDER BY c.created_at ASC
                `, replyIds);
          secondLevelReplies.forEach(r2 => {
            const mainId = replyToMainMap.get(r2.parent_id);
            if (mainId) {
              if (!repliesMap[mainId]) repliesMap[mainId] = [];
              repliesMap[mainId].push(r2);
            }
          });
        }
        comments.forEach(comment => { comment.replies = repliesMap[comment.id] || []; });
      }
      let likedSet = new Set();
      try {
        const authHeader = req.headers.authorization || '';
        const t = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (t) {
          const payload = jwt.verify(t, JWT_SECRET);
          const allIds = [
            ...comments.map(c => c.id),
            ...comments.flatMap(c => c.replies || []).map(r => r.id)
          ];
          if (allIds.length > 0) {
            const placeholders2 = allIds.map(() => '?').join(',');
            const [likedRows] = await pool.execute(`SELECT comment_id FROM comment_likes WHERE user_id = ? AND comment_id IN (${placeholders2})`, [payload.uid, ...allIds]);
            likedSet = new Set(likedRows.map(r => r.comment_id));
          }
        }
      } catch (e) {}
      comments.forEach(c => { c.liked_by_current_user = likedSet.has(c.id); (c.replies || []).forEach(r => { r.liked_by_current_user = likedSet.has(r.id); }); });
      res.json({ success: true, data: { comments, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) } } });
    } catch (error) {
      res.status(500).json({ success: false, message: '获取评论失败' });
    }
  }));

  app.post('/api/articles/:id/comments', authenticateJWT, withFallback(async (req, res) => {
    const articleId = req.params.id;
    const { content, parent_id } = req.body;
    if (!content) { return res.status(400).json({ success: false, message: '评论内容不能为空' }); }
    if (content.length > 1000) { return res.status(400).json({ success: false, message: '评论内容过长' }); }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const safeParentId = (parent_id === undefined || parent_id === null) ? null : parent_id;
      const [result] = await connection.execute(`
            INSERT INTO comments (article_id, user_id, user_name, content, parent_id)
            VALUES (?, ?, ?, ?, ?)
        `, [articleId, req.user.uid, req.user.nickname, content, safeParentId]);
      await connection.execute(`
            UPDATE articles 
            SET comment_count = comment_count + 1 
            WHERE id = ?
        `, [articleId]);
      await connection.commit();
      await clearRelatedCaches(articleId);
      try {
        const [[articleRow]] = await pool.execute('SELECT author_id, title FROM articles WHERE id = ? LIMIT 1', [articleId]);
        if (articleRow && articleRow.author_id && articleRow.author_id !== req.user.uid) {
          await pool.execute('INSERT INTO notifications (user_id, recipient_id, type, actor_id, article_id, comment_id, message) VALUES (?, ?, ?, ?, ?, ?, ?)', [articleRow.author_id, articleRow.author_id, 'comment', req.user.uid, articleId, result.insertId, String(content).slice(0, 120)]);
          try { await clearRelatedCaches(null, articleRow.author_id); } catch {}
        }
        if (safeParentId) {
          const [[parentRow]] = await pool.execute('SELECT user_id FROM comments WHERE id = ? LIMIT 1', [safeParentId]);
          if (parentRow && parentRow.user_id && parentRow.user_id !== req.user.uid) {
            await pool.execute('INSERT INTO notifications (user_id, recipient_id, type, actor_id, article_id, comment_id, message) VALUES (?, ?, ?, ?, ?, ?, ?)', [parentRow.user_id, parentRow.user_id, 'reply', req.user.uid, articleId, result.insertId, String(content).slice(0, 120)]);
            try { await clearRelatedCaches(null, parentRow.user_id); } catch {}
          }
        }
      } catch (e) {}
      const [newComment] = await pool.execute(`
            SELECT c.id, c.article_id, c.user_id, c.user_name, u.nickname AS user_nickname, c.content, c.parent_id, c.like_count, c.created_at, c.updated_at 
            FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?
        `, [result.insertId]);
      res.json({ success: true, data: newComment[0], message: '评论提交成功' });
    } catch (error) {
      await connection.rollback();
      res.status(500).json({ success: false, message: '提交评论失败: ' + error.message });
    } finally {
      connection.release();
    }
  }));

  app.delete('/api/comments/:id', authenticateJWT, withFallback(async (req, res) => {
    const commentId = req.params.id;
    const [rows] = await pool.execute('SELECT id, article_id, user_id FROM comments WHERE id = ? LIMIT 1', [commentId]);
    if (rows.length === 0) { return res.status(404).json({ success: false, message: '评论不存在' }); }
    const c = rows[0];
    const isOwner = c.user_id === req.user.uid;
    if (!(isOwner || req.user.is_admin)) { return res.status(403).json({ success: false, message: '无权限删除该评论' }); }
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('DELETE FROM comments WHERE id = ?', [commentId]);
      const [[{ cnt }]] = await conn.execute('SELECT COUNT(*) AS cnt FROM comments WHERE article_id = ?', [c.article_id]);
      await conn.execute('UPDATE articles SET comment_count = ? WHERE id = ?', [cnt, c.article_id]);
      await conn.commit();
      await clearRelatedCaches(c.article_id);
      res.json({ success: true });
    } catch (e) {
      await conn.rollback();
      res.status(500).json({ success: false, message: '删除失败' });
    } finally {
      conn.release();
    }
  }));

  app.post('/api/comments/:id/like', authenticateJWT, withFallback(async (req, res) => {
    const commentId = parseInt(req.params.id);
    const uid = req.user.uid;
    const [[exists]] = await pool.execute('SELECT COUNT(*) AS cnt FROM comment_likes WHERE comment_id = ? AND user_id = ?', [commentId, uid]);
    let liked, likeCount;
    if (exists.cnt > 0) {
      await pool.execute('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?', [commentId, uid]);
      await pool.execute('UPDATE comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = ?', [commentId]);
      const [[row]] = await pool.execute('SELECT like_count FROM comments WHERE id = ?', [commentId]);
      liked = false; likeCount = row.like_count;
    } else {
      await pool.execute('INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)', [commentId, uid]);
      await pool.execute('UPDATE comments SET like_count = like_count + 1 WHERE id = ?', [commentId]);
      const [[row]] = await pool.execute('SELECT like_count FROM comments WHERE id = ?', [commentId]);
      liked = true; likeCount = row.like_count;
    }
    const [[crow]] = await pool.execute('SELECT article_id FROM comments WHERE id = ?', [commentId]);
    if (crow && crow.article_id) { await clearRelatedCaches(crow.article_id); }
    if (liked) {
      try {
        const [[owner]] = await pool.execute('SELECT user_id, article_id FROM comments WHERE id = ? LIMIT 1', [commentId]);
        if (owner && owner.user_id && owner.user_id !== uid) {
          await pool.execute('INSERT INTO notifications (user_id, recipient_id, type, actor_id, article_id, comment_id) VALUES (?, ?, ?, ?, ?, ?)', [owner.user_id, owner.user_id, 'comment_like', uid, owner.article_id, commentId]);
          try { await clearRelatedCaches(null, owner.user_id); } catch {}
        }
      } catch (e) {}
    }
    return res.json({ success: true, data: { liked, like_count: likeCount } });
  }));

  app.get('/api/comments/:id', cacheMiddleware(60), withFallback(async (req, res) => {
    const commentId = parseInt(req.params.id);
    const [[row]] = await pool.execute('SELECT c.id, c.article_id, c.user_id, c.content, c.parent_id, c.like_count, c.created_at, (SELECT COUNT(*) FROM comments WHERE parent_id = c.id) AS reply_count FROM comments c WHERE c.id = ? LIMIT 1', [commentId]);
    if (!row) { return res.status(404).json({ success: false, message: '评论不存在' }); }
    try {
      const authHeader = req.headers.authorization || '';
      const t = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (t) {
        const payload = jwt.verify(t, JWT_SECRET);
        const [[exists]] = await pool.execute('SELECT COUNT(*) AS cnt FROM comment_likes WHERE comment_id = ? AND user_id = ?', [commentId, payload.uid]);
        row.liked_by_current_user = exists.cnt > 0;
      }
    } catch (e) {}
    if (typeof row.liked_by_current_user === 'undefined') { row.liked_by_current_user = false; }
    res.json({ success: true, data: row });
  }));
}

module.exports = registerCommentRoutes;
