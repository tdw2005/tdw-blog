function registerNotificationRoutes(app, { pool, authenticateJWT, withFallback, cacheMiddleware, clearRelatedCaches }) {
  app.get('/api/notifications', authenticateJWT, cacheMiddleware(60, { allowAuthCache: true, varyByUser: true }), withFallback(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const unreadOnly = String(req.query.unread || '').toLowerCase() === '1';
    const where = unreadOnly ? 'n.recipient_id = ? AND n.`read` = 0' : 'n.recipient_id = ?';
    const params = [req.user.uid, limit.toString(), offset.toString()];
    const [rows] = await pool.execute(`
         SELECT 
            n.id, n.type, n.actor_id, u.nickname AS actor_nickname,
            n.article_id, a.title AS article_title,
            n.comment_id, SUBSTRING(c.content, 1, 120) AS comment_excerpt,
            n.message, n.\`read\`, n.created_at, n.read_at
         FROM notifications n
         LEFT JOIN users u ON u.id = n.actor_id
         LEFT JOIN articles a ON a.id = n.article_id
         LEFT JOIN comments c ON c.id = n.comment_id
         WHERE ${where}
         ORDER BY n.created_at DESC
         LIMIT ? OFFSET ?`, [req.user.uid, ...params.slice(1)]);
    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM notifications n WHERE ${where}`, [req.user.uid]);
    res.json({ success: true, data: { notifications: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
  }));

  app.post('/api/notifications/mark-read', authenticateJWT, withFallback(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(id => parseInt(id)).filter(Number.isFinite) : [];
    if (ids.length === 0) { return res.status(400).json({ success: false, message: '请提供通知ID列表' }); }
    const placeholders = ids.map(() => '?').join(',');
    await pool.execute(`UPDATE notifications SET \`read\` = 1, read_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders}) AND recipient_id = ?`, [...ids, req.user.uid]);
    try { await clearRelatedCaches(null, req.user.uid); } catch {}
    res.json({ success: true });
  }));

  app.post('/api/notifications/mark-all-read', authenticateJWT, withFallback(async (req, res) => {
    await pool.execute('UPDATE notifications SET \`read\` = 1, read_at = CURRENT_TIMESTAMP WHERE recipient_id = ?', [req.user.uid]);
    try { await clearRelatedCaches(null, req.user.uid); } catch {}
    res.json({ success: true });
  }));

  app.get('/api/notifications/unread-count', authenticateJWT, withFallback(async (req, res) => {
    const [[{ cnt }]] = await pool.execute('SELECT COUNT(*) AS cnt FROM notifications WHERE recipient_id = ? AND `read` = 0', [req.user.uid]);
    res.json({ success: true, data: { unread: cnt } });
  }));

  app.get('/api/notifications/unread-counts', authenticateJWT, withFallback(async (req, res) => {
    const [rows] = await pool.execute('SELECT type, COUNT(*) AS cnt FROM notifications WHERE recipient_id = ? AND `read` = 0 GROUP BY type', [req.user.uid]);
    const data = { article_like: 0, comment_like: 0, comment: 0, reply: 0, total: 0 };
    for (const r of rows) {
      const t = String(r.type);
      const c = parseInt(r.cnt, 10) || 0;
      if (t === 'article_like') data.article_like = c;
      else if (t === 'comment_like') data.comment_like = c;
      else if (t === 'comment') data.comment = c;
      else if (t === 'reply') data.reply = c;
      data.total += c;
    }
    res.json({ success: true, data });
  }));
}

module.exports = registerNotificationRoutes;
