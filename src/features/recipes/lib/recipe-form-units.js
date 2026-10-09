// Unités, libellés d'unité et nettoyage de dictée du formulaire de recette.
//
// Extrait de `recipe-form-modal.jsx` le 2026-07-30 (§2 audit front). Ces quatre
// symboles étaient partagés entre le composant principal et `IngredientRow` :
// tant qu'ils vivaient dans le fichier parent, extraire `IngredientRow` aurait
// créé un import enfant → parent. Ce module commun est le préalable à ce
// découpage, il ne change rien au comportement.

// L'unité par défaut est suggérée par `getUnitHints()` selon l'ingrédient.
// L'utilisateur peut quand même choisir n'importe laquelle.
export const WEIGHT_UNITS = {
  fr: ['g','kg','ml','cl','L','unité','pincée','c. à café','c. à soupe','tasse','verre','bol','louche','sachet','pot','botte','gousse','tête','branche','feuille','tranche','carré','tablette','morceau','noix','goutte','PM'],
  en: ['g','kg','ml','cl','L','unit','pinch','tsp','tbsp','cup','glass','bowl','ladle','packet','jar','bunch','clove','head','sprig','leaf','slice','square','bar','piece','knob','drop','to taste'],
}

// Libellé « à l'unité » retenu quand l'unité suggérée n'est pas dans WEIGHT_UNITS.
export const UNIT_FALLBACK = { fr: 'unité', en: 'unit', es: 'unidad' }

// Légumes et fruits comptés à l'unité (pas pesés) → unité par défaut
export const UNIT_DEFAULT_IDS = new Set([
  'vg-ail','vg-artichaut','vg-asperges','vg-aubergine','vg-brocoli',
  'vg-butternut','vg-carottes','vg-celeri','vg-chou-fleur','vg-concombre',
  'vg-courgette','vg-echalote','vg-endives','vg-fenouil','vg-laitue',
  'vg-navet','vg-oignon','vg-oignon-rouge','vg-oignon-vert','vg-patate-douce',
  'vg-poireau','vg-poivron','vg-pomme-terre','vg-radis','vg-salade-verte',
  'vg-tomate','vg-tomate-cerise',
  'fr-abricot','fr-ananas','fr-avocat','fr-banane','fr-citron','fr-citron-vert',
  'fr-clem','fr-kiwi','fr-mangue','fr-melon','fr-orange','fr-peche',
  'fr-poire','fr-pomme','fr-prune',
])

// Supprime en plusieurs passes : verbes courants → pronoms → articles/prépositions
export function cleanTranscript(text, lang) {
  let t = text.trim().replace(/['']/g, "'")
  const passes = {
    fr: [
      // verbes + formules courantes (j'ai besoin de… avant j'ai pour éviter coupe trop courte)
      /^(?:j'ai\s+besoin\s+(?:de\s+|d')|j'ai\s+|je\s+veux\s+|je\s+voudrais\s+|il\s+(?:me\s+)?faut\s+|il\s+y\s+a\s+|mets\s+|ajoute[rz]?\s+|rajoute[rz]?\s+|prends?\s+|donne[r]?\s+[-]?moi\s+)/i,
      // pronoms sujets + j'<verbe> (forme élidée de je devant voyelle)
      /^(?:j'\w+\s+|je\s+|tu\s+|il\s+|elle\s+|on\s+|nous\s+|vous\s+|ils\s+|elles\s+|moi\s+|me\s+|te\s+|se\s+)/i,
      // articles et prépositions contractées
      /^(?:du\s+|de\s+la\s+|de\s+l'|des\s+|un\s+|une\s+|le\s+|la\s+|l'|les\s+|au\s+|aux\s+)/i,
    ],
    en: [
      /^(?:i\s+(?:have|want|need|got|would\s+like)\s+|add\s+|put\s+|give\s+me\s+)/i,
      /^(?:i\s+|a\s+|an\s+|the\s+|some\s+)/i,
    ],
  }[lang] ?? []
  let changed = true
  while (changed) {
    changed = false
    for (const re of passes) {
      const cleaned = t.replace(re, '')
      if (cleaned !== t) { t = cleaned; changed = true; break }
    }
  }
  return t.trim()
}
