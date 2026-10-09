// Mémoire de scroll éphémère (sessionStorage), pour restaurer la position
// d'un conteneur scrollable au retour sur une vue.
//
// Cas d'usage : le panneau Recettes. On y scrolle, on clique une recette
// (navigation page pleine /recipe/:id), puis retour navigateur → on veut
// retrouver le panneau à la même position (et avec assez de cartes
// rendues, d'où le `count` qui mémorise la pagination infinie).
//
// Lecture / consommation séparées exprès : `peekPanelScroll` est PURE
// (pas d'effet de bord) pour pouvoir être appelée dans un initialiseur
// useState — que React double-invoque en StrictMode. La suppression se
// fait via `clearPanelScroll` dans un effet (idempotent).
//
// sessionStorage (pas localStorage) : intention volontairement limitée à
// l'onglet/session courant — pas de persistance longue durée, pas de
// donnée personnelle. RGPD : aucune info identifiante stockée.

// Sauve la position. `value` = { y: number, count: number, anchorId?, anchorOffset? }.
// `anchorId` = la carte en haut de l'écran, `anchorOffset` = son écart au haut du
// conteneur : au retour, la liste se reconstruit et les cartes changent de hauteur
// (notes asynchrones), un simple `y` en pixels tombait ailleurs (2026-10-02).
export function savePanelScroll(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify({
      y: value?.y ?? 0, count: value?.count ?? 0,
      anchorId: value?.anchorId ?? null, anchorOffset: value?.anchorOffset ?? 0,
    }))
  } catch {
    // sessionStorage indisponible (mode privé strict, quota) → no-op.
  }
}

// Lit la position SANS la consommer (pure). Retourne { y, count } ou null.
export function peekPanelScroll(key) {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.y !== 'number') return null
    return {
      y: parsed.y,
      count: typeof parsed.count === 'number' ? parsed.count : 0,
      anchorId: typeof parsed.anchorId === 'string' ? parsed.anchorId : null,
      anchorOffset: typeof parsed.anchorOffset === 'number' ? parsed.anchorOffset : 0,
    }
  } catch {
    return null
  }
}

// Supprime la position mémorisée (consommation). Idempotent.
export function clearPanelScroll(key) {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // no-op
  }
}

// Repère la première carte visible (`[data-recipe-id]`) d'un conteneur et son
// écart au haut du conteneur. Retourne {} si rien n'est repérable.
export function findScrollAnchor(container) {
  if (!container) return {}
  const top = container.getBoundingClientRect().top
  const card = [...container.querySelectorAll('[data-recipe-id]')]
    .find(c => c.getBoundingClientRect().bottom > top)
  if (!card) return {}
  return { anchorId: card.dataset.recipeId, anchorOffset: card.getBoundingClientRect().top - top }
}

// Remet la carte d'ancrage à son écart d'origine ; repli sur `y` si la carte
// n'est pas (encore) rendue. Idempotent : se rappelle à chaque changement de
// la liste tant que la restauration est en attente.
export function applyScrollRestore(container, restore) {
  if (!container || !restore) return
  const card = restore.anchorId
    ? [...container.querySelectorAll('[data-recipe-id]')].find(c => c.dataset.recipeId === restore.anchorId)
    : null
  if (!card) { container.scrollTop = restore.y; return }
  const top = container.getBoundingClientRect().top
  container.scrollTop += card.getBoundingClientRect().top - top - restore.anchorOffset
}

export const RECIPES_PANEL_SCROLL_KEY = 'recipes-panel-scroll'
