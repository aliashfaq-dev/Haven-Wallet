import { useState } from 'react'
import { getVault, checkPw } from './wallet.js'
import { Sheet } from './ui.jsx'

/** Asks for the password before a sensitive action. Creates a security password the first time if the session has none. */
export default function Gate({ open, onClose, onPass, toast, why }) {
  const [pw, setPw] = useState(''), [pw2, setPw2] = useState(''), [busy, setBusy] = useState(false)
  const need = !getVault()
  const go = async () => {
    setBusy(true)
    try {
      if (need) {
        toast('This session has no wallet password. Import or create an encrypted wallet to reveal private keys.')
        return
      }
      if (!(await checkPw(pw))) { toast('Wrong wallet password'); setPw(''); return }
      const acceptedPassword = pw; setPw(''); setPw2(''); onPass(acceptedPassword)
    } catch { toast('Could not verify the password in this browser') }
    finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose}>
      <h2>{need ? 'Wallet password required' : 'Enter your wallet password'}</h2>
      <p className="mute">{need ? 'This session was opened with a private key and has no encrypted wallet password. Import or create a password-protected wallet to use this action.' : why}</p>
      <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !need && go()} placeholder="Wallet password" />
      
      <button className="pri" disabled={busy || !pw} onClick={go}>{busy ? 'Verifying…' : 'Continue'}</button>
    </Sheet>
  )
}
