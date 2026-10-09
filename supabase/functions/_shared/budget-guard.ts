// Plafond budgétaire IA — hard stop à $50/mois (décision user du 2026-05-19).
//
// ── Pourquoi ce fichier existe (et pourquoi il n'existait pas) ──────────────
// Le garde a été écrit en mai dans `src/shared/lib/ai/budget-guard.js`, avec en
// tête « côté server uniquement ». Puis l'IA a déménagé du client vers les Edge
// Functions (PR #575, #578) et **le garde n'a pas suivi** : la RPC
// `get_monthly_ai_cost_cents()` était déployée et fonctionnelle, mais plus
// personne ne l'appelait. Personne ne l'a vu pendant 3 mois, parce que
// **supprimer un appel ne casse rien** — aucun test, aucun lint, aucune CI ne
// signale un garde-fou qu'on n'invoque plus.
// Constaté le 2026-08-14, cf. la note interne sur le plafond du budget IA.
//
// ── Une seule fonction en a besoin, et c'est mesuré ────────────────────────
// Les 3 fonctions IA n'ont pas le même modèle économique :
//   • `moderate-content`  → `omni-moderation-latest`, endpoint **gratuit**,
//                           `cost_cents: 0` en dur. Aucun plafond nécessaire —
//                           et surtout : le plafonner bloquerait la publication
//                           de contenu, ce qui serait pire que le mal.
//   • `scan-receipt`      → Google Vision, **quota gratuit** (1000/mois). Sa
//                           contrainte est un quota, pas une dépense en dollars,
//                           et elle a DÉJÀ son garde : `MONTHLY_FREE_QUOTA` dans
//                           `scan-receipt/index.ts` compte les lignes
//                           `ai_usage_log` du mois AVANT l'appel et rend 429.
//                           ⚠️ Ce n'est PAS le rate limit global qui protège ce
//                           quota — il borne le DÉBIT (50/min) et vit en mémoire
//                           d'instance, donc il ne survit pas à un démarrage à
//                           froid et se multiplie par le nombre d'instances. Le
//                           confondre avec le garde de quota fait croire à un
//                           trou qui n'existe pas ; la formulation précédente
//                           l'a fait, d'où cette précision (2026-08-15).
//   • `suggest-substitutes` → `gpt-4o-mini`, **seule à écrire un `cost_cents`
//                           réel**. C'est elle, et elle seule, que ce garde
//                           protège.
//
// ── Fail-open assumé ───────────────────────────────────────────────────────
// Si la RPC échoue, on LAISSE PASSER (comme la version d'origine). Une panne de
// comptage ne doit pas couper une fonctionnalité payée : le risque d'un appel
// de trop est très inférieur à celui d'un service cassé par un incident de
// télémétrie.

export const BUDGET_LIMIT_CENTS = 5000  // hard stop $50/mois
export const BUDGET_WARN_CENTS  = 3500  // soft warn $35/mois (70 %)

/**
 * Renvoie une `Response` 429 si le plafond mensuel est atteint, `null` sinon.
 * Même contrat que `applyRateLimit` — à appeler JUSTE AVANT l'appel payant,
 * donc APRÈS le cache (un cache hit ne coûte rien et ne doit pas être bloqué).
 *
 * @param supabaseAdmin client `service_role` (la RPC est `SECURITY DEFINER`)
 * @param projectedCostCents coût estimé de l'appel qu'on s'apprête à faire
 */
export async function applyBudgetGuard(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  projectedCostCents: number,
  extraHeaders: Record<string, string> = {},
): Promise<Response | null> {
  const { data, error } = await supabaseAdmin.rpc('get_monthly_ai_cost_cents')

  if (error) {
    // Fail-open, et on le dit fort : un plafond silencieusement inopérant est
    // exactement le défaut que ce fichier corrige.
    console.error('[budget-guard] RPC get_monthly_ai_cost_cents a échoué, appel LAISSÉ PASSER :', error.message)
    return null
  }

  const currentCents = Number(data) || 0

  if (currentCents + projectedCostCents > BUDGET_LIMIT_CENTS) {
    console.error(`[budget-guard] PLAFOND ATTEINT : ${currentCents} + ${projectedCostCents} > ${BUDGET_LIMIT_CENTS} cents`)
    return new Response(
      JSON.stringify({
        error: 'ai_budget_exceeded',
        limit_cents: BUDGET_LIMIT_CENTS,
        current_cents: currentCents,
      }),
      { status: 429, headers: { ...extraHeaders, 'Content-Type': 'application/json' } },
    )
  }

  if (currentCents >= BUDGET_WARN_CENTS) {
    console.warn(`[budget-guard] seuil d'alerte franchi : ${currentCents}/${BUDGET_LIMIT_CENTS} cents ce mois-ci`)
  }

  return null
}
