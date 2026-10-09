// Le nom de chaque action du journal d'activité, en un seul endroit (audit du
// 2026-10-04, ADM-06 et ADM-21).
//
// Le journal et le tableau de bord avaient chacun leur table : des mots qui se
// contredisaient pour la même action (« Post communauté masqué » ici,
// « supprimé » là), des noms pour des actions que rien n'écrit, et AUCUN pour
// les sept actions réellement présentes en base (`profile_data_viewed` ×77,
// `notification_sent`…), qui ne s'affichaient que sous leur nom brut, et
// seulement dans « Tous ».
//
// Glossaire (ADM-21) : « masqué(e) » = réversible ; « supprimé(e)
// définitivement » = irréversible.
//
// Garde-fou : `src/test/unit/journal-tout-a-un-nom.test.js` relit ce que le
// code et les migrations écrivent au journal, et exige un nom pour chaque
// action — et une action écrite pour chaque nom.

export const LIBELLES_DU_JOURNAL = {
  // Recettes
  recipe_submitted:            { label: 'Recette soumise',                   color: 'var(--color-warning)', group: 'Recettes' },
  recipe_approved:             { label: 'Recette approuvée',                 color: 'var(--color-success)', group: 'Recettes' },
  recipe_rejected:             { label: 'Recette rejetée',                   color: 'var(--color-danger)',  group: 'Recettes' },
  recipe_pending:              { label: 'Recette remise en attente',         color: 'var(--color-warning)', group: 'Recettes' },
  recipe_edited:               { label: 'Recette modifiée',                  color: 'var(--color-info)',    group: 'Recettes' },
  recipe_deleted:              { label: 'Recette supprimée',                 color: 'var(--color-danger)',  group: 'Recettes' },
  recipe_self_deleted_rgpd:    { label: 'Recette supprimée par son auteur',  color: 'var(--color-danger)',  group: 'Recettes' },
  recipe_promoted:             { label: 'Recette promue au catalogue',       color: 'var(--color-success)', group: 'Recettes' },
  // Comptes
  account_soft_deleted:        { label: 'Compte mis en suppression',         color: 'var(--color-danger)',  group: 'Utilisateurs' },
  account_restored:            { label: 'Compte restauré',                   color: 'var(--color-success)', group: 'Utilisateurs' },
  account_anonymized:          { label: 'Compte anonymisé',                  color: 'var(--color-info)',    group: 'Utilisateurs' },
  account_anonymization_failed:{ label: 'Anonymisation impossible',          color: 'var(--color-danger)',  group: 'Utilisateurs' },
  unconfirmed_account_kept:    { label: 'Compte non confirmé gardé',         color: 'var(--color-warning)', group: 'Utilisateurs' },
  user_banned:                 { label: 'Utilisateur banni',                 color: 'var(--color-danger)',  group: 'Utilisateurs' },
  user_unbanned:               { label: 'Utilisateur débanni',               color: 'var(--color-success)', group: 'Utilisateurs' },
  special_access_granted:      { label: 'Accès spécial accordé',             color: 'var(--color-success)', group: 'Utilisateurs' },
  special_access_revoked:      { label: 'Accès spécial retiré',              color: 'var(--color-warning)', group: 'Utilisateurs' },
  // Catalogue
  ingredient_added:            { label: 'Ingrédient ajouté',                 color: 'var(--color-success)', group: 'Données' },
  ingredient_updated:          { label: 'Ingrédient modifié',                color: 'var(--color-info)',    group: 'Données' },
  ingredient_deleted:          { label: 'Ingrédient supprimé',               color: 'var(--color-danger)',  group: 'Données' },
  base_recipe_added:           { label: 'Recette catalogue ajoutée',         color: 'var(--color-success)', group: 'Données' },
  base_recipe_updated:         { label: 'Recette catalogue modifiée',        color: 'var(--color-info)',    group: 'Données' },
  base_recipe_deleted:         { label: 'Recette catalogue supprimée',       color: 'var(--color-danger)',  group: 'Données' },
  i18n_auto_translated:        { label: 'Traduction automatique',            color: 'var(--color-info)',    group: 'Données' },
  // Communauté et avis (« masqué » réversible, « supprimé définitivement » non)
  community_post_deleted:      { label: 'Post communauté masqué',            color: 'var(--color-danger)',  group: 'Communauté' },
  community_post_purged:       { label: 'Post communauté supprimé définitivement', color: '#7F1D1D',      group: 'Communauté' },
  community_reply_deleted:     { label: 'Réponse communauté masquée',        color: 'var(--color-danger)',  group: 'Communauté' },
  community_reply_purged:      { label: 'Réponse communauté supprimée définitivement', color: '#7F1D1D',  group: 'Communauté' },
  community_user_muted:        { label: 'Utilisateur mis en sourdine',       color: 'var(--color-warning)', group: 'Communauté' },
  community_user_unmuted:      { label: 'Sourdine levée',                    color: 'var(--color-success)', group: 'Communauté' },
  recipe_review_deleted:       { label: 'Avis masqué',                       color: 'var(--color-danger)',  group: 'Modération' },
  recipe_review_purged:        { label: 'Avis supprimé définitivement',      color: '#7F1D1D',              group: 'Modération' },
  // RGPD
  sensitive_data_accessed:     { label: 'Données sensibles consultées',      color: '#7C5CAF',              group: 'RGPD' },
  profile_data_viewed:         { label: 'Données du profil consultées',      color: '#7C5CAF',              group: 'RGPD' },
  profile_data_exported:       { label: 'Données du profil exportées',       color: '#7C5CAF',              group: 'RGPD' },
  // Panneau admin
  notification_sent:           { label: 'Notification envoyée',              color: 'var(--color-info)',    group: 'Panneau' },
  notification_broadcast_retracted: { label: 'Notification retirée',         color: 'var(--color-danger)',  group: 'Panneau' },
  feature_flag_toggled:        { label: 'Fonctionnalité basculée',           color: 'var(--color-warning)', group: 'Panneau' },
}
