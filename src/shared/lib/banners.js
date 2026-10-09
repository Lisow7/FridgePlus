// Catalogue de bannières de profil. Statique, comme les avatars (avatars.js).
// Partagé (profil + communauté) → vit dans @shared/ (pas de cross-feature).
//
// Deux familles :
//   • Bannières LIBRES (sobres) — dispo par défaut (warm-sunset = défaut).
//   • Bannières de RÉCOMPENSE (kind 'quest') — chacune incarne un palier de
//     badge : dégradé signature unique + emoji « héros » + reflet. Verrouillées
//     tant que le palier n'est pas atteint (cf. achievements.js, BADGE_DEFINITIONS
//     `reward.banner`). C'est la « récompense ».
//
// kind : 'gradient' (value = CSS) · 'color' (value = hex + motif points) ·
//        'quest' (value = dégradé signature + hero = emoji représentatif).
// Ne jamais renommer un `id` publié (clé en BDD profiles.banner_id).

export const BANNER_CATALOG = [
  // ── Libres (sobres) ───────────────────────────────────────────────
  { id: 'warm-sunset', kind: 'gradient', value: 'linear-gradient(135deg,#F7A85E 0%,#D46A10 100%)' },
  { id: 'forest',      kind: 'color',    value: '#2F6E5B' },
  { id: 'slate',       kind: 'color',    value: '#3A4250' },

  // ── Récompenses de quête (signature + héros) ──────────────────────
  // 🍳 Premier plat — débuts en cuisine
  { id: 'veggies', kind: 'quest', value: 'linear-gradient(135deg,#8FCB6E 0%,#2F7A4E 100%)', hero: '🍳' },
  // 👨‍🍳 Chef en herbe — volume
  { id: 'bakery',  kind: 'quest', value: 'linear-gradient(135deg,#F2C14E 0%,#C8821E 100%)', hero: '👨‍🍳' },
  // 🍲 Chef confirmé — gros volume
  { id: 'plum',    kind: 'quest', value: 'linear-gradient(135deg,#A86BC9 0%,#5B2A78 100%)', hero: '🍲' },
  // 🌍 Tour du monde — pays
  { id: 'spices',  kind: 'quest', value: 'linear-gradient(135deg,#F0894B 0%,#B23A1E 100%)', hero: '🌍' },
  // 🗺️ Globe-trotteur — beaucoup de pays
  { id: 'ocean',   kind: 'quest', value: 'linear-gradient(135deg,#5BC0DE 0%,#1E5A8A 100%)', hero: '🗺️' },
  // 🔥 Régulier·e — série
  { id: 'ember',   kind: 'quest', value: 'linear-gradient(135deg,#FF8A3D 0%,#C2280C 100%)', hero: '🔥' },
  // ⚡ Assidu·e — longue série
  { id: 'berry',   kind: 'quest', value: 'linear-gradient(135deg,#F25BA0 0%,#8E2C6A 100%)', hero: '⚡' },
  // 🏆 Légende — série exceptionnelle
  { id: 'mint-fresh', kind: 'quest', value: 'linear-gradient(135deg,#FBD46D 0%,#B8860B 100%)', hero: '🏆' },

  // 🥘 Volume — tier 4 (au-delà de « Chef confirmé »)
  { id: 'copper',      kind: 'quest', value: 'linear-gradient(135deg,#D98C4A 0%,#7A3E12 100%)', hero: '🥘' },
  // 👑 Volume — tier 5 (palier maximal)
  { id: 'crown-gold',  kind: 'quest', value: 'linear-gradient(135deg,#F5D77B 0%,#2E2A1A 100%)', hero: '👑' },
  // 🧭 Monde — tier 3 (palier maximal)
  { id: 'horizon',     kind: 'quest', value: 'linear-gradient(135deg,#4A6FA5 0%,#14213D 100%)', hero: '🧭' },
  // 🌈 Variété — tier 1
  { id: 'aurora',      kind: 'quest', value: 'linear-gradient(135deg,#5EEAD4 0%,#0F766E 100%)', hero: '🌈' },
  // 🎨 Variété — tier 2
  { id: 'violet-muse', kind: 'quest', value: 'linear-gradient(135deg,#818CF8 0%,#3730A3 100%)', hero: '🎨' },
  // 💫 Variété — tier 3 (palier maximal)
  { id: 'starlight',   kind: 'quest', value: 'linear-gradient(135deg,#CBD5E1 0%,#1E293B 100%)', hero: '💫' },
]

export const DEFAULT_BANNER_ID = BANNER_CATALOG[0].id

/** Entrée du catalogue pour un id (fallback = 1re bannière = dégradé de marque). */
export function getBanner(bannerId) {
  return BANNER_CATALOG.find((b) => b.id === bannerId) ?? BANNER_CATALOG[0]
}
