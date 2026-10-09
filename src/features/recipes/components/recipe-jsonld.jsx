import JsonLd from '@shared/ui/json-ld'

// Phase 8 launch (refonte Modales) PR 8.8.e. Injecte un
// `<script type="application/ld+json">` dans le `<head>` au mount, le
// retire au unmount. Permet aux crawlers JS-aware (Googlebot, Bingbot)
// de parser la recette ouverte comme une fiche Schema.org/Recipe et
// d'afficher la rich card dans les résultats de recherche.
//
// 1 seul script à la fois (pas de support multi-modale ouverte) — l'ID
// `recipe-jsonld` permet d'écraser/cleanup proprement.
//
// Le mécanisme d'injection vit maintenant dans `@shared/ui/json-ld` : d'autres
// pages en ont besoin (`/faq`), et le dupliquer aurait créé deux versions
// destinées à diverger. Ce composant ne garde que l'identifiant.

const SCRIPT_ID = 'recipe-jsonld'

export default function RecipeJsonLd({ data }) {
  return <JsonLd id={SCRIPT_ID} data={data} />
}
