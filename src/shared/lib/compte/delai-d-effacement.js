// Le délai entre la suppression d'un compte et l'effacement de ses données,
// en jours, sauvegardes comprises.
//
// Il vit dans `shared/` parce que deux modules le lisent : `legal` (la page
// publique de suppression, exigée par Google Play — qui le réexporte, cf.
// `features/legal/data/suppression-compte.js`) et `auth` (l'écran « Ton compte
// est en cours de suppression » calcule la date d'effacement). Une feature
// n'importe pas une autre feature.
//
// ⚠️ La fonction `delete-account` et la purge planifiée portent le même nombre
// côté serveur : changer ce délai, c'est changer les trois.
export const DELAI_EFFACEMENT_JOURS = 30
