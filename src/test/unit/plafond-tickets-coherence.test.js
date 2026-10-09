import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  MAX_OPEN_TICKETS,
  MAX_OPEN_REPORTS,
  OPEN_TICKET_STATUSES,
  estRefusDePlafond,
} from '@shared/lib/support/open-tickets-cap'

// Garde-fou : le plafond de tickets ouverts est écrit DEUX FOIS — en JavaScript
// et dans une policy RLS. Ce test fait échouer la CI s'ils se contredisent.
//
// POURQUOI DEUX ENDROITS, ET POURQUOI C'EST VOULU
// Le client refuse avant l'aller-retour, pour afficher un message clair. La base
// refuse parce qu'un appel PostgREST direct avec un JWT valide contourne le
// client — c'était le défaut n°3 de la revue transverse du 2026-08-07 : le
// plafond n'existait QUE côté client, donc un utilisateur authentifié pouvait
// noyer la file de modération.
//
// LE RISQUE QUE CE TEST COUVRE
// Baisser le nombre côté JS sans toucher la migration : rien ne casse, le client
// est simplement plus strict. Le MONTER côté JS sans toucher la migration : le
// client laisse passer, la base refuse, et l'utilisateur se prend un refus que
// plus aucun message n'explique. C'est ce sens-là qui fait mal, mais le test
// exige l'égalité stricte — un écart dans un sens comme dans l'autre est un bug.
//
// POURQUOI UN TEST SUR LE FICHIER ET NON SUR LA BASE
// La CI ne parle pas au vrai Supabase. Ce test garde l'INTENTION exprimée par le
// dépôt. ⚠️ Il reste donc vert même si la migration n'a jamais été appliquée —
// l'état réel de la base se vérifie dans `supabase/migrations/README.md`.

// La DERNIÈRE migration qui pose la règle d'insertion fait foi : depuis le
// 2026-10-05 (CPT-17), signalements et demandes ont chacun leur plafond
// (`20261005_signalements_comptes_a_part.sql`).
const DOSSIER = resolve(process.cwd(), 'supabase/migrations')
const MIGRATION = resolve(DOSSIER, readdirSync(DOSSIER)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .filter((f) => readFileSync(resolve(DOSSIER, f), 'utf8').includes('CREATE POLICY support_tickets_insert'))
  .pop())

describe('plafond de tickets ouverts — le JS et la policy RLS disent la même chose', () => {
  const sql = readFileSync(MIGRATION, 'utf8')

  it('le nombre de la policy est exactement MAX_OPEN_TICKETS', () => {
    // `private.compte_tickets_ouverts() < 3` dans le WITH CHECK.
    const m = sql.match(/compte_tickets_ouverts\(\)\s*<\s*(\d+)/)
    expect(m, 'la comparaison du plafond est introuvable dans la migration').not.toBeNull()
    expect(Number(m[1])).toBe(MAX_OPEN_TICKETS)
  })

  it('le nombre des signalements est exactement MAX_OPEN_REPORTS', () => {
    const m = sql.match(/compte_signalements_ouverts\(\)\s*<\s*(\d+)/)
    expect(m, 'la comparaison du plafond des signalements est introuvable').not.toBeNull()
    expect(Number(m[1])).toBe(MAX_OPEN_REPORTS)
  })

  it('chaque compteur ne compte que sa sorte', () => {
    const tickets = sql.slice(sql.indexOf('FUNCTION private.compte_tickets_ouverts()'), sql.indexOf('$function$;', sql.indexOf('FUNCTION private.compte_tickets_ouverts()')))
    const signalements = sql.slice(sql.indexOf('FUNCTION private.compte_signalements_ouverts()'), sql.indexOf('$function$;', sql.indexOf('FUNCTION private.compte_signalements_ouverts()')))
    expect(tickets).toMatch(/type IS DISTINCT FROM 'report'/)
    expect(signalements).toMatch(/type = 'report'/)
  })

  it('les statuts « ouverts » de la policy sont les mêmes que côté client', () => {
    const m = sql.match(/status\s+IN\s*\(([^)]*)\)/i)
    expect(m, 'la liste des statuts est introuvable dans la migration').not.toBeNull()
    const statutsSql = m[1]
      .split(',')
      .map(s => s.trim().replace(/^'|'$/g, ''))
      .sort()
    expect(statutsSql).toEqual([...OPEN_TICKET_STATUSES].sort())
  })

  it('la policy INSERT est REMPLACÉE, pas doublée', () => {
    // Une seconde policy permissive serait OR-ée avec l'ancienne : elle
    // n'interdirait rien du tout. Le DROP est donc ce qui rend le correctif réel.
    expect(sql).toMatch(/DROP POLICY IF EXISTS support_tickets_insert/i)
    expect(sql).toMatch(/CREATE POLICY support_tickets_insert/i)
  })

  it("l'admin et service_role ne sont pas plafonnés", () => {
    // La policy ne vise que `authenticated` (service_role contourne la RLS),
    // et la branche `is_admin()` sort avant le comptage.
    expect(sql).toMatch(/FOR INSERT TO authenticated/i)
    expect(sql).toMatch(/public\.is_admin\(\)\s*\n?\s*OR/i)
  })

  it('la fonction de comptage ne prend aucun paramètre', () => {
    // Un paramètre `p_user_id` permettrait de sonder le compteur d'autrui.
    expect(sql).toMatch(/FUNCTION private\.compte_tickets_ouverts\(\)/)
    expect(sql).toMatch(/SECURITY DEFINER/)
  })
})

describe('estRefusDePlafond', () => {
  it('reconnaît le refus de la policy RLS (42501)', () => {
    expect(estRefusDePlafond({ code: '42501' })).toBe(true)
  })

  it('ne confond pas avec une autre erreur Postgres', () => {
    expect(estRefusDePlafond({ code: '23505' })).toBe(false)
    expect(estRefusDePlafond({ message: 'boom' })).toBe(false)
    expect(estRefusDePlafond(null)).toBe(false)
    expect(estRefusDePlafond(undefined)).toBe(false)
  })
})
