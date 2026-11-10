import { useEffect, useRef, useState } from 'react'

export default function QrScanner({ onResult, onClose }) {
  const video = useRef(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let stream, timer, stopped = false
    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setError('Camera scanning requires HTTPS and browser camera support.'); return }
      if (!('BarcodeDetector' in window)) { setError('QR scanning is not supported by this browser. Please enter the address manually.'); return }
      try {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (stopped) return stream.getTracks().forEach(track => track.stop())
        video.current.srcObject = stream
        await video.current.play()
        const scan = async () => {
          if (stopped) return
          try {
            const codes = await detector.detect(video.current)
            if (codes[0]?.rawValue) { onResult(codes[0].rawValue); return }
          } catch {}
          timer = setTimeout(scan, 250)
        }
        scan()
      } catch (e) { setError(e.message || 'Could not start the camera. Check camera permission.') }
    }
    start()
    return () => { stopped = true; clearTimeout(timer); stream?.getTracks().forEach(track => track.stop()) }
  }, [onResult])
  return <div className="shade" role="dialog" aria-modal="true"><div className="sheet"><h2>Scan QR code</h2><video ref={video} muted playsInline style={{ width: '100%', maxHeight: 360, background: '#111', borderRadius: 10 }} />{error && <div className="note warn">{error}</div>}<p className="mute">Point your camera at a Sepolia payment QR code.</p><button onClick={onClose}>Close scanner</button></div></div>
}
