import { describe, it, expect } from 'vitest'
import { agregerParPeriode } from '@features/admin/lib/activite-par-periode'

// Le graphique du tableau de bord reçoit désormais des comptes PAR JOUR
// (`admin_activite_par_jour`, lot 12l de l'audit du 2026-10-04), plus les
// lignes brutes de trois tables. L'agrégation par période (jour, mois, année)
// est une fonction pure, ici : on la prouve sans recharts.

const jours = [
  { jour: '2026-10-08', actions: 3, inscriptions: 1, recettes: 0 },
  { jour: '2026-10-09', actions: 2, inscriptions: 0, recettes: 1 },
  { jour: '2025-03-15', actions: 10, inscriptions: 4, recettes: 2 },
]
const aujourdHui = new Date('2026-10-10T12:00:00Z')

describe('agregerParPeriode', () => {
  it('7 jours : un point par jour, les comptes du jour, zéro ailleurs', () => {
    const points = agregerParPeriode(jours, '7j', aujourdHui)
    expect(points).toHaveLength(7)
    expect(points.at(-1)).toMatchObject({ actions: 0, signups: 0, recipes: 0 })
    expect(points.at(-2)).toMatchObject({ actions: 2, signups: 0, recipes: 1 })
    expect(points.at(-3)).toMatchObject({ actions: 3, signups: 1, recipes: 0 })
  })

  it('12 mois : les jours d’un même mois s’additionnent, un mois plus vieux reste dehors', () => {
    const points = agregerParPeriode(jours, '12m', aujourdHui)
    expect(points).toHaveLength(12)
    expect(points.at(-1)).toMatchObject({ actions: 5, signups: 1, recipes: 1 })
    expect(points.reduce((s, p) => s + p.actions, 0)).toBe(5)
  })

  it('tout : une colonne par année depuis la plus ancienne', () => {
    const points = agregerParPeriode(jours, 'all', aujourdHui)
    expect(points.map((p) => p.label)).toEqual(['2025', '2026'])
    expect(points[0]).toMatchObject({ actions: 10, signups: 4, recipes: 2 })
    expect(points[1]).toMatchObject({ actions: 5, signups: 1, recipes: 1 })
  })

  it('sans aucun jour : rien à tracer', () => {
    expect(agregerParPeriode([], 'all', aujourdHui)).toEqual([])
  })
})
