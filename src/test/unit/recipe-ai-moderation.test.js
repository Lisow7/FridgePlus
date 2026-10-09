import { describe, it, expect } from 'vitest'
import { computeAiModerationStatus } from '@features/recipes/lib/recipe-ai-moderation'

// Spec source : la conception « recipe-creation-zone-review » du 2026-06-10 (R-04)
//
// Matrice attendue :
//   submission privée / non-publique                  → 'skipped'
//   submission publique + OpenAI OK                    → 'passed'
//   submission publique + OpenAI a planté              → 'error'
//   submission publique + aucune trace (cas exceptionnel) → 'error' (fallback prudent)
//
// 'flagged' n'apparaît jamais : la soumission est bloquée avant buildRecipe().

describe('computeAiModerationStatus', () => {
  it('renvoie « skipped » pour une recette privée (proposePublic = false)', () => {
    expect(computeAiModerationStatus(false, 'passed')).toBe('skipped')
    expect(computeAiModerationStatus(false, 'error')).toBe('skipped')
    expect(computeAiModerationStatus(false, null)).toBe('skipped')
  })

  it('renvoie « passed » si OpenAI a répondu OK pour une publication publique', () => {
    expect(computeAiModerationStatus(true, 'passed')).toBe('passed')
  })

  it('renvoie « error » si OpenAI a planté pour une publication publique', () => {
    expect(computeAiModerationStatus(true, 'error')).toBe('error')
  })

  it('renvoie « error » par prudence si aucune trace OpenAI sur une publication publique', () => {
    expect(computeAiModerationStatus(true, null)).toBe('error')
    expect(computeAiModerationStatus(true, undefined)).toBe('error')
  })

  it('garde le comportement intuitif : skipped > passed/error si pas de proposePublic', () => {
    // Un user qui change d'avis et ne propose pas publique doit voir 'skipped',
    // peu importe le dernier état de la ref OpenAI dans la session.
    expect(computeAiModerationStatus(false, 'passed')).toBe('skipped')
  })
})
