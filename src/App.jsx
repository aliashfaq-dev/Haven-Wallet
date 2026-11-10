import { useState, useEffect, useCallback, useRef } from 'react'
import { BrowserProvider, JsonRpcProvider, Contract, Wallet, formatEther, formatUnits } from 'ethers'
import { NETS, DEFAULT_TOKENS, ERC20, short, load, save, getVault, clearVault, addParams, deriveAt, setVaultCount, usdPrice, rawOf, restoreVaultAccounts, getSavedImported, removeSavedImported } from './wallet.js'
import { Icon, Logo, Sheet, Seg } from './ui.jsx'
import { Onboard, Unlock } from './Onboard.jsx'
import { Send, Receive, ImportToken } from './Screens.jsx'
import Settings from './Settings.jsx'
import Accounts from './Accounts.jsx'
import Networks from './Networks.jsx'
import { scanBlocks } from './live.js'

const hasBiometricSession = () => {
  try { return !!JSON.parse(localStorage.getItem('haven:biometric-session') || 'null') } catch { return false }
}
const clearBiometricSession = () => { try { localStorage.removeItem('haven:biometric-session') } catch {} }

const fmt = (v, d = 4) => (+v).toLocaleString(undefined, { maximumFractionDigits: d })
const NAV = [['home', 'Assets', 'wallet'], ['activity', 'Activity', 'act'], ['accounts', 'Accounts', 'users'], ['networks', 'Networks', 'globe'], ['settings', 'Settings', 'set']]

export default function App() {
  const eth = window.ethereum
  const [cfg, setC] = useState(() => ({ quick: true, lock: 15, rpc: {}, ...load('orbit:cfg', {}) }))
  const setCfg = (p) => setC((c) => { const n = { ...c, ...p }; save('orbit:cfg', n); return n })
  const [theme, setTheme] = useState(() => load('orbit:theme', 'light'))
  useEffect(() => { document.documentElement.dataset.theme = theme; save('orbit:theme', theme) }, [theme])
  const [mode, setMode] = useState(null)
  const [view, setView] = useState(getVault() || hasBiometricSession() ? 'unlock' : 'onboard')
  const [chain, setChain] = useState('0xaa36a7')
  const [accts, setAccts] = useState(null), [idx, setIdx] = useState(0)
  const [names, setNames] = useState(() => load('orbit:names', {})), [imported, setImported] = useState([])
  const [w, setW] = useState(null), [bal, setBal] = useState('0'), [rows, setRows] = useState(null)
  const [custom, setCustom] = useState(() => load('tok:0xaa36a7', [])), [hid, setHidS] = useState([]), [hist, setHist] = useState([])
  const [contacts, setContacts] = useState(() => load('orbit:contacts', []))
  const [tick, setTick] = useState(0), [nv, setNv] = useState(0), [menu, setMenu] = useState(false), [msg, setMsg] = useState('')
  const [price, setPrice] = useState(null), [gas, setGas] = useState(null)
  const [selTx, setSelTx] = useState(null), [selTok, setSelTok] = useState(null), [pre, setPre] = useState(null)
  const [filter, setFilter] = useState('all'), [showHid, setShowHid] = useState(false)
  const [live, setLive] = useState('off'), [unread, setUnread] = useState(0), [flash, setFlash] = useState(0)
  const histRef = useRef([]), cfgRef = useRef(cfg), balRef = useRef('0')
  const tt = useRef()
  histRef.current = hist; cfgRef.current = cfg; balRef.current = bal
  const toast = (m) => { setMsg(m); clearTimeout(tt.current); tt.current = setTimeout(() => setMsg(''), 3200) }
  const bump = () => setNv((n) => n + 1)
  const net = w && (NETS[w.chain] || { name: 'Chain ' + parseInt(w.chain, 16), sym: 'ETH', scan: '' })
  const allTokens = w?.chain === '0xaa36a7' ? DEFAULT_TOKENS['0xaa36a7'] : []
  const tokens = [...allTokens, ...custom.filter((t) => !allTokens.some((d) => d.address.toLowerCase() === t.address.toLowerCase()))]
  const acctName = (a, i) => names[a] || 'Account ' + (i + 1)

  /* ---- browser wallet ---- */
  const setupInj = useCallback(async () => {
    const p = new BrowserProvider(window.ethereum), s = await p.getSigner(), n = await p.getNetwork()
    setMode('injected'); setW({ mode: 'injected', p, s, a: await s.getAddress(), chain: '0x' + n.chainId.toString(16) })
    setView((v) => (['onboard', 'unlock'].includes(v) ? 'home' : v))
  }, [])
  const connectInj = async () => {
    try { await eth.request({ method: 'eth_requestAccounts' }); await setupInj() }
    catch (e) { toast(e.code === 4001 ? 'Connection request rejected' : 'Connection failed') }
  }
  useEffect(() => { if (eth && !getVault()) eth.request({ method: 'eth_accounts' }).then((a) => a.length && setupInj()).catch(() => {}) }, [])
  useEffect(() => {
    if (mode !== 'injected') return
    const onAcc = (a) => (a.length ? setupInj() : disconnect())
    eth.on?.('accountsChanged', onAcc); eth.on?.('chainChanged', setupInj)
    return () => { eth.removeListener?.('accountsChanged', onAcc); eth.removeListener?.('chainChanged', setupInj) }
  }, [mode])

  /* ---- local wallet ---- */
  useEffect(() => {
    if (mode !== 'local' || !accts || !accts[idx]) return
    const p = new JsonRpcProvider(cfg.rpc[chain] || NETS[chain].rpc, parseInt(chain, 16), { staticNetwork: true })
    const s = accts[idx].connect(p)
    setW({ mode: 'local', p, s, a: s.address, chain })
  }, [mode, accts, idx, chain, cfg.rpc])
  const onLocal = (list) => { setAccts(list); setIdx(0); setImported(list.filter((a) => getSavedImported().some((x) => x.address.toLowerCase() === a.address.toLowerCase())).map((a) => a.address)); setMode('local'); setView('home') }
  const lock = useCallback(() => { setAccts(null); setW(null); setMode(null); setIdx(0); setImported([]); setMenu(false); setView(getVault() || hasBiometricSession() ? 'unlock' : 'onboard') }, [])
  const disconnect = () => { setW(null); setMode(null); setView(getVault() || hasBiometricSession() ? 'unlock' : 'onboard') }
  const forget = () => { if (window.confirm('Remove this wallet from the browser? You will need your recovery phrase to restore it.')) { clearVault(); clearBiometricSession(); lock(); setView('onboard') } }
  useEffect(() => {
    if (mode !== 'local' || !accts || !cfg.lock) return
    let t; const reset = () => { clearTimeout(t); t = setTimeout(lock, cfg.lock * 60000) }
    const ev = ['pointerdown', 'keydown']; reset(); ev.forEach((e) => addEventListener(e, reset))
    return () => { clearTimeout(t); ev.forEach((e) => removeEventListener(e, reset)) }
  }, [mode, accts, cfg.lock])

  /* ---- accounts ---- */
  const derivedCount = accts ? accts.filter((a) => !imported.includes(a.address)).length : 0
  const addDerived = () => { setAccts([...accts, deriveAt(accts[0], derivedCount)]); if (getVault()) setVaultCount(derivedCount + 1); setIdx(accts.length); toast('Account created') }
  const importKey = async (s, password) => {
    s = s.trim()
    if (!/^(0x)?[0-9a-fA-F]{64}$/.test(s)) return toast('Enter a valid 64-character private key')
    const a = new Wallet(s.startsWith('0x') ? s : '0x' + s)
    if (accts.some((x) => x.address === a.address)) return toast('That account is already added')
    try {
      await (async () => {
        if (getVault()) {
          const { saveImportedAccount } = await import('./wallet.js')
          await saveImportedAccount(a, password)
        } else throw new Error('Extra account saving requires an encrypted wallet. Import or create a wallet with a password first.')
      })()
    } catch (e) { toast(e.message); return false }
    setAccts([...accts, a]); setImported([...imported, a.address]); setIdx(accts.length); toast('Account saved securely'); return true
  }
  const removeAcct = async (i) => { const a = accts[i]; if (imported.includes(a.address)) await removeSavedImported(a.address); setAccts(accts.filter((_, j) => j !== i)); setImported(imported.filter((x) => x !== a.address)); if (idx >= i) setIdx(Math.max(0, idx - 1)) }

  const switchNet = async (id) => {
    if (mode === 'local') { setChain(id); save('orbit:chain', id); return }
    try { await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: id }] }) }
    catch (err) {
      if (err.code === 4902 || err.code === -32603) { try { await eth.request({ method: 'wallet_addEthereumChain', params: [addParams(id)] }) } catch { toast('Network not added') } }
      else toast('Could not switch network')
    }
  }

  /* ---- data ---- */
  useEffect(() => { if (w) { setCustom(load('tok:' + w.chain, [])); setHidS(load('hid:' + w.chain, [])); setHist(load('hist:' + w.a, [])); setRows(null) } }, [w])
  useEffect(() => {
    if (!w) return
    let dead = false
    ;(async () => {
      const b = formatEther(await w.p.getBalance(w.a)); if (!dead) setBal(b)
      const out = []
      for (const t of tokens) {
        let r = { ...t, b: '—', raw: '0' }
        try { const v = await new Contract(t.address, ERC20, w.p).balanceOf(w.a); r = { ...t, b: fmt(formatUnits(v, t.decimals)), raw: formatUnits(v, t.decimals) } } catch {}
        out.push(r)
      }
      if (!dead) setRows(out)
    })().catch(() => { if (!dead) { setRows([]); toast('Could not reach the network RPC') } })
    return () => { dead = true }
  }, [w, custom, hid, tick])
  // Etherscan API v2 history via a server-side proxy; the secret key never enters browser code.
  useEffect(() => {
    if (!w || w.chain !== '0xaa36a7') return
    let dead = false
    ;(async () => {
      try {
        const res = await fetch('/api/transactions?address=' + encodeURIComponent(w.a), {
          headers: { accept: 'application/json' }
        })
        const body = await res.text()
        let payload
        try {
          payload = body ? JSON.parse(body) : null
        } catch {
          throw new Error(`History API returned invalid/empty data (HTTP ${res.status}). Make sure the API server is running on port 8787.`)
        }
        if (!payload || typeof payload !== 'object') {
          throw new Error(`History API returned an empty response (HTTP ${res.status}). Start the API server with npm run server.`)
        }
        if (!res.ok) throw new Error(payload.error || `History unavailable (HTTP ${res.status})`)
        const entries = (payload.transactions || []).map((x) => ({
          hash: x.hash, from: x.from, to: x.to, amt: x.amount, sym: x.sym || 'USDC',
          dir: x.from.toLowerCase() === w.a.toLowerCase() ? 'out' : 'in',
          chain: '0xaa36a7', st: x.status || 'Confirmed', ts: x.timestamp * 1000,
          nonce: Number(x.nonce), token: x.sym === 'SepoliaETH' ? undefined : { address: DEFAULT_TOKENS['0xaa36a7'][0].address, decimals: 6 }
        }))
        if (!dead) setHist((old) => {
          const byHash = new Map(old.map((x) => [x.hash, x]))
          entries.forEach((x) => { if (!byHash.has(x.hash)) byHash.set(x.hash, x) })
          const next = [...byHash.values()].sort((a,b) => (b.ts || 0) - (a.ts || 0))
          save('hist:' + w.a, next); histRef.current = next; return next
        })
      } catch (e) { if (!dead) toast('Etherscan history: ' + (e.message || 'request failed')) }
    })()
    return () => { dead = true }
  }, [w, tick])

  useEffect(() => { if (w && !NETS[w.chain]?.test) usdPrice(net.sym).then(setPrice); else setPrice(null) }, [w?.chain])
  useEffect(() => { if (w) w.p.getFeeData().then((f) => { const g = f.maxFeePerGas || f.gasPrice; setGas(g ? (+formatUnits(g, 'gwei')).toFixed(2) : null) }).catch(() => setGas(null)) }, [w, tick])

  const patch = (hash, p) => setHist((h) => { const n = h.map((x) => (x.hash === hash ? { ...x, ...p } : x)); save('hist:' + w.a, n); return n })
  const addTx = (e) => setHist((h) => { const n = [e, ...h]; save('hist:' + w.a, n); return n })
  useEffect(() => {
    if (!w) return
    hist.filter((x) => x.chain === w.chain && x.st === 'Pending').forEach((x) =>
      w.p.getTransactionReceipt(x.hash).then((r) => r && patch(x.hash, { st: r.status === 1 ? (x.note === 'Cancelling' ? 'Cancelled' : 'Confirmed') : 'Failed' })).catch(() => {}))
  }, [w, tick, hist.length])

  useEffect(() => {
    if (!w) return
    let dead = false, last = null, busy = false
    const key = (x) => x.hash + (x.dir || 'out') + x.sym
    const poll = async () => {
      if (busy) return
      busy = true
      try {
        const head = await w.p.getBlockNumber()
        if (dead) return
        setLive('on')
        if (last === null) last = head
        if (head > last) {
          const from = Math.max(last + 1, head - 19); last = head
          const [b, evs] = await Promise.all([w.p.getBalance(w.a), scanBlocks(w.p, w.a, from, head, w.chain)])
          if (dead) return
          const nb = formatEther(b)
          if (balRef.current !== nb) setFlash((f) => f + 1)
          setBal(nb)
          let got = 0
          for (const e of evs) {
            if (histRef.current.some((x) => key(x) === key(e))) continue
            const entry = { ...e, chain: w.chain, st: 'Confirmed' }
            histRef.current = [entry, ...histRef.current]; addTx(entry)
            if (e.dir === 'in') {
              got++; toast('Received ' + fmt(e.amt) + ' ' + e.sym)
              if (cfgRef.current.notify && document.hidden && window.Notification?.permission === 'granted') new Notification('Haven', { body: 'Received ' + fmt(e.amt) + ' ' + e.sym })
            }
          }
          if (got) setUnread((u) => u + got)
          if (evs.some((e) => e.token)) setTick((t) => t + 1)
          histRef.current.filter((x) => x.chain === w.chain && x.st === 'Pending').forEach((x) =>
            w.p.getTransactionReceipt(x.hash).then((r) => r && patch(x.hash, { st: r.status === 1 ? (x.note === 'Cancelling' ? 'Cancelled' : 'Confirmed') : 'Failed' })).catch(() => {}))
        }
      } catch { if (!dead) setLive('err') }
      finally { busy = false }
    }
    setLive('off'); poll()
    const iv = setInterval(poll, 4000)
    return () => { dead = true; clearInterval(iv) }
  }, [w])
  useEffect(() => { if (view === 'activity') setUnread(0) }, [view, unread])

  const replaceTx = async (x, cancel) => {
    if (w.mode !== 'local') return toast('Speed up and cancel need a local wallet')
    try {
      const r = x.raw, bump = (v) => (v ? (BigInt(v) * 125n) / 100n + 1n : undefined)
      const o = r.maxFeePerGas ? { maxFeePerGas: bump(r.maxFeePerGas), maxPriorityFeePerGas: bump(r.maxPriorityFeePerGas || '0') } : { gasPrice: bump(r.gasPrice) }
      const tx = await w.s.sendTransaction({ to: cancel ? w.a : r.to, value: cancel ? 0n : BigInt(r.value), data: cancel ? '0x' : r.data, gasLimit: cancel ? 21000n : BigInt(r.gasLimit), nonce: x.nonce, ...o })
      patch(x.hash, { hash: tx.hash, st: 'Pending', note: cancel ? 'Cancelling' : 'Sped up', raw: rawOf(tx) })
      setSelTx(null); toast(cancel ? 'Cancel request sent' : 'Speed-up sent')
      await tx.wait(); setTick((t) => t + 1)
    } catch (e) { toast('Could not replace: ' + (e.shortMessage || e.message).slice(0, 80)); setTick((t) => t + 1) }
  }

  const who = (a) => {
    if (!a) return '—'
    const i = accts ? accts.findIndex((x) => x.address.toLowerCase() === a.toLowerCase()) : -1
    if (i >= 0) return acctName(accts[i].address, i)
    const c = contacts.find((x) => x.address.toLowerCase() === a.toLowerCase())
    return c ? c.name : short(a)
  }
  const exportCsv = () => {
    const rows = hist.map((x) => [new Date(x.ts || 0).toISOString(), NETS[x.chain]?.name, x.dir === 'in' ? 'in' : 'out', x.sym, x.amt, x.from || w.a, x.to, x.st, x.hash].join(','))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([['time,network,direction,asset,amount,from,to,status,hash', ...rows].join('\n')], { type: 'text/csv' }))
    a.download = 'haven-activity.csv'; a.click(); URL.revokeObjectURL(a.href)
  }
  const copy = (v = w.a, m = 'Address copied') => { navigator.clipboard?.writeText(v); toast(m) }
  const refresh = () => setTick((t) => t + 1)
  const setHidList = (l) => { setHidS(l); save('hid:' + w.chain, l) }
  const chainHist = w ? hist.filter((x) => x.chain === w.chain && (filter === 'all' || (filter === 'in' && x.dir === 'in') || (filter === 'out' && x.dir !== 'in') || (filter === 'pending' && x.st === 'Pending'))) : []
  const shownRows = (rows || []).filter((t) => !(cfg.hideZero && +t.raw === 0))
  const hidTokens = tokens.filter((t) => hid.includes(t.address))
  const isCustom = (t) => custom.some((c) => c.address === t.address)
  const cur = w && (mode === 'local' ? acctName(w.a, idx) : 'Browser wallet')

  return (
    <>
      <main className={'app' + (w ? '' : ' solo')}>
        <header>
          <div className="logo"><Logo />Haven</div>
          {w && (
            <div className="acctwrap">
              <button className="pill" onClick={() => (mode === 'local' ? setMenu(!menu) : copy())}><span className="dot" />{cur}<span className="mono mute">{short(w.a)}</span></button>
              {menu && (
                <div className="menu">
                  {accts.map((a, i) => <button key={a.address} className={i === idx ? 'on' : ''} onClick={() => { setIdx(i); setMenu(false) }}>{acctName(a.address, i)}<small>{short(a.address)}</small></button>)}
                  <button onClick={() => { setView('accounts'); setMenu(false) }}>Manage accounts</button>
                </div>
              )}
            </div>
          )}
          <div className="hright">
            {w && <span className={'live ' + live} title="Live updates from the network"><i />Live</span>}
            {w && (
              <select aria-label="Network" value={NETS[w.chain] ? w.chain : ''} onChange={(e) => switchNet(e.target.value)}>
                {!NETS[w.chain] && <option value="">Unsupported</option>}
                {Object.entries(NETS).map(([id, n]) => <option key={id} value={id}>{n.name}</option>)}
              </select>
            )}
            {mode === 'local' && <button className="ib" onClick={lock} aria-label="Lock wallet"><Icon n="lock" /></button>}
            <button className="ib" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Switch light or dark theme"><Icon n={theme === 'dark' ? 'sun' : 'moon'} /></button>
          </div>
        </header>

        <div className="scroll" onClick={() => menu && setMenu(false)}>
          {!w && (view === 'onboard' || view === 'unlock') && (
            <div className="split-login">
              <aside className="brand">
                <Logo size={44} />
                <h1>Haven</h1>
                <p>A self-custody wallet that lives in your browser.</p>
                <ul>
                  <li><Icon n="shield" /><span><b>Your keys stay with you</b>Nothing is ever sent to a server.</span></li>
                  <li><Icon n="send" /><span><b>Instant sending</b>Log in with a private key and send without pop-ups.</span></li>
                  <li><Icon n="act" /><span><b>Live activity</b>Incoming funds appear the moment they are mined.</span></li>
                  <li><Icon n="globe" /><span><b>USDC on Sepolia</b>Focused testnet wallet with Etherscan-powered USDC history.</span></li>
                </ul>
              </aside>
              <div className="formside">
                {view === 'onboard'
                  ? <Onboard onLocal={onLocal} onInjected={connectInj} hasEth={!!eth} toast={toast} />
                  : <Unlock onUnlock={onLocal} onForget={forget} onInjected={connectInj} hasEth={!!eth} />}
              </div>
            </div>
          )}

          {w && view === 'home' && (
            <section className="view wide"><div className="home-grid"><div className="col">
              <div className="hero">
                <div className="mute">{cur} on {net.name}</div>
                <div className="bal flash" key={flash}>{cfg.hideBal ? '••••••' : fmt(bal) + ' ' + net.sym}</div>
                {!cfg.hideBal && price != null && <div className="mute">About ${fmt(+bal * price, 2)} USD at ${fmt(price, 2)} per {net.sym}</div>}
                <div className="mono addr" onClick={() => copy()} title="Copy address">{w.a} <Icon n="copy" s={14} /></div>
                <div className="btns">
                  <button className="pri" onClick={() => { setPre(null); setView('send') }}><Icon n="send" s={16} /> Send</button>
                  <button onClick={() => setView('receive')}><Icon n="recv" s={16} /> Receive</button>
                  <button className="ib" aria-label="Refresh" onClick={() => { refresh(); toast('Refreshed') }}><Icon n="refresh" s={16} /></button>
                  <button className="ib" aria-label="Hide or show balance" onClick={() => setCfg({ hideBal: !cfg.hideBal })}><Icon n={cfg.hideBal ? 'eye' : 'eyeoff'} s={16} /></button>
                </div>
                {gas && <div className="mute gas"><Icon n="gas" s={14} /> Network fee now: {gas} gwei</div>}
              </div>
              </div><div className="col">
              <h3>Assets</h3>
              <div className="list">
                {rows === null ? <div className="skel" /> : shownRows.map((t) => (
                  <div className="row click" key={t.address} onClick={() => setSelTok(t)}><div className="ico">{t.symbol.slice(0, 2)}</div><div className="grow"><b>{t.symbol}</b><span className="mute mono">{short(t.address)}</span></div><div className="r"><b>{cfg.hideBal ? '••••' : t.b}</b></div></div>
                ))}
              </div>
              {hidTokens.length > 0 && <button className="link left" onClick={() => setShowHid(!showHid)}>Hidden tokens ({hidTokens.length})</button>}
              {showHid && <div className="list">{hidTokens.map((t) => <div className="row" key={t.address}><div className="grow"><b>{t.symbol}</b></div><button onClick={() => setHidList(hid.filter((a) => a !== t.address))}>Show</button></div>)}</div>}
              <div className="inrow token-actions"><button onClick={() => setView('import-token')}><Icon n="plus" s={16} /> Add custom token</button>{w.chain === '0xaa36a7' && <a className="mute" href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia" target="_blank" rel="noopener noreferrer">Need test ETH? Open the Sepolia faucet</a>}</div>
              </div></div>
            </section>
          )}

          {w && view === 'activity' && (
            <section className="view">
              <div className="between"><h2>Activity</h2><button onClick={exportCsv}><Icon n="ext" s={16} /> Export CSV</button></div>
              <Seg v={filter} set={setFilter} opts={[['all', 'All'], ['in', 'Received'], ['out', 'Sent'], ['pending', 'Pending']]} />
              <div className="list">
                {chainHist.length === 0 && <div className="note">Nothing here yet. USDC transfers on Sepolia are indexed from Etherscan and shown here.</div>}
                {chainHist.map((x) => (
                  <div className="row click" key={x.hash + (x.dir || 'out') + x.sym} onClick={() => setSelTx(x)}>
                    <div className="ico"><Icon n={x.dir === 'in' ? 'recv' : 'send'} s={18} /></div>
                    <div className="grow"><b>{x.dir === 'in' ? 'Received' : 'Sent'} {x.sym}</b><span className="mute">{x.dir === 'in' ? 'from ' + who(x.from) : 'to ' + who(x.to)}{x.note ? ' · ' + x.note : ''}</span></div>
                    <div className="r"><b>{x.dir === 'in' ? '+' : '-'}{x.amt}</b><span className={'badge ' + x.st.toLowerCase()}>{x.st}</span></div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {w && view === 'send' && <Send {...{ w, net, tokens, rows, bal, cfg, setCfg, contacts, toast, addTx, patch, refresh, pre }} go={setView} />}
          {w && view === 'receive' && <Receive w={w} net={net} go={setView} toast={toast} />}\n          {w && view === 'import-token' && <ImportToken w={w} go={setView} toast={toast} custom={custom} setCustom={setCustom} />}
          
          {w && view === 'accounts' && <Accounts {...{ w, sym: net.sym, mode, accts, idx, setIdx, names, setNames, imported, addDerived, importKey, removeAcct, toast }} canDerive={!!accts?.[0]?.mnemonic} />}
          {w && view === 'networks' && <Networks {...{ w, mode, cfg, setCfg, switchNet, bump, toast }} />}
          {w && view === 'settings' && <Settings {...{ w, cfg, setCfg, lock, forget, disconnect, contacts, setContacts, toast }} />}
        </div>

        {w && (
          <nav className="side">
            {NAV.map(([k, l, i]) => <button key={k} className={view === k ? 'on' : ''} onClick={() => setView(k)}><Icon n={i} />{l}{k === 'activity' && unread > 0 && <span className="count">{unread}</span>}</button>)}
          </nav>
        )}

        <Sheet open={!!selTok} onClose={() => setSelTok(null)}>
          {selTok && <>
            <h2>{selTok.symbol}</h2>
            <div className="kv"><span>Balance</span><b>{selTok.b}</b><span>Contract</span><b className="mono">{short(selTok.address)}</b><span>Decimals</span><b>{selTok.decimals}</b></div>
            <div className="inrow">
              <button className="pri" onClick={() => { setPre(selTok.address); setView('send'); setSelTok(null) }}><Icon n="send" s={16} /> Send</button>
              <button onClick={() => copy(selTok.address, 'Contract copied')}><Icon n="copy" s={16} /> Copy</button>
              {net.scan && <a className="btnlink" href={`${net.scan}/token/${selTok.address}`} target="_blank" rel="noopener noreferrer"><Icon n="ext" s={16} /> Explorer</a>}
            </div>
            <div className="inrow">
              <button onClick={() => { setHidList([...hid, selTok.address]); setSelTok(null) }}>Hide token</button>
              {isCustom(selTok) && <button className="danger" onClick={() => { const l = custom.filter((c) => c.address !== selTok.address); setCustom(l); save('tok:' + w.chain, l); setSelTok(null) }}>Remove token</button>}
            </div>
          </>}
        </Sheet>

        <Sheet open={!!selTx} onClose={() => setSelTx(null)}>
          {selTx && <>
            <h2>Transaction</h2>
            <div className="kv">
              <span>Status</span><b><span className={'badge ' + selTx.st.toLowerCase()}>{selTx.st}</span></b>
              <span>Amount</span><b>{selTx.amt} {selTx.sym}</b>
              <span>{selTx.dir === 'in' ? 'From' : 'To'}</span><b className="mono">{short(selTx.dir === 'in' ? selTx.from : selTx.to)}</b>
              <span>Nonce</span><b>{selTx.nonce ?? '—'}</b>
              <span>Network</span><b>{NETS[selTx.chain]?.name}</b>
              {selTx.ts && <><span>Time</span><b>{new Date(selTx.ts).toLocaleString()}</b></>}
              <span>Hash</span><b className="mono">{short(selTx.hash)}</b>
            </div>
            <div className="inrow">
              <button onClick={() => copy(selTx.hash, 'Hash copied')}><Icon n="copy" s={16} /> Copy hash</button>
              {NETS[selTx.chain]?.scan && <a className="btnlink" href={`${NETS[selTx.chain].scan}/tx/${selTx.hash}`} target="_blank" rel="noopener noreferrer"><Icon n="ext" s={16} /> Explorer</a>}
            </div>
            {selTx.token && !allTokens.some((t) => t.address.toLowerCase() === selTx.token.address.toLowerCase()) && <button onClick={() => { const l = [...custom, { address: selTx.token.address, symbol: selTx.sym, decimals: selTx.token.decimals }]; setCustom(l); save('tok:' + w.chain, l); setSelTx(null); toast(selTx.sym + ' added to assets') }}><Icon n="plus" s={16} /> Add {selTx.sym} to assets</button>}
            {selTx.st === 'Pending' && selTx.raw && <div className="inrow"><button className="pri" onClick={() => replaceTx(selTx, false)}>Speed up</button><button className="danger" onClick={() => replaceTx(selTx, true)}>Cancel</button></div>}
          </>}
        </Sheet>
      </main>
      <div className={'toast' + (msg ? ' on' : '')} role="status">{msg}</div>
    </>
  )
}
