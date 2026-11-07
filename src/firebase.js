let appPromise

function loadFirebaseScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-firebase-src="' + src + '"]')
    if (existing) {
      if (window.firebase) return resolve()
      existing.addEventListener('load', resolve, { once: true })
      existing.addEventListener('error', reject, { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.dataset.firebaseSrc = src
    script.onload = resolve
    script.onerror = () => reject(new Error('Could not load Firebase. Check your internet connection and try again.'))
    document.head.appendChild(script)
  })
}

async function getFirebaseAuth() {
  if (!appPromise) {
    appPromise = (async () => {
      const env = import.meta.env
      const apiKey = env.VITE_FIREBASE_API_KEY
      const projectId = env.VITE_FIREBASE_PROJECT_ID
      const appId = env.VITE_FIREBASE_APP_ID
      const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN || (projectId ? projectId + '.firebaseapp.com' : '')
      if (!apiKey || !projectId || !appId || !authDomain) {
        throw new Error('Firebase is not configured yet. Add the VITE_FIREBASE_* values in Vercel Project Settings.')
      }

      const base = 'https://www.gstatic.com/firebasejs/10.14.1/'
      await loadFirebaseScript(base + 'firebase-app-compat.js')
      await loadFirebaseScript(base + 'firebase-auth-compat.js')

      const firebase = window.firebase
      const config = { apiKey, projectId, appId, authDomain }
      const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config)
      const auth = app.auth()
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      return { auth, firebase }
    })().catch((error) => {
      appPromise = null
      throw error
    })
  }
  return appPromise
}

export async function signInWithGoogle() {
  const { auth, firebase } = await getFirebaseAuth()
  const provider = new firebase.auth.GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const result = await auth.signInWithPopup(provider)
  return { uid: result.user.uid, email: result.user.email, displayName: result.user.displayName }
}
