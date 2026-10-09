// Validator : détecte les doublons de nom FR avec recettes existantes.
// Refonte Recettes Phase 2 — Sprint 18.
//
// Stratégie :
//   - Normalise le nom : lowercase + trim + accents retirés
//   - Compare au catalogue context.existingRecipes (Map<normalized_name, id>)
//   - Match exact → WARNING DUPLICATE_NAME_EXACT
//   - Match fuzzy (Levenshtein <=2 sur normalisé) → WARNING DUPLICATE_NAME_FUZZY
//
// Pour atteindre 1000+ recettes, on veut éviter "Bolognaise" + "Bolognese" en doublon.

import { makeError } from '../pipeline/orchestrator.mjs'

export function duplicateDetector(parsedData, context) {
  const errors = []
  const name = pickFrName(parsedData?.name)
  const existing = context?.existingRecipes // Map<normalized, id>

  if (!name || !existing) return { ok: true, errors: [], parsedData }

  const normalized = normalize(name)
  if (!normalized) return { ok: true, errors: [], parsedData }

  // Exclude self (si on re-valide une recette existante)
  const ownId = parsedData?.id
  const matchExact = existing.get(normalized)
  if (matchExact && matchExact !== ownId) {
    errors.push(makeError('DUPLICATE_NAME_EXACT', {
      field: 'name.fr',
      raw: name,
      suggested: `Doublon exact avec recette ID "${matchExact}". Différencier ou fusionner.`,
    }))
    return { ok: false, errors, parsedData }
  }

  // Fuzzy : Levenshtein <= 2 (utilise pure JS, pas d'extension Postgres)
  for (const [existingNorm, existingId] of existing) {
    if (existingId === ownId) continue
    if (levenshtein(normalized, existingNorm) <= 2 && existingNorm !== normalized) {
      errors.push(makeError('DUPLICATE_NAME_FUZZY', {
        field: 'name.fr',
        raw: name,
        suggested: `Très proche de la recette ID "${existingId}" (norm: "${existingNorm}"). Vérifier doublon.`,
      }))
      break // 1 fuzzy match suffit pour flagger
    }
  }

  return { ok: errors.length === 0, errors, parsedData }
}

duplicateDetector.displayName = 'duplicate-detector'

function pickFrName(name) {
  if (!name) return null
  if (typeof name === 'string') return name
  return name.fr ?? name.en ?? Object.values(name)[0] ?? null
}

function normalize(str) {
  if (!str || typeof str !== 'string') return ''
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // strip diacritics
    .replace(/\s+/g, ' ')
    .trim()
}

// Levenshtein distance — itératif, optimisé pour strings courts (<100 chars)
function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i])
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1,     // deletion
        )
      }
    }
  }
  return matrix[b.length][a.length]
}
