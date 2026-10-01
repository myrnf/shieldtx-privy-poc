import { usePrivy, useWallets, useLinkAccount, type ConnectedWallet, type WalletWithMetadata } from '@privy-io/react-auth'

/**
 * Where the user is in the "deposit from my existing wallet" flow.
 *
 * - `no-wallet`     never linked an external wallet → linkWallet() (Privy modal: pick wallet + SIWE signature)
 * - `needs-connect` has linked wallet(s), but none connected this session (new device, revoked permission…)
 * - `needs-link`    a wallet is connected, but the selected account isn't linked (e.g. user switched account in Rabby)
 * - `ready`         selected account is connected AND linked → can send
 */
export type DepositWalletStatus = 'no-wallet' | 'needs-connect' | 'needs-link' | 'ready'

/**
 * Key distinction: "linked" is stored on the Privy user server-side and persists forever;
 * "connected" is a per-session browser connection and is what's needed to sign.
 */
export function useDepositWallet() {
  const { user, connectWallet } = usePrivy()
  const { wallets } = useWallets()
  const { linkWallet } = useLinkAccount({
    onError: (err) => console.warn('[poc] linkWallet failed:', err),
  })

  const walletAccounts = (user?.linkedAccounts ?? []).filter(
    (a): a is WalletWithMetadata => a.type === 'wallet' && a.chainType === 'ethereum',
  )
  const embedded = walletAccounts.find((a) => a.walletClientType === 'privy')
  const linkedExternal = walletAccounts.filter((a) => a.walletClientType !== 'privy')
  const linkedAddrs = new Set(linkedExternal.map((a) => a.address.toLowerCase()))

  // The account currently selected in MetaMask/Rabby. Privy follows `accountsChanged`, so after a
  // switch this is the new address. With several extensions connected, Privy's list order decides.
  const active: ConnectedWallet | undefined = wallets.find((w) => w.walletClientType !== 'privy')

  const status: DepositWalletStatus =
    active ? (linkedAddrs.has(active.address.toLowerCase()) ? 'ready' : 'needs-link')
    : linkedExternal.length > 0 ? 'needs-connect'
    : 'no-wallet'

  /** Open whichever Privy modal the current status needs. No-op once a wallet is connected. */
  function promptForWallet() {
    if (status === 'no-wallet') linkWallet()
    else if (status === 'needs-connect') connectWallet({ description: 'Reconnect your wallet.' })
  }

  /** Link the already-connected, selected account directly: one SIWE signature, no wallet picker. */
  async function linkActive() {
    if (!active) throw new Error('No connected wallet')
    await active.loginOrLink() // Privy user updates on success → status becomes 'ready'
  }

  return { status, embedded, linkedExternal, active, promptForWallet, linkActive }
}
