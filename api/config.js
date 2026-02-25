// 配置信息
export const CONFIG = {
    STAKING: "0x72212F35aC448FE7763aA1BFdb360193Fa098E52",
    LP_POOL: "0xa2f464a2462aed49b9b31eb8861bc6b0bbb0483f",
    USDT: "0x55d398326f99059fF775485246999027B3197955",
    
    // BSC节点
    BSC_NODES: [
        'https://bsc-dataseed1.binance.org',
        'https://bsc-dataseed2.binance.org',
        'https://bsc-dataseed3.binance.org',
        'https://bsc-dataseed4.binance.org'
    ],
    
    // 查询配置
    BATCH_SIZE: 10,
    PARALLEL_BATCHES: 2,
    RETRY_LIMIT: 3,
    RETRY_DELAY: 1000,
    
    // Vercel KV存储 (需要配置)
    KV: {
        DATA_KEY: 'staking_data',
        ADDRESS_KEY: 'address_list',
        LAST_UPDATE: 'last_update'
    },
    
    // 质押周期
    STAKE_DURATIONS: {
        0: 86400,    // 1天
        1: 1296000,  // 15天
        2: 2592000   // 30天
    }
};

// 质押周期标签
export const STAKE_DURATION_LABELS = {
    0: "1天",
    1: "15天",
    2: "30天"
};

// USDT ABI
export const USDT_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

// 质押合约ABI (精简版，只保留需要的函数)
export const STAKING_ABI = [
    "function stakeCount(address user) view returns (uint256)",
    "function userStakeRecord(address user, uint256 index) view returns (uint40 stakeTime, uint160 amount, bool status, uint8 stakeIndex)"
];
