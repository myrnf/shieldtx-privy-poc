# Privy PoC — email identity + external wallet deposit

Validates that [Privy](https://privy.io) can handle, in one SDK:

1. **Identity**: email signup creating a Privy user plus an embedded wallet.
2. **External wallet linking**: detecting and linking the user's existing EOA (MetaMask / Rabby) with a SIWE signature.
3. **Interaction**: sending a USDC transfer on Arbitrum from that linked EOA.

**Result:** yes to all three, with the caveats under [Gotchas](#gotchas).

## Run it

**1. Create a `.env` file in the project root** with these contents:

```bash
VITE_PRIVY_APP_ID=your-privy-app-id
VITE_NETWORK=arbitrum-sepolia
```

| Variable | Value |
|---|---|
| `VITE_PRIVY_APP_ID` | Privy App ID (required) |
| `VITE_NETWORK` | `arbitrum-sepolia` (testnet, Circle test USDC) or `arbitrum` (mainnet, **real USDC**) |

`.env` is gitignored. Don't commit it.

**2. Install and start:**

```bash
npm install
npm run dev
```

Open http://localhost:5173.

The port is fixed at 5173 because Privy only accepts logins from allowed origins. If something else is using 5173, the dev server exits with an error rather than switching ports. Free the port and run it again.

The external wallet (MetaMask / Rabby) needs USDC, plus a little ETH for gas, on the network you chose.

### Using your own Privy app

If you set up your own app in the [Privy dashboard](https://dashboard.privy.io), configure it like this:

- Enable **Email** and **Wallet** login methods.
- Enable **EVM embedded wallets**.
- Add `http://localhost:5173` to allowed origins.

## Where the code is

| File | What it shows |
|---|---|
| [`src/privy/privyConfig.ts`](src/privy/privyConfig.ts) | `PrivyProvider` config: login methods, embedded wallet creation, chains, wallet list |
| [`src/privy/useDepositWallet.ts`](src/privy/useDepositWallet.ts) | **Core logic.** Works out the embedded wallet, the linked wallets and the active wallet, and returns an explicit `status` with the actions to move between statuses |
| [`src/chain/usdc.ts`](src/chain/usdc.ts) | Balance read, plus the transfer through a Privy `ConnectedWallet` (switch chain → EIP-1193 provider → viem `writeContract`) |
| [`src/chain/config.ts`](src/chain/config.ts) | Chain and USDC addresses (native USDC, not USDC.e) |
| `src/ui/*` | Demo UI only. Swap it for your own |

The `privy/` and `chain/` files carry over to a real app as they are. `ui/` is throwaway.

## Deposit flow (`useDepositWallet` status)

```
no-wallet      ── linkWallet() ──────────────► ready
needs-connect  ── connectWallet() ───────────► ready
needs-link     ── wallet.loginOrLink() ──────► ready
ready          ── user switches account ─────► needs-link
```

| Status | Meaning | Action |
|---|---|---|
| `no-wallet` | User has never linked an external wallet | `linkWallet()`: Privy modal (pick wallet + SIWE signature) |
| `needs-connect` | Wallet is linked, but not connected in this session | `connectWallet()` |
| `needs-link` | A wallet is connected, but the selected account isn't linked | `wallet.loginOrLink()`: one signature for that exact address, no picker |
| `ready` | Selected account is connected **and** linked | Send the transaction |

## Gotchas

- **Linked ≠ connected.** *Linked* is saved on the Privy user on Privy's servers and is permanent until unlinked. *Connected* is a browser connection for this session, and it's what you need to sign. New device, cleared storage or revoked site permission means the user has to reconnect, not re-link.
- **Account switching.** Privy follows the wallet's `accountsChanged` event. After a switch, the new address shows up in `useWallets()` with `linked: false`, and the old one drops out. Don't filter `useWallets()` down to linked addresses only: if you do, the switched account looks like "nothing connected", and `connectWallet()` becomes a silent no-op because the extension is already connected.
- **Privy doesn't sign for external wallets.** It gives you the provider and switches chain. The approval UI is MetaMask's or Rabby's own. `useSendTransaction` and Privy's transaction screens only work for **embedded** wallets.
- **Switch chain, then get the provider again.** `wallet.switchChain()` doesn't update provider instances you already have.
- **Rabby** has no dedicated wallet-list entry (`rabby_wallet` is deprecated). It appears through `detected_ethereum_wallets` (EIP-6963).
- **Several extensions connected:** "active" is the first non-embedded wallet in `useWallets()`.
- **Linking is additive.** Linking a new address keeps the old ones. If you want one external wallet per user, unlink the old one after a successful link.
- **One wallet, one Privy user.** Linking an address that already belongs to another Privy user fails.
- **Links are per Privy app.** Dev and prod App IDs have separate user databases.

## Not covered (needed for production)

- **Backend verification:** checking the Privy access token on your server and reading linked wallets from Privy's server API instead of trusting the client.
- **Crediting deposits by linked address:** a link only proves control of the address at `latestVerifiedAt`. Decide whether links should need re-verifying.
- **Sending from the embedded wallet**, gas sponsorship, and smart wallets.
