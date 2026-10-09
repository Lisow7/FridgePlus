// Validator : résout les relations parent_recipe_slug → parent_recipe_id.
// Refonte Recettes Phase 2 — Sprint 18.
//
// Si la recette importée déclare des relations (variant_of, sub_recipe_of...),
// les sources fournissent souvent des SLUGS au lieu d'IDs. Ce validator :
//   - Résout slug → id via context.recipesByNameAndId
//   - Si pas résolvable → ERROR RELATIONS_PARENT_UNRESOLVED (admin doit fixer)
//   - Enrichit parsedData avec les IDs résolus
//
// Format relations input :
//   { relations: [{ type: 'variant_dietary', target_slug: 'carbonara', metadata: {...} }] }
//
// Format après résolution :
//   { relations: [{ type: 'variant_dietary', target_id: 'carbonara-classique', metadata: {...} }] }

import { makeError } from '../pipeline/orchestrator.mjs'

const ALLOWED_TYPES = new Set([
  'variant_dietary', 'variant_regional', 'variant_occasion',
  'sub_recipe', 'family', 'pairs_well', 'leftover_use', 'substitution',
])

export function relationsResolver(parsedData, context) {
  const errors = []
  const rels = parsedData?.relations

  if (!Array.isArray(rels) || rels.length === 0) {
    return { ok: true, errors: [], parsedData }
  }

  // context.recipesByNameAndId : Map<normalizedName|id, recipeId>
  const lookup = context?.recipesByNameAndId
  if (!lookup) {
    // Pas de lookup dispo = on skip mais on warning si présent
    return { ok: true, errors: [], parsedData }
  }

  const resolved = []
  rels.forEach((rel, idx) => {
    if (!ALLOWED_TYPES.has(rel?.type)) {
      errors.push(makeError('RELATIONS_PARENT_UNRESOLVED', {
        field: `relations[${idx}].type`,
        raw: rel?.type,
        suggested: `Type doit être l'un de : ${[...ALLOWED_TYPES].join(', ')}`,
      }))
      return
    }

    // Si target_id déjà fourni, garder
    if (rel.target_id) {
      if (lookup.has(rel.target_id)) {
        resolved.push({ ...rel, target_id: rel.target_id })
      } else {
        errors.push(makeError('RELATIONS_PARENT_UNRESOLVED', {
          field: `relations[${idx}].target_id`,
          raw: rel.target_id,
          suggested: 'Recette cible introuvable',
        }))
      }
      return
    }

    // Sinon résoudre depuis slug
    const slug = (rel.target_slug ?? '').toLowerCase().trim()
    if (!slug) {
      errors.push(makeError('RELATIONS_PARENT_UNRESOLVED', {
        field: `relations[${idx}]`,
        raw: rel,
        suggested: 'Manque target_id ou target_slug',
      }))
      return
    }

    const targetId = lookup.get(slug)
    if (!targetId) {
      errors.push(makeError('RELATIONS_PARENT_UNRESOLVED', {
        field: `relations[${idx}].target_slug`,
        raw: slug,
        suggested: 'Aucune recette trouvée avec ce slug',
      }))
      return
    }

    resolved.push({ type: rel.type, target_id: targetId, metadata: rel.metadata ?? null })
  })

  // Enrichit parsedData avec les relations résolues
  const newParsed = { ...parsedData, relations: resolved }
  return { ok: errors.length === 0, errors, parsedData: newParsed }
}

relationsResolver.displayName = 'relations-resolver'
