import { useState } from 'react'
import { LuChefHat, LuX, LuPlus, LuRotateCcw, LuShuffle } from 'react-icons/lu'
import Button from '@shared/ui/button'

/**
 * En-tête du panneau Recettes : titre, compteur d'ingrédients et les quatre
 * actions (hasard, créer, vider, fermer).
 *
 * `hoverBtn` descend ici : il ne pilote que l'expansion au survol de ces
 * boutons et n'était lu nulle part ailleurs dans le panneau.
 */
export default function RecipePanelHeader({ t, stock, user, borderPanel, bgPanel, actions }) {
  const { onClose, pickRandomRecipe, openCreateForm, setShowResetConfirm } = actions
  const [hoverBtn, setHoverBtn] = useState(null)
  // Écran tactile (pas de survol) : le texte de Créer, révélé au survol sur
  // ordinateur, n'apparaissait jamais — il ne restait que « + » (audit
  // 2026-10-02, P6). On l'affiche d'emblée. « Vider » reste une icône : à
  // 360 px, ses deux libellés tronquaient le titre (« Reci… ») ; l'action est
  // secondaire, nommée pour les lecteurs d'écran et confirmée par une modale.
  const [noHover] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: none)')?.matches)
  const showCreate = noHover || hoverBtn === 'create'
  const showReset = hoverBtn === 'reset'

  return (
  <div
    className="sticky top-0 z-20 shrink-0 px-4 pt-3 pb-2.5"
    style={{ borderBottom: `1px solid ${borderPanel}`, background: bgPanel }}
  >
    <div className="flex items-center gap-2">
      <LuChefHat size={18} style={{ flexShrink: 0, color: 'var(--color-brand-500)' }} />
      {/* Un titre, rien d'autre : il fut un `<p onClick>` qui remettait les
          filtres à zéro sous l'infobulle « Vider le frigo » — hors clavier,
          et faux (audit du 2026-10-04). Les filtres se remettent à zéro dans
          le tiroir, le frigo se vide par le bouton « Vider ». */}
      <h2
        className="flex-1 min-w-0 font-extrabold overflow-hidden text-ellipsis whitespace-nowrap"
        style={{ fontSize: '24px', color: 'var(--color-charcoal)', margin: 0 }}
      >
        {t.title}
      </h2>

      <div className="flex items-center gap-2 shrink-0">
        {/* Hasard — expand au survol */}
        {user?.id && (
          <Button
            onClick={pickRandomRecipe}
            title={t.rouletteLabel}
            aria-label={t.rouletteLabel}
            onMouseEnter={() => setHoverBtn('shuffle')}
            onMouseLeave={() => setHoverBtn(null)}
            className="h-9 rounded-lg text-sm font-bold"
            style={{
              background: `rgba(224,120,32,${hoverBtn === 'shuffle' ? '0.18' : '0.11'})`,
              color: 'var(--color-brand-500)',
              padding: hoverBtn === 'shuffle' ? '0 10px' : '0 9px',
              gap: hoverBtn === 'shuffle' ? '6px' : '0px',
              transition: 'all 0.2s ease',
            }}
          >
            <LuShuffle size={15} style={{ flexShrink: 0 }} />
            <span style={{ maxWidth: hoverBtn === 'shuffle' ? '90px' : '0px', opacity: hoverBtn === 'shuffle' ? 1 : 0, overflow: 'hidden', transition: 'max-width 0.2s ease, opacity 0.15s ease', whiteSpace: 'nowrap', lineHeight: 1 }}>
              {t.rouletteShort}
            </span>
          </Button>
        )}

        {/* Créer — expand au survol, un peu plus large au repos */}
        <Button
          onClick={openCreateForm}
          title={t.createRecipe}
          onMouseEnter={() => setHoverBtn('create')}
          onMouseLeave={() => setHoverBtn(null)}
          className="h-9 rounded-lg bg-none bg-[#B85000] text-sm font-bold text-white hover:opacity-100"
          style={{
            boxShadow: hoverBtn === 'create' ? '0 3px 16px rgba(184,80,0,0.44)' : '0 2px 10px rgba(184,80,0,0.28)',
            filter: hoverBtn === 'create' ? 'brightness(1.09)' : 'none',
            padding: showCreate ? '0 14px' : '0 13px',
            gap: showCreate ? '6px' : '0px',
            transition: 'all 0.2s ease',
          }}
        >
          <LuPlus size={15} style={{ flexShrink: 0 }} />
          <span style={{ maxWidth: showCreate ? '90px' : '0px', opacity: showCreate ? 1 : 0, overflow: 'hidden', transition: 'max-width 0.2s ease, opacity 0.15s ease', whiteSpace: 'nowrap', lineHeight: 1 }}>
            {t.createShort}
          </span>
        </Button>

        {/* Vider — expand au survol */}
        {stock.size > 0 && (
          <Button
            variant="ghost"
            onClick={() => setShowResetConfirm(true)}
            title={t.resetTitle}
            onMouseEnter={() => setHoverBtn('reset')}
            onMouseLeave={() => setHoverBtn(null)}
            className="h-9 rounded-lg border-[1.5px] text-sm font-bold hover:bg-transparent"
            style={{
              borderColor: hoverBtn === 'reset' ? 'rgba(208,80,80,0.40)' : 'transparent',
              background: hoverBtn === 'reset' ? 'rgba(208,80,80,0.07)' : 'transparent',
              color: hoverBtn === 'reset' ? '#C05050' : 'var(--color-muted)',
              opacity: showReset ? 1 : 0.4,
              padding: showReset ? '0 10px' : '0 9px',
              gap: showReset ? '6px' : '0px',
              transition: 'all 0.2s ease',
            }}
          >
            <LuRotateCcw size={14} style={{ flexShrink: 0 }} />
            <span style={{ maxWidth: showReset ? '60px' : '0px', opacity: showReset ? 1 : 0, overflow: 'hidden', transition: 'max-width 0.2s ease, opacity 0.15s ease', whiteSpace: 'nowrap', lineHeight: 1 }}>
              {t.resetLabel}
            </span>
          </Button>
        )}

        {/* Fermer */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          title={t.closeLabel}
          aria-label={t.closeLabel}
          className="h-9 w-9 rounded-lg border-[1.5px] hover:bg-transparent"
          style={{ borderColor: 'rgba(122,95,86,0.30)', background: 'transparent', color: 'var(--color-muted)', opacity: 0.6, transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.50)'; e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.opacity = '1' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(122,95,86,0.30)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-muted)'; e.currentTarget.style.opacity = '0.6' }}
        >
          <LuX size={18} strokeWidth={2.5} />
        </Button>
      </div>
    </div>

    {/* Compteur ingrédients */}
    {stock.size > 0 && (
      <div className="mt-1 pl-7 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--color-brand-500)', boxShadow: '0 0 0 2.5px rgba(224,120,32,0.18)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--color-brand-500)' }}>{t.ingredientCount(stock.size)}</span>
      </div>
    )}
  </div>
  )
}
