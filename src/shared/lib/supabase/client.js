import { createClient } from '@supabase/supabase-js'

// Fallback values pour ne pas crasher au load si les env
// vars sont absentes (tests Vitest en CI, prerender, etc.). `createClient`
// throw « supabaseUrl is required » dès l'import si l'URL est vide, ce
// qui empêche le module d'être importé même par des tests qui mockent
// supabase plus tard.
//
// En PROD : si les env vars manquent vraiment au build Vercel, on log
// un warning console pour que le dev voit l'erreur (les appels réseau
// échoueront ensuite à l'usage). Pas de throw → permet à l'app de
// charger même partiellement (statique).
const FALLBACK_URL = 'https://placeholder.supabase.co'
const FALLBACK_KEY = 'placeholder-anon-key'

// `||` (pas `??`) : Vite peut injecter `''` (string vide) si une env var
// est absente ou explicitement vide, et `'' ?? fallback` reste `''` —
// createClient throw alors « supabaseUrl is required ». `||` fallback
// aussi pour les valeurs falsy (string vide).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_KEY

if (import.meta.env.PROD && (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY)) {
  console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquant en prod — les appels Supabase échoueront')
}

// Aucune option `lock` — et c'est voulu, l'histoire compte ici.
//
// De v3.379 (mai 2026, PR #474) au 2026-09-11, ce client passait un
// `lock: (_name, _timeout, fn) => fn()` no-op. Il corrigeait une vraie
// collision en build de production : le LockManager natif (`navigator.locks`)
// contre le double-mount StrictMode — le 2ᵉ init volait le verrou du 1ᵉʳ,
// « Lock … was released because another request stole it », `fetchProfile`
// throwait, profil affiché « – » après chaque F5. Invisible en dev.
//
// Depuis @supabase/auth-js 2.107.0, un client construit SANS `lock` n'acquiert
// plus aucun verrou : les refresh concurrents d'un même onglet sont dédoublonnés
// par le paquet, ceux de plusieurs onglets arbitrés côté serveur, et un logout
// pendant un refresh est protégé par un garde de commit. La cause du bug de mai
// ne peut donc plus se produire — et l'option, dépréciée, logguait un
// avertissement à chaque chargement de page (visible en prod). Détail :
// node_modules/@supabase/auth-js/migrations/lockless-coordination.md.
// ⚠️ Ce retrait n'est sûr qu'avec supabase-js ≥ 2.107.0 — le test
// `supabase-client-lockless.test.js` verrouille cette précondition.
//
// flowType 'pkce' : requis pour l'échange du code au retour OAuth (login Google).
// detectSessionInUrl reste à true (défaut) → supabase-js consomme le ?code= au retour.
// Sans impact sur l'auth e-mail/mot de passe existante.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { flowType: 'pkce' },
})
