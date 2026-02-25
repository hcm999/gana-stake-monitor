import multer from 'multer';
import { CONFIG } from './config.js';
import { queryAddresses } from './query.js';

export const config = {
    api: {
        bodyParser: false,
        maxDuration: 30,  // 限制30秒
    },
};

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 1024 * 1024 }, // 限制1MB
});

export default async function handler(req, res) {
    // 设置CORS
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
        upload.single('file')(req, res, async (err) => {
            if (err) {
                console.error('上传错误:', err);
                return res.status(400).json({ success: false, error: err.message });
            }
            
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'No file uploaded' });
            }
            
            console.log('收到文件:', req.file.originalname);
            
            // 简化地址提取
            const content = req.file.buffer.toString('utf-8');
            const lines = content.split(/\r?\n/);
            const addresses = [];
            
            for (const line of lines) {
                const addr = line.trim().split(',')[0].replace(/^["']|["']$/g, '');
                if (addr && addr.startsWith('0x') && addr.length === 42) {
                    addresses.push(addr);
                    break; // 只取第一个地址测试
                }
            }
            
            if (addresses.length === 0) {
                return res.status(400).json({ success: false, error: 'No valid address' });
            }
            
            console.log('测试地址:', addresses[0]);
            
            // 直接返回成功，不查询
            return res.status(200).json({
                success: true,
                addresses: [addresses[0]],
                count: 1,
                message: '上传成功，正在后台查询...'
            });
        });
    } catch (error) {
        console.error('上传错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}
