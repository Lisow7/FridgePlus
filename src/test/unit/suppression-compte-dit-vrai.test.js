import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROUTES } from '@routes/routes-config'
import { CHEMIN_DANS_APP } from '@features/legal/data/suppression-compte'

// Ce que la page publique de suppression dit est vrai (audit du 2026-10-04,
// CPT-07) — la page exigée par Google Play.
//
// Le chemin visait un onglet « Confidentialité » qui n'existe plus ; la page
// promettait des données « anonymisées tout de suite » alors qu'elles sont
// gardées 30 jours ; elle nommait « Exporter mes données » un bouton qui
// s'appelle « Télécharger mes données ». Le test de cohérence existant ne
// contrôlait que le délai : celui-ci lit les VRAIS libellés.

const RACINE = resolve(__dirname, '../../..')
const lire = (chemin) => readFileSync(resolve(RACINE, chemin), 'utf8')
const PAGE_COMPTE = lire('src/features/profile/pages/profile-account-page.jsx')
const PAGE_PUBLIQUE = lire('src/features/legal/pages/account-deletion-page.jsx')
const onglets = ROUTES.find((r) => r.path === '/profile').children.filter((c) => c.label)
const libelle = (champ, lang) => {
  const bloc = PAGE_COMPTE.split(lang === 'fr' ? /\n\s*fr:\s*\{/ : /\n\s*en:\s*\{/)[1]
  return bloc.match(new RegExp(`${champ}:\\s*'([^']+)'`))[1]
}

describe.each(['fr', 'en'])('le chemin dans l’app (%s) suit les vrais libellés', (lang) => {
  it('l’onglet du profil, la zone de danger, le bouton', () => {
    const chemin = CHEMIN_DANS_APP[lang]
    expect(chemin).toContain(onglets.find((o) => o.path === 'compte').label[lang])
    expect(chemin).toContain(libelle('dangerTitle', lang))
    expect(chemin).toContain(libelle('dangerBtn', lang))
  })
})

describe('la page publique dit vrai', () => {
  it('rien n’est « anonymisé tout de suite » : le compte est désactivé, les données gardées 30 jours', () => {
    expect(PAGE_PUBLIQUE).not.toMatch(/anonymisées tout de suite|anonymised straight away|anonymized right away/i)
    expect(PAGE_PUBLIQUE).toMatch(/désactivé tout de suite/)
  })

  it('l’export porte son vrai nom, à son vrai endroit', () => {
    expect(PAGE_PUBLIQUE).not.toMatch(/Exporter mes données|onglet « Confidentialité »/)
    expect(PAGE_PUBLIQUE).toContain(libelle('dataTitle', 'fr'))
  })
})
