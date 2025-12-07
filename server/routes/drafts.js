function registerDraftRoutes(app, { pool, authenticateJWT, withFallback, clearRelatedCaches }) {
  app.get('/api/drafts', authenticateJWT, withFallback(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const scope = (req.query.scope || 'mine').toLowerCase();
    const sortBy = req.query.sortBy || 'updated_at';
    const sortOrder = (req.query.sortOrder || 'DESC').toUpperCase();
    const validSortFields = ['updated_at', 'created_at', 'title'];
    const validOrders = ['ASC', 'DESC'];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'updated_at';
    const safeSortOrder = validOrders.includes(sortOrder) ? sortOrder : 'DESC';
    let whereClause = `a.status = 'draft'`;
    let params = [];
    if (!req.user.is_admin || scope !== 'all') { whereClause += ' AND a.author_id = ?'; params.push(req.user.uid); }
    const [drafts] = await pool.execute(
      `SELECT a.id, a.title, a.excerpt, a.author_id, u.nickname AS author_nickname, u.user_id AS author_uid, a.editor_type, a.view_count, a.created_at, a.updated_at
         FROM articles a
         LEFT JOIN users u ON u.id = a.author_id
         WHERE ${whereClause}
         ORDER BY ${safeSortBy} ${safeSortOrder}
         LIMIT ? OFFSET ?`,
      [...params, limit.toString(), offset.toString()]
    );
    const countQuery = `SELECT COUNT(*) as total FROM articles a WHERE ${whereClause}`;
    const [[{ total }]] = await pool.execute(countQuery, params);
    const draftIds = drafts.map(a => a.id);
    let tagMapDrafts = {};
    if (draftIds.length > 0) {
      const ph = draftIds.map(() => '?').join(',');
      const [tagRows] = await pool.execute(`SELECT t.article_id, g.name FROM article_tags t JOIN tags g ON g.id = t.tag_id WHERE t.article_id IN (${ph})`, draftIds);
      for (const r of tagRows) { if (!tagMapDrafts[r.article_id]) tagMapDrafts[r.article_id] = []; tagMapDrafts[r.article_id].push(r.name); }
    }
    const parsedDrafts = drafts.map(a => ({ ...a, tags: tagMapDrafts[a.id] || [] }));
    res.json({ success: true, data: { drafts: parsedDrafts, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
  }));

  app.put('/api/drafts/:id/publish', authenticateJWT, withFallback(async (req, res) => {
    const articleId = req.params.id;
    const [rows] = await pool.execute('SELECT author_id, status FROM articles WHERE id = ? LIMIT 1', [articleId]);
    if (rows.length === 0) { return res.status(404).json({ success: false, message: '文章不存在' }); }
    const isOwner = rows[0].author_id === req.user.uid;
    if (!isOwner) { return res.status(403).json({ success: false, message: '无权限发布该草稿' }); }
    if (String(rows[0].status) !== 'draft') { return res.status(400).json({ success: false, message: '当前文章不是草稿' }); }
    const [result] = await pool.execute(`UPDATE articles SET status = 'published', created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [articleId]);
    if (result.affectedRows === 0) { return res.status(404).json({ success: false, message: '文章不存在' }); }
    await clearRelatedCaches(articleId);
    res.json({ success: true });
  }));

  app.post('/api/drafts/batch-delete', authenticateJWT, withFallback(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(id => parseInt(id)).filter(id => Number.isFinite(id)) : [];
    if (ids.length === 0) { return res.status(400).json({ success: false, message: '请提供要删除的草稿ID列表' }); }
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const placeholders = ids.map(() => '?').join(',');
      const params = [...ids, req.user.uid];
      const [existing] = await conn.execute(`SELECT id FROM articles WHERE id IN (${placeholders}) AND author_id = ? AND status = 'draft'`, params);
      const existingIds = existing.map(r => r.id);
      if (existingIds.length > 0) {
        const delPlaceholders = existingIds.map(() => '?').join(',');
        await conn.execute(`DELETE FROM articles WHERE id IN (${delPlaceholders}) AND author_id = ? AND status = 'draft'`, [...existingIds, req.user.uid]);
      }
      await conn.commit();
      await clearRelatedCaches();
      if (existingIds.length > 0) { await Promise.all(existingIds.map(id => clearRelatedCaches(id))); }
      return res.json({ success: true, data: { requested: ids.length, deleted: existingIds.length, deleted_ids: existingIds } });
    } catch (e) {
      await conn.rollback();
      return res.status(500).json({ success: false, message: '批量删除失败' });
    } finally {
      conn.release();
    }
  }));
}

module.exports = registerDraftRoutes;
