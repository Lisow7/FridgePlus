# Templates email Supabase Auth — Fridge+

Templates HTML email-safe pour les 6 emails transactionnels de Supabase Auth, brandés Fridge+ (palette warm, logo F+, Georgia serif), **en français et en anglais** : chaque email s'écrit dans la langue du compte (audit du 2026-10-04, CPT-18 — jusque-là, tout partait en français).

## Fichiers et sujets

Le sujet se colle **tel quel** dans le champ « Subject heading » : il choisit sa langue comme le corps.

| Fichier | Type Supabase | Sujet à coller |
|---|---|---|
| `confirm-signup.html` | Confirm signup | `{{ if eq (print .Data.lang) "en" }}Welcome to Fridge+ — confirm your sign-up{{ else }}Bienvenue chez Fridge+ — confirme ton inscription{{ end }}` |
| `magic-link.html` | Magic Link | `{{ if eq (print .Data.lang) "en" }}Your Fridge+ sign-in link{{ else }}Ton lien de connexion Fridge+{{ end }}` |
| `change-email.html` | Change Email Address | `{{ if eq (print .Data.lang) "en" }}Confirm your new Fridge+ email{{ else }}Confirme ton nouvel email Fridge+{{ end }}` |
| `reset-password.html` | Reset Password | `{{ if eq (print .Data.lang) "en" }}Reset your Fridge+ password{{ else }}Réinitialise ton mot de passe Fridge+{{ end }}` |
| `reauthentication.html` | Reauthentication | `{{ if eq (print .Data.lang) "en" }}Fridge+ verification code{{ else }}Code de vérification Fridge+{{ end }}` |
| `invite-user.html` | Invite User | `{{ if eq (print .Data.lang) "en" }}You're invited to Fridge+{{ else }}Tu es invité(e) sur Fridge+{{ end }}` |

Le code de l'app déclenche trois de ces emails : **Confirm signup**, **Reset Password** et **Change Email Address**. Les trois autres (lien magique, réauthentification, invitation) ne partent que si le projet les active ; leurs modèles restent prêts.

**Repli** — si un email reçu affiche les accolades dans son sujet, le champ « Subject heading » de ce projet ne lit pas les conditions : coller alors un sujet dans les deux langues, par exemple `Fridge+ — confirme ton inscription · Confirm your sign-up`.

## La langue

- Chaque modèle la lit **une fois**, en tête : `{{ $en := eq (print .Data.lang) "en" }}`, puis chaque texte visible est un bloc `{{ if $en }}…{{ else }}…{{ end }}`.
- `.Data` = `auth.users.user_metadata`. `lang` y est écrite :
  - à l'**inscription par email** (`signUpWithEmail`, `options.data.lang`) ;
  - par l'**application ensuite** : `useAccountLanguageSync` recopie la langue du compte (`profiles.language`) dans `user_metadata.lang` quand elles diffèrent — un compte Google n'en avait aucune, et un changement de langue n'y arrivait jamais.
- Sans langue connue, ou une langue que l'app ne propose pas : **français**.
- Pourquoi `print` : un compte sans `lang` ne doit **jamais** faire échouer le gabarit — donc l'envoi de l'email. `print` d'une clé absente rend `<nil>` (jamais une erreur), et `eq` compare deux chaînes.
- Le test `src/test/unit/courriels-bilingues.test.js` refuse un modèle dont un texte visible n'existerait qu'en une langue.

## Comment installer dans Supabase

À faire par Antoine (le dépôt ne déploie pas ces modèles : aucune entrée dans `supabase/config.toml`).

1. Dashboard Supabase → **Authentication → Notifications → Email**
2. Cliquer sur la ligne du template à modifier (ex: "Confirm sign up")
3. Onglet **Source** (HTML) — pas WYSIWYG
4. Copier-coller le contenu du fichier `.html` correspondant — **la première ligne comprise** (`{{ $en := … }}`)
5. **Subject heading** — coller le sujet du tableau ci-dessus
6. **Save**
7. Vérifier (ci-dessous)

Autre voie : l'API de gestion (`PATCH /v1/projects/{ref}/config/auth`, champs `mailer_subjects_*` et `mailer_templates_*_content`), avec un jeton d'accès personnel.

### Vérifier après l'installation

- Compte créé avec l'app **en anglais** → email de confirmation en anglais, sujet compris.
- « Mot de passe oublié » d'un compte anglophone → email en anglais ; d'un compte francophone → en français.
- Compte sans langue (ancien compte jamais reconnecté) → en français, **et l'email part** (pas d'erreur 500 à l'envoi).

## Variables Supabase disponibles

- `{{ .ConfirmationURL }}` — URL complète de confirmation avec token
- `{{ .Token }}` — token brut (utilisé pour reauthentication, code à 6 chiffres)
- `{{ .TokenHash }}` — hash du token
- `{{ .SiteURL }}` — URL du site (configurée dans URL Configuration)
- `{{ .Email }}` — email de l'utilisateur destinataire
- `{{ .NewEmail }}` — nouveau email (uniquement dans change-email)
- `{{ .Data }}` — metadata utilisateur custom (`{{ .Data.lang }}`, `{{ .Data.username }}` etc.)

## Palette utilisée

- Background page : `#fffbf5` (warm-50)
- Card : `#ffffff`
- Header band : `#fff3e0` (warm-100)
- CTA button : `#ff8f00` (warm-500)
- Texte principal : `#2d1b00` (charcoal)
- Texte muted : `#7A5F56`
- Accent logo + liens : `#D46A10`
- Border footer : `#e3d9cf` (cream)

## Compatibilité testée

- Outlook (web, desktop)
- Gmail
- Apple Mail
- Mobile (max-width 560px, viewport meta)

## Limitations connues

- Pas de gradients (certains clients n'en supportent pas)
- Pas de Flexbox/Grid (table-based layout)
- Pas de webfonts (system fonts uniquement : Georgia + sans-serif fallback)
- Tons clairs uniquement (pas de variant dark mode email — la majorité des clients adapte automatiquement le contraste)
