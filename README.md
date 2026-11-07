# Haven Wallet (React + Vite)

## Local development

```bash
npm install
npm run server
npm run dev
```

The Vite dev server proxies `/api/*` to the local Express API on port 8787.
Set `ETHERSCAN_API_KEY` in a local `.env` file (never commit it).

## Vercel deployment

This project is configured for Vercel as a Vite frontend plus a Node.js
Serverless Function at `/api/transactions`.

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`
- Environment variable: `ETHERSCAN_API_KEY` (Production, Preview as needed)

Do not add the API key as a `VITE_*` variable. Vite variables are exposed to
browser code. The API key belongs only in Vercel's server-side environment.

The transaction history endpoint reads Sepolia native ETH transfers and USDC
ERC-20 transfers through Etherscan API V2. Wallet signing and transaction
broadcasting still happen locally through the connected wallet/RPC; this
serverless endpoint only reads indexed history.

## Wallet features and security

Haven is a self-custody testnet wallet. Private keys are handled in the browser;
never enter a mainnet private key into a test application. Use testnet funds only.
Anyone with access to an unlocked browser session may be able to spend its funds.
