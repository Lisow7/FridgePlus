// Formatage de dates, centralisé (audit 2026-08-28).
//
// 🔴 Le même helper était recopié dans huit fichiers, et les dix-sept
// occurrences codaient `'fr-FR'` en dur : un administrateur anglophone lisait
// des dates en français dans toute la console d'administration. L'app est
// bilingue, ses écrans d'admin ne l'étaient qu'à moitié.
//
// Aucun module de date n'existait dans le dépôt — d'où celui-ci.

const LOCALES = { fr: 'fr-FR', en: 'en-US' }

const resoudre = (lang) => LOCALES[lang] ?? LOCALES.fr

/** Date seule : « 28/08/2026 » en français, « 8/28/2026 » en anglais. */
export function formatDate(valeur, lang = 'fr') {
  if (!valeur) return '—'
  const d = new Date(valeur)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(resoudre(lang))
}

/** Date + heure, pour les fils de discussion (support, journal, signalements). */
export function formatDateTime(valeur, lang = 'fr') {
  if (!valeur) return '—'
  const d = new Date(valeur)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(resoudre(lang), {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
