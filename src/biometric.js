const STORE = 'haven:biometric-session'
const bytes = (n = 32) => crypto.getRandomValues(new Uint8Array(n))
const b64 = (value) => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
const unb64 = (value) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0))
const randomId = (n = 16) => bytes(n)

let activeUnlockController = null

export const hasBiometricSession = () => {
  try { return !!JSON.parse(localStorage.getItem(STORE) || 'null') } catch { return false }
}
export const clearBiometricSession = () => { try { localStorage.removeItem(STORE) } catch {} }

// Can be called when the user leaves the unlock view or explicitly cancels.
export const cancelBiometricUnlock = () => {
  activeUnlockController?.abort()
}

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
      extensions: { prf: { eval: { first: salt } } },
    },
  })
  if (!credential) throw new Error('Biometric setup was cancelled')
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: bytes(),
      rpId: location.hostname,
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
  if (!window.isSecureContext) throw new Error('Biometric unlock requires HTTPS or localhost. Open Haven Wallet using its secure address.')
  if (!window.PublicKeyCredential || !navigator.credentials?.get || typeof AbortController === 'undefined') {
    throw new Error('Biometric authentication is not supported by this browser. Unlock with your wallet password.')
  }
  if (activeUnlockController) {
    throw new Error('Biometric verification is already in progress. Finish or cancel the current prompt first.')
  }

  let stored
  try {
    stored = JSON.parse(localStorage.getItem(STORE) || 'null')
  } catch {
    throw new Error('The saved biometric session is damaged. Unlock with your wallet password.')
  }
  if (!stored?.id || !stored?.salt || !stored?.iv || !stored?.ciphertext) {
    throw new Error('No valid biometric session was found on this device. Unlock with your wallet password.')
  }

  let credentialId, salt
  try {
    credentialId = unb64(stored.id)
    salt = unb64(stored.salt)
    // Validate the remaining encoded values before requesting user verification.
    unb64(stored.iv)
    unb64(stored.ciphertext)
  } catch {
    throw new Error('The saved biometric session is invalid. Unlock with your wallet password.')
  }

  const controller = new AbortController()
  activeUnlockController = controller
  try {
    const publicKey = {
      challenge: bytes(32),
      timeout: 60000,
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: credentialId }],
      userVerification: 'required',
      extensions: { prf: { eval: { first: salt } } },
    }

    const assertion = await navigator.credentials.get({
      publicKey,
      signal: controller.signal,
    })
    if (!assertion) throw new Error('Your device did not return a biometric credential. Please try again.')

    const first = assertion.getClientExtensionResults?.().prf?.results?.first
    if (!first) {
      throw new Error('This device did not provide the required WebAuthn PRF result. Use your wallet password, or set up biometrics again on a supported device.')
    }

    try {
      const key = await deriveKey(first)
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: unb64(stored.iv) },
        key,
        unb64(stored.ciphertext),
      )
      return JSON.parse(new TextDecoder().decode(plain))
    } catch {
      throw new Error('Biometric verification succeeded, but this saved wallet session could not be decrypted. Unlock with your wallet password and set up biometrics again.')
    }
  } catch (error) {
    if (error instanceof Error && !['NotAllowedError', 'AbortError', 'TimeoutError', 'SecurityError'].includes(error.name)) {
      throw error
    }
    switch (error?.name) {
      case 'NotAllowedError':
        throw new Error('Biometric verification was not completed. It may have been cancelled, timed out, blocked by the browser, or no longer match this device. Try again or use your wallet password.')
      case 'AbortError':
        throw new Error('Biometric verification was cancelled. You can try again or use your wallet password.')
      case 'TimeoutError':
        throw new Error('Biometric verification timed out. Please try again or use your wallet password.')
      case 'SecurityError':
        throw new Error('The website domain could not use this saved biometric credential. Open Haven Wallet at the same HTTPS address where biometrics were enabled.')
      default:
        throw new Error(error?.message || 'Biometric unlock failed. Please use your wallet password.')
    }
  } finally {
    if (activeUnlockController === controller) activeUnlockController = null
  }
}
