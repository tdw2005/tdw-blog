function generateCacheKey(req) {
  const baseKey = `blog:${req.path}`;
  const queryString = Object.keys(req.query)
    .sort()
    .map(key => `${key}=${req.query[key]}`)
    .join('&');
  return queryString ? `${baseKey}?${queryString}` : baseKey;
}

module.exports = { generateCacheKey };
