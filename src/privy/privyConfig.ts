import type { PrivyClientConfig } from '@privy-io/react-auth'
import { chain } from '../chain/config'

export const privyConfig: PrivyClientConfig = {
  loginMethods: ['email', 'wallet'],
  // 'all-users' so wallet-first signups also get an embedded wallet (identity is uniform).
  embeddedWallets: { ethereum: { createOnLogin: 'all-users' } },
  supportedChains: [chain],
  defaultChain: chain,
  appearance: {
    // Rabby has no dedicated entry; it is picked up via EIP-6963 detection.
    walletList: ['detected_ethereum_wallets', 'metamask', 'wallet_connect'],
  },
}
