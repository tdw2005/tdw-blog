const { generateETag } = require('../utils/etag');

function registerTagRoutes(app, { pool, cacheMiddleware, withFallback }) {
  app.get('/api/tags', cacheMiddleware(600), withFallback(async (req, res) => {
    try {
      const [rows] = await pool.execute(`
            SELECT g.name AS name, COUNT(*) AS count
            FROM article_tags t
            JOIN tags g ON g.id = t.tag_id
            JOIN articles a ON a.id = t.article_id
            WHERE a.status = 'published'
            GROUP BY g.name
            ORDER BY count DESC
        `);
      const tags = rows.map(r => ({ name: r.name, count: parseInt(r.count, 10) || 0 }));
      const resultData = { success: true, data: { tags, total: tags.length } };
      const etag = generateETag(resultData);
      res.setHeader('ETag', etag);
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) { return res.status(304).end(); }
      res.json(resultData);
    } catch (error) {
      res.json({ success: true, data: { tags: [], total: 0 } });
    }
  }));
}

module.exports = registerTagRoutes;
