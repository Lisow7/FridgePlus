import { getC } from './community-theme'

// États du feed communauté (chargement / vide) — extraits de community-page.jsx
// (2026-07-25, audit front §2). Feuilles présentationnelles.

export function LoadingState({ darkMode }) {
  const C = getC(darkMode)
  return (
    <>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          borderRadius: '12px', height: '120px', flexShrink: 0,
          backgroundImage: `linear-gradient(90deg,${C.surface} 25%,${C.surfaceUp} 50%,${C.surface} 75%)`,
          backgroundSize: '200% 100%',
          animation: 'cp-shimmer 1.4s ease infinite',
        }} />
      ))}
    </>
  )
}

// `action` ({ label, onClick }) : l'étape qui débloque la suite. Sur mobile,
// l'en-tête n'a pas la place pour « Connecte-toi pour publier » — sans elle,
// la communauté vide était une impasse (audit 2026-10-02).
export function EmptyState({ t, darkMode, action = null }) {
  const C = getC(darkMode)
  return (
    <div style={{
      padding: '48px 20px', textAlign: 'center',
      border: `1.5px dashed ${C.border}`,
      borderRadius: '16px',
      background: C.surface,
    }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🍳</div>
      <p style={{ color: C.mid, fontSize: '16px', margin: 0, lineHeight: 1.6 }}>{t.emptyFeed}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          style={{
            marginTop: '18px', minHeight: 44, padding: '10px 20px', borderRadius: '12px', border: 'none',
            background: C.orange, color: darkMode ? '#000' : '#fff', fontSize: '15px', fontWeight: 800, cursor: 'pointer',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
