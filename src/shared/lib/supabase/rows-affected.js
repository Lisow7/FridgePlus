// Une écriture a-t-elle VRAIMENT touché quelque chose ?
//
// Une écriture que les règles d'accès de la base filtrent ne renvoie PAS
// d'erreur : elle touche 0 ligne et rend `{ data: [], error: null }`. Sans ce
// contrôle, l'écran annonce un succès pour une écriture qui n'a pas eu lieu.
// Prouvé le 2026-10-05 sur « Supprimer mon message » du support : 0 ligne
// supprimée, message toujours en base, retiré de l'écran. (Même besoin au
// panneau admin : audit ADM-26.)
//
// À utiliser avec une requête qui DEMANDE les lignes touchées :
//   const resultat = await supabase.from('t').delete().eq('id', id).select('id')
//   return auMoinsUneLigne(resultat)        // { error, count }
export function auMoinsUneLigne({ data, error }) {
  if (error) return { error, count: 0 }
  const count = Array.isArray(data) ? data.length : 0
  if (count === 0) return { error: { code: 'no_rows_affected', message: 'no_rows_affected' }, count: 0 }
  return { error: null, count }
}
