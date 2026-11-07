import { useState } from 'react'
import { Wallet, HDNodeWallet, Mnemonic } from 'ethers'
import { createVault, unlockVault, deriveAccounts, getVault } from './wallet.js'
import { Progress, Icon, Logo } from './ui.jsx'
import { enableBiometricSession, hasBiometricSession, unlockWithBiometrics } from './biometric.js'

export function Onboard({ onLocal, onInjected, hasEth, toast }) {
  const [step, setStep] = useState('choose')
  const [pw, setPw] = useState(''), [pw2, setPw2] = useState(''), [secret, setSecret] = useState('')
  const [fresh, setFresh] = useState(null), [ok, setOk] = useState(false), [p, setP] = useState(null), [pk, setPk] = useState(''), [remember, setRemember] = useState(false)
  const pwOk = () => (pw.length >= 8 && pw === pw2) || (toast('Passwords must match and be at least 8 characters'), false)
  const finish = async (wal) => {
    setP(0)
    try { await createVault(wal, pw, setP); if (remember) { try { await enableBiometricSession({ kind: 'vault', password: pw }) } catch (e) { toast('Wallet saved; biometric login unavailable: ' + e.message) } } onLocal([wal]) } catch { toast('Could not encrypt the wallet'); setP(null) }
  }
  const create = () => { if (pwOk()) { setFresh(Wallet.createRandom()); setStep('phrase') } }
  const loginPk = async () => {
    const s = pk.trim()
    if (!/^(0x)?[0-9a-fA-F]{64}$/.test(s)) return toast('Enter a valid 64-character private key')
    try { const privateKey = s.startsWith('0x') ? s : '0x' + s; if (remember) { try { await enableBiometricSession({ kind: 'privateKey', privateKey }) } catch (e) { toast('Biometric login unavailable: ' + e.message) } } onLocal([new Wallet(privateKey)]) } catch { toast('Invalid private key') }
  }
  const doImport = () => {
    if (!pwOk()) return
    const s = secret.trim(), phrase = s.toLowerCase().replace(/\s+/g, ' ')
    let wal
    try {
      if (Mnemonic.isValidMnemonic(phrase)) wal = HDNodeWallet.fromPhrase(phrase)
      else if (/^(0x)?[0-9a-fA-F]{64}$/.test(s)) wal = new Wallet(s.startsWith('0x') ? s : '0x' + s)
      else return toast('Enter a 12 or 24 word phrase, or a 64-character private key')
    } catch { return toast('That secret is not valid') }
    finish(wal)
  }

  if (p !== null) return (
    <section className="view on mid"><Logo size={60} /><h2>Encrypting your wallet</h2>
      <p className="mute">Your key is locked with your password and stored only in this browser.</p><Progress p={p} /></section>
  )
  const pwFields = (
    <>
      <div><label>Password</label><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" /></div>
      <div><label>Confirm password</label><input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
    </>
  )
  if (step === 'choose') return (
    <section className="view on mid">
      <Logo size={60} />
      <h1>Your keys. Your funds.</h1>
      <p className="mute">Choose how you want to access your wallet.</p>
      <button className="sec auth-choice" onClick={() => setStep('pk')}><span className="auth-choice__inner"><Icon n="key" /><span>Login with private key</span></span></button>
      <button className="sec auth-choice" onClick={() => setStep('create')}><span className="auth-choice__inner"><Icon n="plus" /><span>Create new wallet</span></span></button>
      <button className="sec auth-choice" onClick={() => setStep('import')}><span className="auth-choice__inner"><Icon n="shield" /><span>Import and encrypt with password</span></span></button>
      <button className="link" disabled={!hasEth} onClick={onInjected}>{hasEth ? 'Connect browser wallet instead' : 'No browser wallet detected'}</button>
    </section>
  )
  if (step === 'pk') return (
    <section className="view on"><button className="back" onClick={() => setStep('choose')}><Icon n="back" s={16} /> Back</button><h2>Login with private key</h2>
      <div><label>Private key</label><input type="password" autoComplete="off" value={pk} onChange={(e) => setPk(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loginPk()} placeholder="0x…" /></div>
      <div className="note warn">Without biometric login, the key stays in this tab’s memory only. If enabled, it is encrypted locally using this device’s WebAuthn credential; it is never sent to a server.</div>
      <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Enable biometric login on this device</label>
      <button className="pri" onClick={loginPk}>Login</button></section>
  )
  if (step === 'create') return (
    <section className="view on"><button className="back" onClick={() => setStep('choose')}><Icon n="back" s={16} /> Back</button><h2>Create a password</h2>
      <p className="mute">It encrypts your wallet on this device. It can’t be reset, so keep it safe.</p>{pwFields}
      <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Enable biometric quick login</label>
      <button className="pri" onClick={create}>Continue</button></section>
  )
  if (step === 'phrase') return (
    <section className="view on"><h2>Your recovery phrase</h2>
      <p className="mute">Write these words down in order. Anyone with them controls your funds, and they are the only way to recover this wallet.</p>
      <div className="phrase">{fresh.mnemonic.phrase.split(' ').map((w, i) => <span key={i}><em>{i + 1}</em>{w}</span>)}</div>
      <label className="check"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> I wrote it down somewhere safe</label>
      <button className="pri" disabled={!ok} onClick={() => finish(fresh)}>Encrypt and open wallet</button></section>
  )
  return (
    <section className="view on"><button className="back" onClick={() => setStep('choose')}><Icon n="back" s={16} /> Back</button><h2>Import wallet</h2>
      <div><label>Recovery phrase or private key</label><textarea rows="3" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="word1 word2 … or 0x…" /></div>
      <div className="note warn">Prefer a fresh wallet funded with small amounts or testnet coins. Never import a key that holds large savings into any website.</div>
      {pwFields}<label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Enable biometric quick login</label><button className="pri" onClick={doImport}>Import and encrypt</button></section>
  )
}

export function Unlock({ onUnlock, onForget, onInjected, hasEth }) {
  const [pw, setPw] = useState(''), [p, setP] = useState(null), [err, setErr] = useState(''), [remember, setRemember] = useState(false), [busy, setBusy] = useState(false)
  const finishPayload = async (payload) => {
    if (payload.kind === 'vault') {
      const root = await unlockVault(payload.password, setP)
      onUnlock(deriveAccounts(root, getVault().count))
    } else if (payload.kind === 'privateKey') {
      onUnlock([new Wallet(payload.privateKey)])
    } else {
      throw new Error('Saved biometric session is invalid')
    }
  }
  const go = async () => {
    setErr(''); setP(0)
    try {
      const root = await unlockVault(pw, setP)
      if (remember) {
        try { await enableBiometricSession({ kind: 'vault', password: pw }) }
        catch (e) { setErr('Wallet unlocked, but biometric login could not be enabled: ' + e.message) }
      }
      onUnlock(deriveAccounts(root, getVault().count))
    } catch { setErr('Wrong password. Try again.'); setP(null) }
  }
  const biometric = async () => {
    setErr(''); setBusy(true)
    try { await finishPayload(await unlockWithBiometrics()) }
    catch (e) { setErr(e.message || 'Biometric verification failed') }
    finally { setBusy(false); setP(null) }
  }
  return (
    <section className="view on mid">
      <Logo size={60} /><h1>Welcome back</h1>
      {hasBiometricSession() && <button className="pri" disabled={busy} onClick={biometric}><Icon n="shield" /> {busy ? 'Verifying…' : 'Unlock with biometrics'}</button>}
      <p className="mute">Or unlock with your wallet password.</p>
      <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} placeholder="Password" />
      {err && <div className="note warn">{err}</div>}
      {p !== null ? <Progress p={p} /> : <button className="pri" onClick={go}>Unlock</button>}
      <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Enable biometric quick login on this device</label>
      {hasEth && <button className="sec" onClick={onInjected}>Use browser wallet instead</button>}
      <button className="link" onClick={onForget}>Forget this wallet</button>
    </section>
  )
}
