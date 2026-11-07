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

## Firebase Google sign-in

Google sign-in is an account-identity step, not a replacement for an Ethereum
wallet key. After Google sign-in, create a new wallet or import an existing
recovery phrase/private key. Wallet secrets remain in the browser and are not
uploaded to Firebase. An existing encrypted local vault still requires its
wallet password to unlock; Google sign-in alone cannot decrypt it or restore it
on a different device.

1. Create a Firebase project and add a Web app in the Firebase console.
2. In **Authentication → Sign-in method**, enable **Google**.
3. In **Authentication → Settings → Authorized domains**, add your Vercel
   production domain (and preview domains you intend to use).
4. Copy the Web app config values into Vercel Project Settings → Environment
   Variables for Production and Preview:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_APP_ID`
5. Redeploy after adding or changing the environment variables.

These Firebase web config values are public client configuration, not private
service-account credentials. Never put a Firebase service-account JSON or
private key in a `VITE_*` variable.
