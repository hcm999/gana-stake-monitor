// api/config.js
export default function handler(req, res) {
    // 设置响应头
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // 从环境变量读取Token
    const token = process.env.GITHUB_TOKEN || '';
    
    // 返回JSON
    res.status(200).json({
        success: true,
        hasToken: !!token,
        token: token,
        message: 'API is working'
    });
}
