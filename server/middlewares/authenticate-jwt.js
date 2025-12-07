const jwt = require('jsonwebtoken');

module.exports = (secret) => {
  return (req, res, next) => {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!token) {
        return res.status(401).json({ success: false, message: '未授权' });
      }
      const payload = jwt.verify(token, secret);
      req.user = payload;
      next();
    } catch (err) {
      return res.status(403).json({ success: false, message: '令牌无效或已过期' });
    }
  };
};
