# Architecture — Fridge+

> Doc d'entrée pour un dev qui découvre le projet. Le « pourquoi » des choix non-évidents est dans
> [`docs/adr/`](adr/README.md). Le process de livraison est dans [`CONTRIBUTING.md`](../CONTRIBUTING.md).
> (Faits vérifiés contre le code le 2026-06-22 ; en cas de doute, se fier au code.)

## 1. Le produit
Fridge+ regarde ce qu'on a dans son frigo et propose des recettes à faire avec, pour cuisiner plus
simple et **gaspiller moins** (score anti-gaspi). Web app, installable en PWA.
**2 langues : `fr` et `en`** (`SUPPORTED_LANGS`, `shared/contexts/ui-provider.jsx` —
un reglage `es`/`de`/`ja` herite est migre vers `en` au boot).

> 🔴 Ce document affirmait « 5 langues » jusqu'au 2026-08-28, et ce faux fait a fui
> jusque dans l'image de partage publique du site. La documentation interne désigne ce fichier
> comme sa source vérifiée : une erreur ici se propage. Verifier `SUPPORTED_LANGS`,
> jamais un document.

## 2. Stack & build
React 19 · Vite · Tailwind CSS v4 · Supabase (Auth + Postgres + RLS) · React Router v7.
Pas de framework méta (pas de Next).
Commandes clés (cf. `package.json`) : `npm run dev | build | test | e2e | migrate | db:types`.

## 3. Structure (feature-based)
- **`src/features/<f>/`** — une feature = un dossier autonome (composants, hooks, api, lib, pages) :
  `admin` (back-office), `auth` (connexion/session), `cart` (panier/coûts), `changelog`,
  `community` (recettes communautaires/forum), `cooking-mode` (mode cuisine), `fridge` (le frigo +
  stock), `legal` (pages légales), `notifications`, `onboarding`, `premium`, `profile`, `pwa`,
  `recipes` (catalogue + création/score), `support` (tickets in-app), `voice` (reconnaissance vocale).
- **`src/shared/`** — UI, hooks, contextes et libs transverses (dont `shared/lib/migration.js`,
  `shared/lib/version.js`, `shared/static/*`).
- **`src/app/`** — bootstrap, contextes applicatifs, hooks de session.
- **`src/routes/`** — déclaration des routes (`routes-config.js`, `index.jsx`) + **guards**
  (`auth-guard`, `premium-guard`, `role-guard`, `recovery-guard`, `redirect-if-auth-guard`).
- **`src/test/`** — tests Vitest. **`src/App.jsx`** — racine, porte une grosse part de l'état.
- Règle : *les fichiers qui changent ensemble vivent ensemble* (découper par responsabilité, pas par couche).

## 4. État, navigation & persistance
- **État** : les sets `stock` (ingrédients au frigo) et `favorites` (recettes) sont gérés haut dans
  `src/App.jsx` et descendus en props.
- **Navigation** : React Router v7 — `BrowserRouter` monté dans `src/main.jsx` (avec `basename` pour
  le déploiement), `<Routes>` dans `src/routes/index.jsx`. `App.jsx` utilise `useNavigate` /
  `useLocation` / `useSearchParams`.
- **Persistance** : localStorage (invité) ↔ Supabase (connecté), avec migration au login.
  → voir [ADR 0001](adr/0001-persistance-dual-mode.md).

## 5. Conventions (où vivent les choses)
- **Préfixes d'ID ingrédients** (vérifiés dans `src/shared/static/ingredients.js`) — indiquent la
  zone de stockage, et pilotent la répartition frigo/garde-manger dans
  `src/features/fridge/lib/categorize-ingredients.js` :
  - **Frigo** : `fr-` (frais), `vg-` (légumes), `frz-` (surgelés), `jp-` (japonais frais).
  - **Garde-manger** : `gp-` (épicerie), `sp-` (épices/condiments), `bk-` (boulangerie — préfixe
    défini dans le code mais non utilisé par les données actuelles).
- **Version** : `CURRENT_VERSION` exporté par `src/shared/lib/version.js` (source unique pour
  l'affichage et Sentry). Le `CHANGELOG` vit dans `src/features/changelog/data/changelog.js`.
- **Layout frigo dépendant de la langue** : `FRIDGE_LAYOUTS[lang]` dans
  `src/shared/static/fridge-layouts.js` (fr → top-freezer, en → side-by-side, etc.).
- **i18n** : objets `I18N` inline par composant, **2 langues (fr/en)** → voir
  [ADR 0002](adr/0002-i18n-inline-par-composant.md), dont le perimetre linguistique
  est perime (les ADR sont en ajout seul : un ADR 0005 le remplacera).
- **Données statiques ↔ Supabase** : transition en cours → voir [ADR 0004](adr/0004-donnees-static-vs-supabase.md).

## 6. Décisions non-évidentes → [`docs/adr/`](adr/README.md)
0001 persistance dual-mode · 0002 i18n inline · 0003 `custom_recipes` = VUE · 0004 données static↔Supabase.

## 7. Exploitation
- Livraison & routine post-deploy : [la note interne de livraison](UPDATE_PROCESS.md).
- Monitoring : [la note interne de monitoring](MONITORING.md). Incident : [la procédure interne de réponse aux incidents](INCIDENT_RESPONSE.md).
- Rollback : [la procédure interne de rollback](ROLLBACK.md). Schéma BDD : `supabase/SCHEMA.md` (gitignored).
