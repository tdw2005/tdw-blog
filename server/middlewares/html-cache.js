module.exports = (req, res, next) => {
  if (req.path === '/' || req.path.startsWith('/article/') || req.path.startsWith('/create') || req.path.startsWith('/edit/')) {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Vary', 'Accept-Encoding');
  }
  next();
};
