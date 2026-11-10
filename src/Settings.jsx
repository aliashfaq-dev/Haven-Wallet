import { useState } from 'react'
import { isAddress, getAddress } from 'ethers'
import { unlockVault, getVault, save, short, changeVaultPassword } from './wallet.js'
import { Toggle } from './ui.jsx'

export default function Settings({ w, cfg, setCfg, lock, forget, disconnect, contacts, setContacts, toast }) {
  const local = w.mode === 'local'
  const [pw, setPw] = useState(''), [secret, setSecret] = useState(null), [busy, setBusy] = useState(false)
  const [currentPw, setCurrentPw] = useState(''), [newPw, setNewPw] = useState(''), [confirmPw, setConfirmPw] = useState('')
  const [nm, setNm] = useState(''), [ad, setAd] = useState(''), [msg, setMsg] = useState(''), [sig, setSig] = useState('')
  const [rpc, setRpc] = useState(cfg.rpc[w.chain] || '')

  const reveal = async () => {
    setBusy(true)
    try { const x = await unlockVault(pw); setSecret(x.mnemonic?.phrase || x.privateKey) } catch { toast('Wrong password') }
    setBusy(false); setPw('')
  }
  const changePassword = async () => {
    if (newPw.length < 8 || newPw !== confirmPw) return toast('New passwords must match and be at least 8 characters')
    setBusy(true)
    try { await changeVaultPassword(currentPw, newPw); setCurrentPw(''); setNewPw(''); setConfirmPw(''); toast('Wallet password changed. Imported accounts were re-encrypted too.') }
    catch (e) { toast('Could not change wallet password: ' + (e.message || 'error')) }
    finally { setBusy(false) }
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
            <div className="setting-toggle"><span>Skip send review<br /><small className="mute">Send in one tap, no confirmation sheet</small></span><Toggle on={cfg.quick} set={(v) => setCfg({ quick: v })} /></div>
            <div className="setting-toggle"><span>Hide balances</span><Toggle on={!!cfg.hideBal} set={(v) => setCfg({ hideBal: v })} /></div>
            <div className="setting-toggle"><span>Hide zero-balance tokens</span><Toggle on={!!cfg.hideZero} set={(v) => setCfg({ hideZero: v })} /></div>
            <div className="split"><span>Auto-lock</span>
              <select value={cfg.lock} onChange={(e) => setCfg({ lock: +e.target.value })}>
                <option value={5}>5 min</option><option value={15}>15 min</option><option value={30}>30 min</option><option value={0}>Never</option></select></div>
            <div className="setting-toggle"><span>Desktop notifications<br /><small className="mute">Alert me about incoming funds when this tab is in the background</small></span><Toggle on={!!cfg.notify} set={async (v) => { if (v && 'Notification' in window) { const p = await Notification.requestPermission(); if (p !== 'granted') return toast('Notifications are blocked in this browser') } setCfg({ notify: v }) }} /></div>
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
      {local && getVault() && <div className="group"><h3>Change wallet password</h3>
        <p className="mute">Use your current wallet password, then choose a new one. Saved imported accounts are re-encrypted automatically.</p>
        <input type="password" autoComplete="current-password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Current wallet password" />
        <input type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="New wallet password (8+ characters)" />
        <input type="password" autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Confirm new wallet password" />
        <button className="pri" disabled={busy || !currentPw || !newPw || !confirmPw} onClick={changePassword}>{busy ? 'Changing…' : 'Change wallet password'}</button>
      </div>}
      <div className="group"><h3>Session</h3>
        {local ? (<><button onClick={lock}>{getVault() ? 'Lock wallet now' : 'Log out'}</button>{getVault() && <button className="danger" onClick={forget}>Remove wallet from this browser</button>}</>)
          : <button onClick={disconnect}>Disconnect</button>}</div>
    </section>
  )
}

