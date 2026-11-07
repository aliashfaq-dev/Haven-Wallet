# Haven Wallet (React + Vite)

    npm install
    npm run server    # terminal 1: Etherscan API proxy on http://localhost:8787
    npm run dev       # terminal 2: Vite app at http://localhost:5173
    npm run build     # static site in dist/

Login: private key (memory only), encrypted local wallet (password), or browser wallet. Asset/network support is restricted to USDC on Ethereum Sepolia (chain ID 11155111).

Features: multiple accounts (create, rename, import key, export key, remove), token list (add by contract, hide, restore,
remove, token detail), custom networks and RPC overrides, send with gas speed, custom fees, nonce and ENS names,
speed up / cancel pending transactions, activity filters and details, USD value, hide balances, QR receive,
address book, message and EIP-712 signing, auto-lock, light and dark themes.

Security: use testnets or small amounts. Anyone with access to your unlocked browser session can spend the funds.

## Live updates
While logged in, the app watches the chain every few seconds. Funds sent to your address (native coin and ERC-20 tokens) show up in
Activity right away, the balance flashes, an unread badge appears on Activity and, if enabled, a desktop notification is sent.
Pending transactions flip to Confirmed automatically.

## Showing private keys
Viewing an account's private key always asks for your password again (the wallet password, or a security password you set for
private-key sessions). The key hides itself after 30 seconds.


## Etherscan transaction history

USDC Sepolia ERC-20 transfers are read from Etherscan API V2 through the
server-side Express endpoint at `/api/transactions`. The API key is not bundled
into browser JavaScript.

1. Copy `.env.example` to `.env` and set `ETHERSCAN_API_KEY` to a newly generated key.
2. Run `npm install`.
3. Start the API proxy with `npm run server`.
4. In another terminal run `npm run dev`.

For production, deploy `server.js` as a backend service and route `/api/*` to it.
Never put the key in a `VITE_` variable or commit `.env`. Signed USDC transfers
are broadcast through the connected Sepolia wallet/RPC; Etherscan indexes and
displays history, it does not custody funds or broadcast transactions.
