// Changelog public Fridge+
//
// POLITIQUE ÉDITORIALE — à lire avant toute modification :
//   • Types autorisés : 'feat' (Nouveauté) et 'fix' (Correction) UNIQUEMENT
//   • 'fix' : uniquement si l'utilisateur pouvait constater le problème
//     (bug de connexion, affichage incorrect, données erronées)
//   • JAMAIS : noms de tables BDD, triggers SQL, codes d'erreur, noms de
//     composants, flags, colonnes, détails d'architecture ou de sécurité
//   • Labels : bénéfice utilisateur en langage courant — pas de jargon
//   • Versioning : v1.x = feature/fix notable, v2.0 = refonte majeure
//   • Groupement : par thème, manuel — plusieurs PRs = une release nommée
//   • ⚠️ VERSION & ENTRÉE = SEULEMENT au dev→main (release prod). Les PR de
//     `dev` n'ajoutent PAS d'entrée et ne bumpent PAS `CURRENT_VERSION`. Au
//     moment de la release, on ajoute UNE entrée consolidée (ce qui est
//     réellement VISIBLE en prod — pas les features derrière un flag OFF) et on
//     bumpe la version une fois. Le badge du footer ne change donc qu'à la prod.
//
// Exemple correct   : "La liste de courses mémorise tes articles préférés"
// Exemple incorrect : "Ajout colonne preferred_items + trigger upsert RLS"

export const CHANGELOG = [
  {
    version: '0.145',
    name: 'Le bouton qui compte reste sous ton pouce',
    date: 'octobre 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Sur téléphone, le bouton « J’ai cuisiné cette recette » reste toujours en bas de l’écran pendant que tu lis la fiche, au lieu d’attendre tout au bout, après les étapes.',
          en: 'On a phone, the “I cooked this recipe” button now stays at the bottom of the screen while you read the recipe, instead of waiting all the way down, after the steps.',
        },
      },
    ],
  },
  {
    version: '0.144',
    name: 'Tout se comprend du premier coup',
    date: 'octobre 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Nouveau dans le bouton orange : « Chercher un aliment ». Tape « œufs », « pâtes » ou « tomate » et ajoute-le en un tap. La recherche comprend les pluriels, les accents et même une petite faute de frappe.',
          en: 'New in the orange button: “Find a food”. Type “eggs”, “pasta” or “tomato” and add it in one tap. The search understands plurals, accents and even a small typo.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Tu peux régler tes allergènes sans compte, dans les filtres des recettes : ils sont signalés sur les cartes. Et si tu crées ton compte ensuite, ils te suivent.',
          en: 'You can set your allergens without an account, in the recipe filters: they are flagged on the cards. And if you create an account later, they come with you.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Dans l’inventaire, on retire un aliment avec une poubelle, et tu as 10 secondes pour annuler.',
          en: 'In the inventory, you remove a food with a bin, and you have 10 seconds to undo.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Quand ton frigo est vide, sa porte t’invite à la toucher. La visite guidée dit où trouver le bouton orange, et tu peux la terminer sans créer de compte.',
          en: 'When your fridge is empty, its door invites you to tap it. The guided tour tells you where to find the orange button, and you can finish it without creating an account.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Une carte de recette pouvait marquer en rouge un ingrédient que tu avais (du beurre doux pour du beurre). Elle dit maintenant la même chose que le pourcentage.',
          en: 'A recipe card could mark an ingredient you had in red (unsalted butter for butter). It now says the same thing as the percentage.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Liker une recette te renvoyait en haut de la liste, et revenir d’une recette te posait ailleurs. Tu restes maintenant là où tu étais.',
          en: 'Liking a recipe sent you back to the top of the list, and coming back from a recipe dropped you somewhere else. You now stay where you were.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Échap ou « retour » sur les filtres fermaient toute la liste des recettes. Seule la fenêtre du dessus se ferme.',
          en: 'Escape or “back” on the filters closed the whole recipe list. Only the window on top closes now.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Pendant une recherche, les compteurs « Toutes », « Prêt » et « Presque » donnent le bon nombre, et la carte d’accueil ne cache plus le bas de la liste.',
          en: 'While you search, the “All”, “Ready” and “Almost” counters show the right number, and the home card no longer hides the bottom of the list.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Sur téléphone : des boutons plus grands, « Favoris » et « Mes recettes » qui disent leur nom, et une communauté vide qui te propose de publier.',
          en: 'On a phone: bigger buttons, “Favs” and “Mine” that say their name, and an empty community that invites you to post.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'L’app te tutoie partout, du slogan aux messages.',
          en: 'In French, the app now speaks to you the same friendly way everywhere, from the slogan to the messages.',
        },
      },
    ],
  },
  {
    version: '0.143',
    name: 'Chacun à sa place',
    date: 'septembre 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Tu peux maintenant demander la suppression de ton compte depuis une page publique, sans avoir besoin de te connecter. Ce qui est effacé, ce qui est rendu anonyme, ce qui est conservé et pendant combien de temps y sont écrits noir sur blanc.',
          en: 'You can now request deletion of your account from a public page, without needing to sign in. What gets erased, what gets anonymised, what is kept and for how long are all spelled out there.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Les cinq panneaux de la visite guidée changeaient de taille d’une étape à l’autre, le bouton « Suivant » sautait d’un endroit à l’autre, et une barre de défilement venait couper le titre en haut. Les panneaux font maintenant tous la même hauteur, le bouton reste au même endroit et le texte tient sans défiler.',
          en: 'The five panels of the guided tour changed size from one step to the next, the “Next” button jumped around, and a scrollbar cut off the title at the top. The panels are now all the same height, the button stays put, and the text fits without scrolling.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Le panneau des cookies se posait par-dessus les liens du pied de page et les rendait impossibles à toucher. Il occupe désormais une ligne entière juste au-dessus du pied de page, qui reste accessible.',
          en: 'The cookie panel sat on top of the footer links and made them impossible to tap. It now takes up a full row just above the footer, which stays reachable.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Sur un téléphone, le titre « COMMUNAUTÉ » débordait de sa place et venait se poser sous les boutons de l’en-tête et sous le texte voisin, qui devenaient illisibles. Chacun reste maintenant dans son coin.',
          en: 'On a phone, the “COMMUNITY” title overflowed its space and ended up underneath the header buttons and the text beside them, making both unreadable. Each now stays in its own place.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Sur un téléphone, les filtres de catégorie de l’espace communauté n’étaient plus que des icônes sans nom : une lecture à voix haute annonçait « bouton » cinq fois de suite sans dire lesquels. Chaque filtre annonce désormais son nom.',
          en: 'On a phone, the category filters in the community space were nothing but unnamed icons: a screen reader announced “button” five times in a row without saying which. Each filter now announces its name.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'En thème sombre, le gris des informations secondaires était trop pâle sur plusieurs fonds pour se lire confortablement. Il a été éclairci.',
          en: 'In dark theme, the grey used for secondary information was too pale on several backgrounds to read comfortably. It has been lightened.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Sur l’écran d’accueil des nouveaux venus, la pastille « Bientôt » était arrondie en gélule alors que tout ce qui l’entoure est en rectangle arrondi. Elle suit maintenant le même dessin.',
          en: 'On the welcome screen for newcomers, the “Soon” pill was rounded into a capsule while everything around it uses rounded rectangles. It now follows the same shape.',
        },
      },
    ],
  },
  {
    version: '0.142',
    name: 'Plus rien ne tombe hors de l’écran',
    date: 'septembre 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Quand une recette de Fridge+ apparaît dans une recherche Google, sa fiche peut désormais afficher tout de suite sa durée, son nombre de parts, sa catégorie et son type de cuisine — sans que tu aies à ouvrir la page pour le savoir.',
          en: 'When a Fridge+ recipe shows up in a Google search, its entry can now display its time, number of servings, category and cuisine right away — without you having to open the page to find out.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Sur un écran étroit, la visite guidée s’arrêtait net à la deuxième étape : le bouton « Suivant » tombait sous le bas de l’écran et devenait impossible à toucher. La carte s’adapte maintenant à la hauteur disponible et c’est son contenu qui défile — les cinq étapes restent accessibles.',
          en: 'On a narrow screen, the guided tour stopped dead at step two: the “Next” button fell below the bottom of the screen and could no longer be tapped. The card now fits the height available and its content scrolls instead — all five steps stay within reach.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Sur un téléphone à écran court, l’écran d’accueil des nouveaux venus débordait sans pouvoir défiler : le bouton « Passer » était impossible à toucher, et sur les plus petits écrans « Entrer directement » n’apparaissait même pas. L’écran défile désormais, et « Passer » reste toujours accessible en haut à droite.',
          en: 'On a phone with a short screen, the welcome screen for newcomers overflowed with no way to scroll: the “Skip” button could not be tapped, and on the smallest screens “Enter directly” did not even appear. The screen now scrolls, and “Skip” always stays reachable in the top-right corner.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'En bas de l’accueil, la fusée « Bien démarrer » et sa carte de conseils se posaient sur le pied de page et en masquaient les mentions. Elles lui laissent maintenant la place au lieu de passer dessus.',
          en: 'At the bottom of the home screen, the “Get started” rocket and its tip card sat on top of the footer and hid its text. They now make room for it instead of covering it.',
        },
      },
    ],
  },
  {
    version: '0.141',
    name: 'Le bouton orange raconte enfin ce qu’il fait',
    date: 'septembre 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Le menu du bouton orange se lit désormais comme une histoire : Remplir (ouvrir le frigo, à la voix, photo du ticket), Vérifier (inventaire, restes), Cuisiner (recettes). Chaque entrée dit en une ligne ce qu’elle fait. « Vider » a rejoint l’Inventaire, là où tu vois ce que tu t’apprêtes à effacer — toujours avec 10 secondes pour annuler.',
          en: 'The orange button’s menu now reads like a story: Fill (open the fridge, by voice, receipt photo), Check (inventory, leftovers), Cook (recipes). Each entry says in one line what it does. “Empty” has moved to the Inventory, where you can see what you are about to clear — still with 10 seconds to undo.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Le guide « Comment ça marche » passe à cinq étapes, dans l’ordre du menu, avec les mêmes icônes que l’app : le bouton orange, Remplir, Vérifier (l’inventaire et les restes, qui n’y étaient pas), Cuisiner — avec « J’ai cuisiné » —, puis Aller plus loin. La visite guidée suit, et l’accueil à vide te montre les trois façons de remplir ton frigo.',
          en: 'The “How it works” guide grows to five steps, in the menu’s order, with the same icons as the app: the orange button, Fill, Check (inventory and leftovers, which were missing), Cook — with “I cooked this” — then Going further. The guided tour follows, and the empty home screen shows you the three ways to fill your fridge.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Les questions fréquentes répondent enfin à ce qu’on se demande vraiment : douze questions en quatre blocs — Remplir, Vérifier, Cuisiner, Compte & données —, la photo du ticket et le micro compris. Chaque réponse renvoie à l’étape du guide qui la détaille.',
          en: 'The FAQ finally answers what people actually wonder: twelve questions in four blocks — Fill, Check, Cook, Account & data — including the receipt photo and the mic. Each answer links to the guide step that explains it.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Au clavier, les menus se parcourent aux flèches ↑ et ↓, et Début / Fin sautent à la première et à la dernière entrée.',
          en: 'On the keyboard, menus can be browsed with the ↑ and ↓ arrows, and Home / End jump to the first and last entry.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Sur grand écran, le frigo remontait quand le bandeau des cookies apparaissait, puis redescendait une fois ta réponse donnée. Le bandeau se range désormais dans le coin en bas à droite, et le frigo ne bouge plus.',
          en: 'On large screens, the fridge jumped up when the cookie banner appeared, then dropped back once you had answered. The banner now sits in the bottom-right corner, and the fridge stays put.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Sur téléphone, en bas des pages d’aide et des nouveautés, la flèche « remonter en haut » recouvrait le dernier bloc — parfois jusqu’au texte. Elle garde maintenant sa place, et le dernier bloc reste lisible.',
          en: 'On phones, at the bottom of the help and what’s-new pages, the “back to top” arrow covered the last block — sometimes its text. It now keeps to its own space, and the last block stays readable.',
        },
      },
    ],
  },
  {
    version: '0.140',
    name: 'Plus rien ne se met en travers',
    date: 'août 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Sur téléphone, le bandeau des cookies se posait par-dessus le menu et empêchait de changer de langue ou de passer en mode sombre — les boutons ne répondaient tout simplement pas. Il recouvrait aussi les bacs du bas du frigo et les boutons des pages d’aide. Chaque élément lui réserve désormais sa place, quelle que soit la taille de l’écran.',
          en: 'On phones, the cookie banner sat on top of the menu and stopped you switching language or turning on dark mode — the buttons simply did not respond. It also covered the lower fridge bins and the buttons on the help pages. Every element now leaves room for it, whatever the screen size.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Deux situations pouvaient faire disparaître le contenu de ton frigo : un frigo rempli sans compte sur un appareil déjà utilisé par quelqu’un d’autre n’était jamais repris, et une coupure de réseau au chargement pouvait faire supprimer des ingrédients que l’app n’avait pas réussi à afficher. Les deux sont fermées, et une erreur d’enregistrement ne passe plus inaperçue.',
          en: 'Two situations could make your fridge contents vanish: a fridge filled without an account on a device someone else had used was never picked up, and a network drop while loading could delete ingredients the app had failed to display. Both are closed, and a failed save no longer goes unnoticed.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'La pastille des notifications comptait faux : supprimer un seul message non lu en retirait deux du compteur, qui pouvait ainsi tomber à zéro alors qu’il te restait des notifications à lire. Le compte suit désormais exactement ce que tu as lu.',
          en: 'The notifications badge was counting wrong: deleting a single unread message removed two from the counter, which could drop to zero while you still had notifications waiting. The count now follows exactly what you have read.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Le prix estimé du panier se dégradait quand tu ajustais le nombre de personnes depuis l’accueil : revenir au nombre de départ ne rendait pas le prix de départ, et il baissait un peu plus à chaque aller-retour. Les quantités, elles, restaient justes — seul le budget affiché mentait. Il est de nouveau fiable, quel que soit le nombre d’allers-retours.',
          en: 'The estimated basket price drifted when you adjusted the number of people from the home screen: going back to the original number did not restore the original price, and it fell a little further with every round trip. Quantities stayed correct — only the displayed budget lied. It is reliable again, however many times you adjust it.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Sur Android, le geste retour ne fermait pas les menus ouverts par-dessus la page : il fallait viser la croix. Le geste les referme maintenant comme on s’y attend, sans quitter la page en cours.',
          en: 'On Android, the back gesture did not close menus opened over the page: you had to aim for the close button. The gesture now dismisses them as expected, without leaving the page you were on.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Ajouter les ingrédients d’une recette au panier y remettait aussi ce que tu avais déjà dans ton frigo, depuis la page de recette comme depuis le panier. Une liste de courses ne sert qu’à ce qui te manque : seuls les ingrédients absents y sont désormais ajoutés.',
          en: 'Adding a recipe’s ingredients to your basket also put back what you already had in your fridge, both from the recipe page and from the basket. A shopping list is only about what you are missing: only the ingredients you do not have are added now.',
        },
      },
    ],
  },
  {
    version: '0.139',
    name: 'Le premier pas ne bute plus',
    date: 'août 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'À la toute première visite sur mobile, le bandeau cookies se posait par-dessus le bouton « Faire la visite guidée » : le geste ne déclenchait rien. Les deux se présentent désormais l’un après l’autre — le choix des cookies d’abord, l’accueil ensuite, dégagé.',
          en: 'On a very first visit from a phone, the cookie banner sat on top of the “Take the tour” button, so tapping it did nothing. The two now come one after the other — cookie choice first, then a clear welcome screen.',
        },
      },
    ],
  },
  {
    version: '0.138',
    name: 'Un frigo à ta main',
    date: 'août 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'La forme de ton frigo se choisit désormais dans Profil → Préférences : congélateur en haut ou portes côte à côte. Elle ne dépend plus de la langue — celle que tu choisis te suit partout, et tout le monde démarre avec le même frigo par défaut.',
          en: 'Your fridge shape is now picked in Profile → Preferences: freezer on top or side-by-side doors. It no longer depends on the language — the one you choose follows you everywhere, and everyone starts with the same default fridge.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Les bacs d’ingrédients sont mieux rangés : ceux qui n’appartiennent à aucune famille vivent maintenant dans une section « Autres » pliable, dans le même esprit que les autres familles — partout, frigo comme garde-manger. Le bouton d’actions rapides s’organise aussi en sections claires (Mon frigo, Ajouter des ingrédients, Cuisiner), chaque action à un seul geste.',
          en: 'Ingredient bins are better organized: items that belong to no family now live in a collapsible “Others” section, matching the rest — everywhere, fridge and pantry alike. The quick actions button is also organized in clear sections (My fridge, Add ingredients, Cook), every action one tap away.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Dans le frigo à portes côte à côte, le compartiment congélateur coupait ses cases en plein mot. Il affiche désormais une liste lisible en entier, quelle que soit la taille de l’écran.',
          en: 'In the side-by-side fridge, the freezer compartment cut its tiles mid-word. It now shows a fully readable list, whatever the screen size.',
        },
      },
    ],
  },
  {
    version: '0.137',
    name: 'L’aperçu montre la vraie app',
    date: 'août 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'L’aperçu affiché quand tu partages le lien de Fridge+ fait peau neuve : tout en français, avec une vraie capture de l’app — la porte du frigo et son bouton d’actions — à la place d’une illustration approximative. Il annonçait aussi cinq langues alors que l’app en propose deux (français et anglais) : c’est corrigé.',
          en: 'The preview shown when you share the Fridge+ link got a makeover: all in French, with a real screenshot of the app — the fridge door and its action button — instead of a rough illustration. It also claimed five languages when the app offers two (French and English): fixed.',
        },
      },
    ],
  },
  {
    version: '0.136',
    name: 'Un lien qui se présente bien',
    date: 'août 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Quand tu partages fridgeplus.app sur WhatsApp ou ailleurs, l’aperçu du lien s’affichait tronqué : titre coupé en plein mot et image recadrée sur un demi-logo. L’aperçu montre désormais l’essentiel en entier — en français puis en anglais — avec un visuel pensé pour la vignette carrée des messageries. Au passage, trois icônes d’ingrédients (tofu, tempeh, seitan) ont été redessinées pour être fidèles à leur vrai visage.',
          en: 'When you shared fridgeplus.app on WhatsApp or elsewhere, the link preview showed up truncated: title cut mid-word and image cropped to half a logo. The preview now shows the essentials in full — in French then English — with a visual designed for messaging apps’ square thumbnail. Along the way, three ingredient icons (tofu, tempeh, seitan) were redrawn to look like the real thing.',
        },
      },
    ],
  },
  {
    version: '0.135',
    name: 'Chaque ingrédient a son icône',
    date: 'août 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Les belles icônes d’ingrédients n’apparaissaient que dans certaines listes du frigo : beurres, crèmes, fromages, yaourts et fruits tropicaux restaient sur un emoji générique — 22 fromages affichaient le même 🧀. Les 82 ingrédients concernés retrouvent leur icône authentique, partout.',
          en: 'The nice ingredient icons only showed up in some fridge lists: butters, creams, cheeses, yogurts and tropical fruits were stuck with a generic emoji — 22 cheeses all showed the same 🧀. The 82 affected ingredients get their authentic icon back, everywhere.',
        },
      },
    ],
  },
  {
    version: '0.134',
    name: 'Le panneau des recettes retrouve sa fluidité',
    date: 'août 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Depuis l’arrivée des photos, faire défiler le panneau des recettes saccadait sérieusement. La cause a été traquée à l’instrument : le léger flou d’arrière-plan du panneau forçait l’écran à se redessiner entièrement à chaque geste. Le défilement est redevenu parfaitement fluide, et les vignettes des recettes se chargent plus vite au passage.',
          en: 'Since photos arrived, scrolling the recipe panel had become seriously choppy. The cause was tracked down with real measurements: the panel’s subtle background blur forced the whole screen to redraw on every gesture. Scrolling is perfectly smooth again, and recipe thumbnails load faster too.',
        },
      },
    ],
  },
  {
    version: '0.133',
    name: 'Chaque plat a son visage',
    date: 'août 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Les 515 recettes du catalogue ont désormais leur photo — plus de 400 plats qui n’avaient qu’un emoji montrent enfin à quoi ils ressemblent, dans les listes, sur leur page et dans les aperçus quand tu partages un lien. Chaque photo a été vérifiée une à une pour correspondre fidèlement au plat.',
          en: 'All 515 recipes in the catalog now have their photo — over 400 dishes that only had an emoji finally show what they look like, in lists, on their page and in link previews when you share. Every photo was checked one by one to faithfully match the dish.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Grand ménage dans les icônes d’ingrédients : la quarantaine qui manquait a été ajoutée, et toutes les existantes ont été repassées en revue — le pain pita ne ressemble plus à un cookie, le quinoa n’est plus un épi de maïs, et la roquette n’est plus… une fusée.',
          en: 'Big cleanup of the ingredient icons: the forty or so missing ones were added, and every existing one was re-reviewed — pita bread no longer looks like a cookie, quinoa is no longer a corn cob, and arugula (“rocket”) is no longer… an actual rocket.',
        },
      },
    ],
  },
  {
    version: '0.132',
    name: 'Chaque mot dans ta langue',
    date: 'août 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Quelques textes restaient dans la mauvaise langue : le bandeau « Trending » de la communauté s’affichait en anglais, et côté anglophone, une poignée de libellés — l’infobulle de note d’une recette, le bouton d’effacement d’un filtre, des messages d’erreur — restaient en français. Tout parle désormais ta langue, y compris ce que lisent les lecteurs d’écran.',
          en: 'A few texts were stuck in the wrong language: the community “Trending” banner showed up in English for French users, and for English speakers a handful of labels — a recipe’s rating tooltip, a filter’s clear button, some error messages — stayed in French. Everything now speaks your language, including what screen readers announce.',
        },
      },
    ],
  },
  {
    version: '0.131',
    name: 'Le clavier ne reste plus coincé',
    date: 'août 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'En naviguant au clavier, plusieurs fenêtres — la confirmation d’effacement de l’historique, l’ajout d’un article au panier, les partages, l’inventaire du frigo — pouvaient te retenir sans issue : ni Échap, ni Tab ne répondaient, et le focus se perdait derrière la fenêtre. Toutes se ferment désormais à l’Échap, gardent le focus à l’intérieur et te ramènent où tu étais.',
          en: 'When navigating with the keyboard, several windows — the history-erase confirmation, adding an item to the cart, the share sheets, the fridge inventory — could hold you with no way out: neither Escape nor Tab responded, and focus got lost behind the window. They all now close on Escape, keep focus inside, and return you to where you were.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Certaines actions étaient tout simplement inaccessibles au clavier : choisir une alternative d’ingrédient sur une recette, supprimer un ticket de support, ouvrir la recette attachée à un post de la communauté. Elles se font maintenant à la touche Tab puis Entrée, comme le reste.',
          en: 'Some actions were simply unreachable by keyboard: picking an ingredient alternative on a recipe, deleting a support ticket, opening the recipe attached to a community post. They now work with Tab then Enter, like everything else.',
        },
      },
    ],
  },
  {
    version: '0.130',
    name: 'Les badges des recettes se lisent enfin',
    date: 'août 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Sur la fiche d’une recette, plusieurs étiquettes étaient écrites trop pâle sur leur propre fond coloré : le niveau de difficulté, le compteur d’ingrédients que tu as déjà, et l’onglet ouvert. Elles se lisent maintenant sans effort, dans les deux thèmes, et les couleurs de fond n’ont pas changé.',
          en: 'On a recipe page, several labels were written too pale on their own colored background: the difficulty level, the counter of ingredients you already have, and the open tab. They now read effortlessly, in both themes, and the background colors are unchanged.',
        },
      },
    ],
  },
  {
    version: '0.129',
    name: 'Le thème bascule d’un bloc',
    date: 'août 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Le passage entre le thème clair et le thème sombre se faisait en désordre : certains éléments changeaient aussitôt, d’autres près de sept dixièmes de seconde plus tard, ce qui donnait une impression de flottement. Toute la page bascule désormais ensemble, en un quart de seconde. Si tu as réglé ton appareil pour limiter les animations, le changement reste instantané.',
          en: 'Switching between the light and dark themes happened out of order: some elements changed right away, others nearly seven tenths of a second later, which made the whole thing feel wobbly. The entire page now switches together, in a quarter of a second. If your device is set to reduce motion, the change stays instant.',
        },
      },
    ],
  },
  {
    version: '0.128',
    name: 'Plus besoin de plisser les yeux',
    date: 'août 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Les deux boutons du bandeau de consentement, à ta toute première visite, étaient presque illisibles en thème sombre — un texte blanc posé sur un fond doré très clair. Ils se lisent maintenant sans effort, ce qui compte d’autant plus qu’il s’agit du choix que tu poses en arrivant.',
          en: 'The two buttons on the consent banner, on your very first visit, were nearly unreadable in dark mode — white text on a very light golden background. They now read effortlessly, which matters all the more given it is the choice you make on arrival.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Plusieurs textes étaient trop pâles pour être lus confortablement : l’accroche qui défile en haut de page, les descriptions des étagères du garde-manger, les filtres de l’espace communauté, les liens de retour et les titres des pages d’information. Tous ont été assombris — ou éclaircis en thème sombre — juste assez pour se détacher nettement, sans changer l’allure de l’application.',
          en: 'Several texts were too pale to read comfortably: the tagline scrolling at the top of the page, the pantry shelf descriptions, the community filters, the back links and the headings on information pages. All have been darkened — or lightened in dark mode — just enough to stand out clearly, without changing the look of the app.',
        },
      },
    ],
  },
  {
    version: '0.127',
    name: 'Chaque page dit son nom',
    date: 'août 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'L’onglet de ton navigateur affiche enfin le nom de la page ouverte — la recette que tu consultes, la FAQ, ton profil, ton panier — au lieu du nom générique de l’application. Utile dès qu’on garde plusieurs onglets ouverts, et pour s’y retrouver dans son historique.',
          en: 'Your browser tab finally shows the name of the page you have open — the recipe you are reading, the FAQ, your profile, your cart — instead of the app’s generic name. Handy as soon as you keep several tabs open, and for finding your way back through your history.',
        },
      },
    ],
  },
  {
    version: '0.126',
    name: 'Ton frigo te suit',
    date: 'août 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Le contenu de ton frigo et tes favoris ajoutés avant de te connecter pouvaient être perdus au moment de la connexion, si ton compte contenait déjà l’un d’eux. Ils sont désormais tous conservés — et si le transfert échoue, rien n’est effacé et il sera retenté à ta prochaine connexion.',
          en: 'The fridge contents and favorites you added before signing in could be lost when you logged in, if your account already contained one of them. They are now all kept — and if the transfer fails, nothing is erased and it will be retried next time you sign in.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'L’onglet du navigateur affiche à nouveau le nom de la recette que tu consultes, au lieu du nom générique de l’application. Pratique quand plusieurs recettes sont ouvertes côte à côte.',
          en: 'Your browser tab shows the name of the recipe you are reading again, instead of the app’s generic name. Handy when several recipes are open side by side.',
        },
      },
    ],
  },
  {
    version: '0.125',
    name: 'La suite est à un clic',
    date: 'août 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'En bas des pages « Questions fréquentes » et « Comment ça marche », un bouton mène maintenant directement à l’app, et les deux pages se renvoient l’une à l’autre. Avant, une fois la lecture finie, il n’y avait rien d’autre à faire que remonter en haut de page.',
          en: 'At the bottom of the "FAQ" and "How it works" pages, a button now takes you straight into the app, and each page links to the other. Until now, once you had finished reading, there was nothing to do but scroll back up.',
        },
      },
    ],
  },
  {
    version: '0.124',
    name: 'Les réponses ne se cachent plus',
    date: 'août 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Deux nouvelles pages, « Comment ça marche » et « Questions fréquentes », accessibles depuis le pied de page et le menu d’aide. Le guide et les réponses ont enfin leur propre adresse : on peut les lire sans lancer de parcours, et en envoyer le lien à quelqu’un.',
          en: 'Two new pages, "How it works" and "FAQ", reachable from the footer and the help menu. The guide and the answers finally have their own address: you can read them without starting a tour, and send someone the link.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Les mentions légales annonçaient un abonnement premium alors que tout est gratuit. La réponse dit maintenant clairement qu’il n’existe aujourd’hui aucun moyen de payer quoi que ce soit.',
          en: 'The legal page announced a premium subscription while everything is free. The answer now states plainly that there is currently no way to pay for anything.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'L’écran de bienvenue s’affichait par-dessus la page qu’on venait lire quand on arrivait directement sur une recette ou sur l’aide. Il ne s’ouvre plus que sur la page d’accueil.',
          en: 'The welcome screen used to cover the page you came to read when you landed straight on a recipe or on the help pages. It now opens on the home page only.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Dans le menu d’aide, le bouton « Visite guidée » ouvrait une page au lieu de lancer la visite. Il s’appelle désormais « Comment ça marche », et la visite se lance depuis cette page.',
          en: 'In the help menu, the "Guided tour" button opened a page instead of starting the tour. It is now called "How it works", and the tour starts from that page.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Navigation au clavier : un lien « Aller au contenu » apparaît dès la première tabulation, pour sauter l’en-tête et arriver directement sur la page.',
          en: 'Keyboard navigation: a "Skip to content" link appears on the very first tab, so you can jump past the header and land straight on the page.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'L’espace communauté n’annonçait pas son titre aux lecteurs d’écran : impossible de savoir où l’on se trouvait sans voir la page.',
          en: 'The community space did not announce its title to screen readers: there was no way to tell where you were without seeing the page.',
        },
      },
    ],
  },
  {
    version: '0.123',
    name: 'Un lien qui donne faim',
    date: 'août 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Quand tu partages une recette, le lien montre enfin la recette elle-même : son nom, sa description et sa photo, au lieu de la présentation générale de Fridge+.',
          en: 'When you share a recipe, the link finally shows the recipe itself: its name, description and photo, instead of the general Fridge+ presentation.',
        },
      },
    ],
  },
  {
    version: '0.122',
    name: 'Rien ne se perd en route',
    date: 'août 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Tape « boeuf » et tu retrouves enfin le bœuf : la recherche ne bute plus sur les lettres collées comme « œ », que ce soit dans ton frigo, sur un ticket de caisse scanné ou en dictant tes courses.',
          en: 'Type "boeuf" and you finally find "bœuf": search no longer trips over joined letters like "œ", whether in your fridge, on a scanned receipt or when dictating your groceries.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Une recette qui ne s\'ouvre pas ne reste plus bloquée sur « Chargement » : on te dit si le lien n\'est plus valable ou si c\'est un simple souci passager, à réessayer.',
          en: 'A recipe that won\'t open no longer stays stuck on "Loading": we tell you whether the link is no longer valid or it\'s just a temporary glitch worth retrying.',
        },
      },
    ],
  },
  {
    version: '0.121',
    name: 'Une liste partagée qui dit vrai',
    date: 'août 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Quand une liste de courses partagée ne s\'ouvre pas, tu sais enfin pourquoi : on ne te dit plus que ton lien a expiré alors qu\'il s\'agit d\'un souci passager, et l\'écran ne reste plus bloqué sur « Chargement ».',
          en: 'When a shared shopping list won\'t open, you finally know why: we no longer claim your link has expired when it\'s just a temporary glitch, and the screen no longer stays stuck on "Loading".',
        },
      },
    ],
  },
  {
    version: '0.120',
    name: 'Jusqu\'aux jours, dans ta langue',
    date: 'août 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Les durées de conservation des restes et le badge d\'essai affichent enfin les jours dans ta langue : en anglais, ils restaient écrits à la française.',
          en: 'Leftover shelf-life durations and the trial badge finally show days in your language: in English, they were still written the French way.',
        },
      },
    ],
  },
  {
    version: '0.119',
    name: 'Une liste de recettes qui ne bronche plus',
    date: 'juillet 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'La liste des recettes ne se recalcule plus inutilement quand tu ouvres les filtres : elle reste réactive même une fois toutes les recettes chargées.',
          en: 'The recipe list no longer recomputes needlessly when you open the filters: it stays responsive even once every recipe is loaded.',
        },
      },
    ],
  },
  {
    version: '0.118',
    name: 'Toute l\'app parle ta langue',
    date: 'juillet 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Les infobulles au survol et les libellés annoncés par les lecteurs d\'écran s\'affichent maintenant dans ta langue dans le reste de l\'app — le panier, ton profil, l\'aide et les notifications — après les recettes.',
          en: 'Hover tooltips and the labels announced by screen readers now display in your language across the rest of the app — the cart, your profile, help and notifications — after recipes.',
        },
      },
    ],
  },
  {
    version: '0.117',
    name: 'Les recettes parlent ta langue',
    date: 'juillet 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Si tu utilises un lecteur d\'écran, les boutons des recettes annoncent maintenant leur fonction dans ta langue.',
          en: 'If you use a screen reader, recipe buttons now announce what they do in your language.',
        },
      },
    ],
  },
  {
    version: '0.116',
    name: 'L\'espace communauté dans ta langue',
    date: 'juillet 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Dans l\'espace communauté, les libellés des boutons s\'affichent maintenant dans ta langue.',
          en: 'In the community space, button labels now display in your language.',
        },
      },
    ],
  },
  {
    version: '0.115',
    name: 'Coulisses fiabilisées',
    date: 'juillet 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Les emails liés à ton compte — la confirmation de suppression et son lien de restauration, ainsi que les alertes de sécurité — sont désormais bien envoyés, avec un bouton d\'action clairement visible.',
          en: 'Account-related emails — the deletion confirmation with its restoration link, and security alerts — are now properly delivered, with a clearly visible action button.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Quand tu partages un lien vers Fridge+, l\'aperçu affiche maintenant la bonne adresse du site.',
          en: 'When you share a Fridge+ link, the preview now shows the correct site address.',
        },
      },
    ],
  },
  {
    version: '0.114',
    name: 'Ta progression, tes avis',
    date: 'juillet 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Les badges et les quêtes sont réunis dans une grille unique « Progression », avec des bannières à débloquer.',
          en: 'Badges and quests are now brought together in a single "Progress" grid, with unlockable banners.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Après avoir cuisiné, note ta recette en un geste — et partage ton avis avec une photo à la communauté.',
          en: 'After cooking, rate your recipe in one tap — and share your review with a photo to the community.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Quand tu augmentes les portions d\'une recette complète, les quantités des recettes liées (ex. une béchamel) s\'ajustent maintenant correctement au lieu de rester figées.',
          en: 'When you increase the servings of a full recipe, the quantities of linked recipes (e.g. a béchamel) now adjust correctly instead of staying fixed.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Tes likes, réactions et notes se sauvegardent maintenant correctement (ils pouvaient disparaître après un rafraîchissement).',
          en: 'Your likes, reactions, and ratings now save correctly (they could previously disappear after a refresh).',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'La recherche de recettes trouve maintenant tes résultats même sans les accents.',
          en: 'Recipe search now finds your results even without accents.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Les ingrédients alternatifs s\'affichent maintenant correctement sur certaines recettes.',
          en: 'Alternative ingredients now display correctly on certain recipes.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Tu peux de nouveau laisser un avis après avoir supprimé le précédent.',
          en: 'You can once again leave a review after deleting your previous one.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Les fenêtres de confirmation (suppression, etc.) sont plus claires et cohérentes avec le design de l\'app.',
          en: 'Confirmation windows (delete, etc.) are now clearer and consistent with the app\'s design.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Les boutons de l\'application ont une forme plus cohérente dans toute l\'app.',
          en: 'Buttons across the app now have a more consistent shape.',
        },
      },
    ],
  },
  {
    version: '0.113',
    name: 'Des recettes qui se retrouvent entre elles',
    date: 'juillet 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Nouvelle catégorie « Sauce & Base » pour retrouver les sauces, pâtes et préparations qui servent de base à d\'autres plats — les recettes qui les utilisent y renvoient directement, et les ingrédients d\'une recette peuvent désormais s\'afficher regroupés sous des sous-titres (« Pour la béchamel »…).',
          en: 'New "Sauce & Base" category to find sauces, doughs, and base preparations used in other dishes — recipes that use them link straight back, and a recipe\'s ingredients can now display grouped under subheadings ("For the béchamel"…).',
        },
      },
    ],
  },
  {
    version: '0.112',
    name: 'Un frigo qui retrouve tout',
    date: 'juillet 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Depuis « Mon frigo », la recherche retrouve aussi les aliments que tu n\'as pas encore : ajoute-les d\'un tap, sans quitter la liste.',
          en: 'From "My fridge", search now also finds items you don\'t have yet — add them with one tap, without leaving the list.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Le guide « Bien démarrer » met en avant les deux façons les plus rapides de remplir ton frigo : parler à voix haute ou prendre en photo ton ticket de caisse.',
          en: 'The "Get started" guide now highlights the two fastest ways to fill your fridge: speaking out loud or taking a photo of your receipt.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Sur Android, le bouton retour ferme désormais la fenêtre ouverte (guide, formulaire, panneau…) au lieu de naviguer en arrière derrière elle.',
          en: 'On Android, the back button now closes the open window (guide, form, panel…) instead of navigating behind it.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Le bouton des notifications s\'active désormais correctement, et affiche un message clair s\'il ne peut pas s\'activer sur ton navigateur.',
          en: 'The notifications toggle now switches on correctly, and shows a clear message if it can\'t be enabled in your browser.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Le message d\'erreur du scan de ticket de caisse se referme désormais tout seul, sans qu\'il faille le fermer à la main.',
          en: 'The receipt-scan error message now closes on its own, instead of staying on screen until dismissed manually.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Sur téléphone et tablette, les bulles d\'info n\'apparaissent plus au toucher — elles restent réservées à la souris sur ordinateur.',
          en: 'On phone and tablet, info bubbles no longer pop up on tap — they stay reserved for mouse hover on desktop.',
        },
      },
    ],
  },
  {
    version: '0.111',
    name: 'Un scan de ticket, un frigo plus lisible',
    date: 'juillet 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Ajoute tes courses en un clin d\'œil : depuis le menu rapide du frigo, prends en photo ton ticket de caisse et l\'app reconnaît les articles pour toi.',
          en: 'Add your groceries in a snap: from the fridge\'s quick-actions menu, take a photo of your receipt and the app recognises the items for you.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Le panneau « Mon frigo » affiche désormais tes ingrédients en liste, groupés par zone, pour une lecture plus claire quand le frigo se remplit.',
          en: 'The "My fridge" panel now shows your ingredients as a list grouped by zone, for a clearer read as your fridge fills up.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Dans la liste des recettes, les titres longs ne sont plus coupés au milieu d\'un mot.',
          en: 'In the recipes list, long titles are no longer cut off mid-word.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Sur la fiche recette mobile, le bas de page reste désormais toujours accessible, même après avoir tout fait défiler.',
          en: 'On the mobile recipe sheet, the footer now always stays reachable, even after scrolling all the way down.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Sur mobile, le bas d\'écran de l\'accueil n\'est plus rogné par la barre de gestes du téléphone.',
          en: 'On mobile, the bottom of the home screen is no longer clipped by the phone\'s gesture bar.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Le téléchargement de tes données personnelles depuis ton profil fonctionne à nouveau correctement.',
          en: 'Downloading your personal data from your profile now works correctly again.',
        },
      },
    ],
  },
  {
    version: '0.110',
    name: 'Un frigo plus intuitif',
    date: 'juillet 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Le menu rapide du frigo (bouton +) regroupe l\'accès à ton inventaire (« Mon frigo ») et suit un ordre plus logique : frigo, recettes, ajouter des ingrédients, restes, vider.',
          en: 'The fridge\'s quick-actions menu (+ button) now groups access to your inventory ("My fridge") and follows a more logical order: fridge, recipes, add ingredients, leftovers, empty.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Les fenêtres et menus de l\'app s\'ouvrent avec une animation plus fluide et harmonisée dans toute l\'application.',
          en: 'Windows and menus across the app now open with a smoother, more consistent animation.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'L\'onglet Nutrition d\'une recette est mieux organisé : tri alphabétique sur desktop, une seule colonne sur mobile.',
          en: 'The Nutrition tab on a recipe is better organized: alphabetical order on desktop, a single column on mobile.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Le guide « Bien démarrer » : le bouton fusée ne s\'affiche plus que sur l\'accueil et disparaît définitivement une fois toutes les étapes terminées.',
          en: 'The "Get started" guide: the rocket button now only shows on the home screen and disappears for good once all steps are completed.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Le bandeau de mise à jour de l\'application s\'affiche désormais de manière fiable quand une nouvelle version est disponible.',
          en: "The app's update banner now reliably appears when a new version is available.",
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Sur mobile, le défilement de la fiche recette et l\'affichage des bulles d\'info sont corrigés.',
          en: 'On mobile, scrolling the recipe sheet and displaying info tooltips are now fixed.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Le bandeau d\'invitation Premium ne provoque plus de saut visuel à l\'ouverture.',
          en: 'The Premium upsell banner no longer causes a visual jump when it opens.',
        },
      },
    ],
  },
  {
    version: '0.109',
    name: 'Reste informé, même l\'app fermée',
    date: 'juillet 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Des notifications natives et optionnelles, activables depuis le panneau Cookies : un rappel discret si tu n\'as pas ouvert l\'app depuis un moment, les annonces importantes de l\'équipe, et une alerte quand un reste arrive à péremption.',
          en: 'Optional native notifications, enabled from the Cookies panel: a gentle nudge if you haven\'t opened the app in a while, important announcements from the team, and an alert when a leftover is about to expire.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Les annonces importantes de l\'équipe (nouveautés, maintenance) apparaissent bien dans ta cloche de notifications.',
          en: 'Important announcements from the team (news, maintenance) now show up properly in your notification bell.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Au clavier, les compartiments du frigo restent bien inaccessibles tant que la porte est fermée.',
          en: 'Using the keyboard, fridge compartments now stay properly out of reach while the door is closed.',
        },
      },
    ],
  },
  {
    version: '0.107',
    name: 'Illustrations plus légères',
    date: 'juillet 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Les illustrations des ingrédients et des recettes se chargent plus vite et plus légères — appli plus fluide, surtout sur mobile et en connexion lente.',
          en: 'Ingredient and recipe illustrations now load faster and lighter — a snappier app, especially on mobile and slow connections.',
        },
      },
    ],
  },
  {
    version: '0.106',
    name: 'Ton frigo, en un coup d\'œil',
    date: 'juillet 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Un nouveau panneau « Mon frigo » : d\'un coup d\'œil, retrouve tous tes ingrédients regroupés par zone (congélateur, frais, légumes, garde-manger), avec une recherche et un retrait rapide. Accessible depuis le pied de page, sur mobile comme sur ordinateur.',
          en: 'A new “My fridge” panel: at a glance, find all your ingredients grouped by zone (freezer, fresh, vegetables, pantry), with search and quick removal. Available from the footer, on mobile and desktop.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Le filtre « De saison » fonctionne enfin : il met en avant les recettes qui utilisent des fruits et légumes de saison ce mois-ci.',
          en: 'The “In season” filter now works: it highlights recipes using fruits and vegetables that are in season this month.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Beaucoup plus de recettes sont signalées « Congélation OK » : repère d\'un coup celles que tu peux préparer à l\'avance et congeler sans perte de qualité.',
          en: 'Many more recipes are marked “Freezer-friendly”: quickly spot the ones you can make ahead and freeze without losing quality.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Le pays choisi dans tes préférences est maintenant bien enregistré.',
          en: 'The country you choose in your preferences is now properly saved.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Dans le guide « Bien démarrer », les ingrédients suggérés indiquent clairement quand ils sont ajoutés (et se retirent d\'un nouveau tap), et s\'ajoutent tous correctement à ton frigo.',
          en: 'In the “Get started” guide, suggested ingredients now clearly show when they\'re added (tap again to remove), and all add correctly to your fridge.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Sur mobile, la petite phrase d\'accroche s\'affiche désormais sous le frigo plutôt que par-dessus les portes — plus lisible, surtout en anglais.',
          en: 'On mobile, the tagline now appears below the fridge instead of over the doors — more readable, especially in English.',
        },
      },
    ],
  },
  {
    version: '0.105',
    name: 'Mieux accueilli, mieux guidé',
    date: 'juillet 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'L\'écran d\'accueil et la visite guidée ont été repensés : un accueil plus chaleureux, puis une visite courte et claire — cinq étapes pour tout le monde, avec des astuces au dos de chaque carte.',
          en: 'The welcome screen and guided tour have been redesigned: a warmer welcome, then a short, clear tour — five steps for everyone, with tips on the back of each card.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'La fenêtre « Aide & infos » devient un vrai point de repère : relance la visite guidée, explore les fonctionnalités (chacune t\'emmène directement au bon endroit) et retrouve les réponses aux questions courantes. Un bouton dans le pied de page rouvre le guide quand tu veux.',
          en: 'The “Help & info” window becomes a real hub: relaunch the guided tour, explore features (each one takes you straight to the right place) and find answers to common questions. A button in the footer reopens the guide whenever you want.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Quand tu ajoutes un ingrédient depuis une recette, une petite animation confirme l\'ajout — tu ne navigues plus à l\'aveugle. Les boutons en bas d\'une recette sont aussi mieux alignés.',
          en: 'When you add an ingredient from a recipe, a small animation confirms it — no more guessing. The buttons at the bottom of a recipe are also better aligned.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Les explications des termes de cuisine sont plus justes : les expressions en plusieurs mots (comme « bouquet garni ») sont reconnues correctement, sans doublon ni confusion de sens.',
          en: 'Cooking term explanations are more accurate: multi-word phrases (like “bouquet garni”) are recognized correctly, with no duplicates or mix-ups.',
        },
      },
    ],
  },
  {
    version: '0.104',
    name: 'Cuisiner plus simplement',
    date: 'juillet 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Les fiches recettes sont plus faciles à suivre : touche un terme de cuisine pour une explication simple, garde l\'entête (titre, temps, progression des ingrédients) visible quand tu fais défiler, et repère chaque ingrédient d\'un coup d\'œil.',
          en: 'Recipes are easier to follow: tap a cooking term for a simple explanation, keep the header (title, time, ingredient progress) visible as you scroll, and spot each ingredient at a glance.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Tous les ingrédients d\'une recette s\'ajoutent maintenant à ton frigo d\'un simple clic — y compris les basiques comme les œufs, le riz ou le pain.',
          en: 'Every recipe ingredient can now be added to your fridge in one tap — including staples like eggs, rice or bread.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Tes restes ont désormais un espace dédié : un bouton pour les retrouver et les gérer, suivre leur date de péremption et voir combien tu en as sauvés.',
          en: 'Your leftovers now have a dedicated space: a button to find and manage them, track their use-by date, and see how many you\'ve saved.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Le texte du frigo et du garde-manger est plus net et mieux dimensionné.',
          en: 'Text in your fridge and pantry is crisper and better sized.',
        },
      },
    ],
  },
  {
    version: '0.103',
    name: 'Le guide « Bien démarrer » va plus loin',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Le guide « Bien démarrer » te mène désormais jusqu\'à ton premier plat : démarre vite en ajoutant quelques ingrédients suggérés, repère en un clin d\'œil une recette que tu peux cuisiner, et cuisine ton premier plat pour débloquer ta première récompense.',
          en: 'The “Get started” guide now takes you all the way to your first dish: kick off fast by adding a few suggested ingredients, instantly spot a recipe you can cook, and cook your first dish to unlock your first reward.',
        },
      },
    ],
  },
  {
    version: '0.102',
    name: 'Le guide « Bien démarrer »',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Un guide « Bien démarrer » accompagne les nouveaux arrivants — invités comme inscrits : ajoute tes ingrédients, découvre les recettes que tu peux cuisiner, et crée un compte pour garder ton frigo et tes favoris.',
          en: 'A “Get started” guide welcomes newcomers — guests and members alike: add your ingredients, discover the recipes you can cook, and create an account to keep your fridge and favorites.',
        },
      },
    ],
  },
  {
    version: '0.101',
    name: 'Mode invité : ton frigo est conservé',
    date: 'juin 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'En mode invité (sans compte), ton frigo et tes recettes favorites sont désormais conservés quand tu reviens ou rafraîchis la page.',
          en: 'In guest mode (no account), your fridge and favorite recipes are now kept when you return or refresh the page.',
        },
      },
    ],
  },
  {
    version: '0.100',
    name: 'Allergènes : traces signalées',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Les recettes signalent désormais les traces d\'allergènes : un ingrédient pouvant en contenir (gluten du maïs ou des épices, lait du chocolat noir, fruits à coque des graines, sésame…) est marqué, et l\'alerte personnalisée selon ton profil en tient compte.',
          en: 'Recipes now flag allergen traces: an ingredient that may contain them (gluten in corn or spice mixes, milk in dark chocolate, nuts in seeds, sesame…) is marked, and your personalized alert accounts for it.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Les recettes contenant réellement du gluten via un ingrédient (cube de bouillon, sauce soja, miso d\'orge…) ne sont plus listées comme « sans gluten ».',
          en: 'Recipes that genuinely contain gluten through an ingredient (stock cubes, soy sauce, barley miso…) are no longer listed as gluten-free.',
        },
      },
    ],
  },
  {
    version: '0.99',
    name: 'Allergènes : sécurité renforcée',
    date: 'juin 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Par sécurité, le gluten est désormais signalé sur les recettes à base de polenta (le maïs peut contenir des traces de gluten), et l\'affichage des allergènes a été affiné sur d\'autres recettes.',
          en: 'For safety, gluten is now flagged on polenta-based recipes (corn may contain traces of gluten), and allergen display was refined on other recipes.',
        },
      },
    ],
  },
  {
    version: '0.98',
    name: 'Allergènes des recettes plus justes',
    date: 'juin 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Les allergènes affichés sont plus exacts sur plusieurs recettes : œuf des gnocchi, poisson de la sauce tonkatsu, sulfites des câpres, gluten des tortillas de blé sont désormais bien signalés.',
          en: 'Displayed allergens are more accurate on several recipes: egg in gnocchi, fish in tonkatsu sauce, sulphites in capers and gluten in wheat tortillas are now properly flagged.',
        },
      },
    ],
  },
  {
    version: '0.97',
    name: 'Recettes plus fidèles',
    date: 'juin 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'De nombreuses recettes utilisent désormais le bon ingrédient : vin blanc de cuisine, gochujang, porc haché, garam masala, pecorino… à la place d\'approximations.',
          en: 'Many recipes now use the right ingredient: cooking white wine, gochujang, ground pork, garam masala, pecorino… instead of approximations.',
        },
      },
    ],
  },
  {
    version: '0.96',
    name: 'Nouveaux ingrédients',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'De nouvelles épices et condiments du monde rejoignent ton placard : gochujang, doubanjiang, sauce tonkatsu, câpres, garam masala, poivre vert, galanga et citronnelle.',
          en: 'New world spices and condiments join your pantry: gochujang, doubanjiang, tonkatsu sauce, capers, garam masala, green peppercorns, galangal and lemongrass.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'D\'autres ingrédients d\'épicerie rejoignent ton placard : vin blanc de cuisine, cognac, polenta, farine de maïs, haricots azuki et noirs, houmous, tapioca, lait concentré sucré, thé noir et noix de coco râpée.',
          en: 'More pantry staples join your cupboard: cooking white wine, cognac, polenta, cornmeal, azuki and black beans, hummus, tapioca, sweetened condensed milk, black tea and desiccated coconut.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Pâtes, feuilles et pains s\'ajoutent au catalogue : tortillas de blé, pâte filo, feuilles de brick, gnocchi, cannelloni, pain pita, chips de tortilla et nouilles dangmyeon.',
          en: 'Pasta, pastry sheets and breads join the catalogue: wheat tortillas, filo pastry, brick pastry, gnocchi, cannelloni, pita bread, tortilla chips and dangmyeon noodles.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Des viandes et fromages rejoignent le catalogue : porc haché, chair à saucisse, morcilla, saucisse fumée, gorgonzola, pecorino et kéfalotyri.',
          en: 'Meats and cheeses join the catalogue: ground pork, sausage meat, morcilla, smoked sausage, gorgonzola, pecorino and kefalotyri.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'De nouveaux légumes complètent le catalogue : tomatillo, chou chinois et cresson.',
          en: 'New vegetables round out the catalogue: tomatillo, napa cabbage and watercress.',
        },
      },
    ],
  },
  {
    version: '0.91',
    name: 'Tri des recettes plus clair',
    date: 'juin 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Le tri des recettes est plus clair : « Mon frigo », « A→Z » et « Plus rapide » remplacent les symboles %, A→Z et l\'horloge, dont le sens n\'était pas évident.',
          en: 'Recipe sorting is clearer: “My fridge”, “A→Z” and “Quickest” replace the %, A→Z and clock symbols, whose meaning was not obvious.',
        },
      },
    ],
  },
  {
    version: '0.90',
    name: 'Recettes plus claires',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Les étapes de préparation de toutes les recettes ont été relues et clarifiées : des instructions plus courtes et plus faciles à suivre, en français comme en anglais.',
          en: 'The preparation steps of every recipe have been reviewed and clarified: shorter, easier-to-follow instructions, in both French and English.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Chaque recette affiche désormais une courte description sous son titre, pour savoir en un coup d\'œil de quoi il s\'agit.',
          en: 'Every recipe now shows a short description under its title, so you can tell what it is at a glance.',
        },
      },
    ],
  },
  {
    version: '0.89',
    name: 'Journal des versions en anglais',
    date: 'juin 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Le journal des nouveautés s\'affiche désormais entièrement en anglais pour les utilisateurs anglophones : les titres des anciennes versions, qui étaient restés en français, sont maintenant traduits.',
          en: 'The version history now displays fully in English for English-speaking users: the titles of older versions, which had remained in French, are now translated.',
        },
      },
    ],
  },
  {
    version: '0.88',
    name: 'Allergènes des recettes plus complets',
    date: 'juin 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'La liste des allergènes affichée sur la fiche d\'une recette est désormais complète : elle prend en compte tous les ingrédients (y compris les alternatives proposées). Auparavant, certains allergènes présents via un ingrédient de substitution pouvaient ne pas apparaître.',
          en: 'The allergen list shown on a recipe page is now complete: it takes every ingredient into account (including suggested alternatives). Previously, some allergens present through a substitute ingredient could be missing.',
        },
      },
    ],
  },
  {
    version: '0.87',
    name: 'Tour du monde des recettes',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Le catalogue de recettes passe de moins de 200 à plus de 500 recettes ! Des centaines de nouveaux plats du monde entier rejoignent Fridge+ : Japon (ramen, sushis, poulet teriyaki…), Chine, Mexique (tacos, fajitas…), Espagne, Grèce (moussaka, souvlaki…), Vietnam, Corée (bibimbap, bulgogi…), Inde, Thaïlande, mais aussi de nombreux classiques français, italiens et américains.',
          en: 'The recipe catalogue grows from under 200 to over 500 recipes! Hundreds of new dishes from around the world join Fridge+: Japan (ramen, sushi, teriyaki chicken…), China, Mexico (tacos, fajitas…), Spain, Greece (moussaka, souvlaki…), Vietnam, Korea (bibimbap, bulgogi…), India, Thailand, plus many French, Italian and American classics.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'La recherche de recettes s\'enrichit : un nouveau filtre par pays couvre désormais une quinzaine de cuisines (avec leurs drapeaux), et de nouveaux types sont disponibles, dont les « Boissons » (lassi, limonades, smoothies) et les recettes « Difficile » pour relever un défi en cuisine.',
          en: 'Recipe search gets richer: a new country filter now covers around fifteen cuisines (with their flags), and new types are available, including "Drinks" (lassi, lemonades, smoothies) and "Difficult" recipes for a cooking challenge.',
        },
      },
    ],
  },
  {
    version: '0.86',
    name: 'Chargement plus rapide des illustrations',
    date: 'juin 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Les illustrations d\'ingrédients et de catégories se chargent désormais beaucoup plus vite : elles sont servies à la bonne taille au lieu de leur version pleine résolution. L\'application s\'affiche plus rapidement, surtout sur mobile.',
          en: 'Ingredient and category illustrations now load much faster: they\'re served at the right size instead of their full-resolution version. The app appears faster, especially on mobile.',
        },
      },
    ],
  },
  {
    version: '0.85',
    name: 'Inscription Google : consentement aligné',
    date: 'juin 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'En créant un compte avec Google, tu confirmes désormais avoir au moins 16 ans et accepter les conditions d\'utilisation et la politique de confidentialité, comme pour l\'inscription par e-mail.',
          en: 'When creating an account with Google, you now confirm you are at least 16 and accept the terms of service and privacy policy, just like with e-mail sign-up.',
        },
      },
    ],
  },
  {
    version: '0.84',
    name: 'Inscription & cookies clarifiés',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'À la création de compte, tu confirmes désormais avoir au moins 16 ans et accepter les conditions d\'utilisation et la politique de confidentialité. La page Mentions légales rappelle aussi que les offres payantes ne sont pas encore actives.',
          en: 'When creating an account, you now confirm you are at least 16 and accept the terms of service and privacy policy. The Legal page also notes that paid plans are not active yet.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Sur le bandeau cookies, le bouton « Refuser tout » est désormais aussi visible et accessible que « Accepter tout ».',
          en: 'On the cookie banner, the "Reject all" button is now just as visible and accessible as "Accept all".',
        },
      },
    ],
  },
  {
    version: '0.83',
    name: 'Saisie du code 2FA corrigée',
    date: 'juin 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Lors de l\'activation de la double authentification (2FA), le curseur quittait le champ à chaque chiffre tapé, rendant la saisie du code à 6 chiffres impossible. C\'est réglé : tu peux désormais saisir ton code d\'un seul trait.',
          en: 'When enabling two-factor authentication (2FA), the cursor jumped out of the field on every digit, making the 6-digit code impossible to enter. Fixed: you can now type your code in one go.',
        },
      },
    ],
  },
  {
    version: '0.82',
    name: 'Anti-gaspi : ton score dans le profil',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Ton score anti-gaspi (€ économisés, carbone évité) rejoint ton profil, dans l\'onglet Activité avec tes autres stats. La porte de ton frigo est désormais plus épurée.',
          en: 'Your anti-waste score (€ saved, carbon avoided) now lives in your profile, on the Activity tab alongside your other stats. Your fridge door is now cleaner.',
        },
      },
    ],
  },
  {
    version: '0.81',
    name: 'Anti-gaspi : alertes de péremption',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Fridge+ te prévient désormais quand des aliments de ton frigo vont bientôt périmer (puis le jour J). Un tap t\'amène droit aux recettes pour les cuisiner avant de les jeter.',
          en: 'Fridge+ now warns you when fridge items are about to spoil (then on the day itself). One tap takes you straight to recipes to use them up before they\'re wasted.',
        },
      },
    ],
  },
  {
    version: '0.80',
    name: 'Anti-gaspi : que cuisiner d\'abord',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Nouveau raccourci « Que cuisiner d\'abord » : d\'un geste, retrouve les recettes qui utilisent en priorité les aliments de ton frigo les plus proches de la péremption. Gratuit.',
          en: 'New "Cook this first" shortcut: in one tap, surface the recipes that use the fridge ingredients closest to spoiling. Free.',
        },
      },
    ],
  },
  {
    version: '0.79',
    name: 'Anti-gaspi : ton score',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Un indicateur anti-gaspi apparaît près de ton frigo : ton score, et les € que tu économises en cuisinant tes ingrédients avant qu\'ils ne périment. Gratuit, et mis à jour tout seul.',
          en: 'An anti-waste indicator now sits by your fridge: your score and the € you save by cooking ingredients before they spoil. Free, and updates on its own.',
        },
      },
    ],
  },
  {
    version: '0.78',
    name: 'Anti-gaspi : fraîcheur des ingrédients',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Chaque ingrédient de ton frigo affiche sa fraîcheur (vert / orange / rouge) pour cuisiner en priorité ce qui va bientôt périmer. Tu peux ajuster une date toi-même en cliquant sur la pastille.',
          en: 'Each fridge ingredient now shows its freshness (green / amber / red) so you cook what\'s about to spoil first. Tap the dot to adjust a date yourself.',
        },
      },
    ],
  },
  {
    version: '0.76',
    name: 'Quêtes & bannières à débloquer',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Récompenses : accomplis des quêtes de cuisine (premier plat, tour du monde, série, chef) pour débloquer des bannières exclusives — chaque quête réussie offre une bannière thématique.',
          en: 'Rewards: complete cooking quests (first dish, around the world, streak, chef) to unlock exclusive banners — each completed quest grants a themed banner.',
        },
      },
    ],
  },
  {
    version: '0.75',
    name: 'Profil : bannières personnalisables',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Profil : choisis une bannière d\'en-tête parmi un catalogue (dégradés, couleurs, motifs cuisine) — elle s\'affiche sur ton profil public.',
          en: 'Profile: pick a header banner from a catalog (gradients, colors, cooking patterns) — shown on your public profile.',
        },
      },
    ],
  },
  {
    version: '0.74',
    name: 'Profil : onglet Récompenses',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Profil : nouvel onglet « Récompenses » qui regroupe ta série de cuisine et tes badges, désormais bien visibles (avant ils étaient noyés dans « Activité »).',
          en: 'Profile: new "Rewards" tab gathering your cooking streak and badges, now clearly visible (they were previously buried under "Activity").',
        },
      },
    ],
  },
  {
    version: '0.73',
    name: 'Profil : pseudo au rafraîchissement',
    date: 'juin 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Profil : ton pseudo et ta bio s\'affichent bien quand tu ouvres ou rafraîchis directement la page profil (avant, les champs pouvaient apparaître vides).',
          en: 'Profile: your username and bio now show correctly when you open or refresh the profile page directly (the fields could previously appear empty).',
        },
      },
    ],
  },
  {
    version: '0.72',
    name: 'Profil : changement d\'avatar',
    date: 'juin 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Profil : le bouton « Changer mon avatar » ouvre désormais le sélecteur d\'avatars — il était sans effet auparavant.',
          en: 'Profile: the "Change my avatar" button now opens the avatar picker — it previously did nothing.',
        },
      },
    ],
  },
  {
    version: '0.71',
    name: 'Profil : finitions d\'affichage',
    date: 'juin 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Profil : le titre « Allergènes » ne s\'affiche plus en double, et le bouton de changement de mot de passe est harmonisé avec celui de la double authentification.',
          en: 'Profile: the "Allergens" title no longer appears twice, and the change-password button is harmonized with the two-factor one.',
        },
      },
    ],
  },
  {
    version: '0.70',
    name: 'Aide rapide dans le support',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Support : avant d\'ouvrir une demande, des conseils d\'aide rapide adaptés à ta question s\'affichent pour t\'aider à résoudre toi-même les soucis courants.',
          en: 'Support: before opening a request, quick-help tips tailored to your topic appear to help you solve common issues yourself.',
        },
      },
    ],
  },
  {
    version: '0.57',
    name: 'Fridge+ en anglais',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Change de langue (français / anglais) directement depuis l\'en-tête.',
          en: 'Switch language (French / English) right from the header.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'L\'application est désormais entièrement disponible en anglais, y compris le journal des nouveautés.',
          en: 'The app is now fully available in English, including the what\'s new page.',
        },
      },
    ],
  },
  {
    version: '0.56',
    name: 'Adresse de contact officielle',
    date: 'juin 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'L\'adresse de contact du support est désormais support@fridgeplus.app.',
          en: 'The support contact address is now support@fridgeplus.app.',
        },
      },
    ],
  },
  {
    version: '0.55',
    name: 'Connexion avec Google',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Connexion et inscription en 1 clic avec Google.',
          en: 'One-click sign-in and sign-up with Google.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Choix de ton pseudo public lors de la première connexion Google.',
          en: 'Pick your public username on first Google sign-in.',
        },
      },
    ],
  },
  {
    version: '0.53',
    name: 'Réinitialisation de mot de passe fiabilisée',
    date: 'juin 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'La validation d\'un nouveau mot de passe ne reste plus bloquée sur « Mise à jour… » : le changement se confirme correctement.',
          en: 'Setting a new password no longer gets stuck on "Updating…": the change now confirms correctly.',
        },
      },
    ],
  },
  {
    version: '0.52',
    name: 'Correction d\'affichage',
    date: 'juin 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Le nom « Fridge+ » s\'affiche correctement sur les écrans de connexion (au lieu de « Fridge++ »).',
          en: 'The "Fridge+" name now displays correctly on the sign-in screens (instead of "Fridge++").',
        },
      },
    ],
  },
  {
    version: '0.49',
    name: 'Termes de cuisine expliqués',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Dans une recette, touche un terme de cuisine souligné (émincer, déglacer, blanchir…) pour voir sa définition.',
          en: 'In a recipe, tap an underlined cooking term (mince, deglaze, blanch…) to see its definition.',
        },
      },
    ],
  },
  {
    version: '0.47',
    name: 'Célébration des badges',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Quand tu cliques « J\'ai cuisiné cette recette » et que tu débloques un nouveau badge, une petite célébration apparaît.',
          en: 'When you tap "I cooked this recipe" and unlock a new badge, a little celebration pops up.',
        },
      },
    ],
  },
  {
    version: '0.46',
    name: 'Séries & badges de cuisine',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Suis ta série de cuisine hebdomadaire et débloque des badges de progression (volume, variété, cuisine du monde) dans ton profil → Activité.',
          en: 'Track your weekly cooking streak and unlock progress badges (volume, variety, world cuisine) in your profile → Activity.',
        },
      },
    ],
  },
  {
    version: '0.44',
    name: 'Changement de mot de passe plus clair',
    date: 'juin 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Quand l\'e-mail de changement de mot de passe ne peut pas être envoyé, un message d\'erreur clair s\'affiche désormais (au lieu de ne rien indiquer).',
          en: 'When the password-change e-mail can\'t be sent, a clear error message now appears (instead of showing nothing).',
        },
      },
    ],
  },
  {
    version: '0.42',
    name: 'Bouton d\'actions plus stable',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Le bouton d\'actions rapides reste désormais au même endroit (dans la barre du haut) — fini le saut, et il ne masque plus le contenu du frigo.',
          en: 'The quick-actions button now stays in one place (top bar) — no more jumping, and it no longer hides the fridge content.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Son action Ouvrir/Fermer s\'adapte à l\'onglet affiché (frigo ou garde-manger).',
          en: 'Its Open/Close action adapts to the active tab (fridge or pantry).',
        },
      },
    ],
  },
  {
    version: '0.41',
    name: 'Aide & infos : ne sois jamais perdu',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Le guide devient « Aide & infos » : visite guidée, raccourcis et accès direct au support, regroupés au même endroit.',
          en: 'The guide becomes "Help & info": guided tour, shortcuts and direct support access, all in one place.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Une FAQ pas-à-pas répond aux questions courantes : ajouter un ingrédient, retrouver ses favoris, créer une recette, utiliser l\'app sans compte.',
          en: 'A step-by-step FAQ answers common questions: adding an ingredient, finding favorites, creating a recipe, using the app without an account.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'La version de l\'application est désormais visible dans « Aide & infos ».',
          en: 'The app version is now visible in "Help & info".',
        },
      },
    ],
  },
  {
    version: '0.40',
    name: 'Barre allégée, menu plus pratique',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Sur mobile, le menu s\'ouvre désormais en panneau bas — plus facile à atteindre d\'une seule main.',
          en: 'On mobile, the menu now opens as a bottom panel — easier to reach with one hand.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Le panier est maintenant accessible directement depuis le menu utilisateur, avec un badge « Prochainement » pour les comptes gratuits.',
          en: 'The cart is now accessible directly from the user menu, with a "Coming soon" badge for free accounts.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'L\'icône Communauté apparaît dans la barre dès la taille tablette (640 px), sans attendre le format bureau.',
          en: 'The Community icon now appears in the header bar from tablet size (640 px), without waiting for desktop.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Les accès Communauté et Mon profil sont désormais de vrais liens : ouverture dans un nouvel onglet et navigation plus accessible.',
          en: 'Community and My profile are now real links: open-in-new-tab support and more accessible navigation.',
        },
      },
    ],
  },
  {
    version: '0.37',
    name: 'Un guide plus clair',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Le guide et la visite découverte indiquent désormais clairement ce qui est gratuit, ce qui demande un compte, et ce qui arrive bientôt — tu sais d\'un coup d\'œil ce dont tu peux profiter maintenant.',
          en: 'The help guide and the discovery tour now clearly show what\'s free, what needs an account, and what\'s coming soon — so you can see at a glance what you can enjoy right now.',
        },
      },
    ],
  },
  {
    version: '0.36',
    name: 'Moins de doublons',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Quand tu crées une recette à partager, Fridge+ te signale désormais les recettes similaires qui existent déjà — pratique pour les retrouver ou éviter les doublons.',
          en: 'When you create a recipe to share, Fridge+ now points out similar recipes that already exist — handy to find them or avoid duplicates.',
        },
      },
    ],
  },
  {
    version: '0.35',
    name: 'Recettes plus complètes',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Le formulaire de recette te suggère désormais comment rendre ta recette plus complète (étapes, portions, ingrédients reconnus) avant de la partager.',
          en: 'The recipe form now suggests how to make your recipe more complete (steps, servings, recognised ingredients) before you share it.',
        },
      },
    ],
  },
  {
    version: '0.34',
    name: 'Publication de recettes plus claire',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Au moment de publier une recette dans la communauté, tu confirmes désormais clairement ton accord pour la partager sous ton pseudo. Tu gardes la main sur ce que tu publies.',
          en: 'When publishing a recipe to the community, you now clearly confirm your agreement to share it under your username. You stay in control of what you publish.',
        },
      },
    ],
  },
  {
    version: '0.33',
    name: 'Lancement gratuit',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Fridge+ est désormais entièrement gratuit ! Profite de toutes les recettes, de ton frigo et de la communauté sans limite. Les fonctionnalités avancées (panier de courses, mode cuisine vocal, coûts…) passent en Premium, bientôt disponible.',
          en: 'Fridge+ is now completely free! Enjoy all recipes, your fridge and the community without limits. Advanced features (shopping basket, hands-free cooking mode, costs…) move to Premium, coming soon.',
        },
      },
    ],
  },
  {
    version: '0.32',
    name: 'Anti-gaspillage simplifié',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Le bouton anti-gaspi du frigo a été retiré : tu retrouves désormais tes recettes anti-gaspillage directement via le filtre dédié dans la liste des recettes, accessible à tous.',
          en: 'The fridge\'s waste-prevention button was removed: you now find your zero-waste recipes directly via the dedicated filter in the recipe list, available to everyone.',
        },
      },
    ],
  },
  {
    version: '0.31',
    name: 'Modération des recettes — fiabilité renforcée',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Les recettes que tu proposes à la communauté sont toujours vérifiées par notre modération automatique, et si la vérification ne peut pas aboutir, notre équipe la passe en revue manuelle en priorité — pour ne jamais publier de contenu sans contrôle.',
          en: 'Recipes you submit to the community are always checked by our automatic moderation, and if the check can\'t complete, our team reviews them manually as a priority — so nothing is ever published without a control.',
        },
      },
    ],
  },
  {
    version: '0.30',
    name: 'Création de recette — brouillon enregistré tout seul',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Fridge+ enregistre maintenant ton brouillon de recette au fur et à mesure : si tu fermes l\'onglet, plantes ou reviens plus tard (jusqu\'à 7 jours), tu retrouves ta saisie. Un bandeau te le rappelle, et tu peux repartir de zéro en un clic.',
          en: 'Fridge+ now saves your recipe draft as you type: if you close the tab, crash, or come back later (up to 7 days), your work is right where you left it. A banner reminds you, and you can start over in one click.',
        },
      },
    ],
  },
  {
    version: '0.29',
    name: 'Publier une recette — ce que tu y gagnes',
    date: 'juin 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Au moment de proposer ta recette à la communauté, Fridge+ te rappelle ce que tu y gagnes : visibilité, nutrition et allergènes calculés tout seuls, avis de la communauté, contribution au catalogue.',
          en: 'When you submit your recipe to the community, Fridge+ now tells you what you get out of it: visibility, automatic nutrition & allergens, community reviews, and contribution to the catalogue.',
        },
      },
    ],
  },
  {
    version: '0.28',
    name: 'Inscription — exemple de pseudo neutre',
    date: 'mai 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'L\'exemple de pseudo affiché à l\'inscription est désormais générique (« Foodie_42 ») plutôt qu\'un pseudo personnel — plus neutre et professionnel.',
          en: 'The example username shown on signup is now a generic suggestion ("Foodie_42") instead of a personal handle — more neutral and professional.',
        },
      },
    ],
  },
  {
    version: '0.26',
    name: 'Catalogue ingrédients fiabilisé',
    date: 'mai 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Les informations d\'un ingrédient (nutrition, conditionnements, unités) sont désormais lues depuis une source unique et à jour, pour des calculs de recette et de panier plus fiables.',
          en: 'An ingredient\'s information (nutrition, pack sizes, units) is now read from a single, up-to-date source, for more reliable recipe and cart calculations.',
        },
      },
    ],
  },
  {
    version: '0.25',
    name: 'Frigo — compteurs justes',
    date: 'mai 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Les compteurs d\'ingrédients de ton frigo ne comptent plus les catégories par erreur : seules tes sélections réelles sont décomptées, et les catégories ajoutées par mégarde au micro sont retirées automatiquement.',
          en: 'Your fridge ingredient counters no longer count categories by mistake: only your actual selections are counted, and categories added by accident via the mic are removed automatically.',
        },
      },
    ],
  },
  {
    version: '0.24',
    name: 'Micro — catégories plus claires',
    date: 'mai 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Quand tu dis une catégorie au micro (ex. « poisson »), Fridge+ te propose maintenant ses variantes à choisir au lieu d\'ajouter une catégorie impossible à retirer du frigo.',
          en: 'When you say a category by voice (e.g. "fish"), Fridge+ now offers its variants to pick from, instead of adding a category you couldn\'t remove from the fridge.',
        },
      },
    ],
  },
  {
    version: '0.23',
    name: 'Consentement vocal — mode cuisine',
    date: 'mai 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Le mode cuisine vocal demande lui aussi ton accord avant d\'utiliser le micro (ta voix est transcrite par ton navigateur). Si tu refuses, la recette reste pilotable au toucher.',
          en: 'Voice cooking mode now also asks for your consent before using the mic (your voice is transcribed by your browser). If you decline, the recipe stays controllable by touch.',
        },
      },
    ],
  },
  {
    version: '0.22',
    name: 'Confidentialité renforcée',
    date: 'mai 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Avant d\'utiliser le micro pour ajouter des ingrédients, Fridge+ t\'explique clairement que ta voix est transcrite par ton navigateur et te demande ton accord. Réglable à tout moment dans les préférences cookies.',
          en: 'Before using the mic to add ingredients, Fridge+ clearly explains that your voice is transcribed by your browser and asks for your consent. Adjustable anytime in cookie preferences.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Pages légales complétées : toutes les sources de données et services tiers utilisés sont désormais listés, et les conditions d\'utilisation précisent ce qui protège l\'application.',
          en: 'Legal pages completed: all data sources and third-party services used are now listed, and the terms of use clarify what protects the app.',
        },
      },
    ],
  },
  {
    version: '0.21',
    name: 'Suivi des dépenses fiabilisé',
    date: 'mai 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Tes courses validées depuis le panier alimentent désormais bien l\'onglet « Mes dépenses » (suivi et graphique mensuels).',
          en: 'Shopping trips you complete from the cart now correctly feed the "My spending" tab (monthly tracking and chart).',
        },
      },
    ],
  },
  {
    version: '0.20',
    name: 'Recettes : navigation en pleine page',
    date: 'mai 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Les recettes s\'ouvrent désormais en pleine page, avec une adresse propre à partager. Le catalogue, lui, reste un panneau pour parcourir sans changer de page.',
          en: 'Recipes now open as a full page with a clean, shareable address. The catalog stays a panel so you can browse without leaving the page.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Quand tu reviens d\'une recette, le catalogue se rouvre exactement où tu l\'avais laissé : mêmes filtres, même position de défilement.',
          en: 'When you come back from a recipe, the catalog reopens right where you left it: same filters, same scroll position.',
        },
      },
    ],
  },
  {
    version: '0.19',
    name: 'Ajout au panier depuis la recette',
    date: 'mai 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'Le bouton « Ajouter au panier » est de nouveau disponible directement depuis la page d\'une recette, comme depuis la liste.',
          en: 'The "Add to cart" button is available again directly from a recipe\'s page, just like from the list.',
        },
      },
    ],
  },
  {
    version: '0.18',
    name: 'Panier — Et après ?',
    date: 'mai 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Nouvel onglet « Et après ? » après tes courses : les recettes que tu peux cuisiner avec ton nouveau stock et le bilan de ta dépense.',
          en: 'New "What\'s next?" tab after shopping: recipes you can cook with your new stock and a summary of what you spent.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Pendant les courses, masque les articles déjà cochés et affiche le nombre d\'articles restants.',
          en: 'While shopping, hide items already checked off and show how many are left.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Bouton « Précédent » pour revenir à l\'étape précédente du panier.',
          en: '"Back" button to return to the previous cart step.',
        },
      },
    ],
  },
  {
    version: '0.17',
    name: 'Partage de recette',
    date: 'mai 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Partage une recette par lien : un bouton « Partager » envoie l\'adresse de la recette et affiche un QR code à scanner.',
          en: 'Share a recipe by link: a "Share" button sends the recipe address and shows a QR code to scan.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Imprime une fiche recette propre (ingrédients avec quantités et étapes), désormais regroupée dans le bouton Partager.',
          en: 'Print a clean recipe sheet (ingredients with quantities and steps), now grouped under the Share button.',
        },
      },
    ],
  },
  {
    version: '0.16',
    name: 'Panier — Phase Préparer refondue ingrédients-first',
    date: 'mai 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Ingrédients consolidés en vue principale, regroupés par rayon de supermarché.',
          en: 'Ingredients consolidated as the main view, grouped by supermarket aisle.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Quantités fusionnées entre recettes (Tomates 200 g + 300 g = 500 g).',
          en: 'Quantities merged across recipes (Tomatoes 200 g + 300 g = 500 g).',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Sélecteur de pack enrichi : multiplicateur, prix au kg/L, recalcul automatique au changement de pack.',
          en: 'Pack selector enriched: multiplier, €/kg pricing, auto-recompute on pack change.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Détection des doublons lors de l\'ajout manuel d\'un ingrédient.',
          en: 'Duplicate detection when manually adding an ingredient.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Rayons repliables individuellement ou globalement (Tout replier / Tout déployer).',
          en: 'Collapsible aisles individually or globally (Expand all / Collapse all).',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Recettes regroupées en section secondaire compacte.',
          en: 'Recipes grouped in a compact secondary section.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Annonce accessibilité du prix recalculé via région live.',
          en: 'A11y announcement of recomputed price via live region.',
        },
      },
    ],
  },
  {
    version: '0.15',
    name: 'Mode cuisine vocal',
    date: 'mai 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Mode cuisine mains libres : lance une recette et pilote chaque étape à la voix, sans toucher l\'écran.',
          en: 'Hands-free cooking mode: start a recipe and drive every step with your voice, without touching the screen.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'L\'app lit chaque étape à voix haute et t\'écoute : dis « suivant », « répète » ou « étape 3 » pour naviguer.',
          en: 'The app reads each step aloud and listens to you: say "next", "repeat" or "step 3" to navigate.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Minuteur à la voix : « lance le minuteur », « ajoute 5 minutes », « réinitialise », avec un signal sonore en fin de cuisson.',
          en: 'Voice timer: "start timer", "add 5 minutes", "reset", with a sound when the cooking time is up.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Boutons clairs pour couper la voix ou le micro, et un guide intégré qui explique tout, infos de confidentialité comprises.',
          en: 'Clear buttons to mute the voice or the mic, plus a built-in guide that explains everything, privacy info included.',
        },
      },
      {
        type: 'fix',
        label: {
          fr: 'Tu restes connecté en ouvrant directement le lien d\'une page (panier, profil…) au lieu d\'être renvoyé à l\'accueil.',
          en: 'You stay logged in when opening a page link directly (cart, profile…) instead of being sent back to the home page.',
        },
      },
    ],
  },
  {
    version: '0.14',
    name: 'Filtres avancés',
    date: 'mai 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Nouveaux curseurs Protéines, Calories et Budget dans le panneau Filtres pour cibler une recette précise.',
          en: 'New Protein, Calories and Budget sliders in the Filters panel to target a precise recipe.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Compteurs dynamiques à côté de chaque filtre — vois en un coup d\'œil combien de recettes correspondent.',
          en: 'Dynamic counters next to each filter — see at a glance how many recipes match.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Partage tes filtres : l\'adresse de la page contient tes choix, le destinataire ouvre la même sélection.',
          en: 'Share your filters: the page URL contains your choices, the recipient opens the same selection.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Chaque filtre Préférences a maintenant une courte description pour mieux comprendre ce qu\'il fait.',
          en: 'Each Preferences filter now has a short description to make it clearer what it does.',
        },
      },
    ],
  },
  {
    version: '0.13',
    name: 'Filtres recettes',
    date: 'mai 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: '5 nouveaux filtres dans le panneau recettes : Sans cuisson, Anti-gaspi, Congélation OK, Familial et Batch cooking.',
          en: '5 new filters in the recipe panel: No-cook, Anti-waste, Freezer-friendly, Kid-friendly, and Batch cooking.',
        },
      },
    ],
  },
  {
    version: '0.12',
    name: 'Panier repensé',
    date: 'mai 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Le panier a sa propre page dédiée — accessible depuis l\'icône panier du menu.',
          en: 'The cart now has its own dedicated page — accessible from the cart icon in the menu.',
        },
      },
      {
        type: 'feat',
        label: {
          fr: 'Trois phases intelligentes : Préparer ta liste, En courses (coche tes articles) et Rentré (vider ou transférer au frigo).',
          en: 'Three smart phases: Prepare your list, Shopping (check off items) and Home (clear or move to fridge).',
        },
      },
    ],
  },
  {
    version: '0.11',
    name: 'Panier',
    date: 'mai 2026',
    changes: [
      {
        type: 'fix',
        label: {
          fr: 'L\'aperçu du panier dans le menu distingue mieux les actions principales des actions secondaires.',
          en: 'The basket preview menu now better distinguishes primary from secondary actions.',
        },
      },
    ],
  },
  {
    version: '0.10',
    name: 'Accès spécial',
    date: 'mai 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Badges de profil pour les bêta-testeurs, l\'équipe support, les créateurs partenaires et les partenaires Fridge+.',
          en: 'Profile badges for beta testers, support team, partner creators and Fridge+ partners.',
        },
      },
    ],
  },
  {
    version: '0.9',
    name: 'Bêta',
    date: 'mai 2026',
    changes: [
      {
        type: 'feat',
        label: {
          fr: 'Première version publique de Fridge+ — frigo, recettes, panier et communauté disponibles.',
          en: 'First public release of Fridge+ — fridge, recipes, cart and community available.',
        },
      },
    ],
  },
]
