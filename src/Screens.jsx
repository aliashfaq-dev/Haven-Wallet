import { useState, useEffect, useMemo } from 'react'
import { Contract, isAddress, getAddress, formatEther, parseEther, parseUnits } from 'ethers'
import QRCode from 'qrcode'
import QrScanner from './QrScanner.jsx'
import { ERC20, NETS, short, save, feeOverrides, rawOf } from './wallet.js'
import { Back, Seg, Sheet, Toggle } from './ui.jsx'

export function Send({ w, net, tokens, rows, bal, cfg, setCfg, contacts, go, toast, addTx, patch, refresh, pre }) {
  const [asset, setAsset] = useState(() => { const i = pre ? tokens.findIndex((t) => t.address === pre) : 0; return String(Math.max(0, i)) }), [to, setTo] = useState(''), [amt, setAmt] = useState('')
  
  const [speed, setSpeed] = useState('normal'), [fee, setFee] = useState(null)
  const [review, setReview] = useState(false), [skip, setSkip] = useState(false), [busy, setBusy] = useState(false), [scanning, setScanning] = useState(false)
  const tok = asset === 'native' ? null : tokens[+asset]
  const valid = isAddress(to.trim()) || /\.eth$/i.test(to.trim())
  const parsed = useMemo(() => { try { return tok ? parseUnits(amt || '0', tok.decimals) : parseEther(amt || '0') } catch { return null } }, [amt, tok])

  useEffect(() => {
    let dead = false
    ;(async () => {
      try {
        const overrides = await feeOverrides(w.p, speed)
        const maxPricePerGas = overrides.maxFeePerGas ?? overrides.gasPrice
        if (maxPricePerGas == null) throw new Error('Gas price unavailable')
        let gasLimit
        if (tok) {
          gasLimit = valid && parsed > 0n
            ? await new Contract(tok.address, ERC20, w.p).transfer.estimateGas(to.trim(), parsed, { from: w.a }).catch(() => 80000n)
            : 65000n
        } else {
          gasLimit = valid && parsed > 0n
            ? await w.p.estimateGas({ from: w.a, to: to.trim(), value: parsed }).catch(() => 21000n)
            : 21000n
        }
        if (!dead) setFee(gasLimit * maxPricePerGas)
      } catch {
        if (!dead) setFee(null)
      }
    })()
    return () => { dead = true }
  }, [w, speed, asset, valid, parsed, to, tok])

  const max = () => {
    if (tok) { const r = rows?.find((x) => x.address === tok.address); if (r) setAmt(r.raw) }
    else { const m = parseEther(bal) - ((fee ?? 0n) * 11n) / 10n; setAmt(m > 0n ? formatEther(m) : '0') }
  }
  const submit = () => {
    if (!valid) return toast('Enter a valid recipient address')
    if (!parsed || parsed <= 0n) return toast('Enter an amount greater than 0')
    try {
      const available = tok ? parseUnits(rows?.find((x) => x.address.toLowerCase() === tok.address.toLowerCase())?.raw || '0', tok.decimals) : parseEther(bal || '0')
      if (parsed > available) return toast('Insufficient ' + (tok ? tok.symbol : 'ETH') + ' balance')
      if (fee && parseEther(bal || '0') < fee) return toast('Not enough SepoliaETH for network fee')
      if (!tok && fee && parsed + fee > available) return toast('Not enough SepoliaETH for amount and fee')
    } catch { return toast('Enter a valid amount') }
    if (w.mode === 'local' && !cfg.quick) setReview(true); else send()
  }
  const send = async () => {
    setReview(false); setBusy(true)
    if (skip) setCfg({ quick: true })
    try {
      const o = await feeOverrides(w.p, speed); let dest = to.trim()
      if (/\.eth$/i.test(dest)) { dest = await w.p.resolveName(dest); if (!dest) throw new Error('ENS name not found on this network') }
            let tx, sym
      if (w.chain !== '0xaa36a7') throw new Error('Please connect to Sepolia first')
      if (asset === 'native') {
        sym = net.sym || 'SepoliaETH'
        const gasLimit = await w.p.estimateGas({ from: w.a, to: dest, value: parsed })
        tx = await w.s.sendTransaction({ to: dest, value: parsed, gasLimit, ...o })
      } else {
        if (!tok) throw new Error('Select a valid token contract')
        sym = tok.symbol
        const contract = new Contract(tok.address, ERC20, w.s)
        const gasLimit = await contract.transfer.estimateGas(dest, parsed, { from: w.a })
        tx = await contract.transfer(dest, parsed, { ...o, gasLimit })
      }
      addTx({ hash: tx.hash, to: dest, amt, sym, chain: w.chain, st: 'Pending', nonce: tx.nonce, ts: Date.now(), raw: rawOf(tx) })
      toast('Transaction sent'); go('activity')
      const rc = await tx.wait()
      patch(tx.hash, { st: rc?.status === 1 ? 'Confirmed' : 'Failed' }); toast('Transaction confirmed'); refresh()
    } catch (e) {
      toast(e.code === 'TRANSACTION_REPLACED' ? 'Transaction was replaced' : e.code === 4001 || e.code === 'ACTION_REJECTED' ? 'Transaction rejected' : 'Failed: ' + (e.shortMessage || e.message).slice(0, 90))
    }
    setBusy(false)
  }
  const feeTxt = fee !== null ? `${(+formatEther(fee)).toFixed(6)} ${net.sym}` : 'Fee estimate unavailable'

  return (
    <section className="view on">
      <Back go={go} /><h2>Send · Sepolia</h2>
      <div><label>Asset</label>
        <select value={asset} onChange={(e) => { setAsset(e.target.value); setAmt('') }}>
          <option value="native">SepoliaETH (ETH)</option>
          {tokens.map((t) => <option key={t.address} value={tokens.indexOf(t)}>{t.symbol} · Sepolia</option>)}
        </select></div>
      <div><label>Recipient address</label><input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Paste wallet address (0x…)" autoComplete="off" /><button className="scan-qr-btn" type="button" onClick={() => setScanning(true)}>▦ Scan recipient QR code</button>
        {contacts.length > 0 && <div className="chips">{contacts.map((c) => <button key={c.address} className="cc" onClick={() => setTo(c.address)}>{c.name}</button>)}</div>}</div>
      <div className="send-balance"><span>Available {tok ? tok.symbol : 'SepoliaETH'} balance</span><strong>{tok ? (rows?.find((x) => x.address.toLowerCase() === tok.address.toLowerCase())?.raw || '0') + ' ' + tok.symbol : bal + ' ETH'}</strong></div><div><label>Amount</label><div className="inrow"><input value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="decimal" placeholder="0.0" /><button onClick={max}>Max</button></div></div>
      <div><label>Network fee priority</label><Seg v={speed} set={setSpeed} opts={ [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']] } /></div>
      <div className="note">Estimated maximum network fee: {feeTxt}</div>
      <button className="pri" disabled={busy} onClick={submit}>{busy ? 'Sending…' : w.mode === 'local' ? (cfg.quick ? 'Send now' : 'Review and send') : 'Send with wallet'}</button>
      {scanning && <QrScanner onClose={() => setScanning(false)} onResult={(raw) => {
        try {
          let recipient = raw.trim(), amount = '', assetCode = 'native', chainId = 11155111;
          if (recipient.toLowerCase().startsWith('ethereum:')) {
            const body = recipient.slice(9); const parts = body.split('?'); const head = parts[0]; const query = new URLSearchParams(parts[1] || '');
            const match = head.match(/^([^/@]+)(?:@(\d+))?(?:\/(transfer))?$/);
            if (!match) throw new Error('Invalid Ethereum QR');
            chainId = Number(match[2] || 11155111);
            if (match[3] === 'transfer') { recipient = query.get('address') || ''; assetCode = 'usdc'; const rawAmount = query.get('uint256'); amount = rawAmount ? (Number(rawAmount) / 1e6).toString() : ''; }
            else { recipient = match[1]; const rawAmount = query.get('value'); amount = rawAmount ? (Number(rawAmount) / 1e18).toString() : ''; }
          }
          if (chainId !== 11155111) throw new Error('This QR is not for Ethereum Sepolia');
          if (!isAddress(recipient)) throw new Error('QR does not contain a valid recipient address');
          if (assetCode === 'usdc') { const index = tokens.findIndex(t => t.symbol === 'USDC' && t.decimals === 6); if (index < 0) throw new Error('Sepolia USDC is unavailable'); setAsset(String(index)); } else setAsset('native');
          setTo(recipient); if (amount) setAmt(amount); setScanning(false); toast('QR payment details filled');
        } catch (e) { toast(e.message || 'Unsupported QR code'); }
      }} />}
      <Sheet open={review} onClose={() => setReview(false)}>
        <h2>Review transaction</h2>
        <div className="kv"><span>From</span><b>{short(w.a)}</b><span>To</span><b>{short(to.trim() || '0x0000000000000000')}</b>
          <span>Amount</span><b>{amt} {tok ? tok.symbol : net.sym}</b><span>Network</span><b>{net.name}</b><span>Estimated max fee</span><b>{feeTxt}</b></div>
        <div className="split"><span>Skip this review from now on</span><Toggle on={skip} set={setSkip} /></div>
        <div className="inrow"><button onClick={() => setReview(false)}>Cancel</button><button className="pri" onClick={send}>Confirm and send</button></div>
      </Sheet>
    </section>
  )
}

export function Receive({ w, net, go, toast }) {
  const [qr, setQr] = useState(''), [amt, setAmt] = useState(''), [asset, setAsset] = useState('native')
  const usdcAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
  const link = (() => {
    try {
      const chainId = parseInt(w.chain, 16)
      if (asset === 'usdc') {
        const raw = amt ? parseUnits(amt, 6) : 0n
        return `ethereum:${usdcAddress}@${chainId}/transfer?address=${w.a}` + (raw > 0n ? `&uint256=${raw}` : '')
      }
      const raw = amt ? parseEther(amt) : 0n
      return `ethereum:${w.a}@${chainId}` + (raw > 0n ? `?value=${raw}` : '')
    } catch { return `ethereum:${w.a}@${parseInt(w.chain, 16)}` }
  })()
  useEffect(() => { QRCode.toDataURL(link, { margin: 1, width: 220, color: { dark: '#1d1c18', light: '#ffffff' } }).then(setQr).catch(() => setQr('')) }, [link])
  return (
    <section className="view">
      <Back go={go} /><h2>Receive · Ethereum Sepolia</h2>
      <div><label>Asset to request</label><select value={asset} onChange={(e) => { setAsset(e.target.value); setAmt('') }}><option value="native">SepoliaETH (ETH)</option><option value="usdc">USDC</option></select></div>
      <div><label>Request amount (optional)</label><input value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="decimal" placeholder={asset === 'usdc' ? '0.00 USDC' : '0.0 ETH'} /></div>
      <div className="qr">{qr && <img src={qr} alt="Sepolia payment request QR code" />}</div>
      <div className="note mono">{w.a}</div>
      <div className="note">{amt ? `Payment request: ${amt} ${asset === 'usdc' ? 'USDC' : 'ETH'} on Ethereum Sepolia` : 'Scan to receive on Ethereum Sepolia'}</div>
      <button className="pri" onClick={() => { navigator.clipboard?.writeText(w.a); toast('Address copied') }}>Copy address</button>
      <button onClick={() => { navigator.clipboard?.writeText(link); toast('Payment request copied') }}>Copy payment request</button>
      <p className="mute">The QR includes the selected Sepolia asset and requested amount. The sender wallet must support Ethereum payment request QR codes.</p>
    </section>
  )
}

export function ImportToken({ w, go, toast, custom, setCustom }) {
  const [addr, setAddr] = useState(''), [info, setInfo] = useState(null), [msg, setMsg] = useState('Symbol and decimals are read from the contract.')
  const onAddr = async (v) => {
    setAddr(v); setInfo(null)
    const a = v.trim()
    if (!isAddress(a)) return setMsg('Enter a valid contract address.')
    try {
      const c = new Contract(a, ERC20, w.p)
      const [symbol, decimals] = await Promise.all([c.symbol(), c.decimals()])
      setInfo({ address: getAddress(a), symbol, decimals: Number(decimals) }); setMsg(`${symbol} · ${decimals} decimals`)
    } catch { setMsg('No ERC-20 token found at this address on this network.') }
  }
  const add = async () => {
    if (!info) return toast('Enter a valid token address first')
    if (!custom.some((t) => t.address.toLowerCase() === info.address.toLowerCase())) { const l = [...custom, info]; setCustom(l); save('tok:' + w.chain, l) }
    if (w.mode === 'injected') { try { await window.ethereum.request({ method: 'wallet_watchAsset', params: { type: 'ERC20', options: { address: info.address, symbol: info.symbol.slice(0, 11), decimals: info.decimals } } }) } catch {} }
    toast(info.symbol + ' added'); go('home')
  }
  return (
    <section className="view on">
      <Back go={go} /><h2>Import token</h2>
      <div><label>Token contract address</label><input value={addr} onChange={(e) => onAddr(e.target.value)} placeholder="0x…" autoComplete="off" /></div>
      <div className="note">{msg}</div><button className="pri" onClick={add}>Add token</button>
    </section>
  )
}
