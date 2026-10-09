import { describe, it, expect, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { appliquerEnLot, messageDeLot } from '@features/admin/lib/appliquer-en-lot'

// Les actions GROUPÉES du panneau d'administration disaient-elles la vérité ?
//
// ── Comment ce défaut a été trouvé ───────────────────────────────────────
// Balayage des fonctions jumelles (`scripts/jumeaux-divergents.mjs`) : les
// deux `handleBulkSoft` sont identiques, mais leur lecture a révélé un défaut
// qu'elles PARTAGENT — et que les actions unitaires des mêmes fichiers n'ont
// pas. `reports-section.jsx` en est la démonstration la plus nette :
//
//   ligne 196 (unitaire) : const { error: err } = await adminUpdateReportStatus(...)
//                          if (err) { setError(err.message); return }
//   ligne 210 (groupée)  : await Promise.all(ids.map(id => adminUpdateReportStatus(...)))
//
// Même fichier, même fonction importée, résultat vérifié d'un côté et jeté de
// l'autre. Six sites dans cinq fichiers.
//
// 🔴 Trois d'entre eux retiraient en plus les lignes de l'état local et
// décrémentaient les compteurs sans condition : des recettes restées en
// attente, des signalements restés ouverts, disparaissaient de la file de
// modération. L'administrateur croyait avoir modéré.

describe('appliquerEnLot — rendre compte de ce qui a réellement réussi', () => {
  it('🔴 compte les échecs au lieu de les avaler', async () => {
    const action = vi.fn(async (id) => (id === 'b' ? { error: 'RLS refuse' } : { ok: true }))
    const bilan = await appliquerEnLot(['a', 'b', 'c'], action)

    expect(bilan).toEqual({
      total: 3, reussis: 2, echecs: 1, toutReussi: false, premiereErreur: 'RLS refuse',
    })
  })

  it('un succès complet est annoncé comme tel', async () => {
    const bilan = await appliquerEnLot(['a', 'b'], async () => ({ error: null }))
    expect(bilan.toutReussi).toBe(true)
    expect(bilan.reussis).toBe(2)
  })

  it('une action qui LÈVE compte comme un échec, sans faire tomber le lot', async () => {
    // Sans ce filet, `Promise.all` rejetterait et le reste du lot resterait
    // dans un état inconnu — pire que l'échec lui-même.
    const action = vi.fn(async (id) => { if (id === 'b') throw new Error('réseau'); return { error: null } })
    const bilan = await appliquerEnLot(['a', 'b', 'c'], action)

    expect(bilan.echecs).toBe(1)
    expect(bilan.premiereErreur).toBe('réseau')
    expect(action).toHaveBeenCalledTimes(3) // le lot est allé au bout
  })

  it('accepte les deux formes d\'erreur des API admin', async () => {
    // Certaines rendent `{ error: 'texte' }`, d'autres `{ error: objetSupabase }`.
    const bilan = await appliquerEnLot(['a', 'b'], async (id) =>
      (id === 'a' ? { error: 'texte' } : { error: { message: 'objet' } }))
    expect(bilan.echecs).toBe(2)
    expect(bilan.premiereErreur).toBe('texte')
  })

  it('une liste vide ne déclenche aucune action', async () => {
    const action = vi.fn()
    for (const vide of [[], null, undefined]) {
      const bilan = await appliquerEnLot(vide, action)
      expect(bilan).toEqual({ total: 0, reussis: 0, echecs: 0, toutReussi: true, premiereErreur: null })
    }
    expect(action).not.toHaveBeenCalled()
  })
})

// Audit du 2026-10-04, ADM-23 : une sélection de 80 recettes partait en 80
// écritures simultanées vers la base.
describe('appliquerEnLot — pas plus de cinq écritures à la fois', () => {
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms))

  it('un lot de douze ne lance jamais plus de cinq actions ensemble, et les mène toutes à bout', async () => {
    let enVol = 0
    let auPlus = 0
    const action = vi.fn(async (id) => {
      enVol++
      auPlus = Math.max(auPlus, enVol)
      await attendre(5)
      enVol--
      return id === 'r7' ? { error: 'refusée' } : { error: null }
    })
    const ids = Array.from({ length: 12 }, (_, i) => `r${i}`)
    const bilan = await appliquerEnLot(ids, action)

    expect(action).toHaveBeenCalledTimes(12)
    expect(auPlus).toBeLessThanOrEqual(5)
    expect(auPlus).toBeGreaterThan(1) // toujours en parallèle (témoin)
    expect(bilan).toEqual({ total: 12, reussis: 11, echecs: 1, toutReussi: false, premiereErreur: 'refusée' })
  })

  it('la « première erreur » est celle du premier identifiant en échec, pas de la première réponse', async () => {
    // r1 échoue lentement, r3 échoue tout de suite : on annonce r1.
    const action = async (id) => {
      if (id === 'r1') { await attendre(20); return { error: 'r1 refusée' } }
      if (id === 'r3') return { error: 'r3 refusée' }
      return { error: null }
    }
    const bilan = await appliquerEnLot(['r0', 'r1', 'r2', 'r3'], action)
    expect(bilan.premiereErreur).toBe('r1 refusée')
    expect(bilan.echecs).toBe(2)
  })
})

describe('messageDeLot — ne jamais masquer un échec partiel', () => {
  const libelle = (n) => `post${n > 1 ? 's' : ''} masqué${n > 1 ? 's' : ''}`

  it('succès complet', () => {
    expect(messageDeLot({ total: 3, reussis: 3, echecs: 0, premiereErreur: null }, libelle))
      .toBe('3 posts masqués.')
  })

  it('échec partiel : les deux nombres sont dits', () => {
    expect(messageDeLot({ total: 3, reussis: 2, echecs: 1, premiereErreur: 'RLS refuse' }, libelle))
      .toBe('2 posts masqués, mais 1 en échec (RLS refuse).')
  })

  it('échec total : rien n\'est annoncé comme fait', () => {
    expect(messageDeLot({ total: 3, reussis: 0, echecs: 3, premiereErreur: 'RLS refuse' }, libelle))
      .toBe('Échec : aucun des 3 éléments n\'a été traité (RLS refuse).')
  })
})

describe('Le mécanisme est-il BRANCHÉ partout ?', () => {
  // Même parade qu'ailleurs dans ce dépôt : prouver que la logique existe ne
  // prouve pas qu'on l'appelle. Ce test refuse qu'une action groupée
  // réapparaisse en jetant ses résultats.
  it('plus aucune action groupée ne jette ses résultats', () => {
    const racine = resolve(process.cwd(), 'src/features/admin')
    const coupables = []
    const parcourir = (d) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name)
        if (e.isDirectory()) { parcourir(p); continue }
        if (!/\.jsx?$/.test(e.name)) continue
        const lignes = readFileSync(p, 'utf8').split('\n')
        lignes.forEach((l, i) => {
          if (!/^\s*await Promise\.all\(/.test(l)) return
          // Un `Promise.all` dont le résultat EST déstructuré est une lecture
          // parallèle légitime — l'affectation peut tenir sur la ligne d'avant
          // (`const [a, b] =` puis `await Promise.all([`).
          const precedente = lignes[i - 1] ?? ''
          if (/=\s*$/.test(precedente)) return
          coupables.push(`${p.slice(p.indexOf('src'))}:${i + 1}`)
        })
      }
    }
    parcourir(racine)
    expect(
      coupables,
      'Ces lignes lancent un lot sans regarder ce qui a échoué. Passer par '
      + '`appliquerEnLot` (features/admin/lib) pour rendre compte honnêtement.',
    ).toEqual([])
  })
})
