import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Ce que l'admin LIT quand il bannit doit décrire ce que la base FAIT.
//
// Audit du 2026-10-04 (ADM-01, ADM-15, BDD-02, CPT-17). Historique de ce test :
//   · jusqu'au 2026-10-04, les textes promettaient « ne pourra plus se
//     connecter » et « Raison obligatoire » alors que bannir n'écrivait qu'un
//     booléen ;
//   · le lot 3a a fait refuser par la base ce qu'un compte banni ÉCRIT — il
//     pouvait encore se connecter, et ce test l'exigeait des textes ;
//   · depuis le lot 3c-3b (2026-10-06), bannir passe par `admin_bannir` : motif
//     montré à la personne, durée, session coupée, reconnexion refusée jusqu'à
//     l'échéance. Les textes doivent dire CELA — et plus « il pourra encore se
//     connecter ».
//
// Et dans l'onglet Signalements, le bouton « Bannir » agit sur l'auteur du
// SIGNALEMENT, pas sur l'auteur du contenu signalé : le bouton le dit.
const lire = (chemin) => readFileSync(resolve(process.cwd(), chemin), 'utf8')

const UTILISATEURS = 'src/features/admin/components/sections/users-section.jsx'
const SIGNALEMENTS = 'src/features/admin/components/sections/reports-section.jsx'
const FENETRE = 'src/features/admin/components/modals/fenetre-de-bannissement.jsx'
const GUIDE = 'src/features/admin/data/admin-help-content.js'

describe('le bannissement est décrit tel qu’il agit', () => {
  it.each([UTILISATEURS, SIGNALEMENTS])('%s bannit par la fenêtre motif + durée, par la base', (chemin) => {
    const source = lire(chemin)
    expect(source).toMatch(/<FenetreDeBannissement\b/)
    expect(source).toMatch(/adminBannir\(/)
    expect(source).not.toMatch(/adminToggleBan/)
    expect(source).not.toMatch(/pourra encore se connecter/i)
  })

  it('la fenêtre dit ce que la base fait : reconnexion refusée, plus rien publié ni écrit au support', () => {
    const source = lire(FENETRE)
    expect(source).toMatch(/reconnexion refusée/)
    expect(source).toMatch(/Plus rien publié ni écrit au support/)
    expect(source).toMatch(/Motif, montré à la personne/)
  })

  it('le guide décrit le bannissement réel : motif obligatoire, durée, reconnexion refusée', () => {
    const entree = lire(GUIDE).split("title: 'Bannir un compte'")[1].split('},')[0]
    expect(entree).toMatch(/motif/i)
    expect(entree).toMatch(/durée/i)
    expect(entree).toMatch(/reconnexion refusée/i)
    expect(entree).not.toMatch(/peut encore se connecter/i)
    expect(entree).not.toMatch(/Aucun motif n.est enregistré/i)
  })

  it('dans les signalements, le bouton nomme sa cible : le signaleur', () => {
    const source = lire(SIGNALEMENTS)
    expect(source).toMatch(/Bannir le signaleur/)
    expect(source).toMatch(/Débannir le signaleur/)
    // Plus aucun libellé « Bannir » nu sur un bouton de cette section.
    expect(source).not.toMatch(/\?\s*'Débannir'\s*:\s*'Bannir'/)
  })
})
