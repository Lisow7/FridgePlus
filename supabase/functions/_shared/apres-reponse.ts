// Une écriture au mieux (cache, journal d'usage) qui part APRÈS la réponse,
// sans la retarder ni la faire échouer.
//
// Pourquoi (audit du 2026-10-04, BDD-18 (5)) : `void supabaseAdmin.from(…)`
// n'écrit JAMAIS. Un constructeur de requête supabase-js n'envoie rien tant
// que personne n'appelle `then()` : le `fetch` n'existe que là. D'où zéro ligne
// `moderation` dans `ai_cache` et `ai_usage_log` depuis juillet. Ici, la
// promesse est consommée ; Supabase Edge fournit `EdgeRuntime.waitUntil` pour
// qu'elle survive au `return` de la réponse. Sans lui (tests, autre hôte), elle
// court quand même, et un rejet ne devient jamais un rejet non géré.
export function runAfterResponse(p: PromiseLike<unknown>): void {
  const sure = Promise.resolve(p).catch((err: unknown) => {
    console.warn('[apres-reponse] écriture au mieux échouée :', String((err as { message?: unknown })?.message ?? err).slice(0, 300))
  })
  const er = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime
  if (er?.waitUntil) er.waitUntil(sure)
}
