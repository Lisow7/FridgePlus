// Libellés de la modale « Aide & infos » : textes du hub et catalogue des
// fonctionnalités présentées.
//
// Extrait de `help-guide.jsx` le 2026-07-31 (§2 audit front) — 6ᵉ application du
// pattern. Ces 95 lignes font passer le fichier sous la barre des 500, le critère
// d'acceptation.
//
// Couverts automatiquement par `i18n-dictionaries-parity.test.js` (#904).

// ⚠️ `tour_*` : ces libellés annoncent une PAGE, pas le lancement direct de la
// visite. Depuis que le bouton mène à `/guide` (2026-08-16), « Visite guidée —
// découvre l'app en 2 min » promettait une visite et ouvrait un texte : on
// clique, rien ne démarre, et ça se ressent comme un bouton mort.
//
// 🥇 **Un libellé de contrôle doit dire ce qui va se passer.** C'est la règle
// de base en écriture d’interface, et WCAG 3.2.4 (identification cohérente) la
// reprend. Si le bouton redevenait un lancement direct, ces textes doivent
// redevenir « Visite guidée ».
export const HELP_I18N = {
  fr: {
    btn_label:     'Aide & infos',
    title:         'Aide & infos',
    tour_title:    'Comment ça marche',
    tour_sub_new:  'Le guide en 5 étapes, et la visite en 2 min',
    tour_sub_seen: 'Revoir le guide, ou relancer la visite',
    explore:       'Explorer les fonctionnalités',
    grp:           { free: 'Gratuit', account: 'Avec un compte', soon: 'Bientôt' },
    badge:         { account: 'Compte', soon: 'Bientôt' },
    note_account:  'Nécessite un compte',
    note_soon:     'Bientôt',
    cta_go:        'Y aller',
    cta_signup:    'Créer un compte',
    cta_soon:      'Voir ce qui est prévu',
    cta_close:     'J’y vais',
    faq_link:       'Questions fréquentes',
    legal_link:     'Mentions légales',
    changelog_link: 'Nouveautés',
    support_btn:    'Contacter le support',
    support_sub:    'Une question ? On te répond.',
    support_mail_btn: 'Écrire au support',
    support_mail_sub: 'on te répond par e-mail.',
    close:          'Fermer',
  },
  en: {
    btn_label:     'Help & info',
    title:         'Help & info',
    tour_title:    'How it works',
    tour_sub_new:  'The guide in 5 steps, and the 2-min tour',
    tour_sub_seen: 'Read it again, or replay the tour',
    explore:       'Explore the features',
    grp:           { free: 'Free', account: 'With an account', soon: 'Coming soon' },
    badge:         { account: 'Account', soon: 'Coming soon' },
    note_account:  'Requires an account',
    note_soon:     'Coming soon',
    cta_go:        'Go there',
    cta_signup:    'Create an account',
    cta_soon:      'See what’s coming',
    cta_close:     'Let’s go',
    faq_link:       'Frequently asked questions',
    legal_link:     'Legal notices',
    changelog_link: 'What’s new',
    support_btn:    'Contact support',
    support_sub:    'A question? We’ll answer.',
    support_mail_btn: 'Email support',
    support_mail_sub: 'we reply by email.',
    close:          'Close',
  },
}

export const FEATURES_I18N = {
  fr: [
    { id: 'fridge',    emoji: '🥕', name: 'Le frigo',          tier: 'free',    target: 'home',      detail: 'Ajoute tes ingrédients pour que l’app sache ce que tu as : coche-les dans un compartiment, ou dicte-les au micro.' },
    { id: 'inventory', emoji: '🧊', name: 'Inventaire',        tier: 'free',    target: 'home',      detail: 'Vois tout ton inventaire d’un coup d’œil, groupé par zone, avec une recherche — pratique avant de faire les courses. Dans Actions rapides, en haut.' },
    { id: 'recipes',   emoji: '🧑‍🍳', name: 'Les recettes',      tier: 'free',    target: 'recipes',   detail: 'Vois d’un coup d’œil ce que tu peux cuisiner avec ton frigo — les recettes réalisables d’abord.' },
    { id: 'voice',     emoji: '🎙️', name: 'À la voix',         tier: 'free',    target: 'home',      detail: 'Dicte tes ingrédients à la voix, depuis Actions rapides, en haut.' },
    { id: 'leftovers', emoji: '🍲', name: 'Les restes',         tier: 'free',    target: 'home',      detail: 'Retrouve tes restes et quoi en faire pour moins gaspiller. Aussi dans Actions rapides.' },
    { id: 'favorites', emoji: '❤️', name: 'Favoris',            tier: 'free',    target: 'home',      detail: 'Garde tes recettes préférées avec le cœur et retrouve-les en un clic ; avec un compte, elles te suivent sur tous tes appareils.' },
    { id: 'community', emoji: '🌍', name: 'Communauté',         tier: 'account', target: 'community', detail: 'Explore les recettes partagées par d’autres cuisiniers et publie les tiennes.' },
    { id: 'create',    emoji: '✍️', name: 'Créer une recette',  tier: 'account', target: 'recipes',   detail: 'Compose ta propre recette : ingrédients, étapes, portions — puis partage-la à la communauté.' },
    { id: 'profile',   emoji: '🏠', name: 'Profil',             tier: 'account', target: 'profile',   detail: 'Ton pseudo, ta photo, tes préférences — et tes données récupérables quand tu veux.' },
    { id: 'receipt',   emoji: '🧾', name: 'Photo du ticket', tier: 'account', target: 'home', detail: 'Photographie ton ticket de caisse pour ajouter plusieurs ingrédients d’un coup, après relecture. Aussi dans Actions rapides.' },
    { id: 'cart',      emoji: '🛒', name: 'Panier',             tier: 'soon',    target: 'upgrade',   detail: 'Ton panier, avec les ingrédients manquants regroupés par rayon.' },
    { id: 'costs',     emoji: '💰', name: 'Coûts',              tier: 'soon',    target: 'upgrade',   detail: 'Le coût estimé de chaque recette, par portion.' },
    { id: 'cooking',   emoji: '👨‍🍳', name: 'Mode cuisine',      tier: 'soon',    target: 'upgrade',   detail: 'Les étapes en grand, une par une, avec minuteur et commandes à la voix.' },
  ],
  en: [
    { id: 'fridge',    emoji: '🥕', name: 'The fridge',      tier: 'free',    target: 'home',      detail: 'Add your ingredients so the app knows what you have: tick them in a compartment, or dictate them with the mic.' },
    { id: 'inventory', emoji: '🧊', name: 'Inventory', tier: 'free', target: 'home',      detail: 'See your whole inventory at a glance, grouped by zone, with search — handy before grocery shopping. In Quick actions, at the top.' },
    { id: 'recipes',   emoji: '🧑‍🍳', name: 'Recipes',         tier: 'free',    target: 'recipes',   detail: 'See at a glance what you can cook with your fridge — the doable ones first.' },
    { id: 'voice',     emoji: '🎙️', name: 'By voice',        tier: 'free',    target: 'home',      detail: 'Dictate your ingredients by voice, from Quick actions, at the top.' },
    { id: 'leftovers', emoji: '🍲', name: 'Leftovers',       tier: 'free',    target: 'home',      detail: 'Find your leftovers and what to make with them to waste less. Also in Quick actions.' },
    { id: 'favorites', emoji: '❤️', name: 'Favorites',       tier: 'free',    target: 'home',      detail: 'Save your favorite recipes with the heart and find them in one tap; with an account, they follow you across devices.' },
    { id: 'community', emoji: '🌍', name: 'Community',       tier: 'account', target: 'community', detail: 'Explore recipes shared by other cooks and publish your own.' },
    { id: 'create',    emoji: '✍️', name: 'Create a recipe', tier: 'account', target: 'recipes',   detail: 'Build your own recipe: ingredients, steps, servings — then share it with the community.' },
    { id: 'profile',   emoji: '🏠', name: 'Profile',         tier: 'account', target: 'profile',   detail: 'Your username, photo, preferences — and your data, downloadable whenever you want.' },
    { id: 'receipt',   emoji: '🧾', name: 'Receipt photo',   tier: 'account', target: 'home',      detail: 'Photograph your grocery receipt to add several ingredients at once, after review. Also in Quick actions.' },
    { id: 'cart',      emoji: '🛒', name: 'Cart',            tier: 'soon',    target: 'upgrade',   detail: 'Your cart, with the missing ingredients grouped by aisle.' },
    { id: 'costs',     emoji: '💰', name: 'Costs',           tier: 'soon',    target: 'upgrade',   detail: 'The estimated cost of each recipe, per serving.' },
    { id: 'cooking',   emoji: '👨‍🍳', name: 'Cooking mode', tier: 'soon',    target: 'upgrade',   detail: 'Steps one at a time in large text, with a timer and voice commands.' },
  ],
}
