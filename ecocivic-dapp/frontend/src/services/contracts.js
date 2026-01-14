/**
 * Contract Configuration
 * Smart contract addresses and helpers
 */

// Contract Addresses from environment
export const CONTRACT_ADDRESSES = {
    BELT_TOKEN: import.meta.env.VITE_CONTRACT_ADDRESS_BELT || '',
    RECYCLING_REWARDS: import.meta.env.VITE_RECYCLING_REWARDS_ADDRESS || '',
    WATER_BILLING: import.meta.env.VITE_WATER_BILLING_ADDRESS || '',
    ECOCIVIC_DEPOSIT: import.meta.env.VITE_ECOCIVIC_DEPOSIT_ADDRESS || '',
};

// Chain configuration
export const CHAIN_CONFIG = {
    chainId: import.meta.env.VITE_CHAIN_ID || '80001',
    networkName: import.meta.env.VITE_NETWORK_NAME || 'Polygon Mumbai',
    rpcUrl: 'https://rpc-mumbai.maticvigil.com',
    blockExplorer: 'https://mumbai.polygonscan.com',
};

/**
 * Check if contract addresses are configured
 */
export const isContractConfigured = (contractName) => {
    const address = CONTRACT_ADDRESSES[contractName];
    return address &&
        address !== '' &&
        address !== '0x...' &&
        address.startsWith('0x') &&
        address.length === 42;
};

/**
 * Get contract explorer URL
 */
export const getContractExplorerUrl = (address) => {
    return `${CHAIN_CONFIG.blockExplorer}/address/${address}`;
};

/**
 * Get transaction explorer URL
 */
export const getTransactionExplorerUrl = (txHash) => {
    return `${CHAIN_CONFIG.blockExplorer}/tx/${txHash}`;
};

/**
 * Validate all required contracts are configured
 */
export const validateContractConfiguration = () => {
    const missing = [];

    Object.entries(CONTRACT_ADDRESSES).forEach(([name, address]) => {
        if (!isContractConfigured(name)) {
            missing.push(name);
        }
    });

    if (missing.length > 0) {
        console.warn(`Missing contract configurations: ${missing.join(', ')}`);
    }

    return {
        isValid: missing.length === 0,
        missing,
    };
};

// Log configuration status on import (dev only)
if (import.meta.env.DEV) {
    const { isValid, missing } = validateContractConfiguration();
    if (!isValid) {
        console.warn('[EcoCivic] Some contracts are not configured:', missing);
    }
}

export default CONTRACT_ADDRESSES;