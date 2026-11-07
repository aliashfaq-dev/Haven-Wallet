import { useState } from 'react'
import { isAddress, getAddress } from 'ethers'
import { unlockVault, getVault, save, short, hasSecPw, checkPw, setSecPw } from './wallet.js'
import { Toggle } from './ui.jsx'

export default function Settings({ w, cfg, setCfg, lock, forget, disconnect, contacts, setContacts, toast }) {
  const local = w.mode === 'local'
  const [pw, setPw] = useState(''), [secret, setSecret] = useState(null), [busy, setBusy] = useState(false)
  const [nm, setNm] = useState(''), [ad, setAd] = useState(''), [msg, setMsg] = useState(''), [sig, setSig] = useState('')
  const [rpc, setRpc] = useState(cfg.rpc[w.chain] || '')

  const reveal = async () => {
    setBusy(true)
    try { const x = await unlockVault(pw); setSecret(x.mnemonic?.phrase || x.privateKey) } catch { toast('Wrong password') }
    setBusy(false); setPw('')
  }
  const addContact = () => {
    if (!nm || !isAddress(ad)) return toast('Enter a name and a valid address')
    const l = [...contacts, { name: nm, address: getAddress(ad) }]; setContacts(l); save('orbit:contacts', l); setNm(''); setAd('')
  }
  const delContact = (a) => { const l = contacts.filter((c) => c.address !== a); setContacts(l); save('orbit:contacts', l) }
  const [td, setTd] = useState('')
  const signTyped = async () => { try { const j = JSON.parse(td); setSig(await w.s.signTypedData(j.domain, j.types, j.message ?? j.value)) } catch { toast('Invalid typed data, or signing was rejected') } }
  const sign = async () => {
    if (!msg) return toast('Enter a message to sign')
    try { setSig(await w.s.signMessage(msg)) } catch { toast('Signature rejected') }
  }

  return (
    <section className="view cols">
      <h2>Settings</h2>
      {local && (
        <>
          <div className="group"><h3>Security</h3>
            <div className="split"><span>Skip send review<br /><small className="mute">Send in one tap, no confirmation sheet</small></span><Toggle on={cfg.quick} set={(v) => setCfg({ quick: v })} /></div>
            <div className="split"><span>Hide balances</span><Toggle on={!!cfg.hideBal} set={(v) => setCfg({ hideBal: v })} /></div>
            <div className="split"><span>Hide zero-balance tokens</span><Toggle on={!!cfg.hideZero} set={(v) => setCfg({ hideZero: v })} /></div>
            <div className="split"><span>Auto-lock</span>
              <select value={cfg.lock} onChange={(e) => setCfg({ lock: +e.target.value })}>
                <option value={5}>5 min</option><option value={15}>15 min</option><option value={30}>30 min</option><option value={0}>Never</option></select></div>
            <div className="split"><span>Desktop notifications<br /><small className="mute">Alert me about incoming funds when this tab is in the background</small></span><Toggle on={!!cfg.notify} set={async (v) => { if (v && 'Notification' in window) { const p = await Notification.requestPermission(); if (p !== 'granted') return toast('Notifications are blocked in this browser') } setCfg({ notify: v }) }} /></div>
            {getVault() && <div><label>Show recovery phrase or private key</label>
              {secret ? (<><div className="note warn">{secret}</div><div className="inrow"><button onClick={() => { navigator.clipboard?.writeText(secret); toast('Copied') }}>Copy</button><button onClick={() => setSecret(null)}>Hide</button></div></>)
                : (<div className="inrow"><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" /><button disabled={busy || !pw} onClick={reveal}>{busy ? '…' : 'Reveal'}</button></div>)}</div>}
          </div>
        </>
      )}
      {local && !getVault() && <SecPw toast={toast} />}
      <div className="group"><h3>Contacts</h3>
        {contacts.map((c) => <div className="split" key={c.address}><span>{c.name}<br /><small className="mute">{short(c.address)}</small></span><button onClick={() => delContact(c.address)}>Remove</button></div>)}
        <input value={nm} onChange={(e) => setNm(e.target.value)} placeholder="Name" />
        <div className="inrow"><input value={ad} onChange={(e) => setAd(e.target.value)} placeholder="0x…" /><button onClick={addContact}>Add</button></div></div>
      <div className="group"><h3>Sign message</h3>
        <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Prove you own this account" />
        <button onClick={sign}>Sign message</button>
        <textarea rows="3" value={td} onChange={(e) => setTd(e.target.value)} placeholder='Typed data (EIP-712) JSON: {"domain":{},"types":{},"message":{}}' />
        <button onClick={signTyped}>Sign typed data</button>{sig && <div className="note mono">{sig}</div>}</div>
      <div className="group"><h3>Session</h3>
        {local ? (<><button onClick={lock}>{getVault() ? 'Lock wallet now' : 'Log out'}</button>{getVault() && <button className="danger" onClick={forget}>Remove wallet from this browser</button>}</>)
          : <button onClick={disconnect}>Disconnect</button>}</div>
    </section>
  )
}

function SecPw({ toast }) {
  const [old, setOld] = useState(''), [a, setA] = useState(''), [b, setB] = useState(''), [busy, setBusy] = useState(false)
  const has = hasSecPw()
  const go = async () => {
    if (a.length < 8 || a !== b) return toast('New passwords must match and be at least 8 characters')
    setBusy(true)
    try {
      if (has && !(await checkPw(old))) return toast('Current password is wrong')
      await setSecPw(a); setOld(''); setA(''); setB(''); toast('Security password saved')
    } catch { toast('Could not save the password in this browser') } finally { setBusy(false) }
  }
  return (
    <div className="group"><h3>Security password</h3>
      <p className="mute">Needed before a private key is shown. {has ? 'Change it here.' : 'Set one now.'}</p>
      {has && <input type="password" value={old} onChange={(e) => setOld(e.target.value)} placeholder="Current password" />}
      <input type="password" value={a} onChange={(e) => setA(e.target.value)} placeholder="New password" />
      <input type="password" value={b} onChange={(e) => setB(e.target.value)} placeholder="Confirm new password" />
      <button disabled={busy} onClick={go}>{busy ? 'Saving…' : has ? 'Change password' : 'Set password'}</button>
    </div>
  )
}
