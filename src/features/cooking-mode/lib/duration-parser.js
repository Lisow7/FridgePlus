// src/features/cooking-mode/lib/duration-parser.js
//
// Extraction de durées depuis le texte d'une étape de recette.
// Retourne array trié par position dans le texte.
//
// Spec : la conception « cooking-mode-vocal » du 2026-05-19

const PATTERNS_FR = [
  { regex: /(\d+(?:[.,]\d+)?)\s*(?:heures?|h)\b/gi, multiplier: 3600 },
  { regex: /(\d+(?:[.,]\d+)?)\s*(?:minutes?|min)\b/gi, multiplier: 60 },
  { regex: /(\d+(?:[.,]\d+)?)\s*(?:secondes?|sec|s)\b/gi, multiplier: 1 },
]

const PATTERNS_EN = [
  { regex: /(\d+(?:[.,]\d+)?)\s*(?:hours?|h)\b/gi, multiplier: 3600 },
  { regex: /(\d+(?:[.,]\d+)?)\s*(?:minutes?|min)\b/gi, multiplier: 60 },
  { regex: /(\d+(?:[.,]\d+)?)\s*(?:seconds?|sec|s)\b/gi, multiplier: 1 },
]

export function parseDurations(text, lang) {
  if (!text || typeof text !== 'string') return []
  const patterns = lang === 'en' ? PATTERNS_EN : PATTERNS_FR
  const durations = []
  for (const { regex, multiplier } of patterns) {
    for (const match of text.matchAll(regex)) {
      const value = parseFloat(match[1].replace(',', '.'))
      durations.push({
        seconds: Math.round(value * multiplier),
        label: match[0].trim(),
        index: match.index,
      })
    }
  }
  return durations.sort((a, b) => a.index - b.index)
}
