import { ethers } from 'ethers';
import { CONFIG, STAKING_ABI, USDT_ABI, STAKE_DURATIONS } from './config.js';

// ================= 核心查询函数 =================
export async function queryAddresses(addresses, mode = 'full') {
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
    
    return {
        ...results,
        lpBalance,
        timestamp: Date.now()
    };
}

// ================= 原handler改为调用新函数 =================
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
        const { addresses, mode = 'full' } = req.body;
        
        if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid addresses' 
            });
        }
        
        if (addresses.length > 50000) {
            return res.status(400).json({ 
                success: false, 
                error: 'Too many addresses (max 50000)' 
            });
        }
        
        // 调用核心查询函数
        const results = await queryAddresses(addresses, mode);
        
        res.status(200).json({
            success: true,
            data: results,
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

// ================= 以下都是原有的辅助函数，保持不变 =================

// 连接到BSC - 改进版本
async function connectToBSC() {
    let lastError = null;
    
    for (const node of CONFIG.BSC_NODES) {
        try {
            console.log(`尝试连接节点: ${node}`);
            const provider = new ethers.JsonRpcProvider(node, undefined, {
                timeout: 10000,  // 10秒超时
                polling: false
            });
            
            // 测试连接
            const blockNumber = await provider.getBlockNumber();
            console.log(`✅ 连接成功: ${node}, 区块高度: ${blockNumber}`);
            return provider;
        } catch (e) {
            console.log(`节点 ${node} 连接失败:`, e.message);
            lastError = e;
            // 继续尝试下一个节点
        }
    }
    
    throw new Error(`无法连接到BSC网络: ${lastError?.message || '未知错误'}`);
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
                    const unlockTime = stakeTime + STAKE_DURATIONS[stakeIndex];
                    
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
        unlock15d: 0,
        recordCount: 0
    };
    
    const allRecords = [];
    const activeRecords = [];
    const failedAddresses = [];
    const dailyStats = new Map();
    
    for (let i = 0; i < addresses.length; i += CONFIG.BATCH_SIZE) {
        const batch = addresses.slice(i, i + CONFIG.BATCH_SIZE);
        
        const promises = batch.map(address => queryAddress(address, contract, now, limits));
        const results = await Promise.all(promises);
        
        results.forEach(result => {
            if (result.success) {
                result.all.forEach(record => {
                    allRecords.push(record);
                    
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
                
                result.active.forEach(record => {
                    activeRecords.push(record);
                    
                    stats.totalStaked += record.amount;
                    stats.recordCount++;
                    
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
        
        await new Promise(r => setTimeout(r, 200));
    }
    
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
            stats: results.stats,
            records: results.activeRecords,
            allRecords: results.allRecords,
            addresses,
            lastUpdate: Date.now()
        };
        
        const url = `${process.env.KV_REST_API_URL}/set/${CONFIG.KV.DATA_KEY}`;
        console.log('保存到KV:', url);
        
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
        } else {
            console.log(`✅ 已保存 ${results.activeRecords?.length || 0} 条活跃记录到KV`);
        }
    } catch (error) {
        console.error('KV保存错误:', error);
    }
}
