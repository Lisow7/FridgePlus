// Les FAITS de la suppression de compte, en UN seul endroit.
//
// ── Pourquoi ce fichier existe ────────────────────────────────────────────
// Google exige, pour toute app permettant de créer un compte, une URL web
// PUBLIQUE de demande de suppression : HTTPS, sans mur de connexion, et un lien
// DIRECT vers la page — pas une page d'accueil où l'information est enfouie.
// https://support.google.com/googleplay/android-developer/answer/13327111
//
// Ces mêmes faits vivaient déjà dans la FAQ de `/legal`. Les recopier dans une
// deuxième page, c'était fabriquer la prochaine divergence : ce dépôt a passé
// sa journée du 2026-09-12 à réparer des copies qui avaient dérivé (le nombre
// d'étapes du guide, écrit à TROIS endroits, faux à deux d'entre eux).
//
// 🥇 D'où la règle ici : le délai, l'adresse et le chemin dans l'app ne
// s'écrivent qu'ICI. `/legal` comme `/suppression-compte` les LISENT, et
// `src/test/unit/suppression-compte-coherence.test.js` refuse qu'une page
// annonce un délai que ce fichier ne déclare pas.

/** Le délai d'effacement définitif, en jours, sauvegardes comprises. */
export const DELAI_EFFACEMENT_JOURS = 30

/** L'adresse de recours, pour qui n'a plus l'application installée. */
export const EMAIL_SUPPRESSION = 'support@fridgeplus.app'

/** Le chemin exact dans l'app, tel qu'il s'affiche à l'écran. */
export const CHEMIN_DANS_APP = {
  fr: 'Profil → onglet « Confidentialité » → bouton « Supprimer mon compte »',
  en: 'Profile → “Privacy” tab → “Delete my account” button',
}

/**
 * Ce qui est effacé, et ce qui survit. La distinction n'est pas cosmétique :
 * Google demande explicitement de dire lesquelles des données sont SUPPRIMÉES
 * et lesquelles sont CONSERVÉES, avec la durée.
 */
export const DONNEES = {
  fr: {
    effacees: [
      'Ton compte, ton adresse e-mail et ton mot de passe',
      'Ton profil : pseudo, photo, préférences, langue, forme de frigo',
      'Le contenu de ton frigo et de ton garde-manger',
      'Tes favoris, tes recettes personnelles et tes listes de courses',
      'Ton panier, ton historique de dépenses et ton journal d’activité',
      'Tes tickets de support et les messages échangés',
    ],
    anonymisees: [
      'Les recettes que tu as publiées dans la communauté restent en ligne, mais leur auteur devient « Utilisateur supprimé » — elles ne sont plus reliées à toi',
      'Tes commentaires publics suivent la même règle',
    ],
    conservees: [
      'Le journal d’audit des actions de modération, sans donnée personnelle, pour des raisons légales',
      'Les sauvegardes chiffrées, effacées à leur tour dans le même délai',
    ],
  },
  en: {
    effacees: [
      'Your account, email address and password',
      'Your profile: username, photo, preferences, language, fridge layout',
      'The contents of your fridge and pantry',
      'Your favourites, your own recipes and your shopping lists',
      'Your cart, your spending history and your activity log',
      'Your support tickets and the messages exchanged',
    ],
    anonymisees: [
      'Recipes you published to the community stay online, but their author becomes “Deleted user” — they are no longer linked to you',
      'Your public comments follow the same rule',
    ],
    conservees: [
      'The audit log of moderation actions, with no personal data, for legal reasons',
      'Encrypted backups, erased in turn within the same period',
    ],
  },
}
