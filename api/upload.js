import { CONFIG } from './config.js';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb'
        },
        maxDuration: 30
    },
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Content-Type', 'application/json');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
    
    try {
        const { stats, records, allRecords, addresses } = req.body;
        
        if (!records || !allRecords) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid data format' 
            });
        }
        
        console.log(`收到数据: ${records.length}条活跃记录, ${allRecords.length}条总记录`);
        
        const saved = await saveToKV({
            stats,
            records,
            allRecords,
            addresses,
            lastUpdate: Date.now()
        });
        
        if (addresses && addresses.length > 0) {
            await saveAddressesToKV(addresses);
        }
        
        res.status(200).json({
            success: true,
            saved: saved,
            recordCount: records.length,
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('上传错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

async function saveToKV(data) {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        console.log('未配置KV存储，跳过保存');
        return false;
    }
    
    try {
        const url = `${process.env.KV_REST_API_URL}/set/${CONFIG.KV.DATA_KEY}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.KV_REST_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(JSON.stringify(data))
        });
        
        if (!response.ok) {
            console.error('KV保存失败:', await response.text());
            return false;
        }
        
        console.log(`✅ 数据已保存到KV`);
        return true;
    } catch (error) {
        console.error('KV保存错误:', error);
        return false;
    }
}

async function saveAddressesToKV(addresses) {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return;
    
    try {
        const url = `${process.env.KV_REST_API_URL}/set/address_list`;
        
        await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.KV_REST_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(JSON.stringify({
                addresses,
                uploadTime: Date.now()
            }))
        });
        
        console.log(`✅ 已保存 ${addresses.length} 个地址到KV`);
    } catch (error) {
        console.error('保存地址错误:', error);
    }
}
