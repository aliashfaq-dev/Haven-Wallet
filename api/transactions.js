import { formatEther, formatUnits } from 'ethers'

const USDC = '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238'
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

async function etherscan(address, extra, apiKey) {
  const query = new URLSearchParams({ chainid: '11155111', module: 'account', address, page: '1', offset: '100', sort: 'desc', apikey: apiKey, ...extra })
  const response = await fetch(`https://api.etherscan.io/v2/api?${query}`, {
    headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15000),
  })
  const body = await response.text()
  let data
  try { data = body ? JSON.parse(body) : null } catch { throw new Error(`Etherscan returned invalid JSON (HTTP ${response.status}).`) }
  if (!response.ok || !data || typeof data !== 'object') throw new Error(data?.result || data?.message || `Etherscan HTTP ${response.status}`)
  if (data.status === '0') {
    if (/no transactions found/i.test(String(data.result || data.message || ''))) return []
    throw new Error(String(data.result || data.message || 'Etherscan rejected the request.'))
  }
  if (!Array.isArray(data.result)) throw new Error('Unexpected Etherscan response format.')
  return data.result
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed.' }) }
  const apiKey = process.env.ETHERSCAN_API_KEY
  if (!apiKey) return res.status(503).json({ error: 'Etherscan API key is not configured.' })
  const address = String(req.query?.address || '')
  if (!ADDRESS_RE.test(address)) return res.status(400).json({ error: 'Invalid wallet address.' })
  try {
    const [native, tokens] = await Promise.all([
      etherscan(address, { action: 'txlist', startblock: '0', endblock: '99999999' }, apiKey),
      etherscan(address, { action: 'tokentx', contractaddress: USDC }, apiKey),
    ])
    const nativeRows = native.map(tx => ({
      hash: tx.hash, from: tx.from, to: tx.to, amount: formatEther(BigInt(tx.value || '0')),
      timestamp: Number(tx.timeStamp || 0), nonce: tx.nonce, sym: 'SepoliaETH',
      status: tx.isError === '1' || tx.txreceipt_status === '0' ? 'Failed' : 'Confirmed',
    }))
    const tokenRows = tokens.map(tx => ({
      hash: tx.hash, from: tx.from, to: tx.to, amount: formatUnits(BigInt(tx.value || '0'), 6),
      timestamp: Number(tx.timeStamp || 0), nonce: tx.nonce, sym: 'USDC',
      status: tx.txreceipt_status === '0' ? 'Failed' : 'Confirmed',
    }))
    return res.status(200).json({ transactions: [...nativeRows, ...tokenRows].sort((a, b) => b.timestamp - a.timestamp) })
  } catch (error) {
    const message = error?.name === 'TimeoutError' ? 'Etherscan request timed out. Please try again.' : (error?.message || 'Could not fetch Etherscan transactions.')
    return res.status(502).json({ error: message })
  }
}
