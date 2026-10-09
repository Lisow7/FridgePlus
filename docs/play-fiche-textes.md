# Fiche Google Play — textes et formulaires, prêts à coller

> Écrit le **2026-09-12**, avec les limites et la politique de métadonnées
> re-vérifiées ce jour ([règles de fiche](https://support.google.com/googleplay/android-developer/answer/9898842),
> [spécifications graphiques](https://support.google.com/googleplay/android-developer/answer/9866151)).
> Compagnon de la note interne « play-pas-a-pas » (étapes 5 et 6).
>
> ⚠️ **Ce qui est interdit dans une fiche, et qui explique les choix ci-dessous** :
> émojis et caractères répétés dans le titre, majuscules non justifiées, mentions
> de classement (« n°1 », « app de l'année »), de prix ou de promotion
> (« -10 % », « gratuit pour un temps limité »), témoignages non attribués,
> mots-clés répétés. D'où : aucun emoji, aucun superlatif, et les seules
> affirmations chiffrées sont vérifiables dans l'app.

## 1. Textes — français (langue par défaut de la fiche)

**Nom de l'application** (30 caractères max) :

```
Fridge+
```

**Description courte** (80 caractères max — 64 utilisés) :

```
Ton frigo te dit quoi cuisiner, avec ce que tu as déjà chez toi.
```

**Description complète** (4 000 caractères max — ~1 500 utilisés) :

```
Fridge+ transforme ce que tu as déjà dans ton frigo en idées de repas.

REMPLIR TON FRIGO — quatre façons
• Coche tes ingrédients bac par bac, comme dans un vrai frigo.
• Cherche un aliment par son nom : « œufs », « pâtes »… et ajoute-le en un tap.
• Dis-les au micro, comme à un ami : « j'ai des œufs, du lait, des tomates ».
• Photographie ton ticket de caisse : toutes tes courses d'un coup, après relecture.

VÉRIFIER CE QUE TU AS
• L'inventaire montre tout ton frigo en une liste, avec une recherche.
• Les restes suivent tes plats cuisinés et le temps qu'il leur reste, pour les finir avant qu'ils ne se perdent.

CUISINER
• Les recettes réalisables apparaissent en premier ; une jauge indique à quel point chacune est à ta portée.
• 515 recettes, 15 cuisines, filtres par régime, temps ou type de plat.
• « J'ai cuisiné » retire du frigo les ingrédients utilisés et garde le plat dans tes restes.

SANS COMPTE
Le frigo, les recettes et le micro fonctionnent sans inscription. Un compte ajoute les favoris, la communauté, ton profil et la photo du ticket.

HORS LIGNE
L'app s'installe sur ton téléphone et se souvient de ton frigo et des recettes déjà chargées.

TA VIE PRIVÉE
Le micro et l'appareil photo restent désactivés tant que tu ne les autorises pas, et tu peux revenir sur ton choix à tout moment. Tu peux supprimer ton compte et tes données quand tu veux.

Fridge+ est en développement continu : l'app évolue chaque semaine. Une question, une idée, un bug : support@fridgeplus.app
```

## 2. Textes — anglais (à ajouter comme seconde langue)

**Nom** : `Fridge+` · **Description courte** (63 caractères) :

```
Your fridge tells you what to cook, with what you already have.
```

**Description complète** :

```
Fridge+ turns what you already have in your fridge into meal ideas.

FILL YOUR FRIDGE — four ways
• Tick your ingredients shelf by shelf, like in a real fridge.
• Find a food by its name: "eggs", "pasta"… and add it in one tap.
• Say them to the mic, like to a friend: "I've got eggs, milk, tomatoes".
• Snap a photo of your receipt: everything you bought, added at once, after a quick review.

CHECK WHAT YOU HAVE
• The inventory shows your whole fridge in one list, with a search.
• Leftovers track your cooked dishes and the time they have left, so you finish them before they go to waste.

COOK
• The recipes you can make show up first; a gauge tells how close each one is.
• 515 recipes, 15 cuisines, filters by diet, time or type of dish.
• "I cooked this" removes the ingredients you used and keeps the dish in your leftovers.

NO ACCOUNT NEEDED
The fridge, the recipes and the mic work without signing up. An account adds favourites, the community, your profile and the receipt photo.

OFFLINE
The app installs on your phone and remembers your fridge and the recipes already loaded.

YOUR PRIVACY
The mic and the camera stay off until you allow them, and you can change your mind anytime. You can delete your account and your data whenever you want.

Fridge+ is under continuous development: the app changes every week. A question, an idea, a bug: support@fridgeplus.app
```

## 3. Ressources graphiques — où elles sont

| Élément | Fichier | Format vérifié |
|---|---|---|
| Icône 512×512 | `public/icon-512.png` | PNG 32 bits avec alpha ✅ |
| **Image de présentation 1024×500** | `store-assets/play/feature-graphic.png` | PNG **24 bits sans alpha** ✅ — générée par `npm run play:graphic`, verrouillée par `src/test/unit/play-feature-graphic.test.js` |
| Captures téléphone | `public/screenshots/accueil-mobile.jpg`, `recette-mobile.jpg` | JPEG 1080×1920 ✅ (2 suffisent, 8 au maximum) |

Une troisième capture aide à raconter l'histoire : la vue **recettes réalisables**
ou le **menu du bouton orange**. Se capture avec la recette de
`src/test/unit/pwa-manifest-screenshots.test.js` (localStorage posé, service
worker bloqué, frigo rempli par l'interface).

## 4. Sécurité des données — brouillon à recopier dans la Console

Transposition honnête de la politique de confidentialité (`/legal`). À déclarer
**collecté**, tout est lié à l'utilisateur et sert au fonctionnement :

| Catégorie Play | Donnée | Obligatoire ? | Pourquoi |
|---|---|---|---|
| Informations personnelles | Adresse e-mail, pseudonyme, identifiant utilisateur | Facultatif (seulement si compte) | Authentification, profil |
| Activité dans l'app | Contenu créé : frigo, recettes personnelles, favoris, panier, restes, journal de cuisine, posts et réponses communauté, tickets de support | Facultatif | Le service lui-même |
| Informations de l'app et performances | Journaux de plantage, diagnostics | Facultatif | Sentry, **soumis au consentement** |
| Identifiants d'appareil ou autres | Identifiant d'abonnement push, identifiant anonyme | Facultatif | Notifications, mesure d'audience |
| Photos | Photo du ticket de caisse | Facultatif | **Traitée de façon éphémère** : envoyée à la reconnaissance de texte, jamais conservée |
| Audio | Voix de l'ajout d'ingrédients | Facultatif | **Traitée de façon éphémère** par le navigateur (API Web Speech), jamais conservée par Fridge+ |

Réponses aux questions obligatoires :

- **Données chiffrées en transit** : oui (HTTPS partout, HSTS).
- **Possibilité de demander la suppression des données** : oui → voir § 6.
- **Partage avec des tiers** : les sous-traitants sont listés dans `/legal`
  (hébergement, e-mails transactionnels, reconnaissance de texte, service push).
  Un sous-traitant qui traite pour le compte de l'éditeur n'est pas un
  « partage » au sens du formulaire, mais **relis chaque cas** : le formulaire
  engage, et Google recoupe avec le comportement réel de l'app.
- ⚠️ **À revoir le jour où le premium s'allume** : une catégorie *Informations
  financières* (historique d'achat) apparaîtra. Rien à déclarer tant que Stripe
  est en mode test et qu'aucune surface d'achat n'existe.

## 5. Classification du contenu et public — brouillon

- **Catégorie** : Alimentation et boissons. **Publicités** : non.
- **Questionnaire IARC** : aucun contenu violent, sexuel, ni jeu d'argent.
- ⚠️ **Répondre OUI à « les utilisateurs peuvent interagir ou échanger du
  contenu »** : la communauté existe. Décrire les garde-fous, qui sont en place :
  modération (validation avant publication), signalement, blocage entre
  utilisateurs, journal d'audit des actions de modération.
- **Public cible** : **16 ans et plus**, cohérent avec les CGU (âge minimum
  RGPD France) — donc **hors programme « Familles »**.
- **Accès à l'application** : une partie des fonctions est derrière un compte
  (favoris, communauté, profil, photo du ticket). Fournir des identifiants de
  test **dans la Console** — ⛔ jamais dans le dépôt ni dans ce fichier.

## 6. ✅ L'URL de suppression — RÉSOLU et EN LIGNE depuis le 2026-09-12

Google exige, pour toute app permettant de créer un compte, une **URL web
publique** où l'on peut **demander la suppression du compte et des données**,
sans installer ni réinstaller l'app. Les conditions qui comptent : **HTTPS**,
**aucun mur de connexion**, et un **lien direct vers la page de suppression**,
pas une page d'accueil où l'information est enfouie
([règles Play](https://support.google.com/googleplay/android-developer/answer/13327111)).

**C'est fait.** L'option 1 (page publique dédiée) a été retenue, construite et
livrée en production avec la **v0.143**, après relecture du texte par le
mainteneur — la page fait des affirmations publiques sur le traitement de données
personnelles, elle ne pouvait pas partir sans cette relecture.

👉 **L'URL à coller dans le formulaire :**

```
https://fridgeplus.app/suppression-compte
```

**Vérifié en production le 2026-09-12**, et c'est ce qui compte pour un robot :

| | |
|---|---|
| HTTPS, sans mur de connexion | ✅ HTTP 200 en navigation anonyme |
| Contenu servi **sans JavaScript** | ✅ le délai de 30 jours, `support@fridgeplus.app`, le chemin dans l'app et « Utilisateur supprimé » sont dans le HTML servi |
| Lien direct, pas une page enfouie | ✅ route dédiée, `<title>` « Supprimer mon compte — Fridge+ » |
| Indexable | ✅ `robots: index, follow`, présente dans `sitemap.xml` |

La page dit ce qui est **effacé**, ce qui est **anonymisé** (les recettes et
commentaires publics restent en ligne sous « Utilisateur supprimé ») et ce qui
est **conservé** avec sa durée — c'est exactement le découpage que le formulaire
Sécurité des données réclame. Source unique :
`src/features/legal/data/suppression-compte.js`, dont un test vérifie que la page
reste **publique** (aucun `AuthGuard`) et que le délai affiché ne diverge jamais.

⚠️ **Ne collez cette URL nulle part avant la v0.143** — elle renvoyait 404, et une
URL morte est précisément le motif de refus que cette page existe pour éviter.
Depuis la mise en production du 2026-09-12, la contrainte est levée.
