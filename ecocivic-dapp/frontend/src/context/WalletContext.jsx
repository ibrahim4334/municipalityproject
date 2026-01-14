import React, { createContext, useState, useEffect, useContext } from 'react';
import { ethers } from 'ethers';

const WalletContext = createContext();

export const useWallet = () => useContext(WalletContext);

const EXPECTED_CHAIN_ID = import.meta.env.VITE_CHAIN_ID || "31337"; // Local Hardhat

// Local Hardhat Network Configuration
const HARDHAT_LOCAL_NETWORK = {
    chainId: '0x7A69', // 31337 in hex
    chainName: 'Hardhat Local',
    nativeCurrency: {
        name: 'ETH',
        symbol: 'ETH',
        decimals: 18,
    },
    rpcUrls: ['http://127.0.0.1:8545'],
    blockExplorerUrls: [],
};

export const WalletProvider = ({ children }) => {
    const [account, setAccount] = useState(null);
    const [balance, setBalance] = useState('0');
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);
    const [chainId, setChainId] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
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
                    message: `Please switch to Hardhat Local network (Chain ID: ${EXPECTED_CHAIN_ID})`
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

    const switchNetwork = async () => {
        if (!window.ethereum) {
            setError("MetaMask not found. Please install MetaMask extension.");
            return false;
        }

        setIsSwitchingNetwork(true);
        setError(null);

        try {
            // Try to switch to the network
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: HARDHAT_LOCAL_NETWORK.chainId }],
                });
                setIsSwitchingNetwork(false);
                return true;
            } catch (switchError) {
                // This error code indicates that the chain has not been added to MetaMask
                if (switchError.code === 4902) {
                    // Try to add the network
                    try {
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [HARDHAT_LOCAL_NETWORK],
                        });
                        setIsSwitchingNetwork(false);
                        return true;
                    } catch (addError) {
                        setError("Failed to add network to MetaMask");
                        setIsSwitchingNetwork(false);
                        return false;
                    }
                } else if (switchError.code === 4001) {
                    setError("User rejected network switch");
                    setIsSwitchingNetwork(false);
                    return false;
                }
                throw switchError;
            }
        } catch (error) {
            console.error("Error switching network:", error);
            setError(`Failed to switch network: ${error.message}`);
            setIsSwitchingNetwork(false);
            return false;
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
                // Try to switch network automatically
                const switched = await switchNetwork();
                if (!switched) {
                    setError(networkCheck.message + ". Please switch manually or try again.");
                    setIsConnecting(false);
                    return false;
                }
                // After switching, check again
                const networkCheckAfter = await checkNetwork(_provider);
                if (!networkCheckAfter.isValid) {
                    setError(networkCheckAfter.message);
                    setIsConnecting(false);
                    return false;
                }
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
        if (window.ethereum && provider) {
            const handleAccountsChanged = async (accounts) => {
                if (accounts.length === 0) {
                    // User disconnected
                    setAccount(null);
                    setProvider(null);
                    setSigner(null);
                    setBalance('0');
                    setChainId(null);
                } else {
                    // Account switched
                    setAccount(accounts[0]);
                    const _signer = await provider.getSigner();
                    setSigner(_signer);
                    await updateBalance(accounts[0], provider);
                }
                setError(null);
            };

            const handleChainChanged = async (chainIdHex) => {
                // Chain changed, update state
                const _provider = new ethers.BrowserProvider(window.ethereum);
                const networkCheck = await checkNetwork(_provider);

                if (networkCheck.isValid && account) {
                    // Network is correct, reconnect
                    const _signer = await _provider.getSigner();
                    setProvider(_provider);
                    setSigner(_signer);
                    await updateBalance(account, _provider);
                } else {
                    // Network is wrong, disconnect
                    setError("Wrong network detected. Please switch to Hardhat Local.");
                }
            };

            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);

            return () => {
                if (window.ethereum) {
                    window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                    window.ethereum.removeListener('chainChanged', handleChainChanged);
                }
            };
        }
    }, [provider, account]);

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
                            setChainId(EXPECTED_CHAIN_ID);
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
            isSwitchingNetwork,
            error,
            connectWallet,
            switchNetwork,
            isCorrectNetwork: chainId === EXPECTED_CHAIN_ID
        }}>
            {children}
        </WalletContext.Provider>
    );
};
