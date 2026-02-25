import { CONFIG } from './config.js';

export default async function handler(req, res) {
    // 设置CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    try {
        // 从Vercel KV获取最新数据
        const data = await getStoredData();
        
        res.status(200).json({
            success: true,
            data: data || {
                stats: null,
                records: [],
                allRecords: [],
                lastUpdate: null
            },
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

// 获取存储的数据
async function getStoredData() {
    // 如果没有配置KV，返回null
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        return null;
    }
    
    try {
        const response = await fetch(
            `${process.env.KV_REST_API_URL}/get/${CONFIG.KV.DATA_KEY}`,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.KV_REST_API_TOKEN}`
                }
            }
        );
        
        if (!response.ok) return null;
        
        const result = await response.json();
        return result.result ? JSON.parse(result.result) : null;
    } catch (error) {
        console.error('KV读取失败:', error);
        return null;
    }
}
