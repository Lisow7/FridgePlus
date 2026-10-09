// Une image « sur mesure » vient de la base : `recipes_unified.image_url`,
// `ingredients.image_url`. Celle d'une recette communautaire est écrite par son
// auteur. Sans contrôle, il y mettait l'adresse de son propre serveur, et chaque
// visiteur dont la liste affichait la carte lui envoyait son adresse IP, son
// navigateur et la page consultée (audit du 2026-10-04, SEC-15).
//
// Seul le stockage public DU PROJET est donc chargé. Tout le reste (autre site,
// autre projet Supabase, `data:`, adresse relative au protocole…) est refusé, et
// l'appelant retombe sur l'emoji.
//
// La même règle est posée en base (contrainte `recipes_unified_image_url_check`) ;
// celle-ci protège aussi des lignes qui lui seraient antérieures.
const STOCKAGE_PUBLIC = '/storage/v1/object/public/'

export function isProjectStorageUrl(url) {
  if (typeof url !== 'string' || !url) return false
  // Lu à l'appel, pas au chargement du module : les tests le font varier.
  const projet = import.meta.env.VITE_SUPABASE_URL
  if (!projet) return false
  // Le préfixe se termine par un chemin : `https://projet.supabase.co.autre.tld/…`
  // ne peut pas commencer par lui.
  return url.startsWith(projet.replace(/\/+$/, '') + STOCKAGE_PUBLIC)
}
