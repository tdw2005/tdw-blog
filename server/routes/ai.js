function registerAIRoutes(app, { aiService }) {
  app.post('/api/ai/generate-article', async (req, res) => {
    try {
      const { title, keywords } = req.body;
      if (!title) { return res.status(400).json({ success: false, message: '标题不能为空' }); }
      if (!aiService.isAvailable()) { return res.status(503).json({ success: false, message: 'AI服务未配置，请在.env文件中设置ZHIPUAI_API_KEY' }); }
      const content = await aiService.generateArticle(title, keywords);
      res.json({ success: true, data: { title, content, excerpt: await aiService.generateExcerpt(content) } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/ai/generate-excerpt', async (req, res) => {
    try {
      const { content } = req.body;
      if (!content) { return res.status(400).json({ success: false, message: '内容不能为空' }); }
      if (!aiService.isAvailable()) { return res.status(503).json({ success: false, message: 'AI服务未配置，请在.env文件中设置ZHIPUAI_API_KEY' }); }
      const excerpt = await aiService.generateExcerpt(content);
      res.json({ success: true, data: { excerpt } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/ai/writing-suggestions', async (req, res) => {
    try {
      const { topic } = req.body;
      if (!topic) { return res.status(400).json({ success: false, message: '主题不能为空' }); }
      if (!aiService.isAvailable()) { return res.status(503).json({ success: false, message: 'AI服务未配置，请在.env文件中设置ZHIPUAI_API_KEY' }); }
      const suggestions = await aiService.getWritingSuggestions(topic);
      res.json({ success: true, data: { suggestions } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/ai/status', (req, res) => {
    res.json({ success: true, data: { available: aiService.isAvailable(), configured: !!process.env.ZHIPUAI_API_KEY && process.env.ZHIPUAI_API_KEY !== 'your_zhipuai_api_key_here', model: process.env.ZHIPUAI_MODEL || 'glm-4', provider: '智谱清言' } });
  });
}

module.exports = registerAIRoutes;
