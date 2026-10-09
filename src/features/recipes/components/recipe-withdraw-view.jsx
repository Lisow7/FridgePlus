// Mode « retrait » de RecipeModal (étape 2 — « J'ai cuisiné cette recette »),
// extrait de recipe-modal.jsx le 2026-07-27 (audit front §1, suite).
//
// DEUX composants et non un seul : le mode retrait est entrelacé dans le DOM —
// sa moitié haute vit dans le conteneur header, sa moitié basse dans le
// conteneur body, chacune derrière son propre ternaire `step === 'detail'`.
// Les réunir imposerait de restructurer le DOM et de renoncer au déplacement
// byte-identique.
//
// Présentationnels : l'état du retrait (step, stepTwoState) reste dans
// RecipeModal — le retrait est une étape d'un même flux, un aller-retour vers
// le détail ne doit pas perdre les cases cochées.

import { LuArrowLeft } from 'react-icons/lu'
import Emoji from '@shared/ui/emoji'
import Button from '@shared/ui/button'
import { getIngredientItemsFlat } from '@shared/lib/recipes/recipe-ingredients'

// Détection frigo/garde-manger via préfixe d'ID :
//   fr-, frz-, vg-, jp- → frigo (frais, congélateur, légumes, frais japonais)
//   gp-, sp-, bk-       → garde-manger (épicerie, épices, boulangerie sec)
const isPantryId = (id) => /^(gp-|sp-|bk-)/.test(id ?? '')
const STORAGE_EMOJI = (id) => isPantryId(id) ? '🥫' : '🧊'

export function RecipeWithdrawHeader({
  recipe,
  recipeName,
  headerText,
  theme,
  darkMode,
  isMobile,
  t,
  onBack,
  onClose,
}) {
  return (
    /* Step 2 header */
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <Button
        onClick={onBack}
        aria-label={t.back}
        className="h-auto shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold"
        style={{
          gap: '6px',
          background: darkMode ? 'rgba(255,255,255,0.10)' : `${theme.text}18`,
          color: headerText,
        }}
      >
        <LuArrowLeft size={14} />
        {!isMobile && t.back}
      </Button>
      <Emoji char={recipe.emoji} size={isMobile ? 28 : 34} style={{ flexShrink: 0 }} imageUrl={recipe.image_url} />
      <h2 style={{ flex: 1, fontSize: isMobile ? '15px' : '18px', fontWeight: 700, color: headerText, margin: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {recipeName}
      </h2>
      <Button
        variant="ghost"
        onClick={onClose}
        aria-label={t.close}
        className="close-x h-auto rounded-none p-0 text-lg opacity-30 hover:bg-transparent"
        style={{ color: headerText, flexShrink: 0 }}
      >✕</Button>
    </div>
  )
}

export function RecipeWithdrawBody({
  recipe,
  stepTwoState,
  setStepTwoState,
  canConfirm,
  confirmWithdraw,
  ingredientLookup,
  mutedColor,
  darkMode,
  isMobile,
  lang,
  t,
}) {
  return (
    /* ── Step 2 — Withdrawal ─────────────────────────────────────────── */
    <div className="fp-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: isMobile ? '16px' : '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Titre + bouton bascule tout (dé)sélectionner */}
      {(() => {
        const entries = Object.entries(stepTwoState).filter(([, s]) => s.resolved && s.resolved !== 'skip')
        const allChecked = entries.length > 0 && entries.every(([, s]) => s.checked)
        const toggleAll = () => {
          const nextChecked = !allChecked
          setStepTwoState(prev => {
            const next = { ...prev }
            for (const [key, s] of Object.entries(next)) {
              if (s.resolved && s.resolved !== 'skip') next[key] = { ...s, checked: nextChecked }
            }
            return next
          })
        }
        return (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-charcoal)', margin: '0 0 2px' }}>{t.withdrawTitle}</p>
              <p style={{ fontSize: '12px', color: mutedColor, margin: 0 }}>{t.withdrawSub}</p>
            </div>
            {entries.length > 0 && (
              <Button
                onClick={toggleAll}
                className="h-auto shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap"
                style={{
                  borderColor: darkMode ? 'rgba(247,168,94,0.35)' : 'rgba(224,120,32,0.30)',
                  background: darkMode ? 'rgba(247,168,94,0.10)' : 'rgba(224,120,32,0.07)',
                  color: darkMode ? 'var(--color-brand-400)' : '#A05020',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = darkMode ? 'rgba(247,168,94,0.18)' : 'rgba(224,120,32,0.13)' }}
                onMouseLeave={e => { e.currentTarget.style.background = darkMode ? 'rgba(247,168,94,0.10)' : 'rgba(224,120,32,0.07)' }}
              >
                {allChecked ? t.deselectAll : t.selectAll}
              </Button>
            )}
          </div>
        )
      })()}

      {/* Liste des ingrédients */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Object.entries(stepTwoState).map(([ingIndexStr, state]) => {
          const ingIndex = parseInt(ingIndexStr)
          const ing      = getIngredientItemsFlat(recipe)[ingIndex]

          /* Item skippé */
          if (state.resolved === 'skip') {
            return (
              <div key={ingIndex} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', borderRadius: '10px',
                background: darkMode ? '#1A2535' : '#F5EDD8',
                border: `1.5px solid ${darkMode ? '#2A3A50' : '#DDD0BC'}`,
                opacity: 0.5,
              }}>
                <span style={{ fontSize: '20px', opacity: 0.5 }}>—</span>
                <span style={{ flex: 1, fontSize: '13px', color: mutedColor, fontStyle: 'italic', textDecoration: 'line-through' }}>
                  {ing.labels?.[lang] ?? ing.label}
                </span>
                <Button
                  variant="ghost"
                  onClick={() => setStepTwoState(prev => ({
                    ...prev,
                    [ingIndex]: { ...prev[ingIndex], resolved: state.prevResolved ?? null, checked: false },
                  }))}
                  className="h-auto rounded px-1.5 py-0.5 text-[11px] underline hover:bg-transparent"
                  style={{ color: mutedColor }}
                >
                  {t.cancel}
                </Button>
              </div>
            )
          }

          /* Item non résolu — forcer la sélection */
          if (state.resolved === null) {
            return (
              <div key={ingIndex} style={{
                padding: '12px 14px', borderRadius: '10px',
                border: `1.5px solid ${darkMode ? 'var(--color-brand-500)' : 'var(--color-brand-400)'}`,
                background: darkMode ? '#1A2535' : '#FFF8F2',
              }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-brand-500)', margin: '0 0 8px' }}>
                  {ing.labels?.[lang] ?? ing.label} — {t.chooseUsed}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {state.inStockOptions.map(id => {
                    const info  = ingredientLookup[id]
                    const name  = info?.labels?.[lang] ?? info?.labels?.fr ?? id
                    const emoji = info?.emoji ?? '•'
                    const imageUrl = info?.image_url
                    return (
                      <Button
                        key={id}
                        onClick={() => setStepTwoState(prev => ({ ...prev, [ingIndex]: { ...prev[ingIndex], resolved: id, checked: false } }))}
                        className="h-auto rounded-lg border-[1.5px] px-3 py-1.5 text-xs font-semibold"
                        style={{
                          gap: '6px',
                          borderColor: darkMode ? '#2A3A50' : '#E8D5B8',
                          background: darkMode ? '#131E2C' : '#FDFAF6',
                          color: 'var(--color-charcoal)',
                          transition: 'background 0.12s, border-color 0.12s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = darkMode ? '#1A3A2A' : '#E8F5E9'; e.currentTarget.style.borderColor = '#7BB078' }}
                        onMouseLeave={e => { e.currentTarget.style.background = darkMode ? '#131E2C' : '#FDFAF6'; e.currentTarget.style.borderColor = darkMode ? '#2A3A50' : '#E8D5B8' }}
                      >
                        <Emoji char={emoji} size={14} style={{ flexShrink: 0 }} imageUrl={imageUrl} />
                        {name}
                      </Button>
                    )
                  })}
                  <Button
                    onClick={() => setStepTwoState(prev => ({ ...prev, [ingIndex]: { ...prev[ingIndex], resolved: 'skip', prevResolved: null } }))}
                    className="h-auto rounded-lg border-[1.5px] px-3 py-1.5 text-xs font-semibold"
                    style={{
                      borderColor: darkMode ? '#4A3020' : '#E8C0A0',
                      background: darkMode ? '#2A1810' : '#FFF0E8',
                      color: 'var(--color-brand-600)',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = darkMode ? '#3A2010' : '#FFE8D8'; e.currentTarget.style.borderColor = 'var(--color-brand-600)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = darkMode ? '#2A1810' : '#FFF0E8'; e.currentTarget.style.borderColor = darkMode ? '#4A3020' : '#E8C0A0' }}
                  >
                    {t.cookWithout}
                  </Button>
                </div>
              </div>
            )
          }

          /* Item résolu — checkbox */
          const info  = ingredientLookup[state.resolved]
          const name  = info?.labels?.[lang] ?? info?.labels?.fr ?? state.resolved
          const emoji = info?.emoji ?? '•'
          const imageUrl = info?.image_url

          return (
            <div
              key={ingIndex}
              onClick={() => setStepTwoState(prev => ({ ...prev, [ingIndex]: { ...prev[ingIndex], checked: !prev[ingIndex].checked } }))}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 14px', borderRadius: '10px', cursor: 'pointer',
                background: state.checked
                  ? (darkMode ? '#1A3A2A' : '#E8F5E9')
                  : (darkMode ? '#1A2535' : '#F5EDD8'),
                border: `1.5px solid ${state.checked ? '#7BB078' : (darkMode ? '#2A3A50' : '#E8D5B8')}`,
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              {/* Custom checkbox */}
              <div style={{
                width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0,
                border: `2px solid ${state.checked ? '#7BB078' : (darkMode ? '#3A5070' : '#C4A890')}`,
                background: state.checked ? '#7BB078' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}>
                {state.checked && <span style={{ color: 'white', fontSize: '11px', fontWeight: 900, lineHeight: 1 }}>✓</span>}
              </div>

              <Emoji char={emoji} size={18} style={{ flexShrink: 0 }} imageUrl={imageUrl} />
              <span style={{
                flex: 1, fontSize: '14px', fontWeight: 600,
                color: state.checked ? '#3A6A38' : 'var(--color-charcoal)',
              }}>
                {name}
              </span>
              {/* Tag d'état frigo/garde-manger — remplace le bouton "cuisiné sans".
                  Cliquer sur le tag bascule l'état (équivalent au clic sur la ligne). */}
              {(() => {
                const isPantry = isPantryId(state.resolved)
                const willRemoveLabel = isPantry ? t.willRemovePantry : t.willRemoveFridge
                const keepLabel       = isPantry ? t.keepInPantry     : t.keepInFridge
                const tagBg = state.checked
                  ? (darkMode ? 'rgba(123,176,120,0.18)' : 'rgba(123,176,120,0.16)')
                  : (darkMode ? 'rgba(212,106,16,0.18)'  : 'rgba(212,106,16,0.12)')
                const tagColor = state.checked ? '#3A6A38' : 'var(--color-brand-600)'
                const tagBorder = state.checked
                  ? (darkMode ? 'rgba(123,176,120,0.35)' : 'rgba(123,176,120,0.45)')
                  : (darkMode ? 'rgba(212,106,16,0.35)'  : 'rgba(212,106,16,0.32)')
                return (
                  <span
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      fontSize: '11px', fontWeight: 600,
                      padding: '4px 9px', borderRadius: '8px',
                      background: tagBg, color: tagColor,
                      border: `1.5px solid ${tagBorder}`,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                    }}
                  >
                    <span aria-hidden="true">{state.checked ? STORAGE_EMOJI(state.resolved) : '✅'}</span>
                    {state.checked ? willRemoveLabel : keepLabel}
                  </span>
                )
              })()}
            </div>
          )
        })}
      </div>

      {/* Bouton confirmer */}
      <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
        {!canConfirm && (
          <p style={{ fontSize: '12px', color: 'var(--color-brand-500)', fontWeight: 600, marginBottom: '8px', textAlign: 'center' }}>
            {t.withdrawPickWarning}
          </p>
        )}
        <Button
          onClick={confirmWithdraw}
          disabled={!canConfirm}
          className={`h-auto w-full rounded-xl px-4 py-3.5 text-sm font-bold ${canConfirm ? 'soft-blink' : ''}`}
          style={{
            background: canConfirm
              ? 'var(--gradient-warm)'
              : (darkMode ? '#2A3A50' : '#E8D5B8'),
            color: canConfirm ? 'white' : mutedColor,
            transition: 'all 0.2s',
            boxShadow: canConfirm ? '0 3px 14px rgba(212,106,16,0.30)' : 'none',
          }}
        >
          {t.confirm}
        </Button>
      </div>
    </div>
  )
}
