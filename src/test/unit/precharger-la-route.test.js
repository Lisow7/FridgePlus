import { describe, it, expect, vi, afterEach } from 'vitest'
import { prechargerLaRoute } from '@routes/precharger-la-route'

// Avant le premier rendu, `main.jsx` charge la page de la route courante (audit
// du 2026-10-04, PERF-05). Sans jamais bloquer : au-delà d'un délai, on rend
// quand même (le squelette fera son travail).

function routes() {
  const faq = Object.assign(() => null, { precharger: vi.fn(() => Promise.resolve()) })
  const fiche = Object.assign(() => null, { precharger: vi.fn(() => Promise.resolve()) })
  const sansPrechargement = () => null
  return {
    faq, fiche,
    liste: [
      { path: '/faq', Component: faq },
      { path: '/recipe/:id', Component: fiche },
      { path: '/cart', Component: sansPrechargement },
      { path: '*', Component: sansPrechargement },
    ],
  }
}

describe('prechargerLaRoute', () => {
  afterEach(() => { vi.useRealTimers() })

  it('précharge la page de la route courante', async () => {
    const r = routes()
    await prechargerLaRoute('/faq', r.liste)
    expect(r.faq.precharger).toHaveBeenCalledTimes(1)
    expect(r.fiche.precharger).not.toHaveBeenCalled()
  })

  it('reconnaît une route à paramètre, et la base du site', async () => {
    const r = routes()
    await prechargerLaRoute('/FridgePlus/recipe/affogato', r.liste, '/FridgePlus/')
    expect(r.fiche.precharger).toHaveBeenCalledTimes(1)
  })

  it('l’accueil et les pages sans préchargement : rien à attendre', async () => {
    const r = routes()
    await expect(prechargerLaRoute('/', r.liste)).resolves.toBeUndefined()
    await expect(prechargerLaRoute('/cart', r.liste)).resolves.toBeUndefined()
    expect(r.faq.precharger).not.toHaveBeenCalled()
  })

  it('ne bloque jamais le rendu : au-delà du délai, on rend quand même', async () => {
    vi.useFakeTimers()
    const lente = Object.assign(() => null, { precharger: () => new Promise(() => {}) })
    let rendu = false
    prechargerLaRoute('/faq', [{ path: '/faq', Component: lente }]).then(() => { rendu = true })

    await vi.advanceTimersByTimeAsync(2999)
    expect(rendu).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    expect(rendu).toBe(true)
  })

  it('un préchargement qui échoue ne bloque pas non plus', async () => {
    const cassee = Object.assign(() => null, { precharger: () => Promise.reject(new Error('chunk')) })
    await expect(prechargerLaRoute('/faq', [{ path: '/faq', Component: cassee }])).resolves.toBeUndefined()
  })
})
