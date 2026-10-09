# Architecture — Fridge+

> Doc d'entrée pour un dev qui découvre le projet. Le « pourquoi » des choix non-évidents est dans
> [`docs/adr/`](adr/README.md). Le process de livraison est dans [`CONTRIBUTING.md`](../CONTRIBUTING.md).
> (Faits vérifiés contre le code le 2026-06-22, §1 et §3 à §7 revérifiés le 2026-10-05 ; en cas
> de doute, se fier au code. Une liste ici qui peut dériver est gardée par un test :
> `src/test/unit/modules-documentes.test.js`.)

## 1. Le produit
Fridge+ regarde ce qu'on a dans son frigo et propose des recettes à faire avec, pour cuisiner plus
simple et **gaspiller moins** (les restes et leur compteur « restes sauvés » ; le score €/carbone a
été retiré avec la DLC des ingrédients). Web app, installable en PWA.
**2 langues : `fr` et `en`** (`SUPPORTED_LANGS`, `shared/lib/i18n/langues.js` —
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
- **`src/features/<f>/`** — une feature = un dossier autonome (composants, hooks, api, lib, pages),
  chacune avec son `README.md`. Les 18 modules (liste gardée par `modules-documentes.test.js`) :
  - `admin` (back-office), `auth` (connexion, session, double authentification),
    `cart` (panier et coûts — Premium, fermé), `changelog` (nouveautés),
  - `community` (forum, recettes partagées), `cooking-mode` (mode cuisine pas à pas),
    `fridge` (le frigo et le garde-manger), `legal` (pages légales, consentement),
  - `notifications` (notifications in-app), `onboarding` (bienvenue, visite guidée),
    `premium` (offre et abonnement), `profile` (pages du compte),
  - `push-notifications` (notifications push du navigateur), `pwa` (installation, mises à jour),
    `receipt-scan` (ticket de caisse → frigo), `recipes` (catalogue, fiche, création),
  - `support` (tickets in-app), `voice` (reconnaissance vocale).
- **`src/shared/`** — UI, hooks, contextes et libs transverses (dont `shared/lib/migration.js`,
  `shared/lib/version.js`, `shared/static/*`).
- **`src/app/`** — bootstrap, contextes applicatifs, hooks de session.
- **`src/routes/`** — déclaration des routes (`routes-config.js`, `index.jsx`) + **guards**
  (`auth-guard`, `premium-guard`, `role-guard`, `recovery-guard`, `redirect-if-auth-guard`).
- **`src/test/`** — tests Vitest. **`src/App.jsx`** — l'écran d'accueil (panneaux, modales,
  navigation interne) ; il ne porte plus le stock ni les favoris (§4).
- Règle : *les fichiers qui changent ensemble vivent ensemble* (découper par responsabilité, pas par couche).

## 4. État, navigation & persistance
- **État** : les sets `stock` (ingrédients au frigo) et `favorites` (recettes) vivent dans
  `SessionStateProvider` (`src/app/contexts/session-state-provider.jsx`, monté dans `src/main.jsx`) ;
  on les lit avec `useStockSession` / `useFavoritesSession` (`shared/contexts/session-state-context`).
  Ce document a affirmé « dans `App.jsx`, descendus en props » jusqu'au 2026-10-05.
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
- **Forme du frigo = préférence du compte** (depuis v0.138) : `profiles.fridge_shape` (Profil →
  Préférences), résolue par `src/shared/lib/resolve-fridge-layout.js`, `top-freezer` par défaut pour
  toutes les langues. La langue ne fournit que les LIBELLÉS (`FRIDGE_LAYOUTS[lang]`,
  `src/shared/static/fridge-layouts.js`). Ce document disait « dépendant de la langue » : vrai avant v0.138.
- **i18n** : objets `I18N` inline par composant, **2 langues (fr/en)** → voir
  [ADR 0002](adr/0002-i18n-inline-par-composant.md), dont le périmètre linguistique est remplacé par
  l'[ADR 0005](adr/0005-corrections-audit-2026-08-28.md) (les ADR sont en ajout seul).
- **Données statiques ↔ Supabase** : transition en cours → voir [ADR 0004](adr/0004-donnees-static-vs-supabase.md).

## 6. Décisions non-évidentes → [`docs/adr/`](adr/README.md)
La liste vit dans l'[index des ADR](adr/README.md) — un pointeur plutôt qu'une copie (règle de l'ADR 0005).

## 7. Exploitation
- Livraison, rollback : [`CONTRIBUTING.md`](../CONTRIBUTING.md) §2 et §6.
- Monitoring, incidents, sauvegardes : procédures internes, hors dépôt public.
- Schéma de la base : les migrations de `supabase/migrations/` et leur [`README`](../supabase/migrations/README.md).
  `supabase/SCHEMA.md` est un fichier LOCAL (ignoré par git) : absent d'un clone neuf.
