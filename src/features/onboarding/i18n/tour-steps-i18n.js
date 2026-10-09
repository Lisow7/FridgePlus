// « 60 % » est écrit en clair : ce fichier part au démarrage, et y importer
// `recipe-thresholds` ajoutait un fichier au démarrage (plafond de poids
// dépassé). L'accord avec SEUIL_PRESQUE est vérifié par
// src/test/unit/aide-qui-dit-vrai.test.js.

// i18n des étapes du TourWizard (refonte « visite courte » — PR onboarding tour).
//
// Modèle : 5 étapes CONSTANTES pour tous les profils (4 communes + 1 finale
// adaptée au profil). Fini le parcours qui s'allonge avec le tier — le reste
// des fonctionnalités se découvre dans « Aide & infos ».
//
// Chaque étape : { title, subtitle, desc?, options?: [{ icon | i, t, d }], tips: [{ icon | i, t }] }.
// `icon` = id du registre `onboarding/lib/tour-icons.js` (les icônes du menu du
// bouton orange) ; `i` = emoji, réservé aux notions hors interface (⚡ 🔒 💾 ❓).
// Les étapes finales ajoutent { ctaLabel } (le libellé du bouton principal ;
// l'action est branchée dans tour-wizard.jsx via STEP_META).
//
// Langues : fr + en. Toute autre langue retombe sur en (règle fr-sinon-en),
// géré dans getSteps() de tour-wizard.jsx.

export const TOUR_STEPS_I18N = {
  fr: {
    fab: {
      title: 'Le bouton orange, Actions rapides',
      subtitle: 'EN HAUT À DROITE DE L’ACCUEIL',
      desc: 'C\'est ton menu. Trois verbes, dans l\'ordre : Remplir, Vérifier, Cuisiner. Chaque entrée dit en une ligne ce qu\'elle fait.',
      tips: [
        { i: '📍', t: 'Perdu à un moment ? Touche le logo Fridge+ : il te ramène à l’accueil, et à ce bouton.' },
        { icon: 'inventory', t: 'Pour vider ton frigo : ouvre l\'Inventaire, le bouton est en bas — avec 10 secondes pour tout annuler.' },
      ],
    },
    fridge: {
      title: 'Remplis ton frigo',
      subtitle: 'QUATRE FAÇONS, AU CHOIX',
      options: [
        { icon: 'door',   t: 'Ouvre le frigo',           d: 'Coche ce que tu as, bac par bac' },
        { icon: 'search', t: 'Cherche un aliment',       d: 'Tape son nom : œufs, pâtes…' },
        { icon: 'mic',    t: 'À la voix',                d: 'Dis tes courses, comme à un ami' },
        { icon: 'camera', t: 'Photographie ton ticket',  d: 'Toutes tes courses d’un coup' },
      ],
      tips: [
        { i: '⚡', t: 'Le combo le plus rapide en rentrant des courses : la voix ou la photo, jamais les deux mains prises par le téléphone.' },
        { i: '🔒', t: 'Micro et appareil photo restent désactivés tant que tu ne dis pas oui — et tu peux changer d\'avis à tout moment dans Confidentialité.' },
      ],
    },
    check: {
      title: 'Vérifier ce que tu as',
      subtitle: 'INVENTAIRE ET RESTES',
      options: [
        { icon: 'inventory', t: 'Inventaire', d: 'Tout ton frigo en une liste : cherche, retire en un tap.' },
        { icon: 'leftovers', t: 'Restes',     d: 'Tes plats cuisinés, avec le temps qui leur reste (vert, orange, rouge).' },
      ],
      tips: [
        { i: '♻️', t: 'Un reste rouge, c\'est celui à finir ce soir — l\'app le met en avant dans les recettes.' },
      ],
    },
    recipes: {
      title: 'Ce que tu peux cuisiner',
      subtitle: 'OUVRE LES RECETTES',
      desc: 'L\'app te montre d\'abord les recettes que tu peux faire avec ce que tu as. Une petite jauge indique à quel point chacune est à ta portée.',
      tips: [
        { i: '✅', t: '« Prêt » = faisable tout de suite. « Presque » = tu as déjà au moins 60 % des ingrédients.' },
        { icon: 'recipes', t: 'Une fois le plat fait, touche « J\'ai cuisiné » : les ingrédients utilisés sortent du frigo, et le plat entre dans tes restes.' },
        { i: '🔎', t: 'Tu peux aussi choisir par régime, temps ou type de plat.' },
      ],
    },
    final_guest: {
      title: 'Aller plus loin',
      subtitle: 'TU AS LES BASES',
      desc: 'Un compte retrouve tes favoris sur tous tes appareils, ouvre la communauté et ton espace. Le premium ? Pas encore : aujourd\'hui, tout est gratuit.',
      ctaLabel: 'Créer un compte →',
      secondaryLabel: 'Continuer sans compte',
      tips: [
        { i: '💾', t: 'Même sans compte, ton frigo et tes favoris restent sur cet appareil.' },
        { i: '❓', t: 'Besoin d\'aide plus tard ? Le bouton « ? » en haut regroupe l\'aide et toutes les fonctionnalités ; la visite se relance depuis « Comment ça marche ».' },
      ],
    },
    final_free: {
      title: 'Aller plus loin',
      subtitle: 'TU AS LES BASES',
      desc: 'Va voir la communauté, partage tes recettes et règle tes goûts dans ton espace.',
      ctaLabel: 'Voir la communauté →',
      tips: [
        { i: '⚡', t: 'Tes favoris et ton profil te suivent maintenant sur tous tes appareils.' },
        { i: '❓', t: 'Besoin d\'aide plus tard ? Le bouton « ? » en haut regroupe ce guide et toutes les fonctionnalités.' },
      ],
    },
    final_premium: {
      title: 'Bonne cuisine !',
      subtitle: 'TU AS TOUT EN MAIN',
      desc: 'Tu connais l\'essentiel. À toi de jouer, et régale-toi !',
      ctaLabel: 'Lancer Fridge+ →',
      tips: [
        { i: '✨', t: 'Un guide dédié te présentera le panier, les coûts et le mode cuisine.' },
        { i: '❓', t: 'Le bouton « ? » en haut regroupe l\'aide et toutes les fonctionnalités.' },
      ],
    },
  },

  en: {
    fab: {
      title: 'The orange button, Quick actions',
      subtitle: 'TOP RIGHT OF THE HOME SCREEN',
      desc: 'It\'s your menu. Three verbs, in order: Fill, Check, Cook. Each entry says in one line what it does.',
      tips: [
        { i: '📍', t: 'Lost at some point? Tap the Fridge+ logo: it takes you home, back to this button.' },
        { icon: 'inventory', t: 'To empty your fridge: open the Inventory, the button is at the bottom — with 10 seconds to undo.' },
      ],
    },
    fridge: {
      title: 'Fill your fridge',
      subtitle: 'FOUR WAYS, YOUR PICK',
      options: [
        { icon: 'door',   t: 'Open the fridge',   d: 'Tick what you have, shelf by shelf' },
        { icon: 'search', t: 'Find a food',       d: 'Type its name: eggs, pasta…' },
        { icon: 'mic',    t: 'By voice', d: 'Say your groceries, like to a friend' },
        { icon: 'camera', t: 'Snap your receipt', d: 'All your groceries at once' },
      ],
      tips: [
        { i: '⚡', t: 'The fastest combo when you get home with groceries: voice or photo, never both hands on the phone.' },
        { i: '🔒', t: 'Mic and camera stay off until you say yes — and you can change your mind anytime in Privacy.' },
      ],
    },
    check: {
      title: 'Check what you have',
      subtitle: 'INVENTORY AND LEFTOVERS',
      options: [
        { icon: 'inventory', t: 'Inventory', d: 'Your whole fridge in one list: search, remove in one tap.' },
        { icon: 'leftovers', t: 'Leftovers', d: 'Your cooked dishes, with the time they have left (green, orange, red).' },
      ],
      tips: [
        { i: '♻️', t: 'A red leftover is the one to finish tonight — the app puts it first in the recipes.' },
      ],
    },
    recipes: {
      title: 'What you can cook',
      subtitle: 'OPEN THE RECIPES',
      desc: 'The app shows you first the recipes you can make with what you have. A small gauge tells how close each one is.',
      tips: [
        { i: '✅', t: '"Ready" = doable right now. "Almost" = you already have at least 60% of the ingredients.' },
        { icon: 'recipes', t: 'Once the dish is done, tap "I cooked this": the ingredients you used leave the fridge, and the dish joins your leftovers.' },
        { i: '🔎', t: 'You can also pick by diet, time or type of dish.' },
      ],
    },
    final_guest: {
      title: 'Going further',
      subtitle: 'YOU\'VE GOT THE BASICS',
      desc: 'An account brings your favorites to all your devices, opens the community and your space. Premium? Not yet: today, everything is free.',
      ctaLabel: 'Create an account →',
      secondaryLabel: 'Continue without an account',
      tips: [
        { i: '💾', t: 'Even without an account, your fridge and favorites stay on this device.' },
        { i: '❓', t: 'Need help later? The "?" button at the top gathers help and every feature; restart the tour from "How it works".' },
      ],
    },
    final_free: {
      title: 'Going further',
      subtitle: 'YOU\'VE GOT THE BASICS',
      desc: 'Check out the community, share your recipes and set your tastes in your space.',
      ctaLabel: 'See the community →',
      tips: [
        { i: '⚡', t: 'Your favorites and profile now follow you across all your devices.' },
        { i: '❓', t: 'Need help later? The "?" button at the top gathers this guide and all the features.' },
      ],
    },
    final_premium: {
      title: 'Happy cooking!',
      subtitle: 'YOU\'VE GOT IT ALL',
      desc: 'You know the essentials. Over to you — enjoy!',
      ctaLabel: 'Launch Fridge+ →',
      tips: [
        { i: '✨', t: 'A dedicated guide will walk you through the cart, costs and cooking mode.' },
        { i: '❓', t: 'The "?" button at the top gathers help and all the features.' },
      ],
    },
  },
}
