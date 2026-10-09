import { suffixS } from '@shared/lib/i18n/pluralize'
import { Z_INDEX } from '@shared/lib/z-index'

// Composant orchestrant les 2 toasts d'annulation des actions
// destructives panier : « panier vidé » (3s) et « ingrédients ajoutés
// au frigo » (7s avec détail par zone). Sprint 10 S10.a.13 — extrait
// depuis App.jsx pour alléger le composant racine de ~125 lignes JSX.
//
// L'état (clearBasketToast / fridgeToast) et les actions undo
// (handleRestoreClearedBasket / handleFridgeUndo) sont gérés par
// `useBasketToasts` côté App.jsx ; ce composant n'est qu'une vue
// stateless qui les reçoit en props.

const CLEAR_BASKET_I18N = {
  fr: (n, s) => `Panier vidé (${n} ingrédient${s})`,
  en: (n, s) => `Cart cleared (${n} item${s})`,
  es: (n, s) => `Cesta vaciada (${n} elemento${s})`,
  de: (n) => `Warenkorb geleert (${n} Artikel)`,
  ja: (n) => `カートを空にしました（${n} 件）`,
}

const RESTORE_LABEL_I18N = { fr: 'Restaurer', en: 'Restore', es: 'Restaurar', de: 'Wiederherstellen', ja: '復元' }
const UNDO_LABEL_I18N    = { fr: 'Annuler',   en: 'Undo',    es: 'Deshacer',   de: 'Rückgängig',     ja: '元に戻す' }

const FRIDGE_ADDED_I18N = {
  fr: (n, s) => `${n} ingrédient${s} ajouté${s}`,
  en: (n, s) => `${n} ingredient${s} added`,
  es: (n, s) => `${n} ingrediente${s} añadido${s}`,
  de: (n, s) => `${n} Zutat${s ? 'en' : ''} hinzugefügt`,
  ja: (n) => `${n} 食材を追加`,
}

const FRIDGE_ZONE_I18N = {
  fr: (n) => `${n} frigo`,
  en: (n) => `${n} fridge`,
  es: (n) => `${n} nevera`,
  de: (n) => `${n} Kühlschrank`,
  ja: (n) => `冷蔵庫 ${n}`,
}
const PANTRY_ZONE_I18N = {
  fr: (n) => `${n} garde-manger`,
  en: (n) => `${n} pantry`,
  es: (n) => `${n} despensa`,
  de: (n) => `${n} Speisekammer`,
  ja: (n) => `食品庫 ${n}`,
}

const toastShellStyle = (darkMode) => ({
  position: 'fixed', bottom: 'calc(24px + var(--fp-bottom-inset, 0px))', left: '50%',
  transform: 'translateX(-50%)',
  zIndex: Z_INDEX.TOAST,
  display: 'flex', alignItems: 'center', gap: '14px',
  padding: '14px 20px',
  borderRadius: '14px',
  background: darkMode ? 'var(--color-dark-surface)' : '#1A1A0A',
  color: '#FFF',
  boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
  fontSize: '14px',
  animation: 'fridge-toast-in 0.3s cubic-bezier(0.34,1.06,0.64,1)',
  maxWidth: 'calc(100vw - 40px)',
})

const undoButtonStyle = {
  background: 'transparent', border: '1px solid rgba(255,255,255,0.30)',
  borderRadius: '8px', padding: '6px 12px',
  color: 'var(--color-brand-400)', fontSize: '13px', fontWeight: 700,
  cursor: 'pointer', transition: 'background 0.15s',
}

export default function BasketUndoToasts({
  clearBasketToast,
  fridgeToast,
  onRestoreClearedBasket,
  onFridgeUndo,
  lang,
  darkMode,
}) {
  return (
    <>
      {clearBasketToast && (
        <div style={toastShellStyle(darkMode)}>
          <span style={{ fontSize: '20px' }}>🗑️</span>
          <span style={{ fontWeight: 600 }}>
            {(() => {
              const n = clearBasketToast.items.length
              const s = suffixS(n, lang)
              const fn = CLEAR_BASKET_I18N[lang] ?? CLEAR_BASKET_I18N.fr
              return fn(n, s)
            })()}
          </span>
          <button
            onClick={onRestoreClearedBasket}
            style={undoButtonStyle}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(247,168,94,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {RESTORE_LABEL_I18N[lang] ?? RESTORE_LABEL_I18N.fr}
          </button>
        </div>
      )}

      {fridgeToast && (
        <div style={toastShellStyle(darkMode)}>
          <span style={{ fontSize: '20px' }}>🥬</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontWeight: 700, fontSize: '14px' }}>
              {(() => {
                const n = fridgeToast.count
                const s = suffixS(n, lang)
                const fn = FRIDGE_ADDED_I18N[lang] ?? FRIDGE_ADDED_I18N.fr
                return fn(n, s)
              })()}
            </span>
            {/* Détail par zone (frigo / garde-manger) si pertinent.
                Le congélateur est inclus dans le frigo (zone froide globale). */}
            {(fridgeToast.nFridge + fridgeToast.nPantry > 0) && (
              <span style={{ fontSize: '12px', opacity: 0.85 }}>
                {[
                  fridgeToast.nFridge > 0 && (FRIDGE_ZONE_I18N[lang] ?? FRIDGE_ZONE_I18N.fr)(fridgeToast.nFridge),
                  fridgeToast.nPantry > 0 && (PANTRY_ZONE_I18N[lang] ?? PANTRY_ZONE_I18N.fr)(fridgeToast.nPantry),
                ].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
          <button
            onClick={onFridgeUndo}
            style={undoButtonStyle}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(247,168,94,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {UNDO_LABEL_I18N[lang] ?? UNDO_LABEL_I18N.fr}
          </button>
        </div>
      )}

      <style>{`
        @keyframes fridge-toast-in {
          0% { opacity: 0; transform: translate(-50%, 12px); }
          100% { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </>
  )
}
