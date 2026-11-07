import { useEffect, useRef, useState } from 'react'

export function CountUp({ to, sym }) {
  const [v, setV] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const t0 = performance.now(), a = from.current
    let raf
    const f = (t) => {
      const p = Math.min(1, (t - t0) / 800)
      setV(a + (to - a) * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(f); else from.current = to
    }
    raf = requestAnimationFrame(f)
    return () => cancelAnimationFrame(raf)
  }, [to])
  return <>{v.toFixed(4)} {sym}</>
}
export const Toggle = ({ on, set }) => <button role="switch" aria-checked={on} className={'tg' + (on ? ' on' : '')} onClick={() => set(!on)}><i /></button>
export const Seg = ({ v, opts, set }) => <div className="seg">{opts.map(([k, l]) => <button key={k} className={v === k ? 'on' : ''} onClick={() => set(k)}>{l}</button>)}</div>
export const Progress = ({ p }) => <div className="prog"><i style={{ width: Math.round(p * 100) + '%' }} /></div>
export function Sheet({ open, onClose, children }) {
  if (!open) return null
  return <div className="shade" onClick={onClose}><div className="sheet" onClick={(e) => e.stopPropagation()}>{children}</div></div>
}
const P = {
  home: <><path d="M4 11l8-7 8 7" /><path d="M6 10v10h12V10" /></>,
  act: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  set: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>,
  send: <><path d="M7 17L17 7" /><path d="M8 7h9v9" /></>,
  recv: <><path d="M17 7L7 17" /><path d="M16 17H7V8" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  refresh: <><path d="M20 11a8 8 0 10-2.3 5.7" /><path d="M20 4v7h-7" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" /></>,
  moon: <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" />,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M16 7l3 3" /></>,
  eth: <><path d="M12 2l7 10-7 4-7-4z" /><path d="M12 22l7-8-7 4-7-4z" /></>,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  wallet: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M3 9V6a2 2 0 012-2h12v3M16 13.5h2" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" /><path d="M16 4.5a3.5 3.5 0 010 7M18 14c2.2.7 3.5 2.6 3.5 5" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeoff: <><path d="M3 3l18 18" /><path d="M10.6 6.1A9.7 9.7 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4M6.5 7.5C3.7 9.2 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1" /></>,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  edit: <path d="M4 20l4-1 11-11-3-3L5 16z" />,
  ext: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5H5V6h5" /></>,
  gas: <path d="M5 20V5a1 1 0 011-1h8a1 1 0 011 1v15M4 20h12M15 10h2a2 2 0 012 2v4a1.5 1.5 0 003 0V9l-3-3" />,
}
export const Icon = ({ n, s = 20 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[n]}</svg>
export const Back = ({ go }) => <button className="back" onClick={() => go('home')}><Icon n="back" s={16} /> Back</button>
export const Logo = ({ size = 28 }) => <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="var(--accent)" /><path d="M10 9v14M22 9v14M10 16h12" stroke="var(--accent-ink)" strokeWidth="3" strokeLinecap="round" /></svg>
