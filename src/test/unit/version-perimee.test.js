import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  recupererLaVersion,
  installerLaRecuperation,
  rechargerSurLaDerniereVersion,
} from '@features/pwa/lib/version-perimee'

// Une version périmée ne reste pas coincée sur des fichiers disparus (audit du
// 2026-10-04, SEO-08).
//
// Après un déploiement, le service worker neuf ATTEND (stratégie « prompt ») :
// qui a cliqué « Plus tard » garde l'ancien index.html. Un morceau dont le nom
// a changé n'est plus servi, son chargement échoue — et l'écran d'erreur
// rechargeait… l'ancien index.html. On ne recharge que sur la PREUVE d'une
// version plus récente : un morceau bloqué par un bloqueur de publicité
// (vendor-sentry) ou une coupure réseau ne doit rien recharger.

function faireUnWorker(etat = 'installed') {
  const w = new EventTarget()
  w.state = etat
  w.messages = []
  w.postMessage = (m) => { w.messages.push(m) }
  w.devenir = (e) => { w.state = e; w.dispatchEvent(new Event('statechange')) }
  return w
}

function faireLEnvironnement({ registration = null, enLigne = true, entreeServie = null, entreeDuDocument = '/assets/index-A.js', fetchEchoue = false } = {}) {
  const serviceWorker = new EventTarget()
  serviceWorker.getRegistration = vi.fn(async () => registration)
  const stockage = new Map()
  const fenetre = new EventTarget()
  fenetre.navigator = { onLine: enLigne }
  fenetre.location = { reload: vi.fn() }
  fenetre.document = {
    querySelector: (sel) => (sel === 'script[type="module"][src]' && entreeDuDocument ? { getAttribute: () => entreeDuDocument } : null),
  }
  const fetchImpl = vi.fn(async () => {
    if (fetchEchoue) throw new TypeError('Failed to fetch')
    return { ok: true, text: async () => `<html><head><script type="module" crossorigin src="${entreeServie}"></script></head></html>` }
  })
  const env = {
    fenetre,
    serviceWorker,
    stockage: { getItem: (k) => stockage.get(k) ?? null, setItem: (k, v) => { stockage.set(k, String(v)) } },
    fetchImpl,
    base: '/',
  }
  return { env, serviceWorker, fenetre, fetchImpl, stockage }
}

function faireUnEnregistrement({ waiting = null, installing = null, apresMiseAJour = null } = {}) {
  const r = { waiting, installing }
  r.update = vi.fn(async () => { if (apresMiseAJour) apresMiseAJour(r) })
  return r
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('un fichier perdu après un déploiement', () => {
  it('une version neuve attend : elle est activée (SKIP_WAITING), puis la page recharge une fois qu’elle a la main', async () => {
    const neuf = faireUnWorker()
    const registration = faireUnEnregistrement({ apresMiseAJour: (r) => { r.waiting = neuf } })
    const { env, serviceWorker, fenetre } = faireLEnvironnement({ registration })

    const fin = recupererLaVersion(env)
    await vi.advanceTimersByTimeAsync(0)
    expect(registration.update).toHaveBeenCalledTimes(1)
    expect(neuf.messages).toEqual([{ type: 'SKIP_WAITING' }])
    expect(fenetre.location.reload).not.toHaveBeenCalled()

    serviceWorker.dispatchEvent(new Event('controllerchange'))
    await expect(fin).resolves.toBe('activee')
    expect(fenetre.location.reload).toHaveBeenCalledTimes(1)

    // La main ne vient jamais en double : le filet du minuteur ne recharge pas une 2e fois.
    await vi.advanceTimersByTimeAsync(10000)
    expect(fenetre.location.reload).toHaveBeenCalledTimes(1)
  })

  it('la version neuve tarde à prendre la main : la page recharge au bout du délai, et une seule fois', async () => {
    const neuf = faireUnWorker()
    const registration = faireUnEnregistrement({ waiting: neuf })
    const { env, serviceWorker, fenetre } = faireLEnvironnement({ registration })

    const fin = recupererLaVersion(env)
    await vi.advanceTimersByTimeAsync(2999)
    expect(fenetre.location.reload).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await expect(fin).resolves.toBe('activee')
    expect(fenetre.location.reload).toHaveBeenCalledTimes(1)

    // Elle prend la main APRÈS le délai (activation lente) : pas de second rechargement.
    serviceWorker.dispatchEvent(new Event('controllerchange'))
    expect(fenetre.location.reload).toHaveBeenCalledTimes(1)
  })

  it('une version neuve est en cours d’installation : on attend qu’elle soit prête, puis on l’active', async () => {
    const neuf = faireUnWorker('installing')
    const registration = faireUnEnregistrement({ installing: neuf })
    const { env, serviceWorker, fenetre } = faireLEnvironnement({ registration })

    const fin = recupererLaVersion(env)
    await vi.advanceTimersByTimeAsync(5000)
    expect(neuf.messages).toEqual([])

    neuf.devenir('installed')
    await vi.advanceTimersByTimeAsync(0)
    expect(neuf.messages).toEqual([{ type: 'SKIP_WAITING' }])
    serviceWorker.dispatchEvent(new Event('controllerchange'))
    await expect(fin).resolves.toBe('activee')
    expect(fenetre.location.reload).toHaveBeenCalledTimes(1)
  })

  it('l’installation échoue (worker abandonné) : rien ne recharge', async () => {
    const neuf = faireUnWorker('installing')
    const registration = faireUnEnregistrement({ installing: neuf })
    const { env, fenetre } = faireLEnvironnement({ registration })

    const fin = recupererLaVersion(env)
    await vi.advanceTimersByTimeAsync(0)
    neuf.devenir('redundant')
    await expect(fin).resolves.toBe('pas-de-version')
    expect(fenetre.location.reload).not.toHaveBeenCalled()
  })

  it('aucune version plus récente (morceau bloqué par un bloqueur de pub) : rien ne recharge', async () => {
    const registration = faireUnEnregistrement()
    const { env, fenetre } = faireLEnvironnement({ registration })

    await expect(recupererLaVersion(env)).resolves.toBe('pas-de-version')
    expect(registration.update).toHaveBeenCalledTimes(1)
    expect(fenetre.location.reload).not.toHaveBeenCalled()
  })

  it('hors ligne : on ne cherche rien et on ne recharge rien', async () => {
    const registration = faireUnEnregistrement({ waiting: faireUnWorker() })
    const { env, fenetre, serviceWorker } = faireLEnvironnement({ registration, enLigne: false })

    await expect(recupererLaVersion(env)).resolves.toBe('hors-ligne')
    expect(serviceWorker.getRegistration).not.toHaveBeenCalled()
    expect(fenetre.location.reload).not.toHaveBeenCalled()
  })

  it('une seule tentative par session : jamais de boucle de rechargements', async () => {
    const registration = faireUnEnregistrement({ waiting: faireUnWorker() })
    const { env, fenetre } = faireLEnvironnement({ registration })

    const premiere = recupererLaVersion(env)
    await vi.advanceTimersByTimeAsync(3000)
    await expect(premiere).resolves.toBe('activee')

    // La page rechargée retombe sur un fichier perdu : on laisse l'erreur suivre son cours.
    registration.waiting = faireUnWorker()
    await expect(recupererLaVersion(env)).resolves.toBe('deja-tente')
    expect(fenetre.location.reload).toHaveBeenCalledTimes(1)
  })

  describe('sans service worker (navigateur sans, ou pas encore installé)', () => {
    it('l’adresse d’entrée servie a changé : une version neuve est en ligne, la page recharge', async () => {
      const { env, fenetre, fetchImpl } = faireLEnvironnement({ entreeServie: '/assets/index-B.js' })

      await expect(recupererLaVersion(env)).resolves.toBe('rechargee')
      expect(fetchImpl).toHaveBeenCalledWith('/', { cache: 'no-store' })
      expect(fenetre.location.reload).toHaveBeenCalledTimes(1)
    })

    it('même adresse d’entrée : pas de version neuve, rien ne recharge', async () => {
      const { env, fenetre } = faireLEnvironnement({ entreeServie: '/assets/index-A.js' })

      await expect(recupererLaVersion(env)).resolves.toBe('pas-de-version')
      expect(fenetre.location.reload).not.toHaveBeenCalled()
    })

    it('le serveur ne répond pas : rien ne recharge', async () => {
      const { env, fenetre } = faireLEnvironnement({ fetchEchoue: true })

      await expect(recupererLaVersion(env)).resolves.toBe('pas-de-version')
      expect(fenetre.location.reload).not.toHaveBeenCalled()
    })
  })
})

describe('le branchement au démarrage', () => {
  it('écoute vite:preloadError — l’événement que Vite émet quand un import dynamique échoue — sans l’étouffer', async () => {
    const registration = faireUnEnregistrement({ waiting: faireUnWorker() })
    const { env, fenetre } = faireLEnvironnement({ registration })
    installerLaRecuperation(env)

    const evenement = new Event('vite:preloadError', { cancelable: true })
    fenetre.dispatchEvent(evenement)
    // L'erreur suit son cours (l'écran d'erreur s'affiche si rien ne recharge).
    expect(evenement.defaultPrevented).toBe(false)

    await vi.advanceTimersByTimeAsync(3000)
    expect(fenetre.location.reload).toHaveBeenCalledTimes(1)
  })
})

describe('le bouton « Recharger » de l’écran d’erreur', () => {
  it('une version neuve attend : il l’active avant de recharger (sinon il rechargeait l’ancienne)', async () => {
    const neuf = faireUnWorker()
    const registration = faireUnEnregistrement({ waiting: neuf })
    const { env, serviceWorker, fenetre } = faireLEnvironnement({ registration })

    const fin = rechargerSurLaDerniereVersion(env)
    await vi.advanceTimersByTimeAsync(0)
    expect(neuf.messages).toEqual([{ type: 'SKIP_WAITING' }])
    serviceWorker.dispatchEvent(new Event('controllerchange'))
    await fin
    expect(fenetre.location.reload).toHaveBeenCalledTimes(1)
  })

  it('aucune version n’attend : il recharge tout de suite, sans chercher', async () => {
    const registration = faireUnEnregistrement()
    const { env, fenetre } = faireLEnvironnement({ registration })

    await rechargerSurLaDerniereVersion(env)
    expect(registration.update).not.toHaveBeenCalled()
    expect(fenetre.location.reload).toHaveBeenCalledTimes(1)
  })

  it('sans service worker : il recharge', async () => {
    const { env, fenetre } = faireLEnvironnement()

    await rechargerSurLaDerniereVersion(env)
    expect(fenetre.location.reload).toHaveBeenCalledTimes(1)
  })
})
