// 设置超时
export const config = {
    api: {
        bodyParser: false,
        externalResolver: true,
        maxDuration: 60  // Vercel 最大允许60秒
    },
};
import multer from 'multer';
import XLSX from 'xlsx';
import { CONFIG } from './config.js';
import { queryAddresses } from './query.js';  // 导入查询函数

export const config = {
    api: {
        bodyParser: false,
    },
};

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
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
            
            console.log('收到文件:', req.file.originalname, '大小:', req.file.size);
            
            // 提取地址
            const addresses = await extractAddresses(req.file);
            console.log('提取到地址数量:', addresses.length);
            
            if (addresses.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'No valid addresses found' 
                });
            }
            
            // 去重
            const uniqueAddresses = [...new Set(addresses)];
            console.log('去重后地址数量:', uniqueAddresses.length);
            
            // 保存地址到KV
            await saveAddressesToKV(uniqueAddresses);
            
            // 直接调用查询函数，避免HTTP请求
            console.log('开始直接查询...');
            let queryResult = null;
            try {
                queryResult = await queryAddresses(uniqueAddresses, 'full');
                console.log('查询完成:', {
                    records: queryResult?.activeRecords?.length || 0,
                    stats: queryResult?.stats
                });
            } catch (queryError) {
                console.error('直接查询失败:', queryError);
                // 继续返回成功，但标记查询失败
            }
            
            res.status(200).json({
                success: true,
                addresses: uniqueAddresses.slice(0, 10), // 只返回前10个用于预览
                count: uniqueAddresses.length,
                queryResult: queryResult ? {
                    stats: queryResult.stats,
                    recordCount: queryResult.activeRecords?.length || 0
                } : null,
                queryError: queryResult ? null : '查询失败'
            });
        });
    } catch (error) {
        console.error('上传处理错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// 从文件中提取地址
async function extractAddresses(file) {
    const addresses = [];
    const filename = file.originalname.toLowerCase();
    
    if (filename.endsWith('.csv') || filename.endsWith('.txt')) {
        const content = file.buffer.toString('utf-8');
        const lines = content.split(/\r?\n/);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // 处理CSV格式
            let firstCol = line.split(',')[0].trim();
            firstCol = firstCol.replace(/^["']|["']$/g, '');
            
            if (isValidAddress(firstCol)) {
                addresses.push(firstCol);
            }
        }
    } else {
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            
            const firstCol = row[0] ? String(row[0]).trim() : '';
            if (isValidAddress(firstCol)) {
                addresses.push(firstCol);
            }
        }
    }
    
    return addresses;
}

function isValidAddress(addr) {
    return addr && 
           typeof addr === 'string' &&
           addr.startsWith('0x') && 
           addr.length === 42 &&
           /^0x[a-fA-F0-9]+$/.test(addr);
}

async function saveAddressesToKV(addresses) {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        console.log('未配置KV存储，跳过保存地址');
        return;
    }
    
    try {
        const url = `${process.env.KV_REST_API_URL}/set/address_list`;
        console.log('保存地址到KV:', url);
        
        const response = await fetch(url, {
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
        
        if (!response.ok) {
            console.error('保存地址失败:', await response.text());
        } else {
            console.log(`✅ 已保存 ${addresses.length} 个地址到KV`);
        }
    } catch (error) {
        console.error('保存地址错误:', error);
    }
}
