import { HDNodeWallet, Wallet, encryptKeystoreJson } from 'ethers'

export const NETS = {
  '0xaa36a7': { name: 'Sepolia', sym: 'SepoliaETH', test: true, scan: 'https://sepolia.etherscan.io', rpc: 'https://ethereum-sepolia-rpc.publicnode.com' },
}
export const addParams = (id) => { const n = NETS[id]; return { chainId: id, chainName: n.name, nativeCurrency: { name: n.sym, symbol: n.sym, decimals: 18 }, rpcUrls: [n.rpc], blockExplorerUrls: [n.scan] } }
export const DEFAULT_TOKENS = {
  '0xaa36a7': [
    { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', symbol: 'USDC', decimals: 6 },
  ],
}
export const ERC20 = [
  'function balanceOf(address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function transfer(address,uint256) returns (bool)',
]
export const short = (a) => a.slice(0, 6) + '…' + a.slice(-4)
export const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
export const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

/* ---------- encrypted vault (password-protected keystore in localStorage) ---------- */
const VAULT = 'orbit:vault'
export const getVault = () => load(VAULT, null)
export const clearVault = () => { try { localStorage.removeItem(VAULT) } catch {} }
export const setVaultCount = (count) => save(VAULT, { ...getVault(), count })
export const getSavedImported = () => getVault()?.imported || []
export async function saveImportedAccount(wallet, password) {
  const vault = getVault()
  if (!vault?.json) throw new Error('Create or import an encrypted wallet with a password before saving extra accounts.')
  const encrypted = await encryptKeystoreJson({ address: wallet.address, privateKey: wallet.privateKey }, password, { scrypt: { N: 2 ** 16 } })
  const imported = [...(vault.imported || [])]
  if (imported.some((x) => x.address.toLowerCase() === wallet.address.toLowerCase())) throw new Error('That account is already saved.')
  imported.push({ address: wallet.address, json: encrypted })
  save(VAULT, { ...vault, imported })
}
export async function removeSavedImported(address) {
  const vault = getVault()
  if (!vault) return
  save(VAULT, { ...vault, imported: (vault.imported || []).filter((x) => x.address.toLowerCase() !== address.toLowerCase()) })
}
export async function restoreVaultAccounts(root, password) {
  const vault = getVault()
  const extra = []
  for (const item of vault?.imported || []) {
    const wallet = await Wallet.fromEncryptedJson(item.json, password)
    if (wallet.address.toLowerCase() !== item.address.toLowerCase()) throw new Error('Saved account integrity check failed.')
    extra.push(wallet)
  }
  return [...deriveAccounts(root, vault?.count || 1), ...extra]
}

export async function createVault(wal, password, progressCallback) {
  const account = {
    address: wal.address, privateKey: wal.privateKey,
    mnemonic: wal.mnemonic ? { path: wal.path, locale: 'en', entropy: wal.mnemonic.entropy } : undefined,
  }
  const json = await encryptKeystoreJson(account, password, { scrypt: { N: 2 ** 16 }, progressCallback })
  save(VAULT, { json, count: 1 })
}
export const unlockVault = (password, progress) => Wallet.fromEncryptedJson(getVault().json, password, progress)
export async function changeVaultPassword(currentPassword, nextPassword) {
  const vault = getVault()
  if (!vault?.json) throw new Error('No password-encrypted wallet is available.')
  const root = await unlockVault(currentPassword)
  const imported = []
  for (const item of vault.imported || []) {
    const wallet = await Wallet.fromEncryptedJson(item.json, currentPassword)
    imported.push({
      address: wallet.address,
      json: await encryptKeystoreJson({ address: wallet.address, privateKey: wallet.privateKey }, nextPassword, { scrypt: { N: 2 ** 16 } }),
    })
  }
  const account = {
    address: root.address, privateKey: root.privateKey,
    mnemonic: root.mnemonic ? { path: root.path, locale: 'en', entropy: root.mnemonic.entropy } : undefined,
  }
  const json = await encryptKeystoreJson(account, nextPassword, { scrypt: { N: 2 ** 16 } })
  save(VAULT, { ...vault, json, imported })
  return true
}
export const deriveAt = (root, i) => HDNodeWallet.fromMnemonic(root.mnemonic, `m/44'/60'/0'/0/${i}`)
export const deriveAccounts = (root, count) =>
  !root.mnemonic ? [root] : Array.from({ length: count }, (_, i) => (i === 0 ? root : deriveAt(root, i)))

export async function feeOverrides(p, speed) {
  const fd = await p.getFeeData()
  const m = { slow: 90n, normal: 100n, fast: 130n }[speed]
  if (fd.maxFeePerGas) return { maxFeePerGas: (fd.maxFeePerGas * m) / 100n, maxPriorityFeePerGas: ((fd.maxPriorityFeePerGas ?? 0n) * m) / 100n }
  return { gasPrice: (fd.gasPrice * m) / 100n }
}

export const addNet = (id, n) => { NETS[id] = n; save('orbit:nets', { ...load('orbit:nets', {}), [id]: n }) }
export const removeNet = (id) => { delete NETS[id]; const o = load('orbit:nets', {}); delete o[id]; save('orbit:nets', o) }
// User-defined networks are intentionally not loaded in USDC/Sepolia-only mode.

const PID = { ETH: 'ethereum', POL: 'polygon-ecosystem-token' }
export async function usdPrice(sym) {
  const id = PID[sym]; if (!id) return null
  try { const j = await (await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`)).json(); return j[id]?.usd ?? null } catch { return null }
}
export const rawOf = (tx) => ({
  to: tx.to, value: (tx.value ?? 0n).toString(), data: tx.data, gasLimit: tx.gasLimit.toString(),
  maxFeePerGas: tx.maxFeePerGas?.toString() ?? null, maxPriorityFeePerGas: tx.maxPriorityFeePerGas?.toString() ?? null, gasPrice: tx.gasPrice?.toString() ?? null,
})

/* ---------- security password (for private-key sessions with no vault) ---------- */
const te = new TextEncoder()
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
const unhex = (h) => Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16)))
async function pbkdf2(pw, salt) {
  const k = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 310000 }, k, 256))
}
export const hasSecPw = () => !!load('orbit:sec', null)
export async function setSecPw(pw) { const salt = crypto.getRandomValues(new Uint8Array(16)); save('orbit:sec', { salt: hex(salt), h: hex(await pbkdf2(pw, salt)) }) }
export async function checkPw(pw) {
  if (getVault()) { try { await unlockVault(pw); return true } catch { return false } }
  const s = load('orbit:sec', null)
  return !!s && hex(await pbkdf2(pw, unhex(s.salt))) === s.h
}
