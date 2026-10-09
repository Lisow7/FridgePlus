// Les langues proposées, et celle du visiteur.
//
// 🔴 Deux langues : `fr` et `en`. Cette liste FAIT FOI (le README et
// docs/ARCHITECTURE.md y renvoient). Un réglage hérité 'es'/'de'/'ja' est
// migré vers 'en' au démarrage par `ui-provider.jsx`.
//
// Sortie de `ui-provider.jsx` le 2026-10-08 (audit ARCH-06) : le filet d'erreur
// racine, monté AU-DESSUS du fournisseur de langue, a besoin de la langue du
// visiteur — il parlait français à tout le monde — et un fichier de composant
// ne doit exporter que des composants (rechargement à chaud de React).
export const SUPPORTED_LANGS = new Set(['fr', 'en'])

/** La langue du visiteur, SANS effet de bord (rien n'est écrit). */
export function langueDuVisiteur() {
  try {
    const saved = localStorage.getItem('fridge-lang')
    if (saved && SUPPORTED_LANGS.has(saved)) return saved
    // Un ancien réglage 'es'/'de'/'ja' : EN (international). Pas FR, le
    // visiteur a explicitement exprimé une préférence non francophone.
    if (saved) return 'en'
    const browser = (navigator.language ?? 'fr').slice(0, 2)
    if (SUPPORTED_LANGS.has(browser)) return browser
    // Non supporté → EN par défaut (couverture internationale plus large que FR).
    return 'en'
  } catch { return 'fr' }
}
