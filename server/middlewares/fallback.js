const { generateFallbackHTML, generateFallbackAPIResponse } = require('../fallback-utils');

function createFallbackResponse() {
  return (req, res, next) => {
    res.fallback = function (error = '服务暂时不可用', options = {}) {
      if (req.path.startsWith('/api')) {
        const response = generateFallbackAPIResponse(error);
        if (options.retryAfter) {
          res.setHeader('Retry-After', options.retryAfter);
        }
        return this.status(503).json(response);
      } else {
        const html = generateFallbackHTML(options.title || '服务暂时不可用', options.message || error);
        return this.status(503).send(html);
      }
    };
    next();
  };
}

function createWithFallback(serviceMonitor, cacheFallback) {
  return (handler, options = {}) => {
    return async (req, res, next) => {
      const isSystemHealthy = serviceMonitor.isSystemHealthy();

      if (!isSystemHealthy && options.allowFallback !== false) {
        if (req.path.startsWith('/api/articles') && req.method === 'GET') {
          try {
            if (req.params.id) {
              const fallbackArticle = await cacheFallback.getArticleFallback(req.params.id);
              return res.json({ success: true, data: fallbackArticle, fallback: true, message: '降级模式：返回基础数据' });
            } else {
              const page = parseInt(req.query.page) || 1;
              const limit = parseInt(req.query.limit) || 10;
              const fallbackData = await cacheFallback.getArticlesFallback(page, limit);
              return res.json({ success: true, data: fallbackData, fallback: true, message: '降级模式：返回基础数据' });
            }
          } catch (fallbackError) {
            return res.fallback('服务暂时不可用，请稍后重试', { retryAfter: 30 });
          }
        } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
          return res.fallback('系统维护中，暂时无法执行此操作', { retryAfter: 60 });
        } else {
          return res.fallback('服务暂时不可用');
        }
      }

      try {
        await handler(req, res, next);
      } catch (error) {
        const isDbError = error.code && ['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR'].some(dbErrorCode => error.code.includes(dbErrorCode));
        if (isDbError && options.allowFallback !== false) {
          serviceMonitor.status.database = false;
          return res.fallback('数据库服务暂时不可用', { retryAfter: 30 });
        }
        res.status(500).json({ success: false, message: '服务器内部错误', ...(process.env.NODE_ENV === 'development' && { error: error.message }) });
      }
    };
  };
}

module.exports = { createFallbackResponse, createWithFallback };
