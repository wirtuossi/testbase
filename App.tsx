import React, { useState, useEffect, useCallback } from 'react';
import { BASE_NETWORK_DETAILS } from './constants';

// EIP-6963: Modern wallet discovery standard
// More info: https://eips.ethereum.org/EIPS/eip-6963
interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: any; // EIP-1193 provider
}

declare global {
  interface Window {
    // Deprecated ethereum object, kept for compatibility
    ethereum?: any; 
  }
  // Event map for EIP-6963
  interface WindowEventMap {
    'eip6963:announceProvider': CustomEvent<EIP6963ProviderDetail>;
  }
}

// Ethers.js is loaded from a CDN, so we declare it here to satisfy TypeScript
declare const ethers: any;

// --- SVG Icon Components (unchanged) ---
const WalletIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
);

const EthIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <path d="M15.91,23.95l-8.03-4.51,8.03,10.74,8.03-10.74-8.03,4.51Z" fill="#343434" />
        <path d="M15.91,1.8,7.88,18.3,15.91,22.8,24,18.3Z" fill="#8c8c8c" />
        <path d="M15.91,23.95,7.88,19.44l8.03-5.32Z" fill="#3c3c3b" />
        <path d="M15.91,14.12,24,19.44,15.91,23.95Z" fill="#8c8c8c" />
        <path d="m15.91,13.1,8.03,5.16L15.91,1.8Z" fill="#343434" />
        <path d="m7.88,18.26,8.03-16.46v11.2Z" fill="#8c8c8c" />
    </svg>
);

const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const App: React.FC = () => {
    // State variables
    const [account, setAccount] = useState<string | null>(null);
    const [balance, setBalance] = useState<string | null>(null);
    const [isWrongNetwork, setIsWrongNetwork] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [walletNotDetected, setWalletNotDetected] = useState<boolean>(false);

    // EIP-6963 provider management
    const [providerDetails, setProviderDetails] = useState<EIP6963ProviderDetail[]>([]);
    const [activeProvider, setActiveProvider] = useState<any | null>(null);

    // --- EIP-6963 Wallet Discovery ---
    useEffect(() => {
        const handleAnnounceProvider = (event: CustomEvent<EIP6963ProviderDetail>) => {
            setProviderDetails(prevProviders => {
                if (prevProviders.some(p => p.info.uuid === event.detail.info.uuid)) {
                    return prevProviders;
                }
                return [...prevProviders, event.detail];
            });
        };

        window.addEventListener('eip6963:announceProvider', handleAnnounceProvider);
        window.dispatchEvent(new Event('eip6963:requestProvider'));

        return () => {
            window.removeEventListener('eip6963:announceProvider', handleAnnounceProvider);
        };
    }, []);

    const getBalance = useCallback(async (accountAddress: string, provider: any) => {
        try {
            const balanceInWei = await provider.getBalance(accountAddress);
            const balanceInEth = ethers.utils.formatEther(balanceInWei);
            setBalance(parseFloat(balanceInEth).toFixed(6));
            setError(null);
        } catch (err) {
            console.error("Failed to get balance:", err);
            setError("Failed to fetch balance. Please try again.");
        }
    }, []);

    const disconnectWallet = useCallback(() => {
        setAccount(null);
        setBalance(null);
        setIsWrongNetwork(false);
        setError(null);
        setWalletNotDetected(false);
        setActiveProvider(null); // Clear the active provider
    }, []);
    
    const handleAccountsChanged = useCallback(async (accounts: string[]) => {
        if (accounts.length === 0) {
            disconnectWallet();
            return;
        }

        if (!activeProvider) {
            disconnectWallet();
            setError("Wallet connection lost. Please reconnect.");
            return;
        }
        
        const newAccount = accounts[0];
        setAccount(newAccount);

        try {
            setIsLoading(true);
            const provider = new ethers.providers.Web3Provider(activeProvider);
            const network = await provider.getNetwork();
            
            if (network.chainId.toString() === parseInt(BASE_NETWORK_DETAILS.chainId, 16).toString()) {
                setIsWrongNetwork(false);
                await getBalance(newAccount, provider);
            } else {
                setIsWrongNetwork(true);
                setBalance(null);
            }
        } catch (err) {
            console.error("Error handling account change:", err);
            setError("Failed to update account details. Please refresh.");
        } finally {
            setIsLoading(false);
        }
    }, [activeProvider, getBalance, disconnectWallet]);

    const handleChainChanged = useCallback(() => {
       window.location.reload();
    }, []);
    
    // --- Event Listener Management ---
    useEffect(() => {
        if (activeProvider) {
            activeProvider.on('accountsChanged', handleAccountsChanged);
            activeProvider.on('chainChanged', handleChainChanged);
        }
    
        return () => {
            if (activeProvider?.removeListener) {
                activeProvider.removeListener('accountsChanged', handleAccountsChanged);
                activeProvider.removeListener('chainChanged', handleChainChanged);
            }
        };
    }, [activeProvider, handleAccountsChanged, handleChainChanged]);

    const connectWallet = async () => {
        setIsLoading(true);
        setError(null);
        setWalletNotDetected(false);
    
        const rabbyDetail = providerDetails.find(p => p.info.name === 'Rabby Wallet');
    
        if (!rabbyDetail) {
            if (providerDetails.length > 0) {
                setError("Rabby Wallet not detected. Please make sure it's installed and set as your active wallet.");
            } else {
                setError("No web3 wallet detected. Please install Rabby Wallet to continue.");
            }
            setWalletNotDetected(true);
            setIsLoading(false);
            return;
        }
    
        const rabbyProvider = rabbyDetail.provider;
        setActiveProvider(rabbyProvider);

        try {
            const provider = new ethers.providers.Web3Provider(rabbyProvider);
            const accounts = await provider.send("eth_requestAccounts", []);
            const address = accounts[0];
            setAccount(address);
    
            const network = await provider.getNetwork();
            if (network.chainId.toString() === parseInt(BASE_NETWORK_DETAILS.chainId, 16).toString()) {
                setIsWrongNetwork(false);
                await getBalance(address, provider);
            } else {
                setIsWrongNetwork(true);
                setBalance(null);
            }
        } catch (err: any) {
            console.error("Connection failed:", err);
            if (err.code === 4001) {
                setError("Wallet connection request was rejected.");
            } else {
                setError("An error occurred during wallet connection.");
            }
            setActiveProvider(null); // Clear provider on failed connection
        } finally {
            setIsLoading(false);
        }
    };
    
    const switchNetwork = async () => {
        if (!activeProvider) {
            setError("Wallet not connected. Please connect first.");
            return;
        }
        try {
            await activeProvider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: BASE_NETWORK_DETAILS.chainId }],
            });
        } catch (switchError: any) {
            if (switchError.code === 4902) {
                try {
                    await activeProvider.request({
                        method: 'wallet_addEthereumChain',
                        params: [BASE_NETWORK_DETAILS],
                    });
                } catch (addError) {
                    setError("Failed to add Base network to wallet.");
                    console.error(addError);
                }
            } else {
                setError("Failed to switch network. Please try from your wallet.");
                console.error(switchError);
            }
        }
    };
    
    const shortAddress = account ? `${account.substring(0, 6)}...${account.substring(account.length - 4)}` : '';

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 font-mono">
            <div className="w-full max-w-md mx-auto bg-gray-800 rounded-2xl shadow-2xl shadow-base-blue/20 p-6 sm:p-8 transition-all duration-500">
                <header className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-base-blue">Base Wallet</h1>
                    <div className="w-10 h-10 bg-base-blue/20 rounded-full flex items-center justify-center">
                        <div className="w-6 h-6 bg-base-blue rounded-full"></div>
                    </div>
                </header>

                <main>
                    {error && (
                        <div className="bg-red-500/20 text-red-300 p-3 rounded-lg mb-4 text-sm text-center">
                            {error}
                        </div>
                    )}
                    
                    {walletNotDetected ? (
                         <div className="text-center">
                            <p className="text-gray-400 mb-6">A web3 wallet is required. Please install Rabby Wallet to continue.</p>
                            <a
                                href="https://rabby.io/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full bg-base-blue hover:bg-base-blue-dark text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-all duration-300 transform hover:scale-105"
                            >
                                <DownloadIcon className="w-6 h-6 mr-3" />
                                Install Rabby Wallet
                            </a>
                        </div>
                    ) : !account ? (
                        <div className="text-center">
                            <p className="text-gray-400 mb-6">Connect your wallet to check your balance on the Base network.</p>
                            <button
                                onClick={connectWallet}
                                disabled={isLoading}
                                className="w-full bg-base-blue hover:bg-base-blue-dark text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                            >
                                <WalletIcon className="w-6 h-6 mr-3" />
                                {isLoading ? 'Connecting...' : 'Connect Wallet'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-gray-700/50 p-4 rounded-lg">
                                <p className="text-sm text-gray-400">Connected Account</p>
                                <p className="text-lg font-semibold break-words">{shortAddress}</p>
                            </div>

                            {isWrongNetwork ? (
                                <div className="text-center p-4 bg-yellow-500/10 rounded-lg">
                                    <p className="text-yellow-400 mb-4">You are not on the Base network.</p>
                                    <button
                                        onClick={switchNetwork}
                                        className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-2 px-4 rounded-lg transition-colors"
                                    >
                                        Switch to Base Network
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-base-blue/10 p-4 rounded-lg">
                                    <p className="text-sm text-base-blue">Balance</p>
                                    {isLoading ? (
                                        <div className="animate-pulse h-8 bg-gray-700 rounded mt-1"></div>
                                    ) : balance !== null ? (
                                        <div className="flex items-center space-x-2 text-2xl font-bold">
                                            <EthIcon className="w-6 h-6" />
                                            <span>{balance} ETH</span>
                                        </div>
                                    ) : (
                                        <div className="text-gray-400">Could not load balance.</div>
                                    )}
                                </div>
                            )}

                            <button
                                onClick={disconnectWallet}
                                className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-3 px-4 rounded-lg transition-colors"
                            >
                                Disconnect
                            </button>
                        </div>
                    )}
                </main>
            </div>
            <footer className="text-center mt-8 text-gray-500 text-sm">
                <p>Built for the Base Ecosystem.</p>
            </footer>
        </div>
    );
};

export default App;
