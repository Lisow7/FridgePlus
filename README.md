# Fridge+ 🥗

> Ouvrez votre frigo. Trouvez l'inspiration.

**Fridge+** est une application web (PWA) qui aide à gérer le contenu de son frigo et de son garde-manger, puis à **découvrir instantanément les recettes réalisables avec ce qu'on a déjà** — pour cuisiner mieux et **gaspiller moins**.

🔗 **En ligne :** [fridgeplus.app](https://fridgeplus.app) · Gratuit · Français et anglais

> Dépôt public en **lecture** : le code est visible, les droits sont réservés ([LICENSE](LICENSE)).
> Les secrets, les données et les documents d’exploitation ne sont pas dans ce dépôt.

---

## ✨ Fonctionnalités

- **Frigo & garde-manger** — inventaire visuel par compartiments, ajout rapide (clic ou **voix**).
- **Recettes adaptées** — classées par taux de correspondance avec ton stock ; filtres riches (temps, difficulté, régime, budget, zéro-déchet…).
- **Anti-gaspi** — fraîcheur des ingrédients 🟢🟡🔴, score d'économies (€ + carbone), alertes de péremption, « que cuisiner d'abord ».
- **Communauté** — création et partage de recettes, avec modération.
- **Compte** — favoris, recettes perso, quêtes & badges, profil personnalisable.
- **Premium** *(à venir)* — panier de courses chiffré, mode cuisine vocal, analyse des dépenses.

## 🛠️ Stack

React 19 · Vite · Tailwind CSS v4 · Supabase (Auth + Postgres + RLS + Edge Functions) · PWA (Workbox) · Vitest + Playwright · Sentry · déploiement Vercel.

> SPA sans router lourd ; l'état (`stock`, `favorites`) est géré dans `App.jsx` et descendu en props. i18n maison (objets `I18N` par composant, 5 langues).

## 🚀 Démarrage

```bash
npm install
npm run dev        # serveur de dev (Vite)
npm run build      # build de production → dist/
npm run preview    # prévisualiser le build
```

Variables d'environnement requises (`.env`) :

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## 🧪 Qualité

```bash
npm run lint       # ESLint
npm run test       # tests unitaires (Vitest)
npm run e2e        # tests E2E (Playwright)
```

## 🗂️ Structure (aperçu)

```
src/
  app/             # shell, layout, navigation, providers
  features/        # domaines : fridge, recipes, cart, community, profile, admin, auth…
  shared/          # ui, hooks, libs, contextes
  shared/static/   # données statiques : ingrédients, recettes, layouts du frigo
  routes/          # configuration des routes
  test/            # unitaires + backend
docs/              # architecture, décisions (ADR), règles d’interface
supabase/          # migrations & edge functions
```

## 📌 Conventions

- **Versioning** : `CURRENT_VERSION` dans `src/shared/lib/version.js` = source unique  ; le journal et le numéro de version changent à chaque release `dev→main` (CONTRIBUTING §4).
- **Git** : branches `feat/…`, `fix/…`, `chore/…` ; PR vers `dev` ; commits `type(vX.X): titre`.
- **IDs ingrédients** : préfixes de stockage — `frz-` (congelé), `fr-` (frais), `vg-` (légumes/fruits), `gp-` (épicerie), `sp-` (épices/condiments), `bk-` (boulangerie).
- **i18n** : toute chaîne visible par l'utilisateur — y compris `aria-label`, `title`, `alt` et `placeholder` — passe par un dictionnaire, résolu en `DICO[lang] ?? DICO.fr`. **Jamais de littéral bilingue inline** (`lang === 'fr' ? 'Fermer' : 'Close'`) : avec un ternaire binaire, ajouter une langue impose de rouvrir chaque site d'appel. Ajouter une langue = traduire un bloc **entièrement** — un bloc partiel est truthy, donc il neutralise le repli et vide tout le panneau. Trois tests appliquent ces règles : `lang-ternaries-i18n` (pas de ternaire de traduction), `aria-labels-i18n` (attributs porteurs de texte), `i18n-dictionaries-parity` (parité des clés sur les 13 dictionnaires).

## 📄 Licence

Code **visible, droits réservés** (*source-available*) : le nom « Fridge+ », le logo, l’identité visuelle et le code source sont la propriété exclusive de l’éditeur. Lecture et étude autorisées ; toute reproduction, modification, distribution ou exploitation, même partielle, est interdite sans autorisation écrite préalable. Texte complet : [LICENSE](LICENSE).
