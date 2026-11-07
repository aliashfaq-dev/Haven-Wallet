const STORE = 'haven:biometric-session'
const bytes = (n = 32) => crypto.getRandomValues(new Uint8Array(n))
const b64 = (value) => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
const unb64 = (value) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0))
const randomId = (n = 16) => bytes(n)

export const hasBiometricSession = () => {
  try { return !!JSON.parse(localStorage.getItem(STORE) || 'null') } catch { return false }
}
export const clearBiometricSession = () => { try { localStorage.removeItem(STORE) } catch {} }

async function platformAuthenticatorAvailable() {
  if (!window.PublicKeyCredential || !navigator.credentials?.create || !navigator.credentials?.get) return false
  try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable() } catch { return false }
}
async function deriveKey(output) {
  return crypto.subtle.importKey('raw', output, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function enableBiometricSession(payload) {
  if (!window.isSecureContext) throw new Error('Biometric login requires HTTPS or localhost')
  if (!(await platformAuthenticatorAvailable())) throw new Error('This device or browser does not support platform biometrics')
  const salt = bytes()
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: bytes(),
      rp: { name: 'Haven Wallet', id: location.hostname },
      user: { id: randomId(), name: 'haven-wallet-user', displayName: 'Haven Wallet' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60000,
      attestation: 'none',
    },
  })
  if (!credential) throw new Error('Biometric setup was cancelled')
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: bytes(),
      allowCredentials: [{ type: 'public-key', id: credential.rawId }],
      userVerification: 'required',
      timeout: 60000,
      extensions: { prf: { eval: { first: salt } } },
    },
  })
  const first = assertion?.getClientExtensionResults?.().prf?.results?.first
  if (!first) throw new Error('This authenticator does not support secure biometric key storage (WebAuthn PRF)')
  const key = await deriveKey(first)
  const iv = bytes(12)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(payload)))
  localStorage.setItem(STORE, JSON.stringify({ id: b64(credential.rawId), salt: b64(salt), iv: b64(iv), ciphertext: b64(ciphertext) }))
}

export async function unlockWithBiometrics() {
  const stored = JSON.parse(localStorage.getItem(STORE) || 'null')
  if (!stored) throw new Error('No biometric session is saved on this device')
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: bytes(),
      allowCredentials: [{ type: 'public-key', id: unb64(stored.id) }],
      userVerification: 'required',
      timeout: 60000,
      extensions: { prf: { eval: { first: unb64(stored.salt) } } },
    },
  })
  const first = assertion?.getClientExtensionResults?.().prf?.results?.first
  if (!first) throw new Error('Biometric key verification is not supported by this authenticator')
  const key = await deriveKey(first)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(stored.iv) }, key, unb64(stored.ciphertext))
  return JSON.parse(new TextDecoder().decode(plain))
}
