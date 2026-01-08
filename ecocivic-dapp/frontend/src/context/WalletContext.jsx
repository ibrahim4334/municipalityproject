import React, { createContext, useState, useEffect, useContext } from 'react';
import { ethers } from 'ethers';

const WalletContext = createContext();

export const useWallet = () => useContext(WalletContext);

const EXPECTED_CHAIN_ID = import.meta.env.VITE_CHAIN_ID || "80001"; // Mumbai testnet

export const WalletProvider = ({ children }) => {
    const [account, setAccount] = useState(null);
    const [balance, setBalance] = useState('0');
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);
    const [chainId, setChainId] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState(null);

    const updateBalance = async (address, prov) => {
        try {
            if (address && prov) {
                const _balance = await prov.getBalance(address);
                setBalance(ethers.formatEther(_balance));
            }
        } catch (err) {
            console.error("Error fetching balance:", err);
            setBalance('0');
        }
    };

    const checkNetwork = async (prov) => {
        try {
            const network = await prov.getNetwork();
            const currentChainId = network.chainId.toString();
            setChainId(currentChainId);
            
            if (currentChainId !== EXPECTED_CHAIN_ID) {
                return {
                    isValid: false,
                    message: `Please switch to the correct network (Chain ID: ${EXPECTED_CHAIN_ID})`
                };
            }
            return { isValid: true };
        } catch (err) {
            return {
                isValid: false,
                message: `Network check failed: ${err.message}`
            };
        }
    };

    const connectWallet = async () => {
        if (!window.ethereum) {
            setError("MetaMask not found. Please install MetaMask extension.");
            return false;
        }

        setIsConnecting(true);
        setError(null);

        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            
            if (!accounts || accounts.length === 0) {
                throw new Error("No accounts found");
            }

            const _provider = new ethers.BrowserProvider(window.ethereum);
            
            // Check network
            const networkCheck = await checkNetwork(_provider);
            if (!networkCheck.isValid) {
                setError(networkCheck.message);
                setIsConnecting(false);
                return false;
            }

            const _signer = await _provider.getSigner();
            const address = await _signer.getAddress();

            setAccount(address);
            setProvider(_provider);
            setSigner(_signer);
            
            await updateBalance(address, _provider);

            setIsConnecting(false);
            return true;
        } catch (error) {
            console.error("Error connecting wallet:", error);
            
            let errorMessage = "Failed to connect wallet";
            if (error.code === 4001) {
                errorMessage = "User rejected wallet connection";
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            setError(errorMessage);
            setIsConnecting(false);
            return false;
        }
    };

    // Listen for account changes
    useEffect(() => {
        if (window.ethereum) {
            const handleAccountsChanged = async (accounts) => {
                if (accounts.length === 0) {
                    // User disconnected
                    setAccount(null);
                    setProvider(null);
                    setSigner(null);
                    setBalance('0');
                } else {
                    // Account switched
                    setAccount(accounts[0]);
                    if (provider) {
                        const _signer = await provider.getSigner();
                        setSigner(_signer);
                        await updateBalance(accounts[0], provider);
                    }
                }
            };

            const handleChainChanged = async (chainId) => {
                // Reload page on chain change to reset state
                window.location.reload();
            };

            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);

            return () => {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                window.ethereum.removeListener('chainChanged', handleChainChanged);
            };
        }
    }, [provider]);

    // Try to reconnect on mount if previously connected
    useEffect(() => {
        const tryReconnect = async () => {
            if (window.ethereum) {
                try {
                    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                    if (accounts && accounts.length > 0) {
                        const _provider = new ethers.BrowserProvider(window.ethereum);
                        const networkCheck = await checkNetwork(_provider);
                        if (networkCheck.isValid) {
                            const _signer = await _provider.getSigner();
                            setAccount(accounts[0]);
                            setProvider(_provider);
                            setSigner(_signer);
                            await updateBalance(accounts[0], _provider);
                        }
                    }
                } catch (error) {
                    console.error("Auto-reconnect failed:", error);
                }
            }
        };

        tryReconnect();
    }, []);

    return (
        <WalletContext.Provider value={{ 
            account, 
            balance, 
            provider, 
            signer, 
            chainId,
            isConnecting,
            error,
            connectWallet 
        }}>
            {children}
        </WalletContext.Provider>
    );
};
