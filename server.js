import express from 'express'
import 'dotenv/config'

const app = express()
const PORT = Number(process.env.PORT || 8787)
const API_KEY = process.env.ETHERSCAN_API_KEY
const USDC = '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238'

app.get('/api/transactions', async (req, res) => {
  res.set('Cache-Control', 'no-store')
  try {
    if (!API_KEY) {
      return res.status(503).json({ error: 'Etherscan API key missing. Add ETHERSCAN_API_KEY to .env and restart the API server.' })
    }
    const address = String(req.query.address || '')
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Invalid wallet address.' })
    }

    const params = new URLSearchParams({
      chainid: '11155111',
      module: 'account',
      action: 'tokentx',
      contractaddress: USDC,
      address,
      page: '1',
      offset: '100',
      sort: 'desc',
      apikey: API_KEY
    })
    const upstream = await fetch(`https://api.etherscan.io/v2/api?${params}`, {
      signal: AbortSignal.timeout(15000),
      headers: { accept: 'application/json' }
    })
    const body = await upstream.text()
    let data
    try {
      data = body ? JSON.parse(body) : null
    } catch {
      return res.status(502).json({ error: `Etherscan returned invalid JSON (HTTP ${upstream.status}). Check API availability and key.` })
    }
    if (!data || typeof data !== 'object') {
      return res.status(502).json({ error: `Etherscan returned an empty response (HTTP ${upstream.status}).` })
    }
    if (!upstream.ok) {
      return res.status(502).json({ error: data.result || data.message || `Etherscan HTTP ${upstream.status}` })
    }
    if (data.status === '0') {
      const message = String(data.result || data.message || '')
      if (/no transactions found/i.test(message)) return res.json({ transactions: [] })
      return res.status(502).json({ error: message || 'Etherscan API rejected the request.' })
    }
    if (!Array.isArray(data.result)) {
      return res.status(502).json({ error: 'Unexpected Etherscan response format.' })
    }

    const transactions = data.result.map((x) => ({
      hash: x.hash,
      from: x.from,
      to: x.to,
      amount: (Number(x.value || 0) / 1e6).toString(),
      timestamp: Number(x.timeStamp || 0),
      nonce: x.nonce,
      status: 'Confirmed'
    }))
    return res.json({ transactions })
  } catch (error) {
    const message = error?.name === 'TimeoutError'
      ? 'Etherscan request timed out. Please try again.'
      : (error?.message || 'Could not fetch Etherscan transactions.')
    return res.status(502).json({ error: message })
  }
})

app.listen(PORT, () => console.log(`Haven API proxy listening on http://localhost:${PORT}`))
