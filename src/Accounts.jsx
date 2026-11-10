import { useState, useEffect } from 'react'
import { formatEther } from 'ethers'
import { save } from './wallet.js'
import { Icon, Sheet } from './ui.jsx'
import Gate from './Gate.jsx'

export default function Accounts({ w, sym, mode, accts, idx, setIdx, names, setNames, imported, canDerive, addDerived, importKey, removeAcct, toast }) {
  const [bals, setBals] = useState({}), [edit, setEdit] = useState(null), [nm, setNm] = useState('')
  const [pk, setPk] = useState(''), [keyOf, setKeyOf] = useState(null), [ack, setAck] = useState(false), [gate, setGate] = useState(null), [importGate, setImportGate] = useState(false)
  useEffect(() => {
    if (mode === 'local') accts.forEach((a) => w.p.getBalance(a.address).then((b) => setBals((x) => ({ ...x, [a.address]: formatEther(b) }))).catch(() => {}))
  }, [accts, w.p, mode])
  useEffect(() => { if (keyOf === null) return; const t = setTimeout(() => { setKeyOf(null); setAck(false) }, 30000); return () => clearTimeout(t) }, [keyOf])
  if (mode !== 'local') return <section className="view"><h2>Accounts</h2><div className="note">You are connected through a browser wallet, which manages its own accounts. Log in with a private key to manage accounts here.</div></section>
  const rename = (a) => { const n = { ...names, [a]: nm.trim() }; setNames(n); save('orbit:names', n); setEdit(null) }
  return (
    <section className="view">
      <h2>Accounts</h2>
      <div className="list">
        {accts.map((a, i) => (
          <div className={'row' + (i === idx ? ' active' : '')} key={a.address}>
            <div className="ico">{i + 1}</div>
            <div className="grow" onClick={() => setIdx(i)}>
              {edit === a.address
                ? <div className="inrow" onClick={(e) => e.stopPropagation()}><input autoFocus value={nm} onChange={(e) => setNm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && rename(a.address)} /><button onClick={() => rename(a.address)}>Save</button></div>
                : <><b>{names[a.address] || 'Account ' + (i + 1)}{i === idx && <span className="tag">Active</span>}{imported.includes(a.address) && <span className="tag">Imported</span>}</b>
                    <span className="mono mute">{a.address}</span>
                    <span className="mute">{bals[a.address] !== undefined ? Number(bals[a.address]).toFixed(4) + ' ' + (sym || '') : '…'}</span></>}
            </div>
            <div className="inrow">
              <button className="ib" aria-label="Rename" onClick={() => { setEdit(a.address); setNm(names[a.address] || '') }}><Icon n="edit" s={16} /></button>
              <button className="ib" aria-label="Show private key" onClick={() => setGate(i)}><Icon n="key" s={16} /></button>
              {imported.includes(a.address) && <button className="ib" aria-label="Remove account" onClick={() => removeAcct(i)}><Icon n="trash" s={16} /></button>}
            </div>
          </div>
        ))}
      </div>
      {canDerive && <button onClick={addDerived}><Icon n="plus" s={16} /> Create new account</button>}
      <div className="group"><h3>Import account</h3>
        <p className="mute">Imported accounts are encrypted with your wallet password and restored whenever you unlock this wallet.</p>
        <div className="inrow"><input type="password" autoComplete="off" value={pk} onChange={(e) => setPk(e.target.value)} placeholder="Private key" /><button disabled={!pk.trim()} onClick={() => setImportGate(true)}>Import and save</button></div></div>
      <Gate open={importGate} onClose={() => setImportGate(false)} toast={toast} why="Confirm your wallet password to encrypt and save this account." onPass={async (password) => { const ok = await importKey(pk, password); if (ok) setPk(''); setImportGate(false) }} />
      <Gate open={gate !== null} onClose={() => setGate(null)} toast={toast} why="Enter your password to view this private key." onPass={() => { setKeyOf(gate); setGate(null); setAck(false) }} />
      <Sheet open={keyOf !== null} onClose={() => { setKeyOf(null); setAck(false) }}>
        {keyOf !== null && <>
          <h2>Private key</h2>
          <div className="note warn">Anyone who has this key can take everything in this account. Never share it. It hides itself after 30 seconds.</div>
          <label className="check"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I understand the risk</label>
          {ack && <><div className="note mono">{accts[keyOf].privateKey}</div><button onClick={() => { navigator.clipboard?.writeText(accts[keyOf].privateKey); toast('Copied') }}>Copy key</button></>}
        </>}
      </Sheet>
    </section>
  )
}
