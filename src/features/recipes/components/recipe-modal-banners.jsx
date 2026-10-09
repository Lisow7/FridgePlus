// Phase 8 launch (refonte Recettes) PR 8.7.b. Extraction de
// RecipeModal : 2 bannières utilitaires de la modale recette.
//
// 1. `<AdminModifiedBanner>` : bandeau violet visible quand un admin a
//    modifié la recette custom de l'utilisateur (info rétroactive).
// 2. `<WithdrawFeedbackBanner>` : bandeau vert success en bas de la modale
//    après confirmation du retrait d'ingrédients du frigo.

export function AdminModifiedBanner({ visible, darkMode, t }) {
  if (!visible) return null
  return (
    <div style={{
      flexShrink: 0, padding: '8px 20px',
      background: darkMode ? 'rgba(168,85,247,0.10)' : 'rgba(168,85,247,0.07)',
      borderBottom: `1px solid ${darkMode ? 'rgba(168,85,247,0.20)' : 'rgba(168,85,247,0.18)'}`,
      display: 'flex', alignItems: 'center', gap: '8px',
    }}>
      <span style={{ fontSize: '14px', flexShrink: 0 }}>✏️</span>
      <span style={{ fontSize: '12px', color: darkMode ? '#C084FC' : '#7E22CE', fontStyle: 'italic' }}>
        {t.adminModifiedNotice}
      </span>
    </div>
  )
}

export function WithdrawFeedbackBanner({ message, isMobile }) {
  if (!message) return null
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      padding: '13px 20px',
      background: 'linear-gradient(135deg, #4CAF7D 0%, #3A8A5E 100%)',
      color: 'white', fontSize: '14px', fontWeight: 700,
      textAlign: 'center',
      borderRadius: isMobile ? '0' : '0 0 24px 24px',
      animation: 'modal-enter 0.25s cubic-bezier(0.34,1.10,0.64,1) both',
      zIndex: 10,
    }}>
      ✓ {message}
    </div>
  )
}
