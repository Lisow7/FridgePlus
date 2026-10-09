// Couleurs et dates des écrans pleins du compte (suppression en cours, compte
// désactivé). Séparés des composants : un fichier de composants n'exporte que
// des composants (rafraîchissement à chaud).

// Orange plus soutenu que celui de la marque : 5,1:1 sous un texte blanc,
// 4,7:1 en texte sur le fond clair (la palette, A11Y-03, reste à trancher).
export const ORANGE_LISIBLE = '#B4520E'

export function couleursDuCompte(darkMode) {
  return darkMode
    ? { fond: '#0F1923', carte: '#14202D', texte: 'var(--color-bg-warm)', doux: '#A0A8B8', bord: 'var(--color-dark-border)', accent: '#F7A85E', erreur: '#F59B9B', note: '#16263A', noteTexte: '#9CC3F5' }
    : { fond: '#FBF6EF', carte: '#FFFFFF', texte: '#2C1A0E', doux: '#6B5A44', bord: '#E3D5C2', accent: ORANGE_LISIBLE, erreur: '#B42318', note: '#EAF2FF', noteTexte: '#1D4FA0' }
}

// « 4 novembre 2026 » : le jour de Paris, pour que l'écran et l'e-mail disent
// la même date.
export function dateLongue(iso, lang) {
  return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })
}
