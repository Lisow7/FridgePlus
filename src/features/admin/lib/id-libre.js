// Un identifiant libre à partir d'une base : la base elle-même si personne ne
// la porte, sinon base-2, base-3… (audit du 2026-10-04, ADM-16 : la vue
// `base_recipes` REMPLACE la recette qui porte déjà l'identifiant — vérifié sur
// la vraie base le 2026-10-08 —, une création ne doit donc jamais en réutiliser
// un).
export function choisirUnIdLibre(base, pris) {
  const occupes = new Set(pris)
  if (!occupes.has(base)) return base
  for (let n = 2; ; n++) {
    if (!occupes.has(`${base}-${n}`)) return `${base}-${n}`
  }
}
