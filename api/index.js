import { CONFIG } from './config.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    
    try {
        // 返回测试数据
        res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalStaked: 0,
                    totalStaked1d: 0,
                    totalStaked15d: 0,
                    totalStaked30d: 0,
                    count1d: 0,
                    count15d: 0,
                    count30d: 0,
                    unlock2d: 0,
                    unlock7d: 0,
                    unlock15d: 0,
                    recordCount: 0
                },
                records: [],
                allRecords: [],
                lastUpdate: Date.now()
            },
            timestamp: Date.now()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
