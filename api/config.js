export const CONFIG = {
    STAKING: "0x72212F35aC448FE7763aA1BFdb360193Fa098E52",
    LP_POOL: "0xa2f464a2462aed49b9b31eb8861bc6b0bbb0483f",
    USDT: "0x55d398326f99059fF775485246999027B3197955",
    
    KV: {
        DATA_KEY: 'staking_data',
        ADDRESS_KEY: 'address_list',
        LAST_UPDATE: 'last_update'
    }
};

export const USDT_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)"
];
