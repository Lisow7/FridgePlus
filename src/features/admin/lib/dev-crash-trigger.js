// Helper de test des ErrorBoundary, exposé UNIQUEMENT en mode dev.
//
// Utilisation depuis la console DevTools (F12) :
//   __crashApp()    → force un crash dans le sous-arbre de App → fallback
//                     plein écran (ErrorBoundary level="app" dans main.jsx)
//   __crashAdmin()  → force un crash quand AdminPanel se rend → fallback
//                     section (ErrorBoundary level="section" dans App.jsx)
//
// Le crash est déclenché via un signal `?crash=1` ou `?crashadmin=1` dans
// l'URL : on appelle history.replaceState pour ajouter le paramètre, puis
// on dispatch un événement pour forcer un re-render. Les composants App
// et AdminPanelInner lisent ce paramètre au rendu et throw si présent.
//
// En prod, ce module n'est jamais importé (gate `import.meta.env.DEV` côté
// main.jsx).

export function setupDevCrashTrigger() {
  if (typeof window === 'undefined') return

  window.__crashApp = () => {
    console.warn('[devCrashTrigger] Forcing app-level crash for ErrorBoundary test')
    const url = new URL(window.location.href)
    url.searchParams.set('crash', '1')
    window.location.assign(url.toString())
  }

  window.__crashAdmin = () => {
    console.warn('[devCrashTrigger] Forcing admin-level crash. Open admin panel to see fallback.')
    const url = new URL(window.location.href)
    url.searchParams.set('crashadmin', '1')
    window.location.assign(url.toString())
  }

  console.info(
    '[devCrashTrigger] Exposed: window.__crashApp() + window.__crashAdmin().\n' +
    'After triggering, reload back to a clean URL to recover.',
  )
}

// Helper utilisé par les composants pour décider s'ils doivent crash.
export function shouldCrash(kind) {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).has(kind)
}
