// AuthLayout — wrapper visuel pour les pages d'authentification
// (/login, /signup, /auth/recovery).
//
// Sprint 11 S11.b.1.
//
// Minimal : logo Fridge+ en haut + card centrée + lien switch
// login↔signup en bas. Pas de Header complet de l'app (l'user est en
// flow d'auth, on retire les distractions).
//
// 2026-10-04 : une ligne d'aide sous la carte. Le support intégré à l'app
// demande d'être connecté — c'est justement ici qu'on ne l'est pas.
import { SUPPORT_EMAIL } from '@shared/lib/contact'

const I18N = {
  // brand = 'Fridge' seul : le « + » coloré est rendu séparément dans le <h1>
  // (sinon on obtient « Fridge++ »).
  fr: { brand: 'Fridge', tagline: 'Cuisine mieux, sans limites.', help: 'Un souci pour te connecter ? Écris-nous :' },
  en: { brand: 'Fridge', tagline: 'Cook better, no limits.', help: 'Trouble signing in? Write to us:' },
}

// `standalone` : l'écran est affiché SEUL, sans l'en-tête de l'app (c'est le
// cas de « Choisis ton pseudo », rendu avant tout le reste). Il occupe alors
// toute la fenêtre ; sinon il laisse à l'en-tête ses 96 px.
export default function AuthLayout({ lang = 'fr', darkMode = false, title, children, footer, standalone = false }) {
  const t = I18N[lang] ?? I18N.fr
  const bgColor   = darkMode ? '#0F1923' : '#FDFAF6'
  const textColor = darkMode ? '#EBE4D8' : '#2d1b00'
  const mutedColor = darkMode ? '#7A90A8' : '#6A4F45'
  const cardBg    = darkMode ? '#1C2535' : '#FFFFFF'
  const cardBorder = darkMode ? '#2A3A50' : 'var(--color-border-warm)'

  return (
    <div style={{
      minHeight: standalone ? '100dvh' : 'calc(100dvh - 96px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
      background: bgColor,
    }}>
      {/* ─── Header brand minimal ─────────────────────────────────── */}
      <header style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{
          margin: 0, fontSize: '28px', fontWeight: 800,
          color: textColor, letterSpacing: '-0.01em',
        }}>
          {t.brand}<span style={{ color: 'var(--color-warm-600)' }}>+</span>
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: mutedColor }}>
          {t.tagline}
        </p>
      </header>

      {/* ─── Card centrée ─────────────────────────────────────────── */}
      {/* 🔴 `<div>` et NON `<main>` : `app-shell.jsx` fournit déjà le `<main>`
          de la page (`id="contenu-principal"`, cible du lien d'évitement). Un
          second `<main>` imbriqué dedans violait trois règles d'un coup sur
          /login et /signup — `landmark-no-duplicate-main`,
          `landmark-main-is-top-level`, `landmark-unique` — et brouillait la
          navigation par landmarks des lecteurs d'écran. */}
      <div style={{
        width: '100%', maxWidth: '420px',
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        borderRadius: '14px',
        padding: '24px',
        boxShadow: darkMode
          ? '0 12px 32px rgba(0,0,0,0.4)'
          : '0 8px 24px rgba(212,106,16,0.10)',
      }}>
        {title && (
          <h2 style={{
            margin: '0 0 16px',
            fontSize: '18px', fontWeight: 800,
            color: textColor,
          }}>
            {title}
          </h2>
        )}
        {children}
      </div>

      {/* ─── Footer (switch login/signup, lien retour, etc.) ───────── */}
      {footer && (
        <footer style={{ marginTop: '20px', fontSize: '13px', color: mutedColor, textAlign: 'center' }}>
          {footer}
        </footer>
      )}

      {/* ─── Aide : toujours là, quelle que soit la page ───────────── */}
      <p style={{ margin: '14px 0 0', fontSize: '12px', color: mutedColor, textAlign: 'center' }}>
        {t.help}{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--color-warm-600)', fontWeight: 700 }}>{SUPPORT_EMAIL}</a>
      </p>
    </div>
  )
}
