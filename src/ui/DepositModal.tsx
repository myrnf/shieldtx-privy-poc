import { useCallback, useEffect, useState } from 'react'
import { formatUnits, isAddress, parseUnits, type Address, type Hash } from 'viem'
import type { ConnectedWallet } from '@privy-io/react-auth'
import { chain, USDC_DECIMALS } from '../chain/config'
import { publicClient, readUsdcBalance, transferUsdc } from '../chain/usdc'
import type { useDepositWallet } from '../privy/useDepositWallet'

type Props = ReturnType<typeof useDepositWallet> & { onClose: () => void }

type TxState =
  | { kind: 'idle' }
  | { kind: 'signing' }
  | { kind: 'pending'; hash: Hash }
  | { kind: 'confirmed'; hash: Hash }
  | { kind: 'error'; message: string; hash?: Hash }

export function DepositModal({ status, active, promptForWallet, linkActive, onClose }: Props) {
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Deposit USDC · {chain.name}</h2>
          <button className="secondary" onClick={onClose}>✕</button>
        </header>
        {status === 'ready' && active ? (
          // Keyed by address so inputs/tx state reset if the user switches accounts mid-flow.
          <TransferForm key={active.address} wallet={active} />
        ) : status === 'needs-link' && active ? (
          <LinkActiveWallet key={active.address} wallet={active} onLink={linkActive} />
        ) : status === 'needs-connect' ? (
          <p>Your linked wallet isn't connected in this session. <button onClick={promptForWallet}>Connect wallet</button></p>
        ) : (
          <p>Link your existing wallet to deposit. <button onClick={promptForWallet}>Link wallet</button></p>
        )}
      </div>
    </div>
  )
}

function LinkActiveWallet({ wallet, onLink }: { wallet: ConnectedWallet; onLink: () => Promise<void> }) {
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function link() {
    setLinking(true)
    setError(null)
    try {
      await onLink()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLinking(false)
    }
  }

  return (
    <div className="stack">
      <p>
        {wallet.meta.name} is on <code>{wallet.address}</code>, which isn't linked to your account.
        Link it to deposit from this address.
      </p>
      <button onClick={link} disabled={linking}>{linking ? 'Sign in your wallet…' : 'Link this wallet'}</button>
      {error && <p className="warn">{error}</p>}
    </div>
  )
}

function TransferForm({ wallet }: { wallet: ConnectedWallet }) {
  const from = wallet.address as Address
  const [balance, setBalance] = useState<bigint | null>(null)
  const [hasGas, setHasGas] = useState(true)
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [tx, setTx] = useState<TxState>({ kind: 'idle' })

  const refresh = useCallback(async () => {
    const [usdc, eth] = await Promise.all([readUsdcBalance(from), publicClient.getBalance({ address: from })])
    setBalance(usdc)
    setHasGas(eth > 0n)
  }, [from])

  useEffect(() => {
    refresh().catch((e) => setTx({ kind: 'error', message: `Balance read failed: ${e.message}` }))
  }, [refresh])

  let parsed: bigint | null = null
  try {
    parsed = amount ? parseUnits(amount, USDC_DECIMALS) : null
  } catch {}

  const error =
    to && !isAddress(to) ? 'Invalid recipient address'
    : amount && (parsed === null || parsed <= 0n) ? 'Invalid amount'
    : parsed !== null && balance !== null && parsed > balance ? 'Amount exceeds balance'
    : null
  const busy = tx.kind === 'signing' || tx.kind === 'pending'
  const canSubmit = !busy && !error && isAddress(to) && parsed !== null && parsed > 0n && balance !== null

  async function submit() {
    if (!canSubmit) return
    setTx({ kind: 'signing' })
    let hash: Hash | undefined
    try {
      hash = await transferUsdc(wallet, to as Address, parsed!)
      setTx({ kind: 'pending', hash })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error('Transaction reverted')
      setTx({ kind: 'confirmed', hash })
      setAmount('')
      await refresh()
    } catch (e) {
      const err = e as { shortMessage?: string; message: string }
      setTx({ kind: 'error', message: err.shortMessage ?? err.message, hash })
    }
  }

  const explorer = chain.blockExplorers?.default.url

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit() }}>
      <p className="muted">
        From <code>{from}</code> ({wallet.meta.name})
      </p>
      <p className="balance">
        {balance === null ? 'Loading balance…' : `${formatUnits(balance, USDC_DECIMALS)} USDC`}
      </p>
      {!hasGas && <p className="warn">This wallet has no ETH on {chain.name} for gas; the transfer will fail.</p>}

      <label>
        Recipient address
        <input value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="0x…" spellCheck={false} />
      </label>
      <label>
        Amount (USDC)
        <input value={amount} onChange={(e) => setAmount(e.target.value.trim())} inputMode="decimal" placeholder="0.00" />
      </label>
      {error && <p className="warn">{error}</p>}

      <button type="submit" disabled={!canSubmit}>
        {tx.kind === 'signing' ? 'Confirm in your wallet…' : tx.kind === 'pending' ? 'Waiting for confirmation…' : 'Confirm'}
      </button>

      {'hash' in tx && tx.hash && (
        <p className="muted">
          Tx: <a href={`${explorer}/tx/${tx.hash}`} target="_blank" rel="noreferrer"><code>{tx.hash.slice(0, 18)}…</code></a>
          {tx.kind === 'confirmed' && ' ✓ confirmed'}
        </p>
      )}
      {tx.kind === 'error' && <p className="warn">{tx.message}</p>}
    </form>
  )
}
