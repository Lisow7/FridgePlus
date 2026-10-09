// Aide rapide (self-service) affichée dans le flux de support AVANT le ticket.
// But : aider l'utilisateur à résoudre seul les soucis courants et à bien
// utiliser l'app — ce qui désengorge aussi les tickets côté admin.
// 100 % statique (FR + EN), aucune IA, aucune BDD. Aligné launch Free.
//
// Clé = id de catégorie du flux guidé (cf CATEGORIES dans support-panel).
// Seules les catégories où l'auto-résolution a du sens ont du contenu ;
// les autres (signalements…) sautent l'étape et vont droit au formulaire.

export const SUPPORT_SELF_HELP = {
  bug_voice: [
    {
      q: { fr: 'Le micro ne réagit pas ?', en: 'The mic doesn\'t respond?' },
      a: {
        fr: 'Vérifie que ton navigateur a l\'autorisation du micro (icône cadenas dans la barre d\'adresse) et que rien d\'autre ne l\'utilise. La reconnaissance vocale marche mieux sur Chrome.',
        en: 'Check that your browser has microphone permission (lock icon in the address bar) and that nothing else is using it. Voice recognition works best on Chrome.',
      },
    },
    {
      q: { fr: 'Mes ingrédients sont mal reconnus ?', en: 'Ingredients poorly recognized?' },
      a: {
        fr: 'Parle lentement, un ingrédient à la fois, dans un endroit calme. Tu peux toujours corriger ou ajouter un ingrédient à la main ensuite.',
        en: 'Speak slowly, one ingredient at a time, in a quiet place. You can always fix or add an ingredient by hand afterwards.',
      },
    },
  ],
  bug_recipe_form: [
    {
      q: { fr: 'Je n\'arrive pas à publier ma recette ?', en: 'Can\'t publish my recipe?' },
      a: {
        fr: 'Une recette doit avoir un titre, au moins un ingrédient et une étape. Les champs manquants sont signalés en rouge. Ta recette est gardée en brouillon, tu ne perds rien.',
        en: 'A recipe needs a title, at least one ingredient and one step. Missing fields are flagged in red. Your recipe is kept as a draft, nothing is lost.',
      },
    },
    {
      q: { fr: 'Combien de temps avant validation ?', en: 'How long before approval?' },
      a: {
        fr: 'Les recettes de la communauté sont relues avant publication. En attendant, tu la retrouves dans ton espace, onglet « Mes recettes ».',
        en: 'Community recipes are reviewed before going public. Meanwhile you\'ll find yours in your space, under "My recipes".',
      },
    },
  ],
  bug_profile: [
    {
      q: { fr: 'Mon frigo ou mes favoris semblent vides ?', en: 'My fridge or favorites look empty?' },
      a: {
        fr: 'Assure-toi d\'être bien connecté au bon compte. Tes données se synchronisent à la connexion — un rafraîchissement de la page suffit le plus souvent.',
        en: 'Make sure you\'re signed in to the right account. Your data syncs on login — refreshing the page usually does the trick.',
      },
    },
    {
      q: { fr: 'Comment changer ma langue ou mon thème ?', en: 'How to change language or theme?' },
      a: {
        fr: 'Ouvre le menu en haut à droite : tu peux y changer la langue et activer le mode sombre à tout moment.',
        en: 'Open the top-right menu: you can switch language and turn on dark mode there at any time.',
      },
    },
  ],
  price_error: [
    {
      q: { fr: 'Un prix te semble faux ?', en: 'A price looks wrong?' },
      a: {
        fr: 'Les prix sont des estimations moyennes et varient selon les enseignes et les saisons. Si l\'écart est important, signale-le ci-dessous avec le prix constaté — ça nous aide à corriger.',
        en: 'Prices are average estimates and vary by store and season. If the gap is large, report it below with the price you saw — it helps us fix it.',
      },
    },
  ],
  question: [
    {
      q: { fr: 'Comment trouver des recettes avec mon frigo ?', en: 'How to find recipes with my fridge?' },
      a: {
        fr: 'Ajoute tes ingrédients dans le frigo, puis ouvre les recettes : elles sont classées par taux de correspondance avec ce que tu as.',
        en: 'Add your ingredients to the fridge, then open recipes: they\'re ranked by how well they match what you have.',
      },
    },
    {
      q: { fr: 'Mes données sont-elles privées ?', en: 'Is my data private?' },
      a: {
        fr: 'Ton frigo et tes favoris ne sont visibles que par toi. Voir « Aide & Mentions légales » en bas de page pour le détail.',
        en: 'Your fridge and favorites are visible only to you. See "Help & Legal" at the bottom of the page for details.',
      },
    },
  ],
}

/**
 * Conseils d'aide rapide pour une catégorie, résolus dans la langue.
 * @returns {Array<{q:string,a:string}>} vide si la catégorie n'a pas d'aide.
 */
export function getSelfHelp(catId, lang = 'fr') {
  const entries = SUPPORT_SELF_HELP[catId]
  if (!entries) return []
  return entries.map(e => ({
    q: e.q[lang] ?? e.q.fr,
    a: e.a[lang] ?? e.a.fr,
  }))
}
