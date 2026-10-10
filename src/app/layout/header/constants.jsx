// Constantes partagées par les sous-composants du Header refondu.
// Centralisé ici pour éviter les répétitions et faciliter la maintenance i18n.

// Source UNIQUE : LANGUAGES + FLAGS sont définis dans la primitive partagée.
export { LANGUAGES, FLAGS } from '@shared/ui/lang-theme-prefs'

export const SIGN_IN_LABEL = { fr: 'Se connecter', en: 'Sign in'}
export const SIGN_OUT_LABEL = { fr: 'Se déconnecter', en: 'Sign out'}
export const COMMUNITY_LABEL = { fr: 'Communauté', en: 'Community'}
export const SUPPORT_LABEL = { fr: 'Écrire au support', en: 'Support'}
export const PROFILE_LABEL = { fr: 'Mon profil', en: 'My profile'}
export const ADMIN_LABEL = { fr: 'Panneau admin', en: 'Admin panel'}
export const CART_LABEL = { fr: 'Mon panier', en: 'My cart'}
export const USER_MENU_LABEL = { fr: 'Menu utilisateur', en: 'User menu'}

export const HOME_LABEL = {
 fr: 'Fridge+ — retour à l\'accueil',
 en: 'Fridge+ — back to home',
}

// Le panier est désactivé pour EN (prix grande surface FR uniquement pour l'instant).
export function isCartDisabled(lang) {
 return lang === 'en'
}
