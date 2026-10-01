# Privy PoC — email identity + external wallet deposit

Validates that [Privy](https://privy.io) can handle, in one SDK:

1. **Identity**: email signup creating a Privy user plus an embedded wallet.
2. **External wallet connection**: detecting and connecting the user's existing EOA (MetaMask / Rabby).
3. **Interaction**: sending a USDC transfer on Arbitrum from that EOA.

**Result:** yes to all three, with the caveats under [Gotchas](#gotchas).

**Design decision:** the external wallet is *connected*, not *linked* to the Privy user. See [Why connect, not link](#why-connect-not-link).

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
| [`src/privy/useDepositWallet.ts`](src/privy/useDepositWallet.ts) | **Core logic.** Works out the embedded wallet and the active external wallet, and remembers the wallet the user picked, and returns a `status` plus `promptForWallet()` / `chooseWallet()` |
| [`src/privy/useEnsureEmbeddedWallet.ts`](src/privy/useEnsureEmbeddedWallet.ts) | Fallback that creates the embedded wallet if Privy's step during login was interrupted |
| [`src/chain/usdc.ts`](src/chain/usdc.ts) | Balance read, plus the transfer through a Privy `ConnectedWallet` (switch chain → EIP-1193 provider → viem `writeContract`) |
| [`src/chain/config.ts`](src/chain/config.ts) | Chain and USDC addresses (native USDC, not USDC.e) |
| `src/ui/*` | Demo UI only. Swap it for your own |

The `privy/` and `chain/` files carry over to a real app as they are. `ui/` is throwaway.

## Deposit flow (`useDepositWallet` status)

| Status | Meaning | Action |
|---|---|---|
| `no-wallet` | No remembered wallet, or it's no longer connected | `promptForWallet()` opens Privy's wallet picker |
| `ready` | The remembered wallet is connected | Send the transaction from it |

- **First deposit:** Privy's picker opens. The chosen wallet is remembered per Privy user, across reloads (in `localStorage`).
- **Later deposits:** straight to the form while that wallet stays connected. If it isn't connected any more (permission revoked, new device), the picker opens again.
- **Change wallet:** a link next to the From address calls `chooseWallet()` to open the picker. Closing the picker keeps the current wallet.
- **Change account:** done inside the wallet. The picker chooses the wallet **app** (Rabby, MetaMask…); the **account** is whatever is selected in it. The active address follows the switch, and the form resets for the new one.
- **No Disconnect button:** browser wallets mostly can't be disconnected by a site. It would only make the app forget the choice, which **Change wallet** already covers.

## Why connect, not link

Privy treats a **linked** wallet as a login method, so **each address can belong to only one Privy user**. If someone linked their wallet under one email and then signs up with another, linking fails with "User already exists for this address". We found no setting to turn this off, and a link can't be removed client-side.

A deposit only needs the wallet **connected**: a browser connection for this session that can sign. Connecting doesn't touch Privy's user records, so any wallet works for any user.

**Trade-off:** Privy keeps no record of which wallets a user deposits from. That's fine if you credit deposits by **destination** (the user's embedded wallet, or a per-user deposit address or contract). If you need to credit by **source** address, store your own proof of ownership: have the wallet sign a message and verify it on your backend. Your own table can let one address belong to several app users.

## Gotchas

- **Embedded wallet creation can be interrupted.** `createOnLogin` only runs as the last step of the login modal, and Privy never retries it. If that step is interrupted (closed tab, network drop, or logging in as a second email while another window in the same browser profile is logged in as someone else), the user ends up logged in with no embedded wallet. `useEnsureEmbeddedWallet` creates the wallet when the user next loads the app.
- **Don't auto-use "the connected wallet".** Privy restores every wallet that has approved the site before, including ones the user didn't mean to use (Phantom injects an Ethereum wallet too). Use the wallet returned by `useConnectWallet`'s `onSuccess`. It fires even if the picked wallet was already connected.
- **Connections are per session.** A new device, cleared site data or revoked site permission in the wallet means the user has to connect again.
- **Account switching.** Privy follows the wallet's `accountsChanged` event: the new address replaces the old one in `useWallets()`. If the wallet is already connected, `connectWallet()` returns right away with the same address, so don't use it to "switch" accounts. The user switches in the wallet itself.
- **Privy doesn't sign for external wallets.** It gives you the provider and switches chain. The approval UI is MetaMask's or Rabby's own. `useSendTransaction` and Privy's transaction screens only work for **embedded** wallets.
- **Switch chain, then get the provider again.** `wallet.switchChain()` doesn't update provider instances you already have.
- **Rabby** has no dedicated wallet-list entry (`rabby_wallet` is deprecated). It appears through `detected_ethereum_wallets` (EIP-6963).

## Not covered (needed for production)

- **Backend verification:** checking the Privy access token on your server instead of trusting the client.
- **Crediting deposits:** decide between destination-based and source-based crediting (see [Why connect, not link](#why-connect-not-link)).
- **Sending from the embedded wallet**, gas sponsorship, and smart wallets.
