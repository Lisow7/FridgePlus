// v3.206.0 — Rate limiter en mémoire pour Edge Functions Supabase.
//
// Approche pragmatique pré-launch : pas de Redis ni table SQL persistée.
// On utilise un Map<key, timestamps[]> dans la mémoire de l'instance Deno.
// Tant que l'instance reste "warm" (1-15 min selon traffic), le compteur
// est partagé entre les requêtes successives. Au cold-start, le compteur
// est reset → le rate limit est conservateur (peut autoriser 2× la quota
// juste après un cold-start, acceptable pour la cible : empêcher le spam
// agressif, pas la fraude commerciale).
//
// Pour une protection plus forte (ex : bruteforce auth distribué), upgrader
// vers une table Postgres `rate_limits(key text PK, hits jsonb)` ou
// Cloudflare Turnstile / Upstash Redis post-launch.

const buckets = new Map<string, number[]>()

/**
 * Renvoie `true` si la requête peut passer, `false` si elle doit être rejetée
 * (429 Too Many Requests).
 *
 * @param key      identifiant unique (ex : `${endpoint}:${ip}` ou `${endpoint}:${userId}`)
 * @param max      nombre max de requêtes autorisées dans la fenêtre
 * @param windowMs taille de la fenêtre glissante en ms
 */
export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const fresh = (buckets.get(key) ?? []).filter(t => now - t < windowMs)
  if (fresh.length >= max) {
    buckets.set(key, fresh)
    return false
  }
  fresh.push(now)
  buckets.set(key, fresh)
  // Cleanup périodique pour éviter de retenir des millions de buckets
  // morts (ex : si l'IP du dernier requester ne revient jamais)
  if (buckets.size > 1000) {
    for (const [k, v] of buckets) {
      const last = v[v.length - 1] ?? 0
      if (last < now - windowMs * 2) buckets.delete(k)
    }
  }
  return true
}

/**
 * Extrait l'IP du client depuis les headers HTTP (Vercel / Cloudflare /
 * Supabase Edge runtime). Fallback : `'unknown'`. Ne JAMAIS faire confiance
 * à ces headers pour de l'authn — uniquement comme key de regroupement.
 *
 * Ordre (audit du 2026-10-04, BDD-08) : `cf-connecting-ip`, posé par le proxy,
 * passe en premier. La PREMIÈRE valeur de `X-Forwarded-For` est celle que
 * l'appelant envoie lui-même : la prendre comme clé laissait un appel anonyme
 * changer de compteur à chaque requête. En dernier recours, la DERNIÈRE valeur
 * (celle qu'ajoute le proxy le plus proche).
 */
export function getClientIp(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  const reelle = req.headers.get('x-real-ip')?.trim()
  if (reelle) return reelle
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const sauts = xff.split(',').map((s) => s.trim()).filter(Boolean)
    if (sauts.length) return sauts[sauts.length - 1]
  }
  return 'unknown'
}

/**
 * Helper combiné : check + retourne une Response 429 prête à être renvoyée.
 * Usage :
 *   const limited = applyRateLimit(req, 'delete-account', { max: 3, windowMs: 60_000 }, userId)
 *   if (limited) return limited
 */
export function applyRateLimit(
  req: Request,
  endpoint: string,
  opts: { max: number; windowMs: number },
  authKey?: string | null,
  extraHeaders: Record<string, string> = {},
): Response | null {
  const key = `${endpoint}:${authKey ?? getClientIp(req)}`
  if (!checkRateLimit(key, opts.max, opts.windowMs)) {
    const retryAfter = Math.ceil(opts.windowMs / 1000)
    return new Response(
      JSON.stringify({ error: 'rate_limited', retry_after_s: retryAfter }),
      {
        status: 429,
        headers: {
          ...extraHeaders,
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
        },
      },
    )
  }
  return null
}
