import { arbitrum, arbitrumSepolia } from 'viem/chains'
import type { Address } from 'viem'

// Native (Circle-issued) USDC, not bridged USDC.e.
const NETWORKS = {
  arbitrum: {
    chain: arbitrum,
    usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as Address,
  },
  'arbitrum-sepolia': {
    chain: arbitrumSepolia,
    usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d' as Address,
  },
} as const

const key = (import.meta.env.VITE_NETWORK ?? 'arbitrum-sepolia') as keyof typeof NETWORKS
if (!NETWORKS[key]) throw new Error(`Unknown VITE_NETWORK: ${key}`)

export const { chain, usdc: USDC_ADDRESS } = NETWORKS[key]
export const USDC_DECIMALS = 6
export const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string | undefined
