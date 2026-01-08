import { ethers } from 'ethers';
import BELTTokenABI from '../abi/BELTToken.json';
import { isValidAddress } from './web3';

const BELT_TOKEN_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS_BELT;

/**
 * BELT token bakiyesini getirir
 */
export const getBeltBalance = async (signer, address) => {
    if (!BELT_TOKEN_ADDRESS || !isValidAddress(BELT_TOKEN_ADDRESS)) {
        console.warn("BELT Token address not configured or invalid");
        return '0';
    }

    if (!signer) {
        console.warn("Signer not provided");
        return '0';
    }

    if (!address || !isValidAddress(address)) {
        console.warn("Invalid address provided");
        return '0';
    }

    try {
        const contract = new ethers.Contract(
            BELT_TOKEN_ADDRESS, 
            BELTTokenABI.abi || BELTTokenABI, 
            signer
        );
        
        const balance = await contract.balanceOf(address);
        return ethers.formatEther(balance); // BELT'in 18 decimal olduğunu varsayıyoruz
    } catch (error) {
        console.error("Error fetching BELT balance:", error);
        
        // Return '0' on error to prevent UI breakage
        return '0';
    }
};

/**
 * BELT token decimals bilgisini getirir
 */
export const getBeltDecimals = async (signer) => {
    if (!BELT_TOKEN_ADDRESS || !isValidAddress(BELT_TOKEN_ADDRESS)) {
        return 18; // Default to 18 decimals
    }

    if (!signer) {
        return 18;
    }

    try {
        const contract = new ethers.Contract(
            BELT_TOKEN_ADDRESS,
            BELTTokenABI.abi || BELTTokenABI,
            signer
        );
        
        // Try to get decimals, fallback to 18 if not available
        if (contract.decimals) {
            return await contract.decimals();
        }
        return 18;
    } catch (error) {
        console.error("Error fetching BELT decimals:", error);
        return 18; // Default fallback
    }
};
