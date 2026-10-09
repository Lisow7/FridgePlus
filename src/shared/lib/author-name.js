// Le nom à afficher pour l'auteur d'un post, d'une réponse ou d'un avis.
//
// Trois cas qu'il ne faut pas confondre :
//   • le pseudo ;
//   • « Utilisateur supprimé » : le compte n'existe plus ;
//   • « Auteur non chargé » : la lecture des profils a échoué
//     (`profileUnavailable`, posé par `withAuthorProfiles`). Ce n'est PAS un
//     compte supprimé — un chargement raté ne doit pas se faire passer pour une
//     donnée (audit du 2026-10-04, lot 7).
export function authorName(row, t) {
  if (row?.profile?.username) return row.profile.username
  return row?.profileUnavailable ? t.authorUnavailable : t.deletedAuthor
}
