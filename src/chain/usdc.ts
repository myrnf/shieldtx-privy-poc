import { createPublicClient, createWalletClient, custom, erc20Abi, http, type Address, type Hash } from 'viem'
import type { ConnectedWallet } from '@privy-io/react-auth'
import { chain, USDC_ADDRESS } from './config'

export const publicClient = createPublicClient({ chain, transport: http() })

export function readUsdcBalance(owner: Address) {
  return publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [owner],
  })
}

/**
 * Send USDC from an external wallet (MetaMask/Rabby) connected through Privy.
 * Privy supplies the EIP-1193 provider; the signature prompt itself is the wallet's own UI.
 */
export async function transferUsdc(wallet: ConnectedWallet, to: Address, amount: bigint): Promise<Hash> {
  if (wallet.chainId !== `eip155:${chain.id}`) await wallet.switchChain(chain.id)
  // Re-fetch after switching: existing provider instances keep the old chain.
  const provider = await wallet.getEthereumProvider()
  const client = createWalletClient({
    account: wallet.address as Address,
    chain,
    transport: custom(provider),
  })
  return client.writeContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [to, amount],
  })
}
