import { useEffect, useRef, useState } from 'react'

export default function QrScanner({ onResult, onClose }) {
  const video = useRef(null)
  const onResultRef = useRef(onResult)
  const [error, setError] = useState('')
  // Keep the latest handler without restarting the camera on every parent render.
  onResultRef.current = onResult

  useEffect(() => {
    let stream, timer, stopped = false, detecting = false
    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError('Camera scanning requires HTTPS and browser camera support.')
        return
      }
      if (!('BarcodeDetector' in window)) {
        setError('QR scanning is not supported by this browser. Please enter the address manually.')
        return
      }
      try {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        })
        if (stopped) {
          stream.getTracks().forEach(track => track.stop())
          return
        }
        if (!video.current) return
        video.current.srcObject = stream
        await video.current.play()
        const scan = async () => {
          if (stopped || detecting) return
          detecting = true
          try {
            const codes = await detector.detect(video.current)
            if (codes[0]?.rawValue) {
              stopped = true
              onResultRef.current?.(codes[0].rawValue)
              return
            }
          } catch {
            // Keep scanning; transient camera frames can fail detection.
          } finally {
            detecting = false
          }
          if (!stopped) timer = window.setTimeout(scan, 250)
        }
        scan()
      } catch (e) {
        setError(e.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access in your browser settings.'
          : e.message || 'Could not start the camera. Check camera permission.')
      }
    }
    start()
    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach(track => track.stop())
      if (video.current) video.current.srcObject = null
    }
  }, [])

  return (
    <div className="shade" role="dialog" aria-modal="true" aria-label="QR code scanner">
      <div className="sheet">
        <h2>Scan QR code</h2>
        <video ref={video} muted playsInline autoPlay style={{ width: '100%', maxHeight: 360, background: '#111', borderRadius: 10 }} />
        {error && <div className="note warn">{error}</div>}
        <p className="mute">Point your camera at a Sepolia payment QR code.</p>
        <button type="button" onClick={onClose}>Close scanner</button>
      </div>
    </div>
  )
}
