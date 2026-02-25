// 在文件顶部引入 query 函数
import { queryAddresses } from './query.js';
import multer from 'multer';
import XLSX from 'xlsx';

// 配置multer内存存储
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    }
});

export const config = {
    api: {
        bodyParser: false, // 禁用bodyParser，让multer处理
    },
};

export default async function handler(req, res) {
    // 设置CORS
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
        // 使用multer处理文件上传
        upload.single('file')(req, res, async (err) => {
            if (err) {
                console.error('上传错误:', err);
                return res.status(400).json({ 
                    success: false, 
                    error: err.message 
                });
            }
            
            if (!req.file) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'No file uploaded' 
                });
            }
            
            // 解析文件中的地址
            const addresses = await extractAddresses(req.file);
            
            if (addresses.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'No valid addresses found' 
                });
            }
            
            // 保存地址列表到KV
            await saveAddressesToKV(addresses);
            
            // 触发自动查询
            const queryResult = await triggerQuery(addresses);
            
            res.status(200).json({
                success: true,
                addresses: addresses,
                count: addresses.length,
                queryResult: queryResult
            });
        });
    } catch (error) {
        console.error('上传错误:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

// 从文件中提取地址
async function extractAddresses(file) {
    const addresses = [];
    const filename = file.originalname.toLowerCase();
    
    if (filename.endsWith('.csv') || filename.endsWith('.txt')) {
        // 处理CSV/TXT文件
        const content = file.buffer.toString('utf-8');
        const lines = content.split(/\r?\n/);
        
        // 从第二行开始（跳过表头）
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // CSV可能包含逗号，取第一列
            let firstCol = line.split(',')[0].trim();
            // 移除可能的引号
            firstCol = firstCol.replace(/^["']|["']$/g, '');
            
            if (isValidAddress(firstCol)) {
                addresses.push(firstCol);
            }
        }
    } else {
        // 处理Excel文件
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        // 从第二行开始（跳过表头）
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            
            const firstCol = row[0] ? String(row[0]).trim() : '';
            if (isValidAddress(firstCol)) {
                addresses.push(firstCol);
            }
        }
    }
    
    // 去重
    return [...new Set(addresses)];
}

// 验证地址格式
function isValidAddress(addr) {
    return addr && 
           addr.startsWith('0x') && 
           addr.length >= 40 && 
           addr.length <= 42 &&
           /^0x[a-fA-F0-9]+$/.test(addr);
}

// 保存地址列表到KV
async function saveAddressesToKV(addresses) {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        console.log('未配置KV存储，跳过保存地址');
        return;
    }
    
    try {
        const response = await fetch(
            `${process.env.KV_REST_API_URL}/set/address_list`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.KV_REST_API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(JSON.stringify({
                    addresses,
                    uploadTime: Date.now()
                }))
            }
        );
        
        if (!response.ok) {
            console.error('保存地址失败:', await response.text());
        } else {
            console.log(`✅ 已保存 ${addresses.length} 个地址到KV`);
        }
    } catch (error) {
        console.error('保存地址错误:', error);
    }
}

// 触发自动查询
async function triggerQuery(addresses) {
    try {
        console.log('直接调用查询函数...');
        
        // 直接调用 query 函数
        const result = await queryAddresses(addresses, 'full');
        
        console.log('查询完成:', {
            total: result.stats?.totalStaked,
            records: result.activeRecords?.length
        });
        
        return result;
    } catch (error) {
        console.error('直接查询失败:', error);
        return null;
    }
}
