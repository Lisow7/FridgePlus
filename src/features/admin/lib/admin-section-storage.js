// Persistance de la section active du panel admin (localStorage).
// Ergonomie : l'admin retrouve sa section au lieu de repartir du dashboard
// à chaque réouverture du panel (préférence locale, fonctionnelle, pas de PII).

export const ADMIN_SECTIONS = [
  'dashboard', 'recipes', 'reports', 'reviews', 'community',
  'ingredients', 'base', 'pricing', 'quality', 'users', 'support',
  'journal', 'notifications', 'features',
]

const SECTION_KEY = 'fridge-admin-section'

/** @returns {string} section stockée valide, sinon 'dashboard'. */
export function readStoredSection() {
  try {
    const s = localStorage.getItem(SECTION_KEY)
    return s && ADMIN_SECTIONS.includes(s) ? s : 'dashboard'
  } catch {
    return 'dashboard'
  }
}

/** Mémorise la section (ignore les clés inconnues / localStorage indisponible). */
export function storeSection(key) {
  try {
    if (ADMIN_SECTIONS.includes(key)) localStorage.setItem(SECTION_KEY, key)
  } catch {
    /* ignore */
  }
}
