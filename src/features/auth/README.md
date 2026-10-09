# Feature `auth`

> Authentification : pages login / signup / récupération de mot de passe / choix de pseudo, écran
> « banni », et 2FA (MFA). (Code lu sur `dev` le 2026-06-22.)

## Particularité : feature « mince », le cœur auth est dans `shared/`
`AuthProvider` + `useAuth` (utilisés dans **31+ fichiers**) et **tout le MFA** (hook `useMFA`, API
`@shared/api/mfa`, modales enroll/challenge, `MFA_I18N`) ont été **déplacés dans `shared/`** (Sprint 9,
flux unidirectionnel « Bulletproof React »). La feature `auth` ne garde que les **pages routées** et
re-exporte le reste pour compat. → state d'auth global : `@shared/contexts/auth-provider`.

## Pages (routées — l'`AuthModal` a été supprimée Sprint 11)
- **`login-page.jsx`** — 2 vues : **Login** (email+password, show/hide, remember me) + **Forgot**
  (envoi du lien de reset). Bouton **Google OAuth** (`GoogleButton`). Gated par `RedirectIfAuthGuard`
  (si déjà connecté → redirige).
- **`signup-page.jsx`** — inscription. **`recovery-page.jsx`** — reset mot de passe (gated par
  `recovery-guard`). **`choose-username-page.jsx`** — choix du pseudo.

## Invariant : OAuth → choix de pseudo
- **`lib/needs-username.js`** : `needsUsername(user, profile)` = vrai **uniquement** si un user
  connecté a un profil **chargé** avec `username_confirmed === false` (compte OAuth fraîchement créé).
  Le `!!profile` évite le flash pendant le chargement différé du profil. → redirige vers
  `choose-username`. **`lib/username-suggestion.js`** propose un pseudo.

## Composants
- **`auth-layout.jsx`** — layout commun aux pages d'auth. **`banned-screen.jsx`** — écran affiché aux
  utilisateurs bannis.

## Dépendances & sécurité
- `@shared/contexts/auth-provider` (`useAuth`), `@shared/hooks/use-mfa` + `@shared/api/mfa` (TOTP),
  `@shared/ui/google-button` (OAuth), guards `src/routes/guards/` (auth/redirect/recovery/role).
- i18n MFA centralisé : `@shared/lib/i18n/mfa-i18n` (exception au pattern inline,
  [ADR 0002](../../../docs/adr/0002-i18n-inline-par-composant.md)). Vue d'ensemble : `docs/ARCHITECTURE.md`.
