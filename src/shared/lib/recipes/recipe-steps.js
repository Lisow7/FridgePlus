// Helpers pour les étapes de recette stockées en objet multilingue d'arrays
// parallèles : { fr:[...], en:[...], es:[...], de:[...], ja:[...] }.
//
// Invariants (cf spec Lot 2) :
//  - Réordonner / insérer / supprimer une étape opère en LOCKSTEP sur toutes
//    les langues présentes (même index) → jamais de désync entre langues.
//  - Éditer le texte ne touche QUE la langue ciblée.
//  - Toutes les fonctions sont pures (immutables) → préservent l'objet source,
//    condition du round-trip byte-identique.

export function stepLangs(steps) {
  return steps ? Object.keys(steps) : []
}

export function stepCount(steps) {
  const langs = stepLangs(steps)
  if (!langs.length) return 0
  return Math.max(...langs.map((l) => steps[l]?.length ?? 0))
}

// Ajoute une étape vide à la fin de chaque langue présente. Si aucune langue
// n'est présente (recette neuve), crée les langues `defaultLangs`.
export function addStep(steps, defaultLangs = ['fr']) {
  const langs = stepLangs(steps)
  const target = langs.length ? langs : defaultLangs
  const next = {}
  for (const l of target) next[l] = [...(steps?.[l] ?? []), '']
  return next
}

// Retire l'étape `index` dans toutes les langues présentes.
export function removeStep(steps, index) {
  const next = {}
  for (const l of stepLangs(steps)) next[l] = (steps[l] ?? []).filter((_, i) => i !== index)
  return next
}

// Déplace l'étape `from` → `to` dans toutes les langues présentes (lockstep).
export function moveStep(steps, from, to) {
  const next = {}
  for (const l of stepLangs(steps)) {
    const arr = [...(steps[l] ?? [])]
    const [item] = arr.splice(from, 1)
    arr.splice(to, 0, item)
    next[l] = arr
  }
  return next
}

// Édite le texte de l'étape `index` pour la langue `lang` uniquement.
export function setStepText(steps, lang, index, text) {
  const arr = [...(steps?.[lang] ?? [])]
  arr[index] = text
  return { ...steps, [lang]: arr }
}
