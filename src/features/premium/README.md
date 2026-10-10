# Feature `premium`

> Abonnement Premium : la **modale d'upgrade** (argumentaire + tarifs + checkout Stripe). Le reste de
> la mécanique premium (hook, gate, provider, helpers Stripe) vit dans `shared/`. (Code lu sur `dev`
> le 2026-06-23.)

## ⚠️ Particularité : feature « UI-only », le cœur premium est dans `shared/`
Tout ce qui sert d'abonnement a été **déplacé dans `shared/`** (Sprint 9 S9.a.3, flux unidirectionnel)
car consommé par fridge/cart/profile/recipes/routes… :
- **`@shared/hooks/use-subscription`** — état d'abonnement de l'utilisateur (`isPremium`, etc.).
- **`@shared/ui/upgrade-gate`** (`UpgradeGate`) — wrapper qui bloque/teasing une zone premium.
- **`@shared/contexts/subscription-modal-provider`** (`SubscriptionModalProvider`, `useUpgradeModal`)
  — ouvre la modale d'upgrade depuis n'importe où.
- **`@shared/lib/payments/stripe`** (`redirectToCheckout`, `redirectToPortal`) + `@shared/lib/i18n/subscription-i18n` (`SUB_I18N`).

Ces éléments sont importés **directement depuis `@shared/...`** par leurs consommateurs (App.jsx,
HeaderActions, cart, profile, recipes, `routes-config.js`…).

> 🧱 **Façade (`index.js`)** : expose le composant `UpgradeModal` + re-exporte par commodité le cœur
> premium qui vit dans `@shared/...` (`UpgradeGate`, `useSubscription`, `SubscriptionModalProvider`,
> `SUB_I18N`, helpers Stripe). En pratique cette façade **n'est importée nulle part** : tous les
> consommateurs prennent ces symboles **directement depuis `@shared/...`** (et `UpgradeModal` via
> `@features/premium/components/upgrade-modal`). L'ancien re-export mort `export * from './api/subscriptions'`
> (module supprimé lors d'un audit de code mort) a été retiré.

## Le seul fichier de la feature : `components/upgrade-modal.jsx`
- Modale d'argumentaire premium (portal, focus-trap). Liste de `FEATURES` (panier, voix, anti-gaspi,
  analyse dépenses, listes, partage, budget), **taglines rotatives**, et tarifs **mensuel 4,99 € /
  annuel 34,99 €** (≈ **-42 %**, calcul en commentaire). CTA → `redirectToCheckout`
  (`@shared/lib/payments/stripe`).
- **Garde Launch Free** : `PREMIUM_ENABLED` (`@shared/lib/premium-config`) — en lancement gratuit, le
  paiement/checkout est verrouillé. Chargée en **lazy** par `app/components/global-overlays.jsx`.

## Dépendances & consommateurs
- `@shared/contexts/auth-provider`, `@shared/lib/payments/stripe`, `@shared/lib/premium-config`
  (`PREMIUM_ENABLED`), `@shared/hooks/use-focus-trap`, `@shared/ui/button`.
- `UpgradeModal` consommé par `app/components/global-overlays.jsx` (lazy). Le reste (cœur premium) =
  voir les modules `shared/` listés ci-dessus et leurs nombreux consommateurs.
- i18n **inline** dans la modale (fr/en) ; `SUB_I18N` centralisé côté shared, cf.
  [ADR 0002](../../../docs/adr/0002-i18n-inline-par-composant.md). Vue d'ensemble : `docs/ARCHITECTURE.md`.
