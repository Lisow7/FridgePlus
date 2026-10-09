import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ADMIN_HELP } from '@features/admin/data/admin-help-content'

// Le guide intégré du panneau admin dit vrai (audit du 2026-10-04, ADM-22).
//
// L'onglet Fonctionnalités n'avait pas d'entrée : son bouton « Guide » ouvrait
// l'aide du Tableau de bord, et l'onglet où l'on bascule la production n'avait
// pas d'aide. Plusieurs pages décrivaient des garanties qui n'existent pas
// (recherche par e-mail, restauration par l'admin, « raison obligatoire » d'un
// message ciblé, suppression qui ne touche pas l'historique, chemin du fichier
// des prix…).

const PANNEAU = readFileSync(resolve(process.cwd(), 'src/features/admin/components/admin-panel.jsx'), 'utf8')
const nav = PANNEAU.slice(PANNEAU.indexOf('function buildNav('), PANNEAU.indexOf('\n}\n', PANNEAU.indexOf('function buildNav(')))
const onglets = [...nav.matchAll(/key:\s*'([a-z-]+)'/g)].map((m) => m[1])
const texte = (cle) => JSON.stringify(ADMIN_HELP[cle] ?? {})

describe('guide admin — chaque onglet a son aide', () => {
  it('témoin : le panneau compte plus de dix onglets, dont Fonctionnalités', () => {
    expect(onglets.length).toBeGreaterThan(10)
    expect(onglets).toContain('features')
  })

  it('chaque onglet du panneau a une entrée dans le guide', () => {
    expect(onglets.filter((cle) => !ADMIN_HELP[cle])).toEqual([])
  })

  it('le guide n’a pas d’entrée pour un onglet qui n’existe pas', () => {
    expect(Object.keys(ADMIN_HELP).filter((cle) => !onglets.includes(cle))).toEqual([])
  })
})

describe('guide admin — ce qu’il affirme est vrai', () => {
  it('Utilisateurs : la recherche se fait par pseudo, et l’admin ne restaure pas un compte', () => {
    expect(texte('users')).not.toMatch(/username ou email|par e-?mail/i)
    expect(texte('users')).not.toMatch(/l'admin peut restaurer/i)
  })

  it('Notifications : seul le titre français est obligatoire ; retirer une diffusion la retire chez tous', () => {
    expect(texte('notifications')).not.toMatch(/FR \+ EN obligatoires/)
    expect(texte('notifications')).not.toMatch(/ne la retire pas de leur historique/)
    expect(texte('notifications')).not.toMatch(/Raison obligatoire/)
  })

  it('Pricing : le chemin du fichier des prix existe, dans le guide comme dans l’onglet (ADM-18)', () => {
    expect(texte('pricing')).not.toMatch(/src\/data\/pricing/)
    expect(texte('pricing')).toMatch(/src\/shared\/static\/pricing/)
    const onglet = readFileSync(resolve(process.cwd(), 'src/features/admin/components/sections/pricing-section.jsx'), 'utf8')
    expect(onglet).not.toMatch(/src\/data\/pricing/)
    expect(onglet).toMatch(/src\/shared\/static\/pricing\/2026\.json/)
  })

  it('Journal : il ne promet pas de filtres qu’il n’a pas, et dit ceux qui manquent', () => {
    expect(texte('journal')).not.toMatch(/par admin acteur, par cible/)
    expect(texte('journal')).toMatch(/Pas de filtre par cible ni par date/)
  })

  // Lot 12h (ADM-10) : les filtres partent désormais à la base.
  it('Journal : les filtres portent sur tout le journal, plus sur la seule page affichée', () => {
    expect(texte('journal')).not.toMatch(/sur la page affichée/)
    expect(texte('journal')).toMatch(/sur tout le journal/)
  })

  it('l’en-tête compte les sections qui existent', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/admin/data/admin-help-content.js'), 'utf8')
    const annonce = Number(source.match(/Guide admin complet\. (\d+) sections documentées/)?.[1])
    expect(annonce).toBe(Object.keys(ADMIN_HELP).length)
  })
})
