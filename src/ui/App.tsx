import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useDepositWallet } from '../privy/useDepositWallet'
import { useEnsureEmbeddedWallet } from '../privy/useEnsureEmbeddedWallet'
import { DepositModal } from './DepositModal'

export function App() {
  const { ready, authenticated, user, login, logout } = usePrivy()
  useEnsureEmbeddedWallet()
  const depositWallet = useDepositWallet()
  const { embedded, linkedExternal, active } = depositWallet
  const [depositOpen, setDepositOpen] = useState(false)

  if (!ready) return <main><p>Loading…</p></main>

  if (!authenticated || !user) {
    return (
      <main>
        <h1>Privy PoC</h1>
        <button onClick={() => login()}>Sign up</button>
      </main>
    )
  }

  function onDeposit() {
    setDepositOpen(true)
    depositWallet.promptForWallet()
  }

  return (
    <main>
      <header>
        <h1>Privy PoC</h1>
        <button className="secondary" onClick={logout}>Log out</button>
      </header>

      <dl>
        <dt>Privy user</dt>
        <dd><code>{user.id}</code></dd>
        <dt>Email</dt>
        <dd>{user.email?.address ?? '—'}</dd>
        <dt>Embedded wallet</dt>
        <dd>{embedded ? <code>{embedded.address}</code> : 'not created'}</dd>
        <dt>Linked external wallets</dt>
        <dd>
          {linkedExternal.length === 0
            ? 'none'
            : linkedExternal.map((a) => (
                <div key={a.address}>
                  <code>{a.address}</code> ({a.walletClientType}
                  {active?.address.toLowerCase() === a.address.toLowerCase() ? ', active' : ''})
                </div>
              ))}
        </dd>
      </dl>

      <button onClick={onDeposit}>Deposit</button>

      {depositOpen && <DepositModal {...depositWallet} onClose={() => setDepositOpen(false)} />}
    </main>
  )
}
