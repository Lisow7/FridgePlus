# Feature `admin`

> Back-office : tableau de bord (KPI), modération, gestion des recettes/ingrédients/prix, support,
> utilisateurs, qualité des données, feature flags. (Code relu sur `dev` le 2026-10-10, lot 14f de
> l'audit du 2026-10-04 ; le garde-fou `admin-nettoyage` vérifie que chaque fichier de la feature est
> cité ici — un fichier ajouté sans sa ligne fait échouer la suite.)

## Rôle
Panel d'administration unique (`AdminPanel`, lazy-loaded depuis `App.jsx`), réservé aux admins
(`isAdmin` via `useAuth`). Bloc cohérent qui **consomme beaucoup d'autres features** (recipes,
community, support, notifications, premium, reports).

## Architecture interne (2 spécificités à connaître)
- **Provider/context `useAdmin`** (`providers/admin-provider.jsx`) — **exception au props-drilling**
  du reste de l'app. Une seule instance par `AdminPanel` ; expose le **rôle** courant
  (`admin`/`moderator`/`support` — `support`/`moderator` prévus, `admin` seul actif), les **stats KPI**
  (les neuf compteurs du panneau en UNE lecture, la fonction `admin_compteurs` ; refresh à la demande)
  et la **section active**. Les sections lisent `useAdmin()` au lieu de refetch. La section active est **persistée** (`lib/admin-section-storage.js`) → l'admin retrouve son
  écran à la réouverture.
- **i18n en ligne par composant**, comme le reste de l'app ([ADR 0002](../../../docs/adr/0002-i18n-inline-par-composant.md)) :
  chaque section porte son propre dictionnaire `I18N` fr/en. `i18n/admin-i18n.js` (`ADMIN_I18N`) ne
  contient que les mots du tableau de bord et de l'en-tête du Journal, lus par `dashboard.jsx` et
  `journal-section.jsx` — et rien d'autre : chaque clé doit être lue (garde-fou `admin-nettoyage`).
  Ce fichier s'est longtemps présenté comme un dictionnaire en cinq langues partagé par tout l'admin ; c'était faux.

## Audit & RGPD (ne pas contourner)
- **`lib/audit.js`** — l'UNIQUE écrivain de la table append-only `activity_logs` dans la feature
  (`logAuditAction`). Garantit : (1) **vocabulaire fermé** (`AUDIT_ACTIONS` whitelist ; action inconnue →
  warning dev mais insert quand même pour ne pas bloquer la prod), (2) **metadata whitelistée par action**
  (`METADATA_KEYS` ; clés non listées filtrées). L'API admin trace ses modifications « au mieux », après
  l'écriture réussie : l'échec de la trace ne défait pas la modération. Les noms affichés dans le Journal
  viennent de `lib/libelles-du-journal.js` (une entrée par action, garde-fou `journal-tout-a-un-nom`).
- **Consultation d'une donnée sensible** (e-mail, dernière connexion, allergènes d'un compte) :
  `adminRevelerCompte(userId, motif)` dans `api/admin.js` appelle `admin_reveler_compte`, qui écrit
  la ligne `sensitive_data_accessed` (qui, quel compte, pourquoi, quand, quels champs) **dans la
  base, avant de rendre la donnée** — si l'écriture échoue, rien n'est rendu. L'écran passe par le
  rideau `components/shared/sensitive-data-toggle` (motif obligatoire) ; aucune de ces données
  n'est chargée avant (audit du 2026-10-04, ADM-05). Distinct de `logAuditAction` (qui trace les
  *modifications*). Jusqu'au 2026-10-08, la trace était écrite par le navigateur, séparément de la
  lecture, et les e-mails de tous les comptes étaient chargés à l'ouverture de l'onglet.
- **Les écritures disent vrai sur leur issue** (`lib/ecritures-admin.js`, `lib/appliquer-en-lot.js`) :
  0 ligne touchée = échec, un lot rend compte de ce qui a réellement réussi, « Accès refusé » seulement
  pour un vrai 42501 (ADM-02, ADM-08, ADM-26 ; garde-fous `admin-ecritures-cliquet`, `admin-ecritures-honnetes`).
- **Ce que la base écrit elle-même au journal** (lot 12l, migration `file_d_import_et_compteurs_en_base`) :
  la publication et le rejet d'une recette importée (`recipe_import_published`, `recipe_import_rejected`,
  acteur posé par la base), la suppression d'un ticket, d'un signalement ou d'un message par un admin
  (`ticket_deleted`, `report_deleted`, `support_message_deleted`), l'effacement définitif d'un compte
  (`account_deleted`, sans acteur). L'heure et l'auteur d'une bascule de fonctionnalité aussi.

## Structure
- **`api/`** — `admin.js` (stats, santé des données, recettes, ingrédients, utilisateurs, journal,
  accès spécial ; ré-exporte la file d'import), `import-queue.js` (file d'import de recettes :
  liste et métriques ; publier, rejeter et publier un lot par les fonctions de la base
  `admin_publier_import`, `admin_rejeter_import`, `admin_publier_lot_import`, chacune en une
  transaction — sortie d'`admin.js` au lot 14f, plus d'import du publisher Node depuis le lot 12l), `bannissement.js`
  (`admin_bannir` / `admin_debannir` par la base, puis l'e-mail `notifier-bannissement` qui donne
  le motif et la date), `community-admin.js`, `recipe-reviews-admin.js` (modération par RPC
  SECURITY DEFINER qui exigent `is_admin()`).
- **`components/`** — `admin-panel` (shell : navigation nommée, section courante), `admin-help-modal`
  (le guide, textes dans `data/`), `dashboard`, les éditeurs du formulaire de recette officielle
  (`ingredients-editor`, `ingredient-extra-fields`, `steps-editor`, `recipe-live-preview`) et
  `MissingImageControls` (compteur + filtre « sans image », partagé par Recettes base et Recettes +).
  `modals/` : `fenetre-de-bannissement` (motif et durée d'un bannissement), `special-access-modal`
  (accorder, modifier, retirer un accès spécial).
- **`components/sections/`** — **14 onglets** (le tableau de bord compris) : `base-recipes-section`
  (+ `base-recipe-form`), `community-section`, `custom-recipes-section` (+ `moderation-reason-modal`),
  `data-quality-section` (+ `import-queue-tab`, `import-metrics`, `motif-de-rejet-modal`),
  `features-section` (feature flags), `ingredients-section` (+ `ingredient-form`), `journal-section`,
  `notifications-section`, `pricing-section` (+ `pricing-row`, `pricing-edit-modal`),
  `recipe-reviews-section`, `reports-section` (+ `report-thread`), `support-section`
  (+ `support-ticket-detail`, `support-ticket-row`), `users-section`.
- **`components/shared/`** — primitives admin réutilisables : `analytics-chart`, `bulk-action-bar`,
  `case-de-selection` (la case d'une ligne, 24 px au doigt), `chargement-rate` (une liste qui n'a pas pu
  être lue, jamais confondue avec une liste vide), `feedback-banner`, `hover-icon-button`,
  `puce-a-cocher` (bouton à bascule au clavier), `reason-selector`, `search-input`,
  `sensitive-data-toggle` (le rideau du motif), `stat-card`. Les modales de confirmation viennent de
  `@shared/ui/confirm-dialog`.
- **`hooks/`** — `use-selection` (sélection multiple, actions en masse), `use-feedback` (le bandeau de
  retour d'une section : un message n'est pas effacé par le minuteur du précédent), `use-rafraichissement-sous-les-yeux`
  (un rafraîchissement périodique qui ne tourne que si l'onglet est visible et l'écran affiché).
- **`lib/`** — `audit`, `libelles-du-journal`, `admin-section-storage`, `ecritures-admin`,
  `appliquer-en-lot`, `csv` (export CSV sûr : guillemets doublés, formules neutralisées), `dates`
  (`fmtDate` / `fmtDateTime` des tableaux), `activite-par-periode` (le graphique du tableau de bord :
  les comptes par jour de `admin_activite_par_jour` rangés en jours, mois ou années, en UTC),
  `pastille` (le style d'une pastille de filtre), `id-libre`
  (un identifiant libre à partir d'une base), `slug`, `ingredient-taxonomy` (périmètre admin seul),
  `missing-image`, `dev-crash-trigger` (déclenche un crash pour tester Sentry, mode dev seulement).
- **`data/`** — `admin-help-content` (textes du guide, un par onglet — garde-fou `guide-admin-dit-vrai`),
  `base-recipe-options` (domaines de valeurs du formulaire des recettes officielles),
  `support-quick-replies`. **`providers/`** — `admin-provider`. **`i18n/`** — `admin-i18n`.

## Dépendances
- `@shared/contexts/auth-provider` (`isAdmin`), `@features/support/api/support` (compteurs tickets),
  `@shared/api/reports` (compteurs signalements), `@shared/lib/moderation`, Supabase (`activity_logs`).
- Vue d'ensemble : `docs/ARCHITECTURE.md`.
