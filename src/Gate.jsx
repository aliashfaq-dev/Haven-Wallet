import { useState } from 'react'
import { getVault, hasSecPw, setSecPw, checkPw } from './wallet.js'
import { Sheet } from './ui.jsx'

/** Asks for the password before a sensitive action. Creates a security password the first time if the session has none. */
export default function Gate({ open, onClose, onPass, toast, why }) {
  const [pw, setPw] = useState(''), [pw2, setPw2] = useState(''), [busy, setBusy] = useState(false)
  const need = !getVault() && !hasSecPw()
  const go = async () => {
    setBusy(true)
    try {
      if (need) {
        if (pw.length < 8 || pw !== pw2) { toast('Passwords must match and be at least 8 characters'); return }
        await setSecPw(pw)
      } else if (!(await checkPw(pw))) { toast('Wrong password'); setPw(''); return }
      setPw(''); setPw2(''); onPass()
    } catch { toast('Could not verify the password in this browser') }
    finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose}>
      <h2>{need ? 'Create a security password' : 'Enter your password'}</h2>
      <p className="mute">{need ? 'You have not set a password for this session yet. Create one now. You will need it each time you view a private key. ' : ''}{why}</p>
      <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !need && go()} placeholder={need ? 'New password (8+ characters)' : 'Password'} />
      {need && <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Confirm password" />}
      <button className="pri" disabled={busy || !pw} onClick={go}>{busy ? 'Verifying…' : need ? 'Save and continue' : 'Continue'}</button>
    </Sheet>
  )
}
