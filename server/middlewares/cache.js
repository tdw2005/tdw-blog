const { generateCacheKey } = require('../utils/cache-key');
const { generateETag } = require('../utils/etag');

module.exports = (cacheFallback, defaultTTL = parseInt(process.env.CACHE_TTL) || 3600) => {
  return (ttl = defaultTTL, options = {}) => {
    return async (req, res, next) => {
      if (req.method !== 'GET') return next();

      const authHeader = req.headers.authorization || '';
      const allowAuthCache = !!options.allowAuthCache;
      const varyByUser = !!options.varyByUser;

      if (authHeader && !allowAuthCache) return next();

      const baseKey = generateCacheKey(req);
      let cacheKey = baseKey;
      if (allowAuthCache && varyByUser && req.user && req.user.uid) {
        cacheKey = `${baseKey}:uid=${req.user.uid}`;
      }

      try {
        const cachedData = await cacheFallback.getWithFallback(cacheKey);
        if (cachedData) {
          const data = JSON.parse(cachedData);
          const etag = generateETag(data);
          res.setHeader('ETag', etag);
          if (allowAuthCache && varyByUser) {
            const existingVary = res.getHeader && res.getHeader('Vary');
            res.setHeader('Vary', existingVary ? String(existingVary) + ', Authorization' : 'Accept-Encoding, Authorization');
          }
          const clientETag = req.headers['if-none-match'];
          if (clientETag === etag) {
            return res.status(304).end();
          }
          return res.json(data);
        }
      } catch (error) {}

      const lockKey = `lock:${cacheKey}`;
      let hasLock = false;
      try {
        if (cacheFallback.redisClient && cacheFallback.redisClient.isConnected) {
          hasLock = await cacheFallback.redisClient.setNX(lockKey, '1', 2);
        }
      } catch (e) {}

      if (!hasLock) {
        try {
          await new Promise(resolve => setTimeout(resolve, 120));
          const again = await cacheFallback.getWithFallback(cacheKey);
          if (again) {
            const data = JSON.parse(again);
            const etag = generateETag(data);
            res.setHeader('ETag', etag);
            if (allowAuthCache && varyByUser) {
              const existingVary = res.getHeader && res.getHeader('Vary');
              res.setHeader('Vary', existingVary ? String(existingVary) + ', Authorization' : 'Accept-Encoding, Authorization');
            }
            const clientETag = req.headers['if-none-match'];
            if (clientETag === etag) { return res.status(304).end(); }
            return res.json(data);
          }
        } catch (e) {}
      }

      const originalJson = res.json;
      res.json = function (data) {
        if (data && data.success && !data.fallback) {
          const jitter = Math.floor(Math.random() * 10);
          cacheFallback.setWithFallback(cacheKey, JSON.stringify(data), Math.max(1, ttl + jitter)).catch(() => {});
        }
        try { if (hasLock && cacheFallback.redisClient) { cacheFallback.redisClient.del(lockKey).catch(() => {}); } } catch {}
        originalJson.call(this, data);
      };

      next();
    };
  };
};
