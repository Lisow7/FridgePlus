import { useRef } from 'react'
import { LuChefHat, LuX, LuPlus, LuRotateCcw, LuShuffle, LuEllipsis } from 'react-icons/lu'
import Button from '@shared/ui/button'
import MenuShell from '@shared/ui/menu-shell'
import { useDropdownMenu } from '@shared/hooks/use-dropdown-menu'

/**
 * En-tête du panneau Recettes : le titre, le compteur d'ingrédients, un menu
 * « Plus d'actions » et la fermeture.
 *
 * Décision du 2026-10-08 : environ 9 commandes au lieu de 14 dans le panneau.
 * Créer, Au hasard (avec un compte) et Vider (frigo non vide) quittent l'en-tête
 * pour ce menu, où chacune porte son texte entier — plus de libellé qui ne se
 * déplie qu'au survol. Le menu (`useDropdownMenu` + `MenuShell`) a son propre
 * piège de focus, au-dessus de celui du panneau : Échap ferme le menu seul et
 * rend le focus au bouton « ⋯ ».
 */
export default function RecipePanelHeader({ t, stock, user, borderPanel, bgPanel, actions }) {
  const { onClose, pickRandomRecipe, openCreateForm, setShowResetConfirm } = actions
  const declencheur = useRef(null)
  const { open, setOpen, menuRef, dropPos } = useDropdownMenu(declencheur)

  const entrees = [
    { cle: 'creer', Icone: LuPlus, libelle: t.createRecipe, agir: openCreateForm },
    user?.id && { cle: 'hasard', Icone: LuShuffle, libelle: t.rouletteLabel, agir: pickRandomRecipe },
    stock.size > 0 && { cle: 'vider', Icone: LuRotateCcw, libelle: t.resetTitle, agir: () => setShowResetConfirm(true) },
  ].filter(Boolean)

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
          le tiroir, le frigo se vide par le menu « Plus d'actions ». */}
      <h2
        className="flex-1 min-w-0 font-extrabold overflow-hidden text-ellipsis whitespace-nowrap"
        style={{ fontSize: '24px', color: 'var(--color-charcoal)', margin: 0 }}
      >
        {t.title}
      </h2>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          ref={declencheur}
          variant="ghost"
          size="icon"
          onClick={() => setOpen((v) => !v)}
          aria-label={t.moreActions}
          aria-haspopup="menu"
          aria-expanded={open}
          className="h-9 w-9 rounded-lg border-[1.5px] hover:bg-transparent"
          style={{ borderColor: 'rgba(122,95,86,0.30)', background: open ? 'rgba(224,120,32,0.11)' : 'transparent', color: 'var(--color-muted)' }}
        >
          <LuEllipsis size={18} strokeWidth={2.5} aria-hidden="true" />
        </Button>

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

    <MenuShell ref={menuRef} open={open} onClose={() => setOpen(false)} ariaLabel={t.moreActions} dropPos={dropPos}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px' }}>
        {entrees.map(({ cle, Icone, libelle, agir }) => (
          <button
            key={cle}
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); agir() }}
            className="flex items-center gap-2.5 rounded-lg text-left text-sm font-bold hover:bg-[rgba(224,120,32,0.08)]"
            style={{ padding: '10px 12px', minHeight: '44px', border: 'none', background: 'transparent', color: 'var(--color-charcoal)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <Icone size={16} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--color-brand-500)' }} />
            {libelle}
          </button>
        ))}
      </div>
    </MenuShell>

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
