import { Component } from 'react'
// passé par le helper logError qui fait `console.error` +
// Sentry.captureException SI Sentry chargé. Évite l'import statique de
// `@sentry/react` (27 KiB) dans le bundle init.
import { logError } from '@shared/lib/observability/sentry'

// ErrorBoundary global + ciblé.
//
// Pattern React classique (les hooks ne peuvent pas attraper d'erreurs de
// rendu pour le moment). Capture toute exception jetée par les enfants au
// rendu / lifecycle / event handler async non géré, affiche un fallback UI
// propre, et envoie l'erreur à Sentry (si consenti — cf. lib/sentry.js).
//
// Deux niveaux d'usage :
// - `<ErrorBoundary level="app" />` : englobe toute l'app dans main.jsx
// (fallback plein écran avec bouton recharger).
// - `<ErrorBoundary level="section" sectionLabel="Panel admin" />` :
// englobe une section critique (cas AdminPanel) — fallback inline qui
// ne casse pas le shell.

const I18N = {
 app: {
 fr: {
 title: 'Une erreur est survenue',
 body: "L'application a rencontré un problème inattendu. Tu peux essayer de recharger la page. Si le problème persiste, n'hésite pas à nous contacter.",
 reload: 'Recharger la page',
 contact: 'Contacter le support',
 details: 'Détails techniques',
 },
 en: {
 title: 'Something went wrong',
 body: 'The app encountered an unexpected error. You can try reloading the page. If the problem persists, please contact us.',
 reload: 'Reload page',
 contact: 'Contact support',
 details: 'Technical details',
 },
 },
 section: {
 fr: {
 title: 'Cette section a rencontré un problème',
 body: 'Tu peux fermer puis rouvrir cette section. Le reste de l\'application reste utilisable.',
 reload: 'Réessayer',
 details: 'Détails techniques',
 },
 en: {
 title: 'This section encountered a problem',
 body: 'You can close and reopen this section. The rest of the app remains usable.',
 reload: 'Try again',
 details: 'Technical details',
 },
 },
}

const SUPPORT_EMAIL = 'support@fridgeplus.app'

export default class ErrorBoundary extends Component {
 constructor(props) {
 super(props)
 this.state = { error: null, errorInfo: null }
 }

 static getDerivedStateFromError(error) {
 return { error }
 }

 componentDidCatch(error, errorInfo) {
 this.setState({ errorInfo })
 // logError → console.error + Sentry.captureException (si chargé,
 // no-op silencieusement sinon).
 logError(error, {
 tag: `error-boundary.${this.props.level ?? 'app'}`,
 sectionLabel: this.props.sectionLabel,
 componentStack: errorInfo?.componentStack,
 })
 }

 handleReload = () => {
 if (this.props.level === 'section') {
 // Reset de l'état local — le parent re-render le children.
 this.setState({ error: null, errorInfo: null })
 } else {
 window.location.reload()
 }
 }

 render() {
 if (!this.state.error) return this.props.children

 const lang = this.props.lang ?? 'fr'
 const level = this.props.level ?? 'app'
 const t = (I18N[level] ?? I18N.app)[lang] ?? (I18N[level] ?? I18N.app).fr
 const isApp = level === 'app'

 const containerStyle = isApp
 ? {
 minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
 padding: '24px', background: '#FDF6EE', color: '#2A2218',
 fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
 }
 : {
 padding: '32px 24px', borderRadius: '12px', background: '#FDF6EE',
 border: '1px solid rgba(212,106,16,0.30)', color: '#2A2218',
 margin: '12px',
 }

 return (
 <div role="alert" style={containerStyle}>
 <div style={{ maxWidth: '480px', width: '100%' }}>
 <h1 style={{ fontSize: isApp ? '22px' : '18px', fontWeight: 700, marginBottom: '12px' }}>
 {t.title}
 </h1>
 <p style={{ fontSize: '15px', lineHeight: 1.55, marginBottom: '20px', color: '#5A4A38' }}>
 {t.body}
 </p>
 <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
 <button
 onClick={this.handleReload}
 style={{
 padding: '10px 18px', borderRadius: '8px', border: 'none',
 background: 'var(--color-brand-600)', color: 'white', fontWeight: 600,
 fontSize: '14px', cursor: 'pointer',
 }}
 >
 {t.reload}
 </button>
 {isApp && (
 <a
 href={`mailto:${SUPPORT_EMAIL}?subject=Erreur Fridge%2B&body=${encodeURIComponent(`Erreur : ${this.state.error?.message ?? 'inconnue'}`)}`}
 style={{
 padding: '10px 18px', borderRadius: '8px',
 border: '1px solid rgba(212,106,16,0.45)', background: 'transparent',
 color: 'var(--color-brand-600)', fontWeight: 600, fontSize: '14px',
 textDecoration: 'none', display: 'inline-block',
 }}
 >
 {t.contact}
 </a>
 )}
 </div>
 {this.state.error && (
 <details style={{ fontSize: '12px', color: '#5A4A38' }}>
 <summary style={{
 cursor: 'pointer', userSelect: 'none',
 fontWeight: 600, padding: '6px 0',
 }}>
 {t.details}
 </summary>
 <pre style={{
 marginTop: '8px', padding: '12px',
 background: '#F4ECDF', color: '#2A2218',
 border: '1px solid rgba(212,106,16,0.30)', borderRadius: '6px',
 fontSize: '11px', lineHeight: 1.5,
 overflow: 'auto', maxHeight: '240px',
 whiteSpace: 'pre-wrap', wordBreak: 'break-word',
 fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
 }}>
 {this.state.error?.message ?? '(no message)'}
 {this.state.errorInfo?.componentStack ?? ''}
 </pre>
 </details>
 )}
 </div>
 </div>
 )
 }
}
