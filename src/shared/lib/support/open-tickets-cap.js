// Plafond de tickets support ouverts par utilisateur — source unique côté client.
//
// Le nombre vivait en DEUX copies identiques (`features/support/api/support.js`
// et `shared/api/reports.js`). Elles n'avaient pas encore divergé au 2026-08-12,
// mais rien ne l'empêchait — d'où cette source unique.
//
// ⚠️ Ce plafond est désormais appliqué EN BASE par la policy RLS
// `support_tickets_insert` (migration `20260812_plafond_serveur_tickets_ouverts.sql`).
// Les deux existent pour des raisons différentes :
//   • le client, pour refuser AVANT l'aller-retour et afficher un message clair ;
//   • la base, parce qu'un appel PostgREST direct avec un JWT valide contourne
//     le client — c'était le défaut signalé par la revue du 2026-08-07.
//
// 🔴 Changer ce nombre impose de changer AUSSI la migration. Le garde-fou
// `src/test/unit/plafond-tickets-coherence.test.js` fait échouer la CI si les
// deux se contredisent.
export const MAX_OPEN_TICKETS = 3

// Les statuts qui comptent comme « ouvert ». Doivent correspondre à ceux de la
// policy : un désaccord bloquerait des utilisateurs légitimes, ou laisserait
// passer ce que la base refuse ensuite.
export const OPEN_TICKET_STATUSES = ['open', 'in_progress']

// Traduit le refus de la base en message que l'UI sait déjà afficher.
//
// Sans ça, `use-support-panel` (qui teste `message === 'max_tickets_reached'`)
// laisserait remonter une erreur Postgres brute — « new row violates row-level
// security policy ». Le cas est rare, le compteur client passant d'abord, mais
// il est réel : deux onglets qui envoient en même temps franchissent le
// compteur client et se font arrêter par la base.
//
// ⚠️ 42501 signale une violation de policy, pas spécifiquement le plafond. Sur
// `support_tickets` l'autre cause possible serait d'insérer au nom d'un autre
// utilisateur — ce que le code appelant ne fait jamais (il passe l'id de la
// session). Si cette table gagne d'autres règles d'insertion, revoir ce point.
export function estRefusDePlafond(error) {
  return error?.code === '42501'
}
