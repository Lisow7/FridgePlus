import { describe, it, expect } from 'vitest'
import { createWriteSeries } from '@shared/lib/optimistic-writes'

// Quand une écriture est refusée, l'écran doit revenir à ce que LA BASE
// contient. « L'état d'avant le dernier geste » n'est pas toujours cela : si
// deux écritures du même élément se croisent — un double-clic suffit — l'état
// d'avant le second geste est celui que le premier venait d'afficher, et que la
// base a peut-être refusé aussi.
//
// La règle, élément par élément : tant qu'une écriture est en vol, on ne sait
// pas. Quand la dernière a répondu : la dernière écriture ACCEPTÉE (dans
// l'ordre d'envoi) fait foi ; à défaut, l'état d'avant la série.
const ABSENT = null
const PRESENT = { addedAt: '2026-10-01T10:00:00.000Z', expiresAt: null }
const REFUSEE = true
const ACCEPTEE = false

describe('createWriteSeries', () => {
  it('une écriture acceptée : rien à remettre', () => {
    const series = createWriteSeries()
    const ajout = series.ouvrir('tomate', ABSENT, PRESENT)
    expect(series.fermer(ajout, ACCEPTEE)).toBeNull()
  })

  it('une écriture refusée : l’état d’avant le geste', () => {
    const series = createWriteSeries()
    const ajout = series.ouvrir('tomate', ABSENT, PRESENT)
    expect(series.fermer(ajout, REFUSEE)).toEqual({ id: 'tomate', etat: ABSENT, voulu: PRESENT })
  })

  it('tant qu’une écriture du même élément est en vol, on ne conclut pas', () => {
    const series = createWriteSeries()
    const ajout = series.ouvrir('tomate', ABSENT, PRESENT)
    const retrait = series.ouvrir('tomate', PRESENT, ABSENT)
    expect(series.fermer(retrait, REFUSEE)).toBeNull()
    expect(series.fermer(ajout, REFUSEE)).not.toBeNull()
  })

  it('ajout puis retrait, tous deux refusés : absent — pas « présent », que la base n’a jamais eu', () => {
    const series = createWriteSeries()
    const ajout = series.ouvrir('tomate', ABSENT, PRESENT)
    const retrait = series.ouvrir('tomate', PRESENT, ABSENT)
    series.fermer(ajout, REFUSEE)
    expect(series.fermer(retrait, REFUSEE)).toEqual({ id: 'tomate', etat: ABSENT, voulu: ABSENT })
  })

  it('même chose quand les réponses arrivent dans l’autre ordre', () => {
    const series = createWriteSeries()
    const ajout = series.ouvrir('tomate', ABSENT, PRESENT)
    const retrait = series.ouvrir('tomate', PRESENT, ABSENT)
    series.fermer(retrait, REFUSEE)
    expect(series.fermer(ajout, REFUSEE)).toEqual({ id: 'tomate', etat: ABSENT, voulu: ABSENT })
  })

  it('retrait puis ajout, tous deux refusés : présent, avec la fraîcheur d’origine', () => {
    const series = createWriteSeries()
    const plusTard = { addedAt: '2026-10-05T08:00:00.000Z', expiresAt: null }
    const retrait = series.ouvrir('tomate', PRESENT, ABSENT)
    const ajout = series.ouvrir('tomate', ABSENT, plusTard)
    series.fermer(retrait, REFUSEE)
    expect(series.fermer(ajout, REFUSEE)).toEqual({ id: 'tomate', etat: PRESENT, voulu: plusTard })
  })

  it('ajout accepté, retrait refusé : présent — la base l’a', () => {
    const series = createWriteSeries()
    const ajout = series.ouvrir('tomate', ABSENT, PRESENT)
    const retrait = series.ouvrir('tomate', PRESENT, ABSENT)
    series.fermer(retrait, REFUSEE)
    expect(series.fermer(ajout, ACCEPTEE)).toEqual({ id: 'tomate', etat: PRESENT, voulu: ABSENT })
  })

  it('ajout refusé, retrait accepté : le dernier geste a tenu, rien à remettre', () => {
    const series = createWriteSeries()
    const ajout = series.ouvrir('tomate', ABSENT, PRESENT)
    const retrait = series.ouvrir('tomate', PRESENT, ABSENT)
    series.fermer(ajout, REFUSEE)
    expect(series.fermer(retrait, ACCEPTEE)).toBeNull()
  })

  it('c’est la dernière écriture acceptée dans l’ordre d’ENVOI qui fait foi, pas la dernière arrivée', () => {
    const series = createWriteSeries()
    const premier = { addedAt: '2026-10-05T08:00:00.000Z', expiresAt: null }
    const ajout1 = series.ouvrir('tomate', ABSENT, premier)
    const retrait2 = series.ouvrir('tomate', premier, ABSENT)
    const ajout3 = series.ouvrir('tomate', ABSENT, PRESENT)
    series.fermer(ajout3, REFUSEE)
    series.fermer(retrait2, ACCEPTEE)
    // `ajout1` arrive en dernier, mais il est parti avant `retrait2`.
    expect(series.fermer(ajout1, ACCEPTEE)).toEqual({ id: 'tomate', etat: ABSENT, voulu: PRESENT })
  })

  // Entre deux séries, l'élément a pu changer par un chemin que ce registre ne
  // voit pas (« Vider le frigo », un rechargement à la connexion). Une série
  // close ne doit donc rien laisser derrière elle : ici l'ajout accepté de la
  // première ne doit pas faire dire « présent » à la seconde, partie d'un
  // aliment absent.
  it('une série close ne pèse pas sur la suivante', () => {
    const series = createWriteSeries()
    series.fermer(series.ouvrir('tomate', ABSENT, PRESENT), ACCEPTEE)
    const ajout = series.ouvrir('tomate', ABSENT, PRESENT)
    expect(series.fermer(ajout, REFUSEE)).toEqual({ id: 'tomate', etat: ABSENT, voulu: PRESENT })
  })

  it('chaque élément a sa série', () => {
    const series = createWriteSeries()
    const tomate = series.ouvrir('tomate', ABSENT, PRESENT)
    const beurre = series.ouvrir('beurre', ABSENT, PRESENT)
    expect(series.fermer(tomate, REFUSEE)).toEqual({ id: 'tomate', etat: ABSENT, voulu: PRESENT })
    expect(series.fermer(beurre, ACCEPTEE)).toBeNull()
  })

  it('les états peuvent être de simples booléens (favoris)', () => {
    const series = createWriteSeries()
    const ajout = series.ouvrir('pasta', false, true)
    const retrait = series.ouvrir('pasta', true, false)
    series.fermer(ajout, REFUSEE)
    expect(series.fermer(retrait, REFUSEE)).toEqual({ id: 'pasta', etat: false, voulu: false })
  })
})
