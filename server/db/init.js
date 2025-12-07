module.exports = async function initDatabase(pool) {
  try {
    const connection = await pool.getConnection();
    await connection.execute('SELECT 1');
    connection.release();
  } catch (err) {}

  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        recipient_id INT NOT NULL,
        type VARCHAR(50) NOT NULL,
        actor_id INT NOT NULL,
        article_id INT NULL,
        comment_id INT NULL,
        message VARCHAR(255) NULL,
        \`read\` TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP NULL,
        FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
        FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
        INDEX idx_recipient (recipient_id, \`read\`, created_at),
        INDEX idx_article (article_id),
        INDEX idx_comment (comment_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    const [colsN] = await pool.execute('SHOW COLUMNS FROM notifications');
    const namesN = colsN.map(c => c.Field);
    if (!namesN.includes('recipient_id')) {
      await pool.execute('ALTER TABLE notifications ADD COLUMN recipient_id INT NOT NULL DEFAULT 0');
    }
    if (!namesN.includes('type')) {
      await pool.execute("ALTER TABLE notifications ADD COLUMN type VARCHAR(50) NOT NULL DEFAULT 'article_like'");
    }
    if (!namesN.includes('actor_id')) {
      await pool.execute('ALTER TABLE notifications ADD COLUMN actor_id INT NOT NULL DEFAULT 0');
    }
    if (!namesN.includes('article_id')) {
      await pool.execute('ALTER TABLE notifications ADD COLUMN article_id INT NULL');
    }
    if (!namesN.includes('comment_id')) {
      await pool.execute('ALTER TABLE notifications ADD COLUMN comment_id INT NULL');
    }
    if (!namesN.includes('message')) {
      await pool.execute('ALTER TABLE notifications ADD COLUMN message VARCHAR(255) NULL');
    }
    if (!namesN.includes('read')) {
      await pool.execute('ALTER TABLE notifications ADD COLUMN `read` TINYINT(1) DEFAULT 0');
    }
    if (!namesN.includes('read_at')) {
      await pool.execute('ALTER TABLE notifications ADD COLUMN read_at TIMESTAMP NULL');
    }
  } catch (e) {}

  try {
    await pool.execute(`CREATE TABLE IF NOT EXISTS comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      article_id INT NOT NULL,
      user_name VARCHAR(100) NOT NULL,
      content TEXT NOT NULL,
      parent_id INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
    const [colsC] = await pool.execute('SHOW COLUMNS FROM comments');
    const namesC = colsC.map(c => c.Field);
    if (!namesC.includes('user_id')) {
      await pool.execute('ALTER TABLE comments ADD COLUMN user_id INT NULL');
    }
    if (!namesC.includes('like_count')) {
      await pool.execute('ALTER TABLE comments ADD COLUMN like_count INT DEFAULT 0');
    }
    await pool.execute(`CREATE TABLE IF NOT EXISTS comment_likes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      comment_id INT NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_like (comment_id, user_id),
      FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
  } catch (e) {}

  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL UNIQUE,
        nickname VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        is_admin TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    const [columns] = await pool.execute('SHOW COLUMNS FROM users');
    const namesU = columns.map(c => c.Field);
    if (!namesU.includes('user_id')) {
      await pool.execute('ALTER TABLE users ADD COLUMN user_id VARCHAR(100) NOT NULL UNIQUE');
    }
    if (!namesU.includes('nickname')) {
      await pool.execute('ALTER TABLE users ADD COLUMN nickname VARCHAR(100) NOT NULL UNIQUE');
    }
    if (!namesU.includes('password_hash')) {
      await pool.execute('ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NOT NULL');
    }
    if (!namesU.includes('is_admin')) {
      await pool.execute('ALTER TABLE users ADD COLUMN is_admin TINYINT(1) DEFAULT 0');
    }
    if (!namesU.includes('created_at')) {
      await pool.execute('ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    }
    if (!namesU.includes('updated_at')) {
      await pool.execute('ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    }
    const [existing] = await pool.execute('SELECT id FROM users WHERE user_id = ? LIMIT 1', ['admintdw']);
    if (existing.length === 0) {
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash('123456', 10);
      const [cols2] = await pool.execute('SHOW COLUMNS FROM users');
      const names2 = cols2.map(c => c.Field);
      const hasUsername = names2.includes('username');
      if (hasUsername) {
        const [uRows] = await pool.execute('SELECT id FROM users WHERE username = ? LIMIT 1', ['管理员']);
        if (uRows.length > 0) {
          await pool.execute('UPDATE users SET user_id = ?, nickname = ?, password_hash = ?, is_admin = ?, username = ? WHERE id = ?', ['admintdw', '管理员', passwordHash, 1, 'admintdw', uRows[0].id]);
        } else {
          const [nRows] = await pool.execute('SELECT id FROM users WHERE nickname = ? LIMIT 1', ['管理员']);
          if (nRows.length > 0) {
            await pool.execute('UPDATE users SET user_id = ?, nickname = ?, password_hash = ?, is_admin = ? WHERE id = ?', ['admintdw', '管理员', passwordHash, 1, nRows[0].id]);
            await pool.execute('UPDATE users SET username = ? WHERE id = ?', ['admintdw', nRows[0].id]);
          } else {
            await pool.execute('INSERT INTO users (user_id, nickname, password_hash, is_admin, username) VALUES (?, ?, ?, ?, ?)', ['admintdw', '管理员', passwordHash, 1, 'admintdw']);
          }
        }
      } else {
        const [nRows] = await pool.execute('SELECT id FROM users WHERE nickname = ? LIMIT 1', ['管理员']);
        if (nRows.length > 0) {
          await pool.execute('UPDATE users SET user_id = ?, nickname = ?, password_hash = ?, is_admin = ? WHERE id = ?', ['admintdw', '管理员', passwordHash, 1, nRows[0].id]);
        } else {
          await pool.execute('INSERT INTO users (user_id, nickname, password_hash, is_admin) VALUES (?, ?, ?, ?)', ['admintdw', '管理员', passwordHash, 1]);
        }
      }
    }
  } catch (e) {}

  try {
    const [colsA] = await pool.execute('SHOW COLUMNS FROM articles');
    const namesA = colsA.map(c => c.Field);
    if (!namesA.includes('like_count')) {
      await pool.execute('ALTER TABLE articles ADD COLUMN like_count INT DEFAULT 0');
    }
    await pool.execute(`CREATE TABLE IF NOT EXISTS article_likes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      article_id INT NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_article_like (article_id, user_id),
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS tags (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS article_tags (
      article_id INT NOT NULL,
      tag_id INT NOT NULL,
      PRIMARY KEY (article_id, tag_id),
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

    if (!namesA.includes('author_id')) {
      await pool.execute('ALTER TABLE articles ADD COLUMN author_id INT NULL');
      await pool.execute('UPDATE articles a JOIN users u ON u.user_id = a.author SET a.author_id = u.id WHERE a.author_id IS NULL');
      try { await pool.execute('ALTER TABLE articles ADD INDEX idx_author_id (author_id)'); } catch (e) {}
      try { await pool.execute('ALTER TABLE articles ADD CONSTRAINT fk_articles_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL'); } catch (e) {}
    }

    const setArticleTags = require('../services/tags')(pool);
    const [tagSeed] = await pool.execute('SELECT id, tags FROM articles');
    for (const row of tagSeed) {
      await setArticleTags(row.id, row.tags);
    }
  } catch (e) {}
};
