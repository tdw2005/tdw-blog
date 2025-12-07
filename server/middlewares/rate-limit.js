module.exports = (redisClient) => {
  return (options = {}) => {
    const { windowMs = 60000, max = 100, prefix = 'rate-limit:' } = options;
    return async (req, res, next) => {
      try {
        const identifier = req.headers['x-forwarded-for'] || req.ip || 'unknown';
        const key = `${prefix}${identifier}:${req.path}`;
        await redisClient.waitForConnection();
        const currentRaw = await redisClient.get(key);
        const current = currentRaw ? parseInt(currentRaw, 10) : 0;
        if (current >= max) {
          res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
          return res.status(429).json({ success: false, message: '请求过于频繁，请稍后再试' });
        }
        await redisClient.set(key, current + 1, Math.ceil(windowMs / 1000));
        next();
      } catch (e) {
        next();
      }
    };
  };
};
