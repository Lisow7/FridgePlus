// Détection de durées dans le texte d'une étape de recette.
//
// Utilisé par CookingMode pour transformer "cuire 15 min" en bouton
// cliquable qui lance un minuteur intégré.
//
// Patterns détectés (5 langues, agnostique de la langue active) :
//   • « 15 min », « 30 minutes », « 5 mn »
//   • « 1 h », « 2 heures », « 1 h 30 », « 1h30 », « 1 h 30 min »
//   • « 30 sec », « 30 secondes » (pour les courtes durées type cuisson œuf)
//   • « 15 mins », « 30 minutos », « 30 minuten », « 15分 »
//
// Limites volontaires :
//   • Ignore les durées > 24 h (probablement des ingrédients « 1 année »)
//   • Ignore les durées < 10 sec (trop courtes pour un timer utile)
//   • Une seule unité de précision par match (pas de fractions style « 1,5 h »)

// Patterns regex multi-langues. Capture les chiffres + unité.
// Ordre important : on cherche d'abord les composés (1h30) avant les simples (1h).
const PATTERNS = [
  // Composé h+min : « 1h30 », « 1 h 30 », « 1 h 30 min »
  { regex: /(\d+)\s*h\s*(\d+)\s*(?:min|minutes?|mn|m)?(?!\w)/gi,
    parse: (m) => parseInt(m[1]) * 60 + parseInt(m[2]) },
  // Heures seules : « 2 h », « 2 heures », « 2 hours », « 2 horas », « 2 Stunden »
  { regex: /(\d+)\s*(?:h(?!\w)|heures?|hours?|horas?|stunden?|時間)/gi,
    parse: (m) => parseInt(m[1]) * 60 },
  // Minutes : « 15 min », « 30 minutes », « 30 minutos », « 30 minuten », « 15分 »
  { regex: /(\d+)\s*(?:min(?:ute|uto|uten)?s?|mn(?!\w)|分)/gi,
    parse: (m) => parseInt(m[1]) },
  // Secondes : « 30 sec », « 30 secondes », « 30 segundos », « 30 Sekunden »
  { regex: /(\d+)\s*(?:sec(?:onde|onda|onden)?s?|秒)/gi,
    parse: (m) => parseInt(m[1]) / 60 },  // en minutes (fractionnaire)
]

/**
 * Parse les durées dans un texte. Retourne tous les matches **non-chevauchants**,
 * triés par position dans le texte.
 *
 * @param {string} text — l'étape de recette
 * @returns {Array<{ start: number, end: number, minutes: number, label: string }>}
 *   • start/end : indices dans le texte (utiles pour highlight inline)
 *   • minutes : durée totale en minutes (peut être fractionnaire pour les sec)
 *   • label : texte original capturé (ex: « 1 h 30 », « 15 min »)
 */
export function parseDurations(text) {
  if (typeof text !== 'string' || !text) return []

  // Premier passage : tous les matches bruts
  const raw = []
  for (const { regex, parse } of PATTERNS) {
    regex.lastIndex = 0  // reset du curseur regex global entre appels
    let m
    while ((m = regex.exec(text)) !== null) {
      const minutes = parse(m)
      // Filtres de validité
      if (minutes < 1 / 60 * 10) continue  // < 10 sec
      if (minutes > 24 * 60) continue      // > 24 h
      raw.push({
        start: m.index,
        end:   m.index + m[0].length,
        minutes,
        label: m[0].trim(),
      })
    }
  }

  // Tri par position
  raw.sort((a, b) => a.start - b.start)

  // Élimination des chevauchements : on garde le plus long (ex: « 1h30 » vs « 1h »)
  const out = []
  for (const match of raw) {
    const last = out[out.length - 1]
    if (!last || match.start >= last.end) {
      out.push(match)
    } else if (match.end - match.start > last.end - last.start) {
      // Le nouveau est plus long → remplace
      out[out.length - 1] = match
    }
    // Sinon le précédent reste
  }

  return out
}

/**
 * Formate des minutes (potentiellement fractionnaires) en string lisible.
 * Ex: 1.5 → "1 min 30", 90 → "1 h 30", 0.5 → "30 sec".
 */
export function formatDuration(minutes, lang = 'fr') {
  const labels = {
    fr: { h: 'h',   min: 'min', sec: 'sec' },
    en: { h: 'h',   min: 'min', sec: 'sec' },
  }
  const l = labels[lang] ?? labels.fr

  if (minutes < 1) {
    return `${Math.round(minutes * 60)} ${l.sec}`
  }
  const h = Math.floor(minutes / 60)
  const m = Math.floor(minutes % 60)
  if (h > 0 && m > 0) return `${h} ${l.h} ${m}`
  if (h > 0) return `${h} ${l.h}`
  return `${m} ${l.min}`
}
