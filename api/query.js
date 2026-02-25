import { ethers } from 'ethers';
import { CONFIG, STAKING_ABI, USDT_ABI } from './config.js';

export default async function handler(req, res) {
    // 设置CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    // 只允许POST请求
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
    
    try {
        const { addresses, mode = 'full' } = req.body;
        
        if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid addresses' 
            });
        }
        
        // 限制地址数量
        if (addresses.length > 50000) {
            return res.status(400).json({ 
                success: false, 
                error: 'Too many addresses (max 50000)' 
            });
        }
        
        console.log(`开始查询: ${addresses.length}个地址, 模式: ${mode}`);
        
        // 连接到BSC
        const provider = await connectToBSC();
        
        // 创建合约实例
        const stakingContract = new ethers.Contract(
            CONFIG.STAKING, 
            STAKING_ABI, 
            provider
        );
        
        // 获取LP池余额
        const lpBalance = await getLPPoolBalance(provider);
        
        // 查询所有地址
        const now = Math.floor(Date.now() / 1000);
        const limits = {
            '2d': now + 172800,
            '7d': now + 604800,
            '15d': now + 1296000
        };
        
        // 分批查询
        const results = await batchQueryAddresses(
            addresses, 
            stakingContract, 
            now, 
            limits,
            mode
        );
        
        // 保存到KV存储
        await saveToKV(results, addresses);
        
        res.status(200).json({
            success: true,
            data: results,
            stats: results.stats,
            lpBalance,
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('查询错误:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

// 连接到BSC
async function connectToBSC() {
    for (const node of CONFIG.BSC_NODES) {
        try {
            const provider = new ethers.JsonRpcProvider(node);
            await provider.getBlockNumber();
            console.log(`✅ 连接成功: ${node}`);
            return provider;
        } catch (e) {
            console.log(`节点 ${node} 连接失败`);
        }
    }
    throw new Error('无法连接到BSC网络');
}

// 获取LP池余额
async function getLPPoolBalance(provider) {
    try {
        const usdtContract = new ethers.Contract(
            CONFIG.USDT, 
            USDT_ABI, 
            provider
        );
        
        const balance = await usdtContract.balanceOf(CONFIG.LP_POOL);
        return parseFloat(ethers.formatUnits(balance, 18));
    } catch (error) {
        console.error("获取LP池余额失败:", error);
        return 0;
    }
}

// 带重试的合约调用
async function callWithRetry(fn, context, retryCount = 0) {
    try {
        return await fn();
    } catch (error) {
        if (retryCount < CONFIG.RETRY_LIMIT) {
            console.log(`调用失败，第 ${retryCount + 1} 次重试...`, error.message);
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * (retryCount + 1)));
            return callWithRetry(fn, context, retryCount + 1);
        } else {
            throw error;
        }
    }
}

// 查询单个地址
async function queryAddress(address, contract, now, limits) {
    const result = {
        address,
        success: false,
        active: [],
        all: [],
        error: null
    };
    
    try {
        const count = await callWithRetry(
            () => contract.stakeCount(address),
            `stakeCount(${address})`
        );
        
        const stakeCount = Number(count);
        
        for (let j = 0; j < stakeCount; j++) {
            try {
                const record = await callWithRetry(
                    () => contract.userStakeRecord(address, j),
                    `userStakeRecord(${address}, ${j})`
                );
                
                const stakeTime = Number(record[0]);
                const amount = record[1];
                const isRedeemed = record[2];
                const stakeIndex = Number(record[3]);
                const amountNum = parseFloat(ethers.formatUnits(amount, 18));
                
                const recordData = {
                    address,
                    amount: amountNum,
                    stakeTime,
                    stakeIndex,
                    isRedeemed
                };
                
                result.all.push(recordData);
                
                if (!isRedeemed) {
                    const unlockTime = stakeTime + CONFIG.STAKE_DURATIONS[stakeIndex];
                    
                    result.active.push({
                        ...recordData,
                        unlockTime,
                        timeRemaining: unlockTime - now
                    });
                }
            } catch (e) {
                console.log(`读取记录失败: ${address}[${j}]`, e.message);
            }
        }
        
        result.success = true;
        
    } catch (e) {
        console.log(`查询地址失败: ${address}`, e.message);
        result.error = e.message;
    }
    
    return result;
}

// 批量查询地址
async function batchQueryAddresses(addresses, contract, now, limits, mode) {
    const stats = {
        totalStaked: 0,
        totalStaked1d: 0,
        totalStaked15d: 0,
        totalStaked30d: 0,
        count1d: 0,
        count15d: 0,
        count30d: 0,
        unlock2d: 0,
        unlock7d: 0,
        unlock15d: 0
    };
    
    const allRecords = [];
    const activeRecords = [];
    const failedAddresses = [];
    const dailyStats = new Map();
    
    // 分批处理
    for (let i = 0; i < addresses.length; i += CONFIG.BATCH_SIZE) {
        const batch = addresses.slice(i, i + CONFIG.BATCH_SIZE);
        
        const promises = batch.map(address => queryAddress(address, contract, now, limits));
        const results = await Promise.all(promises);
        
        results.forEach(result => {
            if (result.success) {
                // 处理记录
                result.all.forEach(record => {
                    allRecords.push(record);
                    
                    // 更新每日统计
                    const dateStr = getDateStrFromTimestamp(record.stakeTime);
                    if (!dailyStats.has(dateStr)) {
                        dailyStats.set(dateStr, {
                            newStake: 0,
                            byPool: {0: 0, 1: 0, 2: 0},
                            count: {0: 0, 1: 0, 2: 0}
                        });
                    }
                    
                    const dayData = dailyStats.get(dateStr);
                    dayData.newStake += record.amount;
                    dayData.byPool[record.stakeIndex] += record.amount;
                    dayData.count[record.stakeIndex]++;
                });
                
                // 处理活跃记录并更新统计
                result.active.forEach(record => {
                    activeRecords.push(record);
                    
                    stats.totalStaked += record.amount;
                    
                    if (record.stakeIndex === 0) {
                        stats.totalStaked1d += record.amount;
                        stats.count1d++;
                    } else if (record.stakeIndex === 1) {
                        stats.totalStaked15d += record.amount;
                        stats.count15d++;
                    } else if (record.stakeIndex === 2) {
                        stats.totalStaked30d += record.amount;
                        stats.count30d++;
                    }
                    
                    if (record.unlockTime <= limits['2d']) stats.unlock2d += record.amount;
                    if (record.unlockTime <= limits['7d']) stats.unlock7d += record.amount;
                    if (record.unlockTime <= limits['15d']) stats.unlock15d += record.amount;
                });
            } else {
                failedAddresses.push(result.address);
            }
        });
        
        // 每批查询后延迟
        await new Promise(r => setTimeout(r, 200));
    }
    
    // 按时间倒序排序
    activeRecords.sort((a, b) => b.stakeTime - a.stakeTime);
    
    return {
        stats,
        activeRecords,
        allRecords,
        dailyStats: Array.from(dailyStats.entries()),
        failedAddresses,
        totalAddresses: addresses.length,
        successCount: addresses.length - failedAddresses.length
    };
}

// 获取日期字符串
function getDateStrFromTimestamp(timestamp) {
    const date = new Date(timestamp * 1000);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 保存到KV存储
async function saveToKV(results, addresses) {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        console.log('未配置KV存储，跳过保存');
        return;
    }
    
    try {
        const data = {
            ...results,
            addresses,
            lastUpdate: Date.now()
        };
        
        const response = await fetch(
            `${process.env.KV_REST_API_URL}/set/${CONFIG.KV.DATA_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.KV_REST_API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(JSON.stringify(data))
            }
        );
        
        if (!response.ok) {
            console.error('KV保存失败:', await response.text());
        } else {
            console.log('✅ 数据已保存到KV');
        }
    } catch (error) {
        console.error('KV保存错误:', error);
    }
}
// 在 query.js 底部添加
export async function queryAddresses(addresses, mode = 'full') {
    // 这里是原来 handler 中的主要逻辑
    // 把 handler 中的代码提取出来
    const provider = await connectToBSC();
    const stakingContract = new ethers.Contract(CONFIG.STAKING, STAKING_ABI, provider);
    
    const now = Math.floor(Date.now() / 1000);
    const limits = {
        '2d': now + 172800,
        '7d': now + 604800,
        '15d': now + 1296000
    };
    
    const results = await batchQueryAddresses(addresses, stakingContract, now, limits, mode);
    
    // 保存到 KV
    await saveToKV(results, addresses);
    
    return results;
}

// 原来的 handler 改为调用这个函数
export default async function handler(req, res) {
    try {
        const { addresses, mode = 'full' } = req.body;
        const results = await queryAddresses(addresses, mode);
        res.status(200).json({ success: true, data: results });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
