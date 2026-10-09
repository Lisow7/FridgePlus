import Button from '@shared/ui/button'

// Phase 8 launch (refonte Recettes) PR 8.7.b. Extraction de
// RecipeModal : mini-dialog de confirmation suppression d'une recette
// custom. Pure presentational : reçoit l'état + callbacks du parent.

export default function RecipeDeleteDialog({
  isOpen,
  onCancel,
  onConfirm,
  isMobile,
  darkMode,
  t,                  // i18n object (confirmDeleteTitle, confirmDeleteBody, confirmDeleteCancel, confirmDeleteOk)
}) {
  if (!isOpen) return null
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 20,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      borderRadius: isMobile ? '20px 20px 0 0' : '24px',
    }}>
      <div style={{
        background: darkMode ? '#131E2C' : '#FDFAF6',
        borderRadius: '16px', padding: '28px 24px',
        maxWidth: '320px', width: '90%', textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
      }}>
        <p style={{ fontWeight: 700, fontSize: '16px', color: darkMode ? '#FFFFFF' : 'var(--color-charcoal)', marginBottom: '8px' }}>
          {t.confirmDeleteTitle}
        </p>
        <p style={{ fontSize: '13px', color: darkMode ? 'rgba(255,255,255,0.55)' : 'var(--color-muted)', marginBottom: '24px' }}>
          {t.confirmDeleteBody}
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <Button
            variant="secondary"
            onClick={onCancel}
            className="h-auto rounded-[10px] border-[1.5px] px-[18px] py-[9px] text-sm font-semibold"
            style={{
              background: darkMode ? '#1A2535' : '#F0EAD8',
              borderColor: darkMode ? '#2A3A50' : '#DDD0BC',
              color: darkMode ? 'rgba(255,255,255,0.75)' : 'var(--color-charcoal)',
            }}
          >
            {t.confirmDeleteCancel}
          </Button>
          <Button
            onClick={onConfirm}
            className="h-auto rounded-[10px] bg-gradient-to-br from-[#E07070] to-[#C04040] px-[18px] py-[9px] text-sm font-bold text-white shadow-[0_3px_12px_rgba(192,64,64,0.35)] hover:opacity-90"
          >
            {t.confirmDeleteOk}
          </Button>
        </div>
      </div>
    </div>
  )
}
