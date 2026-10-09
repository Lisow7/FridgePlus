// Moteur générique de détection de termes dans un texte d'étape de recette.
// Extrait de culinary-glossary.js pour être réutilisé par plusieurs
// dictionnaires (verbes techniques, recettes de base…) via un seul passage
// combiné sur le texte — voir step-annotations.js.

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Construit un matcher à partir d'une liste d'entrées de dictionnaire.
 * @param {Array<{formId:string, kind:string, forms:string[], payload:any}>} entries
 *   L'ORDRE compte : en cas de collision exacte de forme (même chaîne, insensible
 *   à la casse) entre deux entrées, la DERNIÈRE insérée gagne (Map.set écrase).
 * @returns {{regex: RegExp|null, index: Map<string, object>}}
 */
export function buildTermMatcher(entries) {
  const index = new Map()
  const forms = []
  for (const entry of entries) {
    for (const form of entry.forms) {
      forms.push(form)
      index.set(form.toLowerCase(), entry)
    }
  }
  // Tri par longueur décroissante : les expressions multi-mots doivent
  // matcher avant leurs sous-mots (ex. « sauce tomate » avant « tomate »).
  forms.sort((a, b) => b.length - a.length)
  const pattern = forms.map(escapeRegex).join('|')
  // Frontières de mots accent-safe : les `\b` ASCII de JS cassent autour de
  // é, è, à… → lookarounds sur les propriétés Unicode Lettre/Nombre.
  const regex = pattern ? new RegExp(`(?<![\\p{L}\\p{N}])(${pattern})(?![\\p{L}\\p{N}])`, 'giu') : null
  return { regex, index }
}

/**
 * Découpe un texte en segments, en marquant les termes détectés par le matcher.
 * Seule la 1ʳᵉ occurrence de chaque `formId` est marquée (évite le sur-surlignage).
 * @param {string} text
 * @param {{regex: RegExp|null, index: Map<string, object>}} matcher
 * @returns {Array<{type:'text',value:string} | {type:string,value:string,id:string,payload:any}>}
 */
export function splitTextWithMatcher(text, matcher) {
  if (!text) return [{ type: 'text', value: text ?? '' }]
  const { regex, index } = matcher
  if (!regex) return [{ type: 'text', value: text }]
  const segments = []
  const usedIds = new Set()
  let lastIndex = 0
  regex.lastIndex = 0
  let m
  while ((m = regex.exec(text)) !== null) {
    const form = m[1]
    const entry = index.get(form.toLowerCase())
    if (!entry || usedIds.has(entry.formId)) continue
    usedIds.add(entry.formId)
    if (m.index > lastIndex) segments.push({ type: 'text', value: text.slice(lastIndex, m.index) })
    segments.push({ type: entry.kind, kind: entry.kind, value: form, id: entry.formId, payload: entry.payload })
    lastIndex = m.index + form.length
  }
  if (lastIndex < text.length) segments.push({ type: 'text', value: text.slice(lastIndex) })
  return segments.length ? segments : [{ type: 'text', value: text }]
}
