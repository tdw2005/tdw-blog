module.exports = (req, res, next) => {
  if (req.path.startsWith('/api/articles') && req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Vary', 'Accept-Encoding, Authorization');
  }
  next();
};
