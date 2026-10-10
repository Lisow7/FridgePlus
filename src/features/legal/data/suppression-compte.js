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

/** Le délai d'effacement définitif, en jours, sauvegardes comprises.
 *  Il vit dans `shared/` (l'écran de suppression en cours le lit aussi) :
 *  réexporté ici, la source reste unique. */
import { DELAI_EFFACEMENT_JOURS } from '@shared/lib/compte/delai-d-effacement'
export { DELAI_EFFACEMENT_JOURS }

/**
 * Ce qui suit la demande faite dans l'app. Le HTML servi a dit « anonymisées
 * immédiatement » jusqu'au 2026-10-10 pendant que la page disait l'inverse :
 * c'est la page qui dit vrai (fonction `delete-account` : suppression douce,
 * 30 jours, annulable). Une seule phrase désormais, lue des deux côtés.
 */
export const APRES_LA_DEMANDE = {
  fr: `Ton compte est désactivé tout de suite. Tes données sont gardées ${DELAI_EFFACEMENT_JOURS} jours, le temps de changer d’avis — en te reconnectant, ou par le lien de l’e-mail de confirmation —, puis anonymisées et définitivement effacées, sauvegardes comprises.`,
  en: `Your account is deactivated straight away. Your data is kept for ${DELAI_EFFACEMENT_JOURS} days so you can change your mind — by signing back in, or with the link in the confirmation email — then anonymised and permanently erased, backups included.`,
}

/** L'adresse de recours, pour qui n'a plus l'application installée. */
export const EMAIL_SUPPRESSION = 'support@fridgeplus.app'

/** Le chemin exact dans l'app, tel qu'il s'affiche à l'écran. */
// Gardé par `suppression-compte-dit-vrai.test.js`, qui le compare aux VRAIS
// libellés (il visait un onglet « Confidentialité » qui n'existait plus —
// audit du 2026-10-04, CPT-07).
export const CHEMIN_DANS_APP = {
  fr: 'Profil → « Compte & sécurité » → « Zone de danger » → « Supprimer mon compte »',
  en: 'Profile → “Account & security” → “Danger zone” → “Delete my account”',
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
      'Tes favoris, tes recettes personnelles, ton panier et tes listes',
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
      'Si ton compte était suspendu : une empreinte de ton adresse e-mail, qui ne permet pas de la retrouver, jusqu’à la fin de la suspension (3 ans au plus), pour empêcher une réinscription avec la même adresse',
    ],
  },
  en: {
    effacees: [
      'Your account, email address and password',
      'Your profile: username, photo, preferences, language, fridge layout',
      'The contents of your fridge and pantry',
      'Your favourites, your own recipes, your cart and your lists',
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
      'If your account was suspended: a fingerprint of your email address, from which it cannot be recovered, until the suspension ends (3 years at most), to prevent signing up again with the same address',
    ],
  },
}
