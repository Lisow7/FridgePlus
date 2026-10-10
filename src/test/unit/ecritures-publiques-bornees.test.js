import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

// Audit du 2026-10-04, lot « écritures publiques bornées » — BDD-05 (1, 3, 4),
// BDD-15, BDD-16 (1, 3), BDD-21 (1, 4, 5).
//
// Ce que n'importe qui pouvait faire en base, sans limite :
//   • lire TOUTE la table des paniers partagés (la règle de lecture publique ne
//     filtrait que sur la date) — chaque panier, avec l'identifiant de son
//     compte ; poser une date d'expiration en l'an 9999 ; en empiler sans fin ;
//   • enregistrer comme adresse de push n'importe quelle URL (les fonctions
//     d'envoi y postent ensuite), autant de fois qu'on veut ;
//   • et toute fonction neuve du schéma public naissait exécutable par les
//     visiteurs (droits par défaut), deux règles de suppression des
//     notifications se doublaient, une règle de lecture du cache IA survivait
//     sans lecteur, un accès spécial bloquait l'effacement de l'admin qui
//     l'avait accordé.
//
// La migration pose les bornes en base ; le client lit un panier partagé par
// une fonction (un seul panier, celui du lien), plus par la table.

const racine = process.cwd()
const lire = (chemin) => readFileSync(resolve(racine, chemin), 'utf8')
const migrations = readdirSync(resolve(racine, 'supabase/migrations'))
const MIGRATION = migrations.find((f) => /^\d{14}_ecritures_publiques_bornees\.sql$/.test(f))
const APRES_RELEASE = migrations.find((f) => /^\d{14}_paniers_partages_lecture_par_rpc_apres_release\.sql$/.test(f))
const SONDE = 'supabase/probes/20261010_ecritures_publiques_bornees.sql'

const rpc = vi.fn()
vi.mock('@shared/lib/supabase/client', () => ({
  supabase: {
    rpc: (...args) => rpc(...args),
    from: () => { throw new Error('la lecture d’un panier partagé passe par la fonction, plus par la table') },
  },
}))
const { getSharedBasket } = await import('@features/cart/api/shared-baskets')

describe('un panier partagé se lit par la fonction get_shared_basket, un seul à la fois', () => {
  beforeEach(() => rpc.mockReset())

  it('appelle get_shared_basket avec l’identifiant du lien et rend le panier', async () => {
    rpc.mockResolvedValue({ data: { payload: { rows: [], total: 0, lang: 'fr' }, expires_at: '2026-10-17T00:00:00Z' }, error: null })
    const { data, error } = await getSharedBasket('11111111-1111-4111-8111-111111111111')
    expect(rpc).toHaveBeenCalledWith('get_shared_basket', { p_id: '11111111-1111-4111-8111-111111111111' })
    expect(error).toBeNull()
    expect(data).toEqual({ payload: { rows: [], total: 0, lang: 'fr' }, expires_at: '2026-10-17T00:00:00Z' })
  })

  it('un lien inconnu ou expiré rend null, sans erreur', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    const { data, error } = await getSharedBasket('22222222-2222-4222-8222-222222222222')
    expect(data).toBeNull()
    expect(error).toBeNull()
  })

  it('une panne de la base reste une erreur, distincte d’un lien mort', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'internal error' } })
    const { data, error } = await getSharedBasket('33333333-3333-4333-8333-333333333333')
    expect(data).toBeNull()
    expect(error).toEqual({ message: 'internal error' })
  })

  it('sans identifiant, rien ne part', async () => {
    const { data, error } = await getSharedBasket('')
    expect(rpc).not.toHaveBeenCalled()
    expect(data).toBeNull()
    expect(error).toEqual({ message: 'missing_id' })
  })

  it('le faux serveur des tests de bout en bout sert la fonction, plus la table', () => {
    const mock = lire('e2e/support/supabase-mock.js')
    expect(mock).toMatch(/rest\/v1\/rpc\/get_shared_basket/)
  })
})

describe('la migration borne ce que le public peut écrire ou lire', () => {
  it('existe, sous un nom à version complète', () => {
    expect(MIGRATION).toBeDefined()
  })

  it('un panier partagé se lit par une fonction sous droits du définisseur, ouverte aux visiteurs et à personne d’autre par défaut', () => {
    const sql = lire(`supabase/migrations/${MIGRATION}`)
    expect(sql).toMatch(/CREATE (OR REPLACE )?FUNCTION public\.get_shared_basket\(p_id uuid\)[\s\S]*SECURITY DEFINER/)
    expect(sql).toMatch(/expires_at > now\(\)/)
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.get_shared_basket\(uuid\) FROM PUBLIC/)
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_shared_basket\(uuid\) TO anon, authenticated/)
    // Le propriétaire garde la lecture de SES paniers (export de ses données),
    // pour le jour où la lecture publique de la table tombe.
    expect(sql).toMatch(/CREATE POLICY shared_baskets_owner_select ON public\.shared_baskets[\s\S]*FOR SELECT[\s\S]*user_id = \(select auth\.uid\(\)\)/)
  })

  it('un panier partagé expire dans 30 jours au plus, à une date que le client ne choisit pas, et vingt actifs par compte au plus', () => {
    const sql = lire(`supabase/migrations/${MIGRATION}`)
    expect(sql).toMatch(/CREATE (OR REPLACE )?FUNCTION public\.shared_baskets_borne\(\)/)
    expect(sql).toMatch(/NEW\.created_at := now\(\)/)
    expect(sql).toMatch(/interval '30 days'/)
    expect(sql).toMatch(/>= 20/)
    expect(sql).toMatch(/CREATE TRIGGER shared_baskets_borne[\s\S]*BEFORE INSERT ON public\.shared_baskets/)
  })

  it('une adresse de push doit être celle d’un service de push connu, dix appareils par compte au plus', () => {
    const sql = lire(`supabase/migrations/${MIGRATION}`)
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.subscribe_to_push\(p_endpoint text, p_p256dh text, p_auth_key text\)/)
    for (const hote of ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'notify.windows.com', 'web.push.apple.com']) {
      expect(sql).toContain(hote)
    }
    expect(sql).toMatch(/>= 10/)
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.subscribe_to_push\(text, text, text\) FROM PUBLIC, anon/)
  })

  it('une seule règle de suppression des notifications, la règle morte du cache IA retirée, l’accès spécial ne bloque plus l’effacement de l’admin', () => {
    const sql = lire(`supabase/migrations/${MIGRATION}`)
    expect(sql).toMatch(/DROP POLICY IF EXISTS notifications_delete_own ON public\.notifications/)
    expect(sql).toMatch(/DROP POLICY IF EXISTS notifications_delete_admin_broadcast ON public\.notifications/)
    expect(sql).toMatch(/CREATE POLICY notifications_delete ON public\.notifications[\s\S]*FOR DELETE[\s\S]*recipient_id = \(select auth\.uid\(\)\)[\s\S]*public\.is_admin\(\)/)
    expect(sql).toMatch(/DROP POLICY IF EXISTS ai_cache_public_select ON public\.ai_cache/)
    expect(sql).toMatch(/ALTER TABLE public\.special_access ALTER COLUMN granted_by DROP NOT NULL/)
    expect(sql).toMatch(/FOREIGN KEY \(granted_by\) REFERENCES public\.profiles\(id\) ON DELETE SET NULL/)
  })

  it('une fonction neuve du schéma public n’est plus exécutable par défaut par les visiteurs ni les comptes', () => {
    const sql = lire(`supabase/migrations/${MIGRATION}`)
    expect(sql).toMatch(/ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated/)
  })

  it('la lecture publique de la table ne tombe qu’après la release, par une migration à part', () => {
    expect(APRES_RELEASE).toBeDefined()
    const sql = lire(`supabase/migrations/${APRES_RELEASE}`)
    expect(sql).toMatch(/DROP POLICY IF EXISTS shared_baskets_public_read ON public\.shared_baskets/)
    const readme = lire('supabase/migrations/README.md')
    expect(readme).toContain(APRES_RELEASE)
    expect(readme).toMatch(new RegExp(`${APRES_RELEASE}[\\s\\S]{0,300}attente de release|attente de release[\\s\\S]{0,300}${APRES_RELEASE}`))
  })

  it('sa sonde existe et n’écrit rien (un seul bloc DO, terminé par RAISE EXCEPTION)', () => {
    const sonde = lire(SONDE)
    expect(sonde.match(/DO \$probe\$/g)).toHaveLength(1)
    expect(sonde).toMatch(/RAISE EXCEPTION 'SONDE ecritures_publiques_bornees/)
  })

  it('le registre des migrations la liste', () => {
    expect(lire('supabase/migrations/README.md')).toContain(MIGRATION)
  })
})
