// Prix affichés, par langue (audit du 2026-10-04, UX-15) : dix sites arrondissaient
// à deux décimales et posaient la virgule à la main — un anglophone lisait « 4,99 € ».
// `Intl.NumberFormat` connaît les deux règles : « 4,99 € » en français, « €4.99 »
// en anglais. L'espace avant « € » reste une espace simple pour l'instant
// (Intl rend une fine insécable ; les insécables viennent avec leur propre lot).
const LOCALE = { fr: 'fr-FR', en: 'en-GB' }

/**
 * @param {number} valeur en euros
 * @param {'fr'|'en'} lang
 * @param {{ approx?: boolean }} options `approx` : « ~ » devant (estimation)
 * @returns {string|null} null si ce n'est pas un nombre
 */
export function formatPrix(valeur, lang = 'fr', { approx = false } = {}) {
  if (!Number.isFinite(valeur)) return null
  const texte = new Intl.NumberFormat(LOCALE[lang] ?? LOCALE.fr, { style: 'currency', currency: 'EUR' })
    .format(valeur)
    .replace(/\s/g, ' ') // `\s` couvre l'insécable et la fine insécable que rend Intl
  return approx ? `~${texte}` : texte
}
