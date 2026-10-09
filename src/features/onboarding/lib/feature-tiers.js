// Source unique du tier d'accès par feature (onboarding + pastilles).
// 'soon' = premium ; affiché « Prochainement » tant que PREMIUM_ENABLED=false.
export const FEATURE_TIER = {
  fridge: 'free', recipes: 'free', voice: 'free', filters: 'free',
  favorites: 'account', community: 'account', create: 'account', profile: 'account',
  cart: 'soon', costs: 'soon', cooking: 'soon', lists: 'soon', share: 'soon',
}
