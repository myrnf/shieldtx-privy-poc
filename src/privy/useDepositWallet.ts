import { useState } from 'react'
import { usePrivy, useWallets, useConnectWallet, type ConnectedWallet, type WalletWithMetadata } from '@privy-io/react-auth'

/**
 * - `no-wallet` no remembered wallet, or it's no longer connected → promptForWallet()
 * - `ready`     the remembered wallet is connected → can send
 */
export type DepositWalletStatus = 'no-wallet' | 'ready'

const storageKey = (userId: string) => `poc.depositWallet.${userId}`

function load(key: string | null) {
  if (!key) return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function save(key: string, walletClientType: string) {
  try {
    localStorage.setItem(key, walletClientType)
  } catch {}
}

/**
 * Deposits only need the external wallet *connected* (a per-session browser connection that can
 * sign), not *linked* to the Privy user. Linking would make the wallet a login method, and Privy
 * allows each address on only one user, so a wallet linked by another account could never deposit.
 * Consequence: Privy keeps no record of which wallets a user deposits from.
 *
 * The user picks the wallet once in Privy's picker; we remember that choice (per Privy user, across
 * reloads) and reuse it while it stays connected. We never auto-use an unpicked wallet: Privy
 * restores every wallet that previously approved the site (e.g. Phantom's EVM provider).
 */
export function useDepositWallet() {
  const { user } = usePrivy()
  const { wallets, ready: walletsReady } = useWallets()
  const key = user ? storageKey(user.id) : null

  // Wallet app the user picked (e.g. Rabby), per Privy user. Keyed by app, not address, so switching
  // accounts inside the wallet keeps it selected and the active address follows the switch.
  // In-memory copy covers browsers where localStorage is unavailable.
  const [memory, setMemory] = useState<Record<string, string>>({})
  const picked = key ? (memory[key] ?? load(key)) : null

  const { connectWallet } = useConnectWallet({
    // Fires even if the chosen wallet was already connected.
    onSuccess: ({ wallet }) => {
      if (!key) return
      setMemory((m) => ({ ...m, [key]: wallet.walletClientType }))
      save(key, wallet.walletClientType)
    },
  })

  const embedded = user?.linkedAccounts.find(
    (a): a is WalletWithMetadata => a.type === 'wallet' && a.walletClientType === 'privy',
  )

  const active: ConnectedWallet | undefined = picked
    ? wallets.find((w) => w.walletClientType === picked)
    : undefined

  const status: DepositWalletStatus = active ? 'ready' : 'no-wallet'

  /** Open Privy's picker. Closing it keeps the current wallet. */
  function chooseWallet() {
    connectWallet({ description: 'Choose the wallet you want to deposit from.' })
  }

  /** Open the picker only if there's no usable remembered wallet. */
  function promptForWallet() {
    // Before useWallets is ready, the remembered wallet may just not be restored yet.
    if (walletsReady && status === 'no-wallet') chooseWallet()
  }

  return { status, embedded, active, chooseWallet, promptForWallet }
}
