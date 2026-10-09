// i18n du WelcomeScreen (refonte accueil). fr + en (règle fr-sinon-en).
// La marque « Fridge+ » n'est pas traduisible (cf. branding) — rendue en dur
// dans le composant.

export const WELCOME_I18N = {
  fr: {
    skipBtn:      'Passer',
    greet:        'Bienvenue en cuisine !',
    sub:          'Cuisine ce que tu as déjà, sans prise de tête.',
    bullets: [
      { emoji: '🥕', text: 'Garnis ton frigo en quelques secondes' },
      { emoji: '🧑‍🍳', text: 'Vois tout de suite ce que tu peux cuisiner' },
      { emoji: '🎙️', text: 'Parle à ton frigo pour le remplir, sans rien taper' },
    ],
    soonTeaser:   'Bientôt : panier · coûts · cuisine guidée',
    cta:          'Faire la visite guidée',
    ctaSub:       '≈ 2 min · 5 étapes · à ton rythme',
    later:        'Entrer directement →',
    skipFootnote: 'Pas envie maintenant ? Tu pourras relancer le guide quand tu veux depuis le bouton « ? » en haut.',
  },
  en: {
    skipBtn:      'Skip',
    greet:        'Welcome to the kitchen!',
    sub:          'Cook what you already have, no fuss.',
    bullets: [
      { emoji: '🥕', text: 'Stock your fridge in seconds' },
      { emoji: '🧑‍🍳', text: 'Instantly see what you can cook' },
      { emoji: '🎙️', text: 'Talk to your fridge to fill it, no typing' },
    ],
    soonTeaser:   'Coming soon: cart · costs · guided cooking',
    cta:          'Take the guided tour',
    ctaSub:       '≈ 2 min · 5 steps · at your pace',
    later:        'Go straight in →',
    skipFootnote: 'Not now? You can relaunch the guide anytime from the "?" button at the top.',
  },
}
