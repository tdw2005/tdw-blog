const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { checkDatabaseHealth, checkRedisHealth } = require('../fallback-utils');

function registerSystemRoutes(app, { pool, redisClient, authenticateJWT, withFallback, clearRelatedCaches }) {
  app.get('/api/health', async (req, res) => {
    try {
      const [dbHealth, redisHealth] = await Promise.all([
        checkDatabaseHealth(pool),
        checkRedisHealth(redisClient)
      ]);
      res.json({ success: true, data: { database: dbHealth ? 'healthy' : 'unhealthy', redis: redisHealth ? 'healthy' : 'unhealthy', timestamp: new Date().toISOString(), uptime: process.uptime() } });
    } catch (error) {
      res.json({ success: false, data: { database: 'unknown', redis: 'unknown', timestamp: new Date().toISOString(), error: error.message } });
    }
  });

  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) { try { fs.mkdirSync(backupDir, { recursive: true }); } catch {} }

  app.post('/api/backup/create', authenticateJWT, withFallback(async (req, res) => {
    if (!req.user.is_admin) { return res.status(403).json({ success: false, message: '仅管理员可创建备份' }); }
    const backupId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    const backupPath = path.join(backupDir, `${backupId}.json`);
    const [articles] = await pool.execute('SELECT * FROM articles');
    const [users] = await pool.execute('SELECT * FROM users');
    const [comments] = await pool.execute('SELECT * FROM comments');
    const data = { timestamp: new Date().toISOString(), articles, users, comments };
    fs.writeFileSync(backupPath, JSON.stringify(data));
    res.json({ success: true, data: { backupId, timestamp: data.timestamp } });
  }));

  app.post('/api/backup/import', authenticateJWT, withFallback(async (req, res) => {
    if (!req.user.is_admin) { return res.status(403).json({ success: false, message: '仅管理员可导入备份' }); }
    const payload = req.body || {};
    if (!payload || !Array.isArray(payload.users) || !Array.isArray(payload.articles) || !Array.isArray(payload.comments)) {
      return res.status(400).json({ success: false, message: '请提交包含 users、articles、comments 的JSON' });
    }
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      try { await conn.execute('SET FOREIGN_KEY_CHECKS = 0'); } catch {}
      try { await conn.execute('DELETE FROM notifications'); } catch {}
      try { await conn.execute('DELETE FROM comment_likes'); } catch {}
      try { await conn.execute('DELETE FROM article_likes'); } catch {}
      try { await conn.execute('DELETE FROM article_tags'); } catch {}
      try { await conn.execute('DELETE FROM tags'); } catch {}
      try { await conn.execute('DELETE FROM comments'); } catch {}
      try { await conn.execute('DELETE FROM articles'); } catch {}
      try { await conn.execute('DELETE FROM users'); } catch {}

      const insertRows = async (table, rows) => {
        if (!rows || rows.length === 0) return;
        const cols = Object.keys(rows[0] || {});
        const placeholders = cols.map(() => '?').join(',');
        const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`;
        for (const r of rows) {
          const values = cols.map(c => r[c]);
          await conn.execute(sql, values);
        }
      };

      await insertRows('users', payload.users);
      await insertRows('articles', payload.articles);
      await insertRows('comments', payload.comments);

      try { await conn.execute('SET FOREIGN_KEY_CHECKS = 1'); } catch {}
      await conn.commit();
      try {
        const setArticleTags = require('../services/tags')(pool);
        const [tagSeed] = await pool.execute('SELECT id, tags FROM articles');
        for (const row of tagSeed) { await setArticleTags(row.id, row.tags); }
      } catch {}
      try { await clearRelatedCaches(); } catch {}
      res.json({ success: true });
    } catch (e) {
      try { await conn.rollback(); } catch {}
      res.status(500).json({ success: false, message: '导入失败' });
    } finally {
      conn.release();
    }
  }));

  app.post('/api/admin/backfill/nicknames', authenticateJWT, withFallback(async (req, res) => {
    if (!req.user.is_admin) { return res.status(403).json({ success: false, message: '仅管理员可执行回填任务' }); }
    try {
      const [affected] = await pool.execute(`UPDATE comments c JOIN users u ON u.id = c.user_id SET c.user_name = u.nickname`);
      await clearRelatedCaches();
      res.json({ success: true, data: { updated: affected.affectedRows || 0 } });
    } catch (e) {
      res.status(500).json({ success: false, message: '昵称回填失败' });
    }
  }));

  app.get('/api/backup/list', authenticateJWT, withFallback(async (req, res) => {
    if (!req.user.is_admin) { return res.status(403).json({ success: false, message: '仅管理员可查看备份' }); }
    const files = fs.existsSync(backupDir) ? fs.readdirSync(backupDir).filter(f => f.endsWith('.json')) : [];
    const list = files.map(name => {
      const id = name.replace(/\.json$/, '');
      const p = path.join(backupDir, name);
      let ts = null; try { const content = JSON.parse(fs.readFileSync(p, 'utf-8')); ts = content.timestamp; } catch {}
      const stat = fs.statSync(p);
      return { id, size: stat.size, mtime: stat.mtime.toISOString(), timestamp: ts };
    }).sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
    res.json({ success: true, data: list });
  }));

  app.get('/api/backup/download/:id', authenticateJWT, withFallback(async (req, res) => {
    if (!req.user.is_admin) { return res.status(403).json({ success: false, message: '仅管理员可下载备份' }); }
    const id = req.params.id;
    const filePath = path.join(backupDir, `${id}.json`);
    if (!fs.existsSync(filePath)) { return res.status(404).json({ success: false, message: '备份不存在' }); }
    res.download(filePath, `${id}.json`);
  }));

  app.delete('/api/backup/:id', authenticateJWT, withFallback(async (req, res) => {
    if (!req.user.is_admin) { return res.status(403).json({ success: false, message: '仅管理员可删除备份' }); }
    const id = req.params.id;
    const filePath = path.join(backupDir, `${id}.json`);
    if (!fs.existsSync(filePath)) { return res.status(404).json({ success: false, message: '备份不存在' }); }
    fs.unlinkSync(filePath);
    res.json({ success: true });
  }));
}

module.exports = registerSystemRoutes;
