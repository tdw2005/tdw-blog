const axios = require('axios');

class AIService {
    constructor() {
        this.apiKey = process.env.ZHIPUAI_API_KEY;
        this.baseURL = process.env.ZHIPUAI_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
        this.model = process.env.ZHIPUAI_MODEL || 'glm-4';
        this.maxTokens = parseInt(process.env.MAX_TOKENS) || 1000;
        this.isConfigured = !!this.apiKey && this.apiKey !== 'your_zhipuai_api_key_here';
    }

    async generateContent(prompt, type = 'article') {
        if (!this.isConfigured) {
            throw new Error('AI 服务未配置，请在 .env 文件设置 ZHIPUAI_API_KEY');
        }

        const systemMessages = {
            article: `你是一名专业的内容编辑，擅长撰写中文技术文章。请根据用户提供的标题和关键词，生成一篇结构清晰、内容充实的中文文章。要求：\n1. 文章结构包含引言、正文、小结\n2. 专业准确，细节到位\n3. 适合一般读者阅读\n4. 字数在800-1500字\n5. 使用Markdown格式`,
            excerpt: `你是一名专业编辑，请根据给定内容生成中文摘要。要求：\n1. 字数100-200字\n2. 突出核心观点与价值\n3. 语言简洁有吸引力\n4. 不使用“本文”“这篇文章”等字样`,
            suggestion: `你是一名写作助手，请根据用户主题提供3-5个相关写作建议。每条建议附带简要的内容结构提示。`
        };

        try {
            const response = await axios.post(`${this.baseURL}/chat/completions`, {
                model: this.model,
                messages: [
                    { role: 'system', content: systemMessages[type] || systemMessages.article },
                    { role: 'user', content: prompt }
                ],
                max_tokens: this.maxTokens,
                temperature: 0.7,
                stream: false
            }, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            return response.data.choices[0].message.content;
        } catch (error) {
            const msg = error.response?.data?.error?.message || error.message;
            throw new Error(`AI 请求失败: ${msg}`);
        }
    }

    async generateArticle(title, keywords = '') {
        const prompt = `标题: ${title}\n${keywords ? `关键词: ${keywords}` : ''}`;
        return await this.generateContent(prompt, 'article');
    }

    async generateExcerpt(content) {
        const prompt = `正文内容: ${content.substring(0, 1000)}...`;
        return await this.generateContent(prompt, 'excerpt');
    }

    async getWritingSuggestions(topic) {
        const prompt = `主题: ${topic}`;
        return await this.generateContent(prompt, 'suggestion');
    }

    isAvailable() {
        return this.isConfigured;
    }
}

module.exports = new AIService();
