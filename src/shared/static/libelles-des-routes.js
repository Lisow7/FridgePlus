// Le libellé de chaque route, en français et en anglais — la SEULE source :
// `routes-config.js` l'accroche à chaque route (`label`), et le titre d'onglet
// se construit dessus (`@shared/lib/route-title`). La table vit dans shared/
// pour que les pages (features/) et les hooks (shared/) n'aient pas à
// importer routes/ (audit du 2026-10-04, ARCH-13).
//
// Clés : le chemin complet de la route, enfants compris (`/profile/compte`).
export const LIBELLES_DES_ROUTES = {
  '/legal':               { fr: 'Mentions légales',      en: 'Legal notice' },
  '/changelog':           { fr: 'Journal des versions',  en: 'Changelog' },
  '/faq':                 { fr: 'Questions fréquentes',  en: 'FAQ' },
  '/guide':               { fr: 'Comment ça marche',     en: 'How it works' },
  '/suppression-compte':  { fr: 'Supprimer mon compte',  en: 'Delete my account' },
  '/profile':             { fr: 'Mon profil',            en: 'My profile' },
  '/profile/identite':    { fr: 'Profil',                en: 'Profile' },
  '/profile/preferences': { fr: 'Préférences',           en: 'Preferences' },
  '/profile/activite':    { fr: 'Activité',              en: 'Activity' },
  '/profile/recompenses': { fr: 'Récompenses',           en: 'Rewards' },
  '/profile/depenses':    { fr: 'Mes dépenses',          en: 'My spending' },
  '/profile/compte':      { fr: 'Compte & sécurité',     en: 'Account & security' },
  '/login':               { fr: 'Connexion',             en: 'Sign in' },
  '/signup':              { fr: 'Créer un compte',       en: 'Create an account' },
  '/auth/recovery':       { fr: 'Nouveau mot de passe',  en: 'New password' },
  '/community':           { fr: 'Communauté',            en: 'Community' },
  '/recipe/:id':          { fr: 'Recette',               en: 'Recipe' },
  '/cart':                { fr: 'Mon panier',            en: 'My cart' },
  '/cook/:recipeId':      { fr: 'Mode cuisine',          en: 'Cooking mode' },
  '*':                    { fr: 'Page introuvable',      en: 'Page not found' },
}
