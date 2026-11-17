import { useState } from 'react'
import { getVault, checkPw } from './wallet.js'
import { Sheet } from './ui.jsx'

/** Asks for the password before a sensitive action. Creates a security password the first time if the session has none. */
export default function Gate({ open, onClose, onPass, toast, why, allowCreate = false }) {
  const [pw, setPw] = useState(''), [pw2, setPw2] = useState(''), [busy, setBusy] = useState(false)
  const need = !getVault()
  const go = async () => {
    setBusy(true)
    try {
      if (need && allowCreate) {
        if (pw.length < 8 || pw !== pw2) { toast('Set matching passwords with at least 8 characters'); return }
        const acceptedPassword = pw; setPw(''); setPw2(''); onPass(acceptedPassword)
        return
      }
      if (need) { toast('This wallet has no password yet. Use the add-account flow to set one.'); return }
      if (!(await checkPw(pw))) { toast('Wrong wallet password'); setPw(''); return }
      const acceptedPassword = pw; setPw(''); setPw2(''); onPass(acceptedPassword)
    } catch { toast('Could not verify the password in this browser') }
    finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose}>
      <h2>{need && allowCreate ? 'Create wallet password' : 'Enter your wallet password'}</h2>
      <p className="mute">{need && allowCreate ? 'Create a password now. This will encrypt your current wallet and the new account.' : need ? 'This wallet has no password yet. Use the add-account flow to create one.' : why}</p>
      <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !need && go()} placeholder={need && allowCreate ? "New wallet password (8+ characters)" : "Wallet password"} />
      {need && allowCreate && <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Confirm new wallet password" />}
      <button className="pri" disabled={busy || !pw || (need && allowCreate && !pw2)} onClick={go}>{busy ? 'Please wait…' : need && allowCreate ? 'Set password and continue' : 'Continue'}</button>
    </Sheet>
  )
}
