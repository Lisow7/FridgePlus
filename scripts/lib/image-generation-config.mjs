// Config de génération d'images — modèle, qualité, coût estimé.
//
// Migration du 2026-08-26 (lot 2, la feuille de route interne « Décisions du 2026-08-26 ») :
// `gpt-image-1` est déprécié par OpenAI au 23 OCTOBRE 2026. Le défaut devient
// `gpt-image-1-mini` — moins cher d'un ordre de grandeur, suffisant pour des
// vignettes de recette (à confirmer sur l'échantillon avant tout batch,
// cf. la note interne sur les photos de recettes §8).
//
// 🔴 La qualité reste EXPLICITE et `auto` est REFUSÉ : c'est `auto` (qui monte
// en `high` sur une photo culinaire) qui a produit la facture de 82,57 $.

const MODELES = ['gpt-image-1-mini', 'gpt-image-2', 'gpt-image-1']
const QUALITES = ['low', 'medium', 'high']

// Tarifs relevés le 2026-08-26 (mini : 0,006 / 0,015 / 0,052 $ l'image en
// 1024×1024), ARRONDIS AU-DESSUS — sous-estimer est dangereux, l'auto-recharge
// OpenAI peut se déclencher en silence. À revérifier avant tout batch.
const COUT_MINI = { low: 0.01, medium: 0.02, high: 0.06 }
// Gros modèles : tarifs variables selon le catalogue du jour ⇒ on garde le
// plafond historique OBSERVÉ en prod (0,15 $/image, facture de 2026-05-19).
const COUT_GROS_MODELE = 0.15

export function resolveGenerationConfig(args = {}) {
  const model = args.model ?? 'gpt-image-1-mini'
  if (!MODELES.includes(model)) {
    throw new Error(`Modèle inconnu : ${model}. Attendus : ${MODELES.join(', ')}`)
  }
  const quality = args.quality ?? 'medium'
  if (!QUALITES.includes(quality)) {
    throw new Error(`Qualité invalide : ${quality}. Attendues : ${QUALITES.join(', ')} (jamais 'auto' — cf. facture 82,57 $)`)
  }
  return {
    model,
    quality,
    costPerImage: model === 'gpt-image-1-mini' ? COUT_MINI[quality] : COUT_GROS_MODELE,
    deprecationWarning: model === 'gpt-image-1'
      ? '⚠️ gpt-image-1 est déprécié par OpenAI (retrait le 2026-10-23) — préférer gpt-image-1-mini ou gpt-image-2.'
      : null,
  }
}
