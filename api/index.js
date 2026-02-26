import { CONFIG } from './config.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/json');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
    
    try {
        // 从KV获取数据
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
        res.status(500).json({ success: false, error: error.message });
    }
}

async function getStoredData() {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        return null;
    }
    
    try {
        const url = `${process.env.KV_REST_API_URL}/get/${CONFIG.KV.DATA_KEY}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${process.env.KV_REST_API_TOKEN}`
            }
        });
        
        if (!response.ok) return null;
        
        const result = await response.json();
        return result.result ? JSON.parse(result.result) : null;
    } catch (error) {
        console.error('KV读取失败:', error);
        return null;
    }
}
