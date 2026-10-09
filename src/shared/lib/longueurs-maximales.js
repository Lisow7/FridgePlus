// Longueurs maximales des saisies que la base borne (migration
// 20261005_journal_et_textes_bornes.sql, audit du 2026-10-04 BDD-10).
//
// Le formulaire s'arrête AVANT la borne : une saisie plus longue serait
// refusée par la base, et le message tapé perdu sur une erreur générique.
// `textes-bornes.test.jsx` relit la borne dans la migration.

// Message de support, côté utilisateur comme côté admin (caractères).
// Base : support_messages_content_longueur, 5 000.
export const MESSAGE_SUPPORT_MAX = 5000

// Précisions de la raison d'un accès à une donnée sensible (caractères). La
// raison part dans les métadonnées du journal, que la base borne à 2 048
// octets : 300 caractères y tiennent même si chacun est échappé en \u00XX
// (6 octets), libellé le plus long compris.
export const RAISON_DETAILS_MAX = 300
