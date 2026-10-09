// Résout le layout du frigo : la LANGUE ne fournit que les libellés, la FORME
// vient de la préférence utilisateur (`profiles.fridge_shape`, null = défaut).
// Décision user 2026-08-27 : même forme par défaut dans toutes les langues
// (avant, fr → top-freezer et en → side-by-side, et changer de langue
// changeait le frigo).
//
// `fr` et `en` partagent exactement les mêmes compartiments/sous-catégories
// (vérifié en base le 2026-08-27) : écraser `type` suffit, tout le reste
// (largeur 500/400, aiguillage FridgeTopFreezer/SideBySide) en découle déjà.

// Les formes proposables dans Profil > Préférences. `multi-door` existe en
// code mais dort — ne l'ajouter ici qu'avec une vraie passe UI/QA.
export const FRIDGE_SHAPES = ['top-freezer', 'side-by-side']

export const DEFAULT_FRIDGE_SHAPE = 'top-freezer'

export function resolveFridgeLayout({ layouts, lang, shape }) {
  const base = layouts?.[lang] ?? layouts?.fr ?? null
  if (!base) return null
  // Toute valeur hors liste (donnée corrompue, forme future pas encore
  // proposée) retombe sur le défaut — la CHECK en base garde la porte, ceci
  // garde le client.
  const forme = FRIDGE_SHAPES.includes(shape) ? shape : DEFAULT_FRIDGE_SHAPE
  return base.type === forme ? base : { ...base, type: forme }
}
