import { Link } from 'react-router-dom'
import { LuArrowLeft, LuSearchX } from 'react-icons/lu'
import { useDocumentTitle } from '@shared/hooks/use-document-title'
import { useNoIndex } from '@shared/hooks/use-no-index'

// Page 404 fallback. S'affiche pour toute route non listée
// dans le router (typo, lien expiré, partage avec ancienne URL).
//
// Le serveur répond 200 à toute adresse (application à page unique) : sans
// `noindex` ni titre propre, un robot prenait cette page pour l'accueil
// (« soft 404 », audit du 2026-10-04, SEO-03).

const I18N = {
 fr: { title: 'Page introuvable', subtitle: "La page que tu cherches n'existe pas ou a été déplacée.", backHome: 'Retour à l\'accueil' },
 en: { title: 'Page not found', subtitle: "The page you're looking for doesn't exist or has been moved.", backHome: 'Back to home' },
}

export default function NotFoundPage({ lang = 'fr', darkMode = false }) {
 const t = I18N[lang] ?? I18N.fr
 useNoIndex()
 useDocumentTitle(`${t.title} — Fridge+`)
 const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
 const muted = darkMode ? 'rgba(240,232,220,0.7)' : 'rgba(44,26,14,0.65)'

 return (
 <div style={{
 maxWidth: '520px', margin: '0 auto',
 padding: '64px 24px',
 color: fg,
 textAlign: 'center',
 }}>
 <div style={{
 display: 'inline-flex',
 padding: '24px',
 borderRadius: '50%',
 background: 'linear-gradient(135deg, rgba(247,168,94,0.18) 0%, rgba(212,106,16,0.10) 100%)',
 marginBottom: '24px',
 }}>
 <LuSearchX size={42} aria-hidden="true" style={{ color: 'var(--color-warm-600)' }} />
 </div>
 <h1 style={{
 fontSize: '32px', fontWeight: 800,
 margin: '0 0 12px',
 background: 'var(--gradient-warm)',
 WebkitBackgroundClip: 'text',
 backgroundClip: 'text',
 color: 'transparent',
 }}>
 404 — {t.title}
 </h1>
 <p style={{
 fontSize: '15px', fontWeight: 400,
 color: muted, margin: '0 0 32px',
 lineHeight: 1.55,
 }}>
 {t.subtitle}
 </p>
 <Link
 to="/"
 style={{
 display: 'inline-flex', alignItems: 'center', gap: '8px',
 padding: '11px 22px', borderRadius: '8px',
 background: 'var(--gradient-deep)',
 color: 'white',
 fontSize: '14px', fontWeight: 700,
 textDecoration: 'none',
 boxShadow: '0 4px 16px rgba(212,106,16,0.32)',
 }}
 >
 <LuArrowLeft size={15} aria-hidden="true" />
 <span>{t.backHome}</span>
 </Link>
 </div>
 )
}
