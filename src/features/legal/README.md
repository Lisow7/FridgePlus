# Feature `legal`

> Conformité & transparence : page `/legal` (mentions légales, CGU, CGV, confidentialité, FAQ),
> bandeau + modale de consentement cookies (CNIL), et panneau « Confidentialité » du Profil.
> (Code lu sur `dev` le 2026-06-23.)

## Particularité : le hook de consentement vit dans `shared/`
`useConsent` (+ `CONSENT_VERSION`, `hasConsentedSync`, `getConsentSync`) a été **déplacé dans
`@shared/hooks/use-consent`** (Sprint 9 S9.a.5) car il est consommé **hors** de la feature : le
gate Sentry (`@shared/lib/observability/sentry.js`) et le flux vocal (`src/app/hooks/use-voice-flow.js`,
cooking-mode) en dépendent. `index.js` le **re-exporte** pour compat. La feature `legal` ne garde que
l'UI (page, bandeau, modale, panneau) + le contenu juridique + l'i18n consentement.

## Page `/legal` (routée, lazy)
- **`pages/legal-page.jsx`** — montée sur `/legal` (`routes-config.js`, `lazy`). Affiche en-tête +
  sommaire ancré + **4-5 sections** rendues à partir de blocs **typés** (`p` / `list` / `h3` /
  `citation` / `note`) via le sous-composant `Block`. i18n **inline** (`I18N` fr/en).
- **Sections conditionnées par `PREMIUM_ENABLED`** : `['legal', 'terms', 'privacy', 'faq']` en mode
  Launch Free ; la **CGV** (`cgv`) ne réapparaît **qu'à l'activation du premium** (ses placeholders
  `[À COMPLÉTER]` ne doivent pas être publics tant que Stripe est bloqué).
- **2 bandeaux contextuels** : *disclaimer pré-launch* (contenu = rédaction de référence à relire par
  un juriste) + *bandeau « Lancement gratuit »* (affiché si `!PREMIUM_ENABLED`, pour que CGU/privacy
  restent exactes). Plus une *note de fallback de traduction* pour `es/de/ja`.

## Contenu juridique (`data/legal-content.js`)
- Source de vérité du texte légal, **séparée du rendu**. Exporte `getLegalSection(lang, key)` et
  `getTranslationFallbackNote(lang)`. Contact unique : `support@fridgeplus.app`.
- **Stratégie i18n : FR + EN complets ; `es/de/ja` retombent sur EN** + note « traduction localisée à
  venir » (on évite les frais de traduction juridique tant que le contenu n'est pas figé). Idem côté
  UI consentement : `consent-i18n.js` ne définit que `fr`/`en`, les autres langues tombent sur `fr`
  via `I18N[lang] ?? I18N.fr`.

## Consentement cookies (CNIL)
- **`components/cookie-banner.jsx`** — bandeau **non bloquant** au premier accès (n'a pas décidé).
  ⚠️ **Anti dark-pattern CNIL** : « Tout refuser » a le **même poids visuel** que « Tout accepter »
  (rempli, même couleur) ; « Personnaliser » est la seule option visuellement moindre.
- **`components/cookie-modal.jsx`** — consentement **granulaire** : `Essentiels` (toujours ON, toggle
  désactivé — RGPD art. 5), `Fonctionnels` (cache/offline), `Mesure d'audience` (**Sentry uniquement**,
  off par défaut), `Reconnaissance vocale`. Focus-trap a11y (`useFocusTrap`, Escape pour fermer).
- **`components/confidentiality-panel.jsx`** — intégré au **Profil → onglet Confidentialité**
  (`profile-account-page.jsx`). Récap des choix + ré-édition (réutilise `CookieModal`). Le **reset
  complet** efface aussi le drapeau charte communauté et **révoque** l'acceptation côté BDD
  (`revokeCommunityTerms`) — les données de compte (frigo, recettes, posts) ne sont pas touchées.

## Modèle de consentement (rappel, défini dans `@shared/hooks/use-consent`)
- Stockage `localStorage['fridge-consent-v1']` ; **bumper `CONSENT_VERSION`** invalide l'existant et
  ré-affiche le bandeau. Pattern **store + subscribe** (toutes les instances `useConsent` partagent
  l'état → la modale qui sauvegarde fait disparaître le bandeau frère) + **sync inter-onglets**.
- 4 catégories : `essential` (forcé true), `functional`, `audience` (gate Sentry), `voice`. Le
  consentement **vocal est indépendant** : l'accepter au 1ᵉʳ usage du micro **ne masque pas** le
  bandeau global (`bannerDismissed`).

## Dépendances & consommateurs
- `@shared/hooks/use-consent` (cœur), `@shared/hooks/use-focus-trap`, `@shared/ui/button`,
  `@shared/api/community` (`revokeCommunityTerms`), `@shared/lib/premium-config` (`PREMIUM_ENABLED`).
- Consommé par : `routes-config.js` (`/legal`), `app/components/*-overlays.jsx` (bandeau global),
  `profile/.../profile-account-page.jsx` (panneau), `sentry.js` (gate audience), flux vocal
  (cooking-mode / `use-voice-flow`).
- i18n consentement **centralisé** (`i18n/consent-i18n.js`) pour rester cohérent entre bandeau, modale
  et panneau — exception assumée au pattern inline, cf. [ADR 0002](../../../docs/adr/0002-i18n-inline-par-composant.md).
  Vue d'ensemble : `docs/ARCHITECTURE.md`.
