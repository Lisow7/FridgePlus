// Plafond quotidien d'e-mails PAR COMPTE, tenu en base (audit du 2026-10-04,
// BDD-08).
//
// Le limiteur de `rate-limit.ts` vit en mémoire d'instance : il repart de zéro
// à chaque démarrage à froid et ne voit pas les autres instances. Pour les
// e-mails, qui consomment le quota d'envoi partagé de Resend (lien de
// restauration, réponses du support, relances), un compte ne doit pas pouvoir
// en épuiser le quota : `public.reserver_un_email` compte les envois des
// dernières 24 heures et réserve le suivant, sous verrou (migration
// 20261005_quotas_par_compte.sql).
//
// Sans import : la fonction reçoit le client, ce qui la rend testable hors
// Deno (`quotas-par-compte.test.js`).

export const EMAILS_PAR_JOUR = 10

type ClientRpc = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
}

/**
 * Réserve l'envoi d'un e-mail pour ce compte.
 * - `'ok'`      : réservé (la ligne est écrite), l'e-mail peut partir ;
 * - `'plafond'` : déjà EMAILS_PAR_JOUR envois en 24 heures ;
 * - `'erreur'`  : la base n'a pas répondu — à l'appelant de décider, jamais en silence.
 */
export async function reserverUnEmail(admin: ClientRpc, userId: string, sorte: string): Promise<'ok' | 'plafond' | 'erreur'> {
  try {
    const { data, error } = await admin.rpc('reserver_un_email', {
      p_user_id: userId,
      p_kind: sorte,
      p_max_par_jour: EMAILS_PAR_JOUR,
    })
    if (error) return 'erreur'
    return data === true ? 'ok' : 'plafond'
  } catch {
    return 'erreur'
  }
}
