
import type { NetworkDetails } from './types';

export const BASE_NETWORK_DETAILS: NetworkDetails = {
  chainId: '0x2105', // 8453 in hex
  chainName: 'Base Mainnet',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['https://mainnet.base.org'],
  blockExplorerUrls: ['https://basescan.org'],
};
