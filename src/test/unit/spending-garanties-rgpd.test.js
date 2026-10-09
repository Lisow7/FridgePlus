import { describe, it, expect, vi, beforeEach } from 'vitest'

// `shared/api/spending.js` porte DEUX garanties juridiques, et n'avait AUCUN test.
//
// ── Pourquoi ce fichier existe ────────────────────────────────────────────
// Trouvé par la mesure de couverture du 2026-08-28 : ce module ressortait à
// 0 % de lignes exécutées alors qu'il cumule suppression de données, écriture
// en base et conformité RGPD. Le croisement « risque × absence de couverture »
// l'a placé en tête, et la lecture a confirmé pourquoi c'est grave :
//
//   • Art. 21 (opposition au profilage) — avant chaque insert, `recordSpendingEvent`
//     interroge la RPC `is_profiling_opted_out`. Si l'utilisateur s'est opposé,
//     RIEN ne doit être écrit.
//   • Art. 17 (droit à l'effacement) — `eraseSpendingHistory` supprime
//     réellement, sans soft delete.
//
// 🔴 Le premier est un garde-fou, et ce dépôt s'est DÉJÀ fait prendre sur cette
// forme exacte : le plafond budgétaire IA a passé trois mois débranché parce que
// « SUPPRIMER UN APPEL NE CASSE RIEN — aucun test, aucun lint, aucune CI ne
// signale un garde-fou qu'on n'invoque plus »
// (cf. `budget-guard-edge.test.js`). Ici la conséquence ne serait pas un
// dépassement de budget mais l'enregistrement de données de profilage sur
// quelqu'un qui s'y est explicitement opposé.
//
// Ces tests ne vérifient donc pas seulement le comportement : ils vérifient que
// la garde est APPELÉE, et qu'aucune écriture ne part quand elle refuse.

const mockFrom = vi.hoisted(() => vi.fn())
const mockRpc  = vi.hoisted(() => vi.fn())

vi.mock('@shared/lib/supabase/client', () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
}))

import {
  recordSpendingEvent, eraseSpendingHistory, deleteSpendingEvent, listSpendingEvents,
} from '@shared/api/spending'

// Chaîne supabase-js « thenable » : chaque maillon renvoie la chaîne, et
// l'attente résout la valeur finale. Même idiome que `reports.test.js`.
function chaine(valeur, extras = {}) {
  const c = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    gte:    vi.fn().mockReturnThis(),
    order:  vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(valeur),
    ...extras,
  }
  c[Symbol.toStringTag] = 'Promise'
  c.then  = (res, rej) => Promise.resolve(valeur).then(res, rej)
  c.catch = (rej)      => Promise.resolve(valeur).catch(rej)
  return c
}

const EVENEMENT = { total_eur: 42.5, items_count: 7, items_json: [{ id: 'fr-tomate', qty: 2 }] }

describe('spending.js — Art. 21 : opposition au profilage', () => {
  beforeEach(() => { mockFrom.mockReset(); mockRpc.mockReset() })

  it('🔴 n\'écrit RIEN en base quand l\'utilisateur s\'est opposé au profilage', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })
    const res = await recordSpendingEvent('u-1', EVENEMENT)

    expect(res).toEqual({ ok: true, skipped: true })
    // Le cœur du test : aucune table n'est touchée. Vérifier seulement la
    // valeur de retour laisserait passer un insert parti quand même.
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('interroge bien la RPC de garde, avec l\'utilisateur concerné', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    mockFrom.mockReturnValue(chaine({ data: { id: 'e-1' }, error: null }))
    await recordSpendingEvent('u-1', EVENEMENT)

    // Si un remaniement retire cet appel, l'opposition devient inopérante sans
    // qu'aucune autre alarme ne se déclenche. C'est ce test qui le dit.
    expect(mockRpc).toHaveBeenCalledWith('is_profiling_opted_out', { p_user_id: 'u-1' })
  })

  it('écrit quand l\'utilisateur ne s\'est pas opposé', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const c = chaine({ data: { id: 'e-1' }, error: null })
    mockFrom.mockReturnValue(c)

    const res = await recordSpendingEvent('u-1', EVENEMENT)
    expect(mockFrom).toHaveBeenCalledWith('spending_events')
    expect(c.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u-1', items_count: 7 }))
    expect(res).toEqual({ ok: true, id: 'e-1' })
  })

  it('procède à l\'écriture si la RPC de garde ÉCHOUE — arbitrage documenté', async () => {
    // Choix explicite du module : sauter à la moindre erreur bloquerait toute
    // capture sur une indisponibilité passagère, alors que la colonne a pour
    // défaut « pas opposé ». Ce test fige l'intention pour qu'une inversion
    // future soit une décision, pas un glissement.
    mockRpc.mockResolvedValue({ data: null, error: { message: 'réseau' } })
    const c = chaine({ data: { id: 'e-2' }, error: null })
    mockFrom.mockReturnValue(c)

    const res = await recordSpendingEvent('u-1', EVENEMENT)
    expect(c.insert).toHaveBeenCalled()
    expect(res).toEqual({ ok: true, id: 'e-2' })
  })

  it('borne les valeurs négatives ou non numériques plutôt que de les écrire telles quelles', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const c = chaine({ data: { id: 'e-3' }, error: null })
    mockFrom.mockReturnValue(c)

    await recordSpendingEvent('u-1', { total_eur: -12, items_count: 3.7, items_json: null })
    expect(c.insert).toHaveBeenCalledWith(expect.objectContaining({
      total_eur: 0, items_count: 4, items_json: [],
    }))
  })

  it('refuse sans utilisateur, sans interroger la base', async () => {
    const res = await recordSpendingEvent(null, EVENEMENT)
    expect(res).toEqual({ error: 'invalid' })
    expect(mockRpc).not.toHaveBeenCalled()
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('spending.js — Art. 17 : droit à l\'effacement', () => {
  beforeEach(() => { mockFrom.mockReset(); mockRpc.mockReset() })

  it('supprime réellement, filtré sur le seul utilisateur, et rend le compte', async () => {
    const compte = chaine({ count: 5 })
    const suppr  = chaine({ error: null })
    mockFrom.mockReturnValueOnce(compte).mockReturnValueOnce(suppr)

    const res = await eraseSpendingHistory('u-1')
    expect(suppr.delete).toHaveBeenCalled()
    expect(suppr.eq).toHaveBeenCalledWith('user_id', 'u-1')
    expect(res).toEqual({ ok: true, count: 5 })
  })

  it('remonte l\'erreur au lieu d\'annoncer un effacement qui n\'a pas eu lieu', async () => {
    const compte = chaine({ count: 3 })
    const suppr  = chaine({ error: { message: 'RLS refuse' } })
    mockFrom.mockReturnValueOnce(compte).mockReturnValueOnce(suppr)

    const res = await eraseSpendingHistory('u-1')
    expect(res).toEqual({ error: 'RLS refuse' })
  })

  it('refuse sans utilisateur — un effacement non filtré serait catastrophique', async () => {
    const res = await eraseSpendingHistory(null)
    expect(res).toEqual({ error: 'invalid' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('deleteSpendingEvent refuse sans identifiant', async () => {
    const res = await deleteSpendingEvent(null)
    expect(res).toEqual({ error: 'invalid' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('deleteSpendingEvent cible l\'événement demandé', async () => {
    const c = chaine({ error: null })
    mockFrom.mockReturnValue(c)
    const res = await deleteSpendingEvent('e-9')
    expect(c.delete).toHaveBeenCalled()
    expect(c.eq).toHaveBeenCalledWith('id', 'e-9')
    expect(res).toEqual({ ok: true })
  })
})

describe('spending.js — lecture', () => {
  beforeEach(() => { mockFrom.mockReset(); mockRpc.mockReset() })

  it('rend une liste vide sur erreur plutôt que de propager', async () => {
    mockFrom.mockReturnValue(chaine({ data: null, error: { message: 'boum' } }))
    expect(await listSpendingEvents('u-1')).toEqual([])
  })

  it('rend une liste vide sans utilisateur, sans requête', async () => {
    expect(await listSpendingEvents(null)).toEqual([])
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
