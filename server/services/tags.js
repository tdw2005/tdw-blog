const { parseTagsField } = require('../utils/parse');

module.exports = (pool) => {
  return async function setArticleTags(articleId, tags) {
    const arr = Array.isArray(tags) ? tags.map(t => String(t || '').trim()).filter(Boolean) : parseTagsField(tags);
    const unique = [...new Set(arr)];
    await pool.execute('DELETE FROM article_tags WHERE article_id = ?', [articleId]);
    for (const name of unique) {
      await pool.execute('INSERT INTO tags (name) VALUES (?) ON DUPLICATE KEY UPDATE name = name', [name]);
      const [[row]] = await pool.execute('SELECT id FROM tags WHERE name = ? LIMIT 1', [name]);
      if (row && row.id) {
        await pool.execute('INSERT IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)', [articleId, row.id]);
      }
    }
  };
};
