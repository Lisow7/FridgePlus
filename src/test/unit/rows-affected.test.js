import { describe, it, expect } from 'vitest'
import { auMoinsUneLigne } from '@shared/lib/supabase/rows-affected'

// Une écriture que les règles d'accès de la base filtrent ne renvoie PAS
// d'erreur : elle touche 0 ligne, et rend `{ data: [], error: null }`. Sans ce
// contrôle, l'écran annonce un succès pour une écriture qui n'a pas eu lieu —
// prouvé le 2026-10-05 sur « Supprimer mon message » du support (0 ligne,
// message toujours en base, retiré de l'écran). Le même contrôle sert au
// panneau admin (audit ADM-26).
describe('auMoinsUneLigne', () => {
  it('une ligne touchée : aucune erreur, et le nombre', () => {
    expect(auMoinsUneLigne({ data: [{ id: 'm-1' }], error: null })).toEqual({ error: null, count: 1 })
  })

  it('plusieurs lignes : le nombre', () => {
    expect(auMoinsUneLigne({ data: [{ id: 'a' }, { id: 'b' }], error: null })).toEqual({ error: null, count: 2 })
  })

  it('0 ligne touchée, sans erreur de la base : c’est un échec, reconnaissable', () => {
    const { error, count } = auMoinsUneLigne({ data: [], error: null })
    expect(count).toBe(0)
    expect(error?.code).toBe('no_rows_affected')
  })

  it('pas de liste du tout (requête sans `.select()`) : échec aussi — on ne peut pas savoir', () => {
    expect(auMoinsUneLigne({ data: null, error: null }).error?.code).toBe('no_rows_affected')
  })

  it('une erreur de la base passe telle quelle', () => {
    const panne = { message: 'Failed to fetch' }
    expect(auMoinsUneLigne({ data: null, error: panne })).toEqual({ error: panne, count: 0 })
  })
})
