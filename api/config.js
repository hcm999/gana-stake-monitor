// api/config.js
export default function handler(req, res) {
    // 设置CORS头，允许前端访问
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 从环境变量读取Token
    const token = process.env.GITHUB_TOKEN || '';
    
    // 只返回必要信息，不返回完整Token（可选）
    res.json({
        hasToken: !!token,
        // 如果需要完整Token用于前端，可以返回：
        token: token
        // 注意：这样Token还是会暴露在浏览器中，但至少不会在代码里
    });
}
