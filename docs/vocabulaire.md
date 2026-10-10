# Vocabulaire de l'app — un nom par chose

Source : audit du 2026-10-04 (UX-08, UX-16), décision du 2026-10-08.
Dix notions portaient plusieurs noms, parfois dans la même phrase : on « vidait le panier » mais on
« sauvegardait la liste » dans la même fenêtre ; l'aide envoyait dans « le bouton d'actions » un menu
nommé « Actions rapides ».

**Garde-fou** : `scripts/vocabulaire.mjs` relève, dans ce que l'app affiche, les synonymes écartés ci-dessous ;
`src/test/unit/vocabulaire-tenu.test.js` exige une liste vide. Pour la lire : `node scripts/vocabulaire.mjs`.
Ne sont pas lus : le panneau admin (outil interne), les tests, le journal des versions
(`src/features/changelog/data/`, qui raconte le passé avec les mots de son époque), les commentaires,
les identifiants (`user_basket`, `basket-modals-root`) et les journaux de développement.

## Les dix notions

| Notion | FR | EN | Écartés |
|---|---|---|---|
| Ce qu'on a chez soi | **Inventaire** (menu « Inventaire (n) », panneau « Inventaire — n aliments », aide) | **Inventory** | « Aperçu du frigo », « Mon frigo — n aliments » ; EN « Fridge at a glance », « Fridge overview », « My fridge — n items » |
| Les courses | **Panier** ; **Mes listes** pour celles qu'on garde | **Cart** ; **My lists** | « liste de courses » ; EN « basket », « shopping list » |
| La cuisine pas à pas | **Mode cuisine**, la voix en est une option | **Cooking mode** | « Cuisine guidée », « Mode cuisine vocal », « cuisine vocale » ; EN « Guided cooking », « voice cooking (mode) », « hands-free cooking mode » |
| « Mes recettes » | **seulement** les recettes que tu as créées (filtre, notifications, aide) | **My recipes**, idem | la carte d'accueil dit « Voir les recettes », un reste vient de « Recettes » |
| Le bouton orange | **Actions rapides** — « le bouton orange, Actions rapides » la première fois | **Quick actions** | « bouton d'actions », « bouton orange » seul ; EN « actions button », « orange button » seul |
| Le ticket de caisse | **Photo du ticket** ; la consigne reste « Photographie ton ticket » | **Receipt photo** ; « Snap your receipt » | « Scan (du) ticket (de caisse) », « scanner ton ticket » ; EN « Receipt scan », « scan your receipt » |
| La voix | **À la voix** ; « Parle à ton frigo » reste le slogan, « reconnaissance vocale » la demande d'accord | **By voice** | « Dis-le », « Dis-le au micro », « Le micro » ; EN « Say it », « The mic », « say it to the mic » |
| Les réglages | la section du menu utilisateur : **Langue et thème** ; l'onglet du profil garde **Préférences** | **Language and theme** / **Preferences** | — (test ciblé : `header.test.jsx`) |
| Ce qui n'est pas encore là | **Bientôt** (badge) | **Coming soon** | « Prochainement », « Bientôt disponible », « Ce qui arrive » ; EN « Soon », « Available soon » |
| Se connecter (EN) | — | **Sign in** | « Log in », « login » |

Un « bientôt » sur une carte : le badge dit l'état (« Bientôt »), l'encadré le dit en phrase (« Cette
fonctionnalité arrive bientôt. ») — deux « Bientôt » côte à côte ressemblaient à un doublon.

## Les mots anglais dans l'app française (UX-16)

| Écarté | FR |
|---|---|
| post(s) | **publication(s)** — féminin : « Supprimer cette publication ? », « Elle disparaîtra… » |
| like(s) | **j'aime**, invariable : « Aucun j'aime », « 3 j'aime » |
| Support (nom de menu) | **Écrire au support** ; la catégorie de notifications : **Mes demandes** |
| Batch cooking | **Grandes quantités** |

Une réponse n'est pas une publication : supprimer une réponse demande « Supprimer cette réponse ? »
(elle reprenait le titre de la publication).

## Les verbes (décisions du 2026-10-08)

| Geste | FR | EN | Exemples |
|---|---|---|---|
| Garder ce qu'on a fait | **Enregistrer** ; un réglage immédiat dit **✓ Enregistré** | **Save** ; **✓ Saved** | « Enregistrer ma liste » ; « sauvegardes » ne désigne plus que les copies de secours chiffrées |
| Faire disparaître pour de bon | **Supprimer** | **Delete** | une recette, une publication, un message, son compte, son historique de dépenses, les notifications lues |
| Sortir d'une liste | **Retirer** | **Remove** | du frigo, des favoris, du panier ; une étape ou un ingrédient du formulaire |
| Tout enlever d'un coup | **Vider** | **Empty** | le panier, la liste, le frigo |
| Enlever un texte | **Effacer** | **Clear** | la recherche, un champ, les filtres |

Le bouton qui confirme nomme l'action (« Vider la liste », « Supprimer la publication ») : plus de
« Confirmer » par défaut (`confirmations-nommees.test.js`).

## Ajouter une notion

1. Une ligne dans le tableau ci-dessus, avec le nom retenu et les synonymes écartés.
2. Une règle dans `REGLES` (`scripts/vocabulaire.mjs`) : `lang`, `interdit`, `canon` ; `sure: true` seulement
   si le mot n'existe que dans une langue (il est alors cherché aussi dans les textes sans langue connue) ;
   `sauf` pour une forme permise (« le bouton orange, Actions rapides »).
3. Un témoin dans `vocabulaire-tenu.test.js` si la règle a une particularité.
