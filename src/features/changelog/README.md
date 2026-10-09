# Feature `changelog`

> Journal des nouveautés : page `/changelog` (« Nouveautés »), pastille « nouvelle version »
> et la **donnée `CHANGELOG`** (source de vérité du contenu public des releases).
> (Code lu sur `dev` le 2026-06-23.)

## Donnée centrale : `data/changelog.js` (avec politique éditoriale stricte)
`CHANGELOG` est un tableau d'entrées `{ version, name, date, changes[] }`, **du plus récent au plus
ancien**. Chaque `change` = `{ type, label }` où `type` ∈ **`feat`** | **`fix`** uniquement et `label`
est soit une string, soit un objet i18n `{ fr, en }`.

⚠️ **Politique éditoriale en tête du fichier — à lire avant toute modif** : labels = bénéfice
utilisateur en langage courant ; `fix` seulement si l'utilisateur pouvait constater le problème ;
**jamais** de jargon technique (tables BDD, triggers, flags, composants, sécurité). Chaque change
livré ⇒ une nouvelle entrée CHANGELOG **+** bump de `CURRENT_VERSION`.

## ⚠️ `CURRENT_VERSION` ne vit PAS ici — il est dans `@shared/lib/version.js`
Découplage **perf** (Sprint 3) : `changelog.js` fait ~671 KB. `sentry.js` n'avait besoin que de la
version → l'importer depuis `changelog.js` faisait rater le tree-shaking et embarquait tout le tableau
dans le chunk init (-200 KiB gzip après extraction). Donc : `CURRENT_VERSION` = `@shared/lib/version.js`
(à bumper **en même temps** que l'ajout d'entrée dans `changelog.js`). `index.js` le re-exporte pour compat.

## Page `/changelog` (routée, lazy)
- **`pages/changelog-page.jsx`** — montée sur `/changelog` (`routes-config.js`, `lazy`). Mappe
  `CHANGELOG` en cartes ; l'entrée dont `version === CURRENT_VERSION` reçoit un cadre + badge
  « Version actuelle ». Couleurs par type (`feat` vert, `fix` bleu). i18n **inline** (fr/en) ; les
  `label` objets sont résolus par langue (`label[lang] ?? label.fr`).
- **Effets** : `markSeen()` au montage (éteint la pastille) + override du `document.title` pendant la
  visite. **`components/changelog-tagline.jsx`** — accroche animée (effet machine à écrire, rotation).

## Pastille « nouvelle version » : `hooks/use-new-release.js`
- Compare `localStorage['fridge-last-seen-version']` à `CURRENT_VERSION` → expose `hasNew` (badge dans
  le **footer** / **help-guide** onboarding), `markSeen()` (appelé par la page) et `latestRelease`
  (`CHANGELOG[0]`). Tolérant au localStorage indisponible (mode privé/quota → silencieux).

## i18n des titres de version : `data/changelog-i18n.js`
- Les `name`/`date` des entrées sont stockés **en FR** (source). Ce fichier porte la table de
  traduction **EN** des titres (`RELEASE_NAMES_EN`, clé = nom FR) + les helpers `pickReleaseName(entry,
  lang)` et `localizeReleaseDate(date, lang)`. But : traduire l'affichage sans alourdir le gros
  `changelog.js`. Fallback = titre/date FR.

## Dépendances & consommateurs
- `@shared/lib/version` (`CURRENT_VERSION`), `@shared/ui/scroll-to-top-button`, `react-router-dom`.
- Consommé par : `routes-config.js` (`/changelog`), `app/layout/footer.jsx` (pastille + lien),
  `onboarding/.../help-guide.jsx` (pastille), `shared/lib/version.js` (source version),
  `shared/lib/observability/sentry.js` (release tag).
- i18n **inline par composant** (page + tagline), cf. [ADR 0002](../../../docs/adr/0002-i18n-inline-par-composant.md).
  Vue d'ensemble : `docs/ARCHITECTURE.md`.
