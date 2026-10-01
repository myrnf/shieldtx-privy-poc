import { useRef } from 'react'
import { useCreateWallet, useLogin, type User } from '@privy-io/react-auth'

const hasEmbeddedWallet = (user: User) =>
  user.linkedAccounts.some((a) => a.type === 'wallet' && a.walletClientType === 'privy')

/**
 * Fallback for `createOnLogin`: Privy only creates the embedded wallet as the last step of the
 * login modal, and never retries. If that step is interrupted (tab closed, network drop, modal
 * stuck), the user stays authenticated with no embedded wallet.
 *
 * `onComplete` runs after Privy's own creation step (so it can't race it), and also immediately on
 * page load for an already-authenticated session — which is what recovers the interrupted case.
 */
export function useEnsureEmbeddedWallet() {
  const { createWallet } = useCreateWallet()
  const attempted = useRef<string | null>(null) // user id; StrictMode can fire the callback twice

  useLogin({
    onComplete: ({ user }) => {
      if (hasEmbeddedWallet(user) || attempted.current === user.id) return
      attempted.current = user.id
      createWallet().catch((err) => console.warn('[poc] embedded wallet fallback failed:', err))
    },
  })
}
