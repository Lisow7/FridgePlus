// Une version périmée ne reste pas coincée sur des fichiers disparus (audit du
// 2026-10-04, SEO-08).
//
// Après un déploiement, le service worker neuf ATTEND (`registerType:
// 'prompt'`) : qui a cliqué « Plus tard » garde l'ancien index.html, servi du
// cache. Les morceaux hors du précache (vendor-sentry, admin-panel,
// vendor-recharts — `vite.config.js`) changent de nom et ne sont plus servis :
// le chargement échoue, et l'écran d'erreur rechargeait… l'ancien index.html,
// jusqu'à ce que la nouvelle version s'active d'elle-même. À une PREMIÈRE
// visite (page pas encore tenue par le service worker), c'est n'importe quel
// morceau paresseux : rejoué le 2026-10-05 entre deux vrais builds, le clic
// vers la FAQ laissait l'écran d'erreur, sans retour possible.
//
// Vite émet `vite:preloadError` quand un import dynamique échoue. On ne
// recharge alors que sur la PREUVE d'une version plus récente : un service
// worker neuf (en attente ou qui s'installe), ou, sans service worker, une
// adresse d'entrée qui a changé côté serveur. Un morceau bloqué par un bloqueur
// de publicité (vendor-sentry) ou une coupure réseau ne recharge rien : l'erreur
// suit son cours, comme avant. Une seule tentative par session : jamais de
// boucle de rechargements.

const CLE = 'fridge-version-recuperee'
const ATTENTE_INSTALLATION_MS = 15000
const ATTENTE_ACTIVATION_MS = 3000
const ENTREE = 'script[type="module"][src]'

// `sessionStorage` est lu à l'usage, sous try : y accéder peut lever (cookies
// bloqués), et ce module s'installe au démarrage.
function environnement() {
  return {
    fenetre: window,
    serviceWorker: navigator.serviceWorker,
    stockage: {
      getItem: (cle) => window.sessionStorage.getItem(cle),
      setItem: (cle, valeur) => window.sessionStorage.setItem(cle, valeur),
    },
    fetchImpl: (...args) => window.fetch(...args),
    base: import.meta.env.BASE_URL,
  }
}

function attendreInstallee(worker) {
  if (!worker) return Promise.resolve(null)
  return new Promise((resolve) => {
    const finir = (w) => {
      clearTimeout(minuteur)
      worker.removeEventListener('statechange', suivre)
      resolve(w)
    }
    const suivre = () => {
      if (worker.state === 'installed') finir(worker)
      else if (worker.state === 'redundant') finir(null)
    }
    const minuteur = setTimeout(() => finir(null), ATTENTE_INSTALLATION_MS)
    worker.addEventListener('statechange', suivre)
    suivre()
  })
}

// Active `worker` (SKIP_WAITING est le message qu'écoute le service worker de
// Workbox), attend qu'il prenne la main, puis recharge — au plus une fois : le
// premier des deux signaux coupe l'autre.
function activerPuisRecharger(worker, { serviceWorker, fenetre }) {
  return new Promise((resolve) => {
    const recharger = () => {
      clearTimeout(minuteur)
      serviceWorker.removeEventListener('controllerchange', recharger)
      fenetre.location.reload()
      resolve('activee')
    }
    const minuteur = setTimeout(recharger, ATTENTE_ACTIVATION_MS)
    serviceWorker.addEventListener('controllerchange', recharger)
    worker.postMessage({ type: 'SKIP_WAITING' })
  })
}

async function lireLEnregistrement(serviceWorker) {
  try {
    return (await serviceWorker?.getRegistration?.()) ?? null
  } catch {
    return null
  }
}

// La page servie AUJOURD'HUI par le serveur (sans cache), ou null.
async function pageServie(fetchImpl, base) {
  try {
    const reponse = await fetchImpl(base, { cache: 'no-store' })
    return reponse.ok ? await reponse.text() : null
  } catch {
    return null
  }
}

function dejaTente(stockage) {
  try { return stockage.getItem(CLE) !== null } catch { return false }
}

function noterLaTentative(stockage) {
  try { stockage.setItem(CLE, String(Date.now())) } catch { /* stockage refusé */ }
}

export async function recupererLaVersion(env = environnement()) {
  const { fenetre, serviceWorker, stockage, fetchImpl, base } = env
  if (fenetre.navigator?.onLine === false) return 'hors-ligne'
  if (dejaTente(stockage)) return 'deja-tente'

  const registration = await lireLEnregistrement(serviceWorker)
  if (registration) {
    try { await registration.update() } catch { /* réseau : on lit ce qu'on a */ }
    const neuf = registration.waiting ?? await attendreInstallee(registration.installing)
    if (!neuf) return 'pas-de-version'
    noterLaTentative(stockage)
    return activerPuisRecharger(neuf, env)
  }

  // Sans service worker : la page servie cite-t-elle encore le script
  // d'entrée chargé ? Si non, un déploiement l'a remplacé.
  const chargee = fenetre.document.querySelector(ENTREE)?.getAttribute('src') ?? null
  const servie = chargee ? await pageServie(fetchImpl, base) : null
  if (!servie || servie.includes(chargee)) return 'pas-de-version'
  noterLaTentative(stockage)
  fenetre.location.reload()
  return 'rechargee'
}

export function installerLaRecuperation(env = environnement()) {
  env.fenetre.addEventListener('vite:preloadError', () => { void recupererLaVersion(env) })
}

// Le bouton « Recharger » de l'écran d'erreur : si une version neuve attend,
// l'activer d'abord — recharger seul rendrait l'ancienne, servie du cache.
export async function rechargerSurLaDerniereVersion(env = environnement()) {
  const neuf = (await lireLEnregistrement(env.serviceWorker))?.waiting
  if (neuf) return activerPuisRecharger(neuf, env)
  env.fenetre.location.reload()
  return 'rechargee'
}
