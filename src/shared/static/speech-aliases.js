// Sprint 7 PR S7.b — Réduction à FR + EN.
// Synonymes oraux par langue → ID ingrédient. Couvre les termes
// familiers, abréviations et noms alternatifs NON couverts par les
// labels ou la déstemmatisation automatique.
// Clés : chaîne normalisée (normalize() — minuscules, sans accents).
export const SPEECH_ALIASES = {
  fr: {
    // Patate(s) ≠ "Pomme de terre" dans les labels
    'patate':              'vg-pomme-terre',
    'patates':             'vg-pomme-terre',
    // Abréviation très usitée
    'mayo':                'sp-mayonnaise',
    // Plat souvent demandé sous son nom court
    'parmentier':          'frz-hachis',
    // Ordre inversé par rapport au label "Haché bœuf"
    'boeuf hache':         'fr-hache-boeuf',
    // Beurre de cacahuète (label complet rarement dit)
    'beurre cacahuete':    'sp-beurre-cacahuete',
    'beurre de cacahuete': 'sp-beurre-cacahuete',
    // "Bicarbonate de soude" → rarement dit en entier
    'bicarbonate':         'gp-bicarbonate',
    // "Concentré de tomate" (label = "Concentré tomate", sans "de")
    'concentre de tomate': 'gp-concentre-tom',
  },

  en: {
    // Herbe : "Cilantro" (américain) ≠ label "Coriander" (britannique)
    'cilantro':            'sp-coriandre',
    // "Scallion" (américain) ≠ label "Spring onion"
    'scallion':            'vg-oignon-vert',
    'scallions':           'vg-oignon-vert',
    // "Arugula" (américain) ≠ label "Rocket"
    'arugula':             'vg-roquette',
    // "Spud" (familier) ≠ label "Potato"
    'spud':                'vg-pomme-terre',
    'spuds':               'vg-pomme-terre',
    // Abréviation
    'mayo':                'sp-mayonnaise',
    // "Heavy cream" (américain) ≠ label "Single cream"
    'heavy cream':         'fr-creme-liquide',
    // "Mince/minced beef" (britannique) ≠ label "Ground beef"
    'mince':               'fr-hache-boeuf',
    'minced beef':         'fr-hache-boeuf',
  },
}
