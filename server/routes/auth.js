const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

function registerAuthRoutes(app, { pool, JWT_SECRET, authenticateJWT, withFallback, clearRelatedCaches }) {
  app.post('/api/auth/register', withFallback(async (req, res) => {
    const { id, nickname, password } = req.body || {};
    if (!id || !nickname || !password) { return res.status(400).json({ success: false, message: '请输入完整信息' }); }
    if (nickname === '管理员') { return res.status(400).json({ success: false, message: '昵称不可为“管理员”' }); }
    if (id.length > 100 || nickname.length > 100 || password.length > 200) { return res.status(400).json({ success: false, message: '输入过长' }); }
    const [[existingById]] = await pool.execute('SELECT COUNT(*) AS cnt FROM users WHERE user_id = ?', [id]);
    if (existingById.cnt > 0) { return res.status(409).json({ success: false, message: '该ID已被使用' }); }
    const [[existingByName]] = await pool.execute('SELECT COUNT(*) AS cnt FROM users WHERE nickname = ?', [nickname]);
    if (existingByName.cnt > 0) { return res.status(409).json({ success: false, message: '该昵称已被使用' }); }
    const passwordHash = await bcrypt.hash(password, 10);
    const [cols] = await pool.execute('SHOW COLUMNS FROM users');
    const hasUsername = cols.map(c => c.Field).includes('username');
    let result;
    if (hasUsername) {
      [result] = await pool.execute('INSERT INTO users (user_id, nickname, password_hash, is_admin, username) VALUES (?, ?, ?, 0, ?)', [id, nickname, passwordHash, nickname]);
    } else {
      [result] = await pool.execute('INSERT INTO users (user_id, nickname, password_hash, is_admin) VALUES (?, ?, ?, 0)', [id, nickname, passwordHash]);
    }
    res.json({ success: true, data: { id: result.insertId } });
  }));

  app.post('/api/auth/login', withFallback(async (req, res) => {
    const { id, password } = req.body || {};
    if (!id || !password) { return res.status(400).json({ success: false, message: '请输入ID和密码' }); }
    const [users] = await pool.execute('SELECT id, user_id, nickname, password_hash, is_admin FROM users WHERE user_id = ? LIMIT 1', [id]);
    if (users.length === 0) { return res.status(401).json({ success: false, message: '账号或密码错误' }); }
    const user = users[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) { return res.status(401).json({ success: false, message: '账号或密码错误' }); }
    const token = jwt.sign({ uid: user.id, user_id: user.user_id, nickname: user.nickname, is_admin: !!user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
    try { res.setHeader('Set-Cookie', `token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`); } catch {}
    res.json({ success: true, data: { token, user: { id: user.id, user_id: user.user_id, nickname: user.nickname, is_admin: !!user.is_admin } } });
  }));

  app.get('/api/auth/me', authenticateJWT, withFallback(async (req, res) => {
    const uid = req.user.uid;
    const [users] = await pool.execute('SELECT id, user_id, nickname, is_admin, created_at, updated_at FROM users WHERE id = ? LIMIT 1', [uid]);
    if (users.length === 0) { return res.status(404).json({ success: false, message: '用户不存在' }); }
    const u = users[0];
    res.json({ success: true, data: u });
  }));

  app.put('/api/auth/profile', authenticateJWT, withFallback(async (req, res) => {
    const uid = req.user.uid;
    const { nickname } = req.body || {};
    if (!nickname) { return res.status(400).json({ success: false, message: '请输入昵称' }); }
    if (!req.user.is_admin && nickname === '管理员') { return res.status(400).json({ success: false, message: '昵称不可为“管理员”' }); }
    const [[exists]] = await pool.execute('SELECT COUNT(*) AS cnt FROM users WHERE nickname = ? AND id <> ?', [nickname, uid]);
    if (exists.cnt > 0) { return res.status(409).json({ success: false, message: '该昵称已被使用' }); }
    await pool.execute('UPDATE users SET nickname = ? WHERE id = ?', [nickname, uid]);
    try { await pool.execute('UPDATE comments SET user_name = ? WHERE user_id = ?', [nickname, uid]); } catch {}
    try {
      const authorId = req.user.uid;
      const [rows] = await pool.execute('SELECT id FROM articles WHERE author_id = ?', [authorId]);
      await clearRelatedCaches();
      const ids = rows.map(r => r.id);
      if (ids.length > 0) { await Promise.all(ids.map(id => clearRelatedCaches(id))); }
      const [commentArticleRows] = await pool.execute('SELECT DISTINCT article_id FROM comments WHERE user_id = ?', [uid]);
      const commentArticleIds = commentArticleRows.map(r => r.article_id);
      if (commentArticleIds.length > 0) { await Promise.all(commentArticleIds.map(id => clearRelatedCaches(id))); }
    } catch (e) {}
    res.json({ success: true });
  }));

  app.put('/api/auth/password', authenticateJWT, withFallback(async (req, res) => {
    const uid = req.user.uid;
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) { return res.status(400).json({ success: false, message: '请输入旧密码和新密码' }); }
    const [users] = await pool.execute('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [uid]);
    if (users.length === 0) { return res.status(404).json({ success: false, message: '用户不存在' }); }
    const ok = await bcrypt.compare(oldPassword, users[0].password_hash);
    if (!ok) { return res.status(401).json({ success: false, message: '旧密码不正确' }); }
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, uid]);
    res.json({ success: true });
  }));

  app.post('/api/auth/logout', authenticateJWT, (req, res) => {
    try { res.setHeader('Set-Cookie', 'token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'); } catch {}
    res.json({ success: true });
  });
}

module.exports = registerAuthRoutes;
