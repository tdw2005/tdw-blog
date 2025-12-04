SET FOREIGN_KEY_CHECKS = 0;
-- 创建数据库
CREATE DATABASE IF NOT EXISTS blog_ssr 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE blog_ssr;

-- 删除旧表
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS articles;

-- 文章表
CREATE TABLE articles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  author VARCHAR(100) DEFAULT 'Admin',
  tags JSON,
  editor_type ENUM('rich', 'markdown') DEFAULT 'rich',
  status ENUM('published', 'draft') DEFAULT 'published',
  view_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 评论表
-- 在 server/database/schema.sql 中修改 comments 表结构
CREATE TABLE comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  article_id INT NOT NULL,
  user_name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  parent_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 添加索引
ALTER TABLE articles 
ADD INDEX idx_articles_status (status),
ADD INDEX idx_articles_created (created_at),
ADD INDEX idx_articles_comments (comment_count);

ALTER TABLE comments
ADD INDEX idx_comments_article (article_id),
ADD INDEX idx_comments_parent (parent_id);
SET FOREIGN_KEY_CHECKS = 1;