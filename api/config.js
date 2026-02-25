// api/config.js
export default function handler(req, res) {
    // 设置CORS头，允许前端访问
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // 处理预检请求
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 只允许GET请求
    if (req.method !== 'GET') {
        return res.status(405).json({ 
            success: false, 
            error: 'Method not allowed' 
        });
    }

    try {
        // 从环境变量读取Token
        const token = process.env.GITHUB_TOKEN || '';
        
        // 返回配置信息
        res.status(200).json({
            success: true,
            hasToken: !!token,
            token: token,  // 返回给前端使用
            message: token ? 'Token loaded successfully' : 'No token found in environment'
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
}
