// Textes (fr, en) du bandeau, du pied de page, des boutons et des statuts,
// partagés avec la fenêtre des cookies et le panneau profil. Les textes des
// CATÉGORIES (« Rapports d'erreurs », « Statistiques d'usage »…) sont dans
// `consent-categories-i18n.js` : chargés au démarrage, le bandeau et le pied
// de page n'en ont pas besoin (poids de démarrage, 2026-10-06).

export const I18N = {
  fr: {
    bannerTitle:      '🍪 Cookies et données',
    bannerIntro:      "Fridge+ garde sur ton appareil ce qu'il faut pour fonctionner (ta session, tes préférences). Avec ton accord, l'app envoie aussi ses erreurs à Sentry et note les étapes que tu y franchis, pour s'améliorer. Choisis ce que tu acceptes — modifiable à tout moment.",
    bannerSeeMore:    'Voir la politique de confidentialité',
    btnAcceptAll:     'Tout accepter',
    btnRefuseAll:     'Tout refuser',
    btnCustomize:     'Personnaliser',
    btnSave:          'Enregistrer mes choix',
    btnClose:         'Fermer',
    btnReset:         'Réinitialiser mes choix',

    profileTabTitle:  'Confidentialité',
    profileIntro:     "Gère ici les données que Fridge+ stocke sur ton appareil. Tu peux changer tes choix à tout moment, c'est ton droit (RGPD art. 7-3).",
    profileCurrent:   'Dernière mise à jour',
    profileSeePolicy: 'Voir la politique de confidentialité',
    profileResetWarn: "Réinitialiser efface tes préférences cookies et révoque ton acceptation de la charte de la communauté (tu devras la ré-accepter pour interagir à nouveau). Tes données de compte (frigo, recettes, favoris, publications) ne sont pas affectées.",

    statusAccepted:   'Accepté',
    statusRefused:    'Refusé',
    statusAlways:     'Toujours actif',

    footerBtn:        'Cookies',
  },

  en: {
    bannerTitle:      '🍪 Cookies and data',
    bannerIntro:      "Fridge+ keeps what it needs on your device to work (your session, your preferences). With your consent, the app also sends its errors to Sentry and records the steps you take in it, to improve. Choose what you accept — changeable anytime.",
    bannerSeeMore:    'View the privacy policy',
    btnAcceptAll:     'Accept all',
    btnRefuseAll:     'Refuse all',
    btnCustomize:     'Customize',
    btnSave:          'Save my choices',
    btnClose:         'Close',
    btnReset:         'Reset my choices',

    profileTabTitle:  'Privacy',
    profileIntro:     "Manage the data Fridge+ stores on your device here. You can change your choices anytime — it's your right (GDPR art. 7-3).",
    profileCurrent:   'Last update',
    profileSeePolicy: 'View the privacy policy',
    profileResetWarn: "Resetting clears your cookie preferences and revokes your acceptance of the community charter (you will need to accept it again to interact). Your account data (fridge, recipes, favorites, published posts) is not affected.",

    statusAccepted:   'Accepted',
    statusRefused:    'Refused',
    statusAlways:     'Always on',

    footerBtn:        'Cookies',
  },

}
