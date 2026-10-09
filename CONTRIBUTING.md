# Contribuer à Fridge+

> **Source unique de vérité du workflow** : branches, commits, PR, versioning, release, rollback.
> Pour l'**architecture** et le rationale, voir `docs/ARCHITECTURE.md` + `docs/adr/`.

## 1. Démarrage

```bash
npm install
npm run dev        # serveur de dev (Vite)
npm run test       # tests unitaires (Vitest)
npm run lint       # ESLint
npm run e2e        # tests E2E (Playwright)
npm run build      # build de prod → dist/
```

Environnement : créer `.env.local` avec les clés publiques `VITE_SUPABASE_URL` et
`VITE_SUPABASE_ANON_KEY`. **Ne jamais commiter de secret.** `.env.test` (versionné)
ne contient que des placeholders de test.

### Partager le projet (audit, prestataire, outil externe)

**Toujours passer par `git archive` — jamais un zip du dossier de travail :**

```bash
git archive --format=zip --output=../fridgeplus-partage.zip HEAD
```

`git archive` n'exporte que les fichiers **suivis par git** : il exclut donc `.git/`,
`node_modules/`, `dist/` et surtout **tout ce que `.gitignore` protège — dont `.env.local`**.

Un zip du dossier, lui, embarque `.env.local` et donc les vraies clés
(`SUPABASE_SERVICE_ROLE_KEY`, qui **contourne toute la RLS**, `STRIPE_SECRET_KEY`, qui
**débite la carte**, `STRIPE_WEBHOOK_SECRET`, `OPENAI_API_KEY`). Ces clés ne sont pas dans
git, mais une archive qui circule (cloud, clé USB, téléversement vers un service tiers) les exfiltre tout
aussi sûrement — et la fuite est silencieuse.

⚠️ Si un zip du dossier de travail a déjà été partagé : **considérer les 4 secrets comme
compromis et les faire tourner** (Supabase → API pour `service_role` ; Stripe → roll des
clés + nouveau webhook secret ; OpenAI → nouvelle clé), puis mettre à jour Vercel,
`.env.local` et les secrets Supabase Functions.

## 2. Modèle de branches & livraison

```
feat/<slug>  ──PR──▶  dev (staging)  ──PR──▶  main (production)
```

- **`dev`** = intégration. Chaque merge crée un déploiement **Preview** Vercel.
- **`main`** = production : Vercel sert `fridgeplus.app` depuis `main`.
  **Livrer = une PR `dev→main` délibérée** (jamais un push direct).
- `main` et `dev` sont **protégés** (rulesets) : pas de force-push, pas de suppression.
  `main` exige en plus une **PR + CI verte**.

### Créer une feature
1. `git fetch origin && git switch -c feat/mon-slug origin/dev`
2. Développer, commiter (cf. §3), pousser.
3. Ouvrir une PR **base `dev`**, remplir le template, CI verte.

### Livrer en production
1. Ouvrir une PR **base `main`, compare `dev`**.
2. CI verte requise : `ESLint`, `Production build`, `Vitest`, `Smoke tests`, `Release guard`, `Secret scan`.
3. Merger → Vercel déploie `fridgeplus.app`.
4. Vérifier la prod : version affichée dans le pied de page, Sentry sans erreur nouvelle.

## 3. Conventions de commit

Format : `type(vX.X): titre à l'impératif` — ex. `feat(v0.87): ajoute le filtre par saison`.
Types : `feat`, `fix`, `ui`, `perf`, `refactor`, `chore`, `docs`, `test`, `build`, `ci`.
`vX.X` = version courante (cf. §4).

## 4. Versioning & changelog

- Version affichée : `src/shared/lib/version.js` (`CURRENT_VERSION`) — **source unique**.
- Journal : `src/features/changelog/data/changelog.js` (tableau `CHANGELOG`).
- **Le bump de version + l'entrée changelog n'arrivent QU'au moment d'une release `dev→main`** (pas à chaque PR de feature sur `dev` — le badge du footer doit refléter ce qui est réellement en prod, pas la cadence interne de `dev`). Une release consolide potentiellement plusieurs PR `dev` en **une seule entrée** groupée par thème.
- À une release `dev→main` : si le lot ne contient **que des `fix`** (rien de nouveau visible), **ne pas bumper par défaut** → label `skip-release-guard`. Ne bumper (`fix`→patch, `feat`→minor) que si le lot contient au moins un `feat` réellement visible en prod (pas derrière un flag OFF), ou sur demande explicite.
- `fix` dans le changelog = uniquement si l'utilisateur pouvait constater le problème. Jamais de jargon technique (tables BDD, flags, codes d'erreur, noms de composants).

## 5. Pull requests

- Base `dev` pour les features, base `main` pour les releases.
- Le template (checklist) s'affiche automatiquement — le remplir.
- CI verte obligatoire avant merge sur `main`.
- Smoke : vérifier le rendu, **preview Vercel de préférence**.

## 6. Rollback (production cassée)

1. **Primaire (sans git)** : Vercel → Settings → Environments → Production → re-pointer la
   Production Branch sur `dev`, ou « Promote » un déploiement sain antérieur.
2. **Git** : revenir au dernier commit sain de `main` par une PR de `revert` (jamais de force-push).

## 7. Standards d'ingénierie (la barre de qualité)

SOLID · Clean Code · DDD · sécurité **OWASP** · **RGPD** · accessibilité **WCAG/EAA** · **SEO** ·
performance · scalabilité. Architecture & décisions : `docs/ARCHITECTURE.md` + `docs/adr/`.
Chaque feature a son `src/features/<x>/README.md`.

## 8. Carte du repo

- `src/features/<x>/` — features (chacune son README).
- `src/shared/` — transverse (`static/` données, `lib/`, `ui/`, `hooks/`, `contexts/`).
- `src/routes/` — routing + guards.
- `docs/` — `ARCHITECTURE.md`, `adr/` (décisions), `ui/` (règles d’interface).
- `supabase/` — migrations, edge functions.
- `.github/workflows/` — CI.

## 9. Onboarding équipe (futur — monter les curseurs sans refonte)

- Activer `require_pull_request_reviews` (≥ 1 approbation) sur le ruleset `main`.
- Activer la revue **code-owner seulement à ≥ 2 personnes** (sinon l'unique owner ne peut pas
  approuver ses propres PR → lock-out du merge).
- Retirer le `bypass_actors` admin du ruleset pour un enforcement total.
- Affiner `.github/CODEOWNERS` par domaine (ex. `/supabase/ @data-lead`).
