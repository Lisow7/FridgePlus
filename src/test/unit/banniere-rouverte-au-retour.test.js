import { describe, it, expect, vi } from 'vitest'
import { creerRetourDOnglet } from '@features/pwa/lib/au-retour-d-onglet'

// « Plus tard » ne fait plus disparaître la bannière de mise à jour pour toute
// la vie de l'onglet (audit du 2026-10-04, SEO-08) : tant qu'une version
// attend, elle revient au retour sur l'onglet. La recherche d'une version plus
// récente, elle, reste limitée à une fois par minute.

function faire({ waiting = null, visible = true } = {}) {
  let t = 0
  const document = { visibilityState: visible ? 'visible' : 'hidden' }
  const registration = { waiting }
  const verifier = vi.fn()
  const onVersionEnAttente = vi.fn()
  const retour = creerRetourDOnglet({
    registration, verifier, onVersionEnAttente, document, delaiMs: 60000, maintenant: () => t,
  })
  return { retour, document, registration, verifier, onVersionEnAttente, avancer: (ms) => { t += ms } }
}

describe('au retour sur l’onglet', () => {
  it('une version attend : la bannière revient, à chaque retour', () => {
    const { retour, onVersionEnAttente, avancer } = faire({ waiting: {} })
    retour()
    avancer(5000)
    retour()
    expect(onVersionEnAttente).toHaveBeenCalledTimes(2)
  })

  it('aucune version n’attend : pas de bannière', () => {
    const { retour, onVersionEnAttente } = faire()
    retour()
    expect(onVersionEnAttente).not.toHaveBeenCalled()
  })

  it('onglet caché : rien', () => {
    const { retour, onVersionEnAttente, verifier } = faire({ waiting: {}, visible: false })
    retour()
    expect(onVersionEnAttente).not.toHaveBeenCalled()
    expect(verifier).not.toHaveBeenCalled()
  })

  it('la recherche d’une version plus récente reste limitée à une fois par minute', () => {
    const { retour, verifier, avancer } = faire()
    retour()
    avancer(30000)
    retour()
    expect(verifier).toHaveBeenCalledTimes(1)
    avancer(30000)
    retour()
    expect(verifier).toHaveBeenCalledTimes(2)
  })
})
