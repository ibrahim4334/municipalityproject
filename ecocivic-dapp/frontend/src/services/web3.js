import { ethers } from "ethers";

let provider;
let signer;

// Expected network configuration
const EXPECTED_CHAIN_ID = import.meta.env.VITE_CHAIN_ID || "80001"; // Mumbai testnet default
const EXPECTED_NETWORK_NAME = import.meta.env.VITE_NETWORK_NAME || "Polygon Mumbai";

/**
 * Ethereum adresinin geçerli olup olmadığını kontrol eder
 */
export function isValidAddress(address) {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
}

/**
 * Network kontrolü yapar
 */
export async function checkNetwork() {
  if (!provider) {
    throw new Error("Provider not initialized");
  }

  const network = await provider.getNetwork();
  const currentChainId = network.chainId.toString();

  if (currentChainId !== EXPECTED_CHAIN_ID) {
    throw new Error(
      `Wrong network! Please switch to ${EXPECTED_NETWORK_NAME} (Chain ID: ${EXPECTED_CHAIN_ID}). Current: ${currentChainId}`
    );
  }

  return network;
}

/**
 * Kullanıcının cüzdanına bağlan
 */
export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask not found. Please install MetaMask extension.");
  }

  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    
    // Request account access
    await provider.send("eth_requestAccounts", []);
    
    // Check network
    await checkNetwork();
    
    signer = await provider.getSigner();
    const address = await signer.getAddress();

    if (!isValidAddress(address)) {
      throw new Error("Invalid wallet address received");
    }

    return address;
  } catch (error) {
    if (error.code === 4001) {
      throw new Error("User rejected wallet connection");
    }
    if (error.message.includes("Wrong network")) {
      throw error;
    }
    throw new Error(`Failed to connect wallet: ${error.message}`);
  }
}

/**
 * Provider al
 */
export function getProvider() {
  if (!provider) {
    throw new Error("Provider not initialized. Please connect your wallet first.");
  }
  return provider;
}

/**
 * Signer al
 */
export function getSigner() {
  if (!signer) {
    throw new Error("Signer not initialized. Please connect your wallet first.");
  }
  return signer;
}

/**
 * Kontrat instance'ı üret
 */
export function getContract(contractAddress, abi) {
  if (!signer) {
    throw new Error("Wallet not connected");
  }

  if (!contractAddress || !isValidAddress(contractAddress)) {
    throw new Error(`Invalid contract address: ${contractAddress}`);
  }

  if (!abi || !Array.isArray(abi)) {
    throw new Error("Invalid ABI provided");
  }

  try {
    return new ethers.Contract(contractAddress, abi, signer);
  } catch (error) {
    throw new Error(`Failed to create contract instance: ${error.message}`);
  }
}

/**
 * Transaction gas limit tahmini yapar
 */
export async function estimateGas(contractFunction, ...args) {
  try {
    const gasEstimate = await contractFunction.estimateGas(...args);
    // Add 20% buffer for safety
    return gasEstimate + (gasEstimate * 20n / 100n);
  } catch (error) {
    throw new Error(`Gas estimation failed: ${error.message}`);
  }
}

/**
 * Transaction'ı güvenli şekilde gönderir
 */
export async function sendTransaction(contractFunction, ...args) {
  try {
    // Estimate gas first
    const gasLimit = await estimateGas(contractFunction, ...args);
    
    // Get current gas price
    const feeData = await provider.getFeeData();
    
    // Send transaction with gas limit
    const tx = await contractFunction(...args, {
      gasLimit,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    });

    return tx;
  } catch (error) {
    if (error.code === 4001) {
      throw new Error("Transaction rejected by user");
    }
    if (error.code === -32603) {
      throw new Error("Transaction failed. Please check your balance and try again.");
    }
    throw new Error(`Transaction failed: ${error.message}`);
  }
}
