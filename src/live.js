import { id, zeroPadValue, Contract, formatEther, formatUnits, getAddress } from 'ethers'
import { NETS, ERC20 } from './wallet.js'

const TRANSFER = id('Transfer(address,address,uint256)')
const meta = {}
async function tokenMeta(p, addr) {
  if (meta[addr]) return meta[addr]
  try { const c = new Contract(addr, ERC20, p); const [symbol, decimals] = await Promise.all([c.symbol(), c.decimals()]); return (meta[addr] = { symbol, decimals: Number(decimals) }) }
  catch { return (meta[addr] = { symbol: 'TOKEN', decimals: 18 }) }
}

/** Looks at blocks from..to and returns native and ERC-20 transfers that involve `me`. */
export async function scanBlocks(p, me, from, to, chain) {
  const low = me.toLowerCase(), out = [], sym = NETS[chain]?.sym || 'ETH'
  for (let n = from; n <= to; n++) {
    const b = await p.getBlock(n, true).catch(() => null)
    for (const tx of b?.prefetchedTransactions ?? []) {
      const isIn = tx.to?.toLowerCase() === low, isOut = tx.from?.toLowerCase() === low
      if (tx.value > 0n && (isIn || isOut))
        out.push({ hash: tx.hash, from: tx.from, to: tx.to, amt: formatEther(tx.value), sym, dir: isOut ? 'out' : 'in', ts: b.timestamp * 1000, nonce: tx.nonce })
    }
  }
  const pad = zeroPadValue(me, 32)
  for (const [topics, dir] of [[[TRANSFER, null, pad], 'in'], [[TRANSFER, pad], 'out']]) {
    const logs = await p.getLogs({ fromBlock: from, toBlock: to, topics }).catch(() => [])
    for (const l of logs) {
      if (l.topics.length !== 3) continue // skip NFT transfers
      const m = await tokenMeta(p, l.address)
      out.push({ hash: l.transactionHash, from: getAddress('0x' + l.topics[1].slice(26)), to: getAddress('0x' + l.topics[2].slice(26)),
        amt: formatUnits(BigInt(l.data), m.decimals), sym: m.symbol, dir, ts: Date.now(), token: { address: l.address, decimals: m.decimals } })
    }
  }
  return out
}
