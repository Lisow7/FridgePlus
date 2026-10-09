// v3.205.0 — Helper CORS partagé pour les Edge Functions Supabase.
//
// Avant : `Access-Control-Allow-Origin: '*'` partout. Conséquence : un
// site tiers pouvait envoyer une requête depuis le navigateur d'un user
// avec son JWT (volé via XSS / extension malveillante / phishing) et
// invoquer nos endpoints sensibles (delete-account, restore-account,
// auto-translate-deepl, etc.).
//
// Après : whitelist d'origines connues. La requête est acceptée
// uniquement si l'`Origin` envoyé par le navigateur matche un pattern
// autorisé. Sinon, le browser bloque la réponse côté client (mais le
// serveur traite quand même la requête → ne PAS s'en servir comme
// authz, c'est juste un layer défensif anti-CSRF).
//
// La whitelist est partiellement codée en dur (patterns standards :
// fridge-plus.com, *.vercel.app, lisow7.github.io, localhost:*) +
// extensible via env var `EXTRA_ALLOWED_ORIGINS` (CSV de domaines
// exacts) pour les cas non-prévus.

const STATIC_ALLOWED_PATTERNS: RegExp[] = [
  // Production réelle (cf. CONTRIBUTING.md : Vercel déploie fridgeplus.app depuis `main`)
  /^https:\/\/fridgeplus\.app$/,
  /^https:\/\/www\.fridgeplus\.app$/,
  // Ancien nom de domaine envisagé, gardé au cas où
  /^https:\/\/fridge-plus\.com$/,
  /^https:\/\/www\.fridge-plus\.com$/,
  // Vercel previews + production deployment URL
  /^https:\/\/fridge-plus(-[a-z0-9-]+)?\.vercel\.app$/,
  /^https:\/\/fridge-plus-[a-z0-9-]+-lisows-projects-[a-z0-9-]+\.vercel\.app$/,
  // GitHub Pages (vitrine actuelle pré-launch)
  /^https:\/\/lisow7\.github\.io$/,
  // Dev local (Vite essaie 5173 → 5200 selon ports occupés)
  /^http:\/\/localhost:\d{4,5}$/,
  /^http:\/\/127\.0\.0\.1:\d{4,5}$/,
]

function isOriginAllowed(origin: string): boolean {
  if (!origin) return false
  if (STATIC_ALLOWED_PATTERNS.some(p => p.test(origin))) return true
  // Extension via env var : CSV de domaines exacts (pas de regex pour
  // rester simple et auditable côté ops)
  const extra = Deno.env.get('EXTRA_ALLOWED_ORIGINS') ?? ''
  if (extra) {
    const list = extra.split(',').map(s => s.trim()).filter(Boolean)
    if (list.includes(origin)) return true
  }
  return false
}

/**
 * Retourne les headers CORS à utiliser dans la réponse de l'Edge Function.
 * Reflète l'`Origin` request si autorisé, sinon `'null'` (rejet browser).
 *
 * Toujours appeler avec la `Request` reçue par `serve(async (req) => …)`.
 */
export function getCorsHeaders(req: Request, methods: string = 'POST, OPTIONS'): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const allowed = isOriginAllowed(origin)
  return {
    'Access-Control-Allow-Origin':  allowed ? origin : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
    'Access-Control-Allow-Methods': methods,
    'Vary': 'Origin',
  }
}
