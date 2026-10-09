// Les questions de prise en main — « comment je m'en sers ? ».
//
// Elles vivaient dans `HELP_I18N` (`features/onboarding`), qui les affichait en
// accordéon dans la modale « Aide & infos ». Elles sont désormais rendues par
// la page `/faq` (`features/legal`), et un fichier partagé est le seul endroit
// correct pour un texte lu par deux features : `import/no-restricted-paths`
// interdit — à raison — qu'une feature importe le dictionnaire d'une autre.
//
// ⚠️ À ne pas confondre avec la clé `faq` de `legal-content.js`, qui répond aux
// questions sur le SERVICE (gratuité, compte, données, RGPD). Celles-ci portent
// sur l'USAGE. `/faq` rend les deux, dans cet ordre.
//
// Refonte du 2026-09-11 (spec « aide & bouton orange », § 4.5) : les questions
// viennent des confusions OBSERVÉES (ticket de caisse jamais nommé, bouton
// orange jamais montré, inventaire et « J'ai cuisiné » absents) — NN/g : une
// FAQ ne contient que des questions réellement posées, formulées en questions,
// avec des réponses courtes qui renvoient vers la tâche. Chaque question porte
// `group` (bloc, dans l'ordre du menu : Remplir, Vérifier, Cuisiner, puis le
// compte) et `step` (l'étape du guide qui la détaille, `/guide#etape-n`).
// Douze au plus ; deux phrases par réponse au plus.
//
// fr + en seulement : `legal-content.js` fait déjà retomber es/de/ja sur
// l'anglais, et la page doit rester dans une seule langue à la fois.
//
// Le nom contient « i18n » à dessein : c'est ce qui fait découvrir ce fichier
// par `i18n-dictionaries-parity.test.js`, dont le glob cible `*i18n*`.

export const FAQ_BASICS_I18N = {
  fr: {
    intro: 'Tout part du bouton orange, en haut à droite : Remplir, Vérifier, Cuisiner.',
    groups: { fill: 'Remplir', check: 'Vérifier', cook: 'Cuisiner', account: 'Compte & données' },
    questions: [
      // ── Remplir (étape 2 du guide) ──
      { group: 'fill', step: 2, q: 'Comment ajouter des ingrédients ?',
        a: 'Quatre façons, toutes dans le bouton orange : ouvre le frigo et coche bac par bac, cherche un aliment par son nom, dis-les au micro, ou photographie ton ticket de caisse.' },
      { group: 'fill', step: 2, q: 'La photo du ticket, comment ça marche ?',
        a: 'Avec un compte, « Photo du ticket » lit les articles de ton ticket et te les montre à relire avant de les ajouter d’un coup. La caméra ne s’active que si tu l’autorises.' },
      { group: 'fill', step: 2, q: 'Le micro ne réagit pas ?',
        a: 'Vérifie que tu as autorisé le micro (au premier usage, ou dans Confidentialité) et que la langue de l’app est celle que tu parles. Il comprend le français et l’anglais.' },
      // ── Vérifier (étape 3) ──
      { group: 'check', step: 3, q: 'Où voir tout ce que j’ai ?',
        a: 'Bouton orange → Inventaire : tout ton frigo en une liste, avec une recherche ; un tap sur un aliment le retire. C’est aussi là que tu peux vider le frigo, avec 10 secondes pour annuler.' },
      { group: 'check', step: 3, q: 'C’est quoi les « Restes », et comment éviter le gaspillage ?',
        a: 'Les restes sont tes plats cuisinés, avec le temps qui leur reste : vert, orange, rouge. L’app met les rouges en avant dans les recettes pour que tu les finisses à temps.' },
      // ── Cuisiner (étape 4) ──
      { group: 'cook', step: 4, q: 'J’ai mes ingrédients, et après ?',
        a: 'Ouvre les recettes : celles que tu peux cuisiner apparaissent en premier. Une petite jauge indique à quel point chacune est à ta portée.' },
      { group: 'cook', step: 4, q: '« Prêt » et « Presque », ça veut dire quoi ?',
        a: '« Prêt » : tu as tout ce qu’il faut. « Presque » : il te manque un ou deux ingrédients, et la recette te dit lesquels.' },
      { group: 'cook', step: 4, q: 'Que fait « J’ai cuisiné » ?',
        a: 'Tu décoches ce qu’il te reste, le reste sort de ton frigo automatiquement, et le plat rejoint tes restes pour ne pas l’oublier.' },
      // ── Compte & données (étape 5) ──
      { group: 'account', step: 5, q: 'Faut-il un compte ?',
        a: 'Non. Le frigo, les recettes et le micro sont gratuits et sans compte ; un compte ajoute les favoris, la communauté, ton profil et la photo du ticket.' },
      { group: 'account', step: 5, q: 'Ça marche sans réseau ?',
        a: 'L’app s’installe sur ton téléphone et se souvient de ton frigo et des recettes déjà chargées. Ajouter à la voix ou par photo, en revanche, demande le réseau.' },
      { group: 'account', step: 5, q: 'L’app existe-t-elle en anglais ?',
        a: 'Oui : le drapeau en haut bascule entre français et anglais, à tout moment.' },
      { group: 'account', step: 5, q: 'C’est quoi le premium ?',
        a: 'Bientôt : panier, coûts, cuisine vocale. Pour l’instant, tout est gratuit.' },
    ],
  },
  en: {
    intro: 'Everything starts from the orange button, top right: Fill, Check, Cook.',
    groups: { fill: 'Fill', check: 'Check', cook: 'Cook', account: 'Account & data' },
    questions: [
      { group: 'fill', step: 2, q: 'How do I add ingredients?',
        a: 'Four ways, all in the orange button: open the fridge and tick shelf by shelf, find a food by its name, say them to the mic, or snap a photo of your receipt.' },
      { group: 'fill', step: 2, q: 'How does the receipt photo work?',
        a: 'With an account, "Receipt photo" reads the items on your receipt and shows them for review before adding them all at once. The camera only turns on if you allow it.' },
      { group: 'fill', step: 2, q: 'The mic isn\'t responding?',
        a: 'Check that you allowed the mic (on first use, or in Privacy) and that the app\'s language is the one you speak. It understands French and English.' },
      { group: 'check', step: 3, q: 'Where do I see everything I have?',
        a: 'Orange button → Inventory: your whole fridge in one list, with a search; one tap on an item removes it. That\'s also where you can empty the fridge, with 10 seconds to undo.' },
      { group: 'check', step: 3, q: 'What are "Leftovers", and how do I avoid waste?',
        a: 'Leftovers are your cooked dishes, with the time they have left: green, orange, red. The app puts the red ones first in the recipes so you finish them in time.' },
      { group: 'cook', step: 4, q: 'I\'ve added my ingredients, now what?',
        a: 'Open the recipes: the ones you can cook show up first. A small gauge tells how close each one is.' },
      { group: 'cook', step: 4, q: 'What do "Ready" and "Almost" mean?',
        a: '"Ready": you have everything. "Almost": you\'re one or two ingredients short, and the recipe tells you which.' },
      { group: 'cook', step: 4, q: 'What does "I cooked this" do?',
        a: 'You untick what you have left, the rest leaves your fridge automatically, and the dish joins your leftovers so you don\'t forget it.' },
      { group: 'account', step: 5, q: 'Do I need an account?',
        a: 'No. The fridge, recipes and mic are free and need no account; an account adds favorites, community, your profile and the receipt photo.' },
      { group: 'account', step: 5, q: 'Does it work offline?',
        a: 'The app installs on your phone and remembers your fridge and the recipes already loaded. Adding by voice or photo, however, needs the network.' },
      { group: 'account', step: 5, q: 'Is the app available in English?',
        a: 'Yes: the flag at the top switches between French and English, anytime.' },
      { group: 'account', step: 5, q: 'What is premium?',
        a: 'Soon: cart, costs, voice cooking. For now, everything is free.' },
    ],
  },
}

// `?? .en` et non `?? .fr` : es/de/ja retombent déjà sur l'anglais côté
// `legal-content.js`. Mélanger les deux langues sur la même page serait pire
// que de la servir entièrement en anglais.
export function getFaqBasics(lang) {
  return (FAQ_BASICS_I18N[lang] ?? FAQ_BASICS_I18N.en).questions
}

export function getFaqBasicsMeta(lang) {
  const d = FAQ_BASICS_I18N[lang] ?? FAQ_BASICS_I18N.en
  return { intro: d.intro, groups: d.groups }
}
