module.exports = (cacheFallback) => {
  return async function clearRelatedCaches(articleId = null, userId = null) {
    try {
      const keysToDelete = [];
      const listKeys = await cacheFallback.redisClient.scan('blog:/api/articles*');
      keysToDelete.push(...listKeys);
      const tagKeys = await cacheFallback.redisClient.scan('blog:/api/tags*');
      keysToDelete.push(...tagKeys);
      if (articleId) {
        const detailKey = `blog:/api/articles/${articleId}`;
        keysToDelete.push(detailKey);
        const commentKeys = await cacheFallback.redisClient.scan(`blog:/api/articles/${articleId}/comments*`);
        keysToDelete.push(...commentKeys);
        const statsKey = `blog:/api/articles/${articleId}/comments/stats`;
        keysToDelete.push(statsKey);
      }
      if (userId) {
        try {
          const notifKeys = await cacheFallback.redisClient.scan('blog-auth:/api/notifications*');
          for (const k of notifKeys) {
            if (String(k).includes(`:uid=${userId}`)) {
              keysToDelete.push(k);
            }
          }
        } catch {}
      }
      if (keysToDelete.length > 0) {
        await Promise.all(keysToDelete.map(key => cacheFallback.redisClient.del(key)));
      }
      cacheFallback.cleanup();
    } catch (error) {}
  };
};
