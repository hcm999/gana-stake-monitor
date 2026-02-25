export const CONFIG = {
    STAKING: "0x72212F35aC448FE7763aA1BFdb360193Fa098E52",
    LP_POOL: "0xa2f464a2462aed49b9b31eb8861bc6b0bbb0483f",
    USDT: "0x55d398326f99059fF775485246999027B3197955",
    
    // BSC节点 - 增加更多节点
    BSC_NODES: [
        'https://bsc-dataseed1.binance.org',
        'https://bsc-dataseed2.binance.org',
        'https://bsc-dataseed3.binance.org',
        'https://bsc-dataseed4.binance.org',
        'https://bsc-dataseed1.defibit.io',
        'https://bsc-dataseed2.defibit.io',
        'https://bsc-dataseed1.ninicoin.io',
        'https://bsc-dataseed2.ninicoin.io'
    ],
    
    // 查询配置 - 减小批次大小
    BATCH_SIZE: 5,           // 从10减小到5
    PARALLEL_BATCHES: 1,     // 从2减小到1
    RETRY_LIMIT: 5,          // 从3增加到5
    RETRY_DELAY: 2000,       // 从1000增加到2000
    
    // Vercel KV存储
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
