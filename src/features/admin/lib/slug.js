// Un identifiant lisible tiré d'un texte (« Soupe de légumes » → « soupe-de-legumes »).
// Module à part : l'API admin, chargée dès le démarrage (badges de l'en-tête),
// s'en sert pour fabriquer l'identifiant d'une recette neuve — importer
// `ingredient-taxonomy` pour cela ajoutait ses tables de libellés au démarrage
// (+1,6 Ko compressés, mesuré le 2026-10-08).
export function slugify(str) {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
}
