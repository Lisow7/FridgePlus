import {
  buildLookup, buildFlatList, buildFuseIndex, buildGroupInfo, findMatches,
} from '@shared/lib/matching/ingredient-text-matcher'

export async function matchReceiptLabels(labels, { lang, ingredients }) {
  const lookup = buildLookup(ingredients, lang)
  const flatList = buildFlatList(ingredients, lang)
  const fuseIndex = await buildFuseIndex(flatList)
  const groupInfo = buildGroupInfo(ingredients)

  const matched = []
  const ambiguous = []
  const seenIds = new Set()
  let unmatchedCount = 0

  for (const label of labels) {
    const { exact, ambiguous: amb } = findMatches(label, lang, lookup, flatList, fuseIndex, groupInfo)

    if (exact.length > 0) {
      for (const ing of exact) {
        if (seenIds.has(ing.id)) continue
        seenIds.add(ing.id)
        matched.push({ id: ing.id, labels: ing.labels, emoji: ing.emoji })
      }
    }
    if (amb.length > 0) {
      for (const a of amb) {
        ambiguous.push({ candidates: a.candidates })
      }
    }
    if (exact.length === 0 && amb.length === 0) {
      unmatchedCount += 1
    }
  }

  return { matched, ambiguous, unmatchedCount }
}
