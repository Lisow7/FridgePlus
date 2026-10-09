# Templates email Supabase Auth — Fridge+

Templates HTML email-safe pour les 6 emails transactionnels de Supabase Auth, brandés Fridge+ (palette warm, logo F+, Georgia serif).

## Fichiers

| Fichier | Type Supabase | Variable principale | Sujet recommandé |
|---|---|---|---|
| `confirm-signup.html` | Confirm signup | `{{ .ConfirmationURL }}` | Bienvenue chez Fridge+ — confirme ton inscription |
| `magic-link.html` | Magic Link | `{{ .ConfirmationURL }}` | Ton lien de connexion Fridge+ |
| `change-email.html` | Change Email Address | `{{ .ConfirmationURL }}`, `{{ .NewEmail }}` | Confirme ton nouvel email Fridge+ |
| `reset-password.html` | Reset Password | `{{ .ConfirmationURL }}` | Réinitialise ton mot de passe Fridge+ |
| `reauthentication.html` | Reauthentication | `{{ .Token }}` | Code de vérification Fridge+ |
| `invite-user.html` | Invite User | `{{ .ConfirmationURL }}` | Tu es invité(e) sur Fridge+ |

## Comment installer dans Supabase

1. Dashboard Supabase → **Authentication → Notifications → Email**
2. Cliquer sur la ligne du template à modifier (ex: "Confirm sign up")
3. Onglet **Source** (HTML) — pas WYSIWYG
4. Copier-coller le contenu du fichier `.html` correspondant
5. **Subject heading** — coller le sujet recommandé du tableau ci-dessus
6. **Save**
7. Tester en déclenchant l'action correspondante (signup, reset password, etc.)

## Variables Supabase disponibles

- `{{ .ConfirmationURL }}` — URL complète de confirmation avec token
- `{{ .Token }}` — token brut (utilisé pour reauthentication, code à 6 chiffres)
- `{{ .TokenHash }}` — hash du token
- `{{ .SiteURL }}` — URL du site (configurée dans URL Configuration)
- `{{ .Email }}` — email de l'utilisateur destinataire
- `{{ .NewEmail }}` — nouveau email (uniquement dans change-email)
- `{{ .Data }}` — metadata utilisateur custom (`{{ .Data.full_name }}` etc.)

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
