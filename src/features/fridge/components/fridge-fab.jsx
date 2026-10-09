import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LuX, LuMic, LuDoorOpen, LuDoorClosed, LuChefHat, LuGrid2X2, LuCookingPot, LuCamera, LuClipboardList, LuSearch } from 'react-icons/lu'
import { useViderLeFrigo } from '@features/fridge/hooks/use-vider-le-frigo'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import { useMediaQuery } from '@shared/hooks/use-media-query'
import { useDropdownMenu } from '@shared/hooks/use-dropdown-menu'
import { useFeatureFlag } from '@shared/contexts/feature-flags-provider'
import MenuShell from '@shared/ui/menu-shell'
import Button from '@shared/ui/button'
import Tooltip from '@shared/ui/tooltip'
import InventoryPanel from '@features/fridge/components/inventory-panel'
import { getFabPrimaryAction } from '@features/fridge/lib/fab-primary-action'

// FAB unifié — un seul mode de rendu : ancré dans #header-fab-slot (livré
// en #4), tous breakpoints et tous états (frigo ouvert/fermé). Plus de
// saut, plus d'occlusion. Tap → menu via MenuShell (bottom sheet mobile /
// dropdown desktop). L'action Ouvrir/Fermer suit la zone active.

const I18N = {
  fr: {
    fab_label: 'Actions rapides',
    open_fridge: 'Ouvrir le frigo', close_fridge: 'Fermer le frigo',
    close_pantry: 'Fermer le garde-manger',
    recipes: 'Recettes', leftovers: 'Restes',
    inventory: (n) => `Inventaire (${n})`,
    section_fill: 'Remplir', section_check: 'Vérifier', section_cook: 'Cuisiner',
    hint_open_fridge: 'Coche ce que tu as, bac par bac',
    hint_close_fridge: 'Referme les portes',
    hint_close_pantry: 'Referme le garde-manger',
    hint_mic: 'Dis tes courses, comme à un ami',
    hint_receipt: 'Toutes tes courses d’un coup',
    hint_inventory: 'Tout ton frigo en une liste',
    search_food: 'Chercher un aliment',
    hint_search_food: 'Tape son nom : œufs, pâtes…',
    hint_leftovers: 'Tes plats cuisinés, et leur fraîcheur',
    hint_recipes: 'Ce que tu peux faire maintenant',
    mic_stop: 'Arrêter', mic_init: '…',
    empty: 'Vider',
    confirm_title: 'Vider ton frigo ?',
    confirm_body: 'Tous les ingrédients seront retirés. Tu auras 10 secondes pour annuler.',
    confirm_ok: 'Vider', confirm_cancel: 'Annuler',
    close: 'Fermer',
    mic_add: 'À la voix',
    photo_receipt: 'Photo du ticket',
  },
  en: {
    fab_label: 'Quick actions',
    open_fridge: 'Open the fridge', close_fridge: 'Close the fridge',
    close_pantry: 'Close the pantry',
    recipes: 'Recipes', leftovers: 'Leftovers',
    inventory: (n) => `Inventory (${n})`,
    section_fill: 'Fill', section_check: 'Check', section_cook: 'Cook',
    hint_open_fridge: 'Tick what you have, shelf by shelf',
    hint_close_fridge: 'Close the doors',
    hint_close_pantry: 'Close the pantry',
    hint_mic: 'Say your groceries, like to a friend',
    hint_receipt: 'All your groceries at once',
    hint_inventory: 'Your whole fridge in one list',
    search_food: 'Find a food',
    hint_search_food: 'Type its name: eggs, pasta…',
    hint_leftovers: 'Your cooked dishes, and how fresh',
    hint_recipes: 'What you can make right now',
    mic_stop: 'Stop', mic_init: '…',
    empty: 'Empty',
    confirm_title: 'Empty your fridge?',
    confirm_body: "All ingredients will be removed. You'll have 10 seconds to undo.",
    confirm_ok: 'Empty', confirm_cancel: 'Cancel',
    close: 'Close',
    mic_add: 'By voice',
    photo_receipt: 'Receipt photo',
  },
}

// Titre de section non cliquable : on VOIT dans quoi chaque action est rangée
// (demande user 2026-08-27 : « comme avant mais en mieux » — les rangements de
// l'ancien sous-menu, sans sa navigation à 2 taps).
function SectionLabel({ label, darkMode }) {
  return (
    <div aria-hidden="true" style={{
      padding: '8px 14px 3px', fontSize: '10.5px', fontWeight: 700,
      letterSpacing: '0.07em', textTransform: 'uppercase',
      color: darkMode ? '#7A90A8' : '#886C54',
      userSelect: 'none',
    }}>{label}</div>
  )
}

function MenuItem({ icon, label, hint, onClick, danger, disabled, darkMode, badge = 0 }) {
  const fg = danger ? 'var(--color-danger)' : (darkMode ? 'var(--color-bg-warm)' : 'var(--color-charcoal)')
  const muted = darkMode ? '#8FA3B8' : '#826E5A'
  const hover = darkMode ? 'rgba(247,168,94,0.10)' : 'rgba(212,106,16,0.07)'
  const labelId = useId()
  const hintId = useId()
  // Écran bas (clavier virtuel, paysage) : le menu doit tenir sans défiler,
  // l'explication s'efface, le libellé reste.
  const ecranBas = useMediaQuery('(max-height: 600px)')
  const montrerHint = Boolean(hint) && !ecranBas
  return (
    <button
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      aria-labelledby={labelId}
      aria-describedby={montrerHint ? hintId : undefined}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '11px',
        padding: montrerHint ? '9px 14px' : '11px 14px', borderRadius: '8px', border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left',
        background: 'transparent', color: fg, fontSize: '14px', fontWeight: 600,
        fontFamily: 'inherit', opacity: disabled ? 0.4 : 1,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = hover }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ flexShrink: 0, display: 'flex' }}>{icon}</span>
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span id={labelId}>{label}</span>
        {montrerHint && (
          <span id={hintId} style={{ fontSize: '12px', fontWeight: 500, color: muted, lineHeight: 1.3 }}>{hint}</span>
        )}
      </span>
      {badge > 0 && (
        <span aria-hidden="true" style={{
          flexShrink: 0, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
          background: 'var(--color-danger)', color: 'white', fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
        }}>{badge}</span>
      )}
    </button>
  )
}

function ConfirmModal({ open, onCancel, onConfirm, t, darkMode }) {
  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, { active: open, onEscape: onCancel })
  useCloseOnBackButton(open, onCancel)
  if (!open) return null
  const bg = darkMode ? '#0F1925' : '#FFFFFF'
  const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const border = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'
  return createPortal(
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="fab-empty-title" onClick={onCancel}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(15,8,2,0.78)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: bg, color: fg, borderRadius: 14, maxWidth: 420, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.4)', overflow: 'hidden', border: `1px solid ${border}` }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${border}` }}>
          <h2 id="fab-empty-title" style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{t.confirm_title}</h2>
        </div>
        <div style={{ padding: '18px 20px', fontSize: 14, lineHeight: 1.55 }}>{t.confirm_body}</div>
        <div style={{ padding: '12px 20px 16px', display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: `1px solid ${border}` }}>
          <Button variant="secondary" size="sm" onClick={onCancel} className="h-auto py-[9px] px-4 text-[13px] font-semibold" style={{ borderColor: border, color: fg }}>{t.confirm_cancel}</Button>
          <Button variant="danger" size="sm" onClick={onConfirm} className="h-auto py-[9px] px-4 text-[13px]">{t.confirm_ok}</Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function FridgeFAB({
  lang = 'fr', darkMode = false,
  stock, stockCount: _stockCount = 0, recipesLabel,
  onShowRecipes, onShowLeftovers, leftoversExpiredCount = 0, voiceListening = false, jaLoading = false, onVoiceToggle, onReceiptScanStart,
  activeTab = 'fridge', doorOpen = false, pantryOpen = false,
  onOpenFridge, onCloseFridge, onClosePantry,
  onEmptyOptimistic, onEmptyConfirm, onEmptyUndo,
  isHome = true,
}) {
  const t = I18N[lang] ?? I18N.fr
  const triggerRef = useRef(null)
  const { open, setOpen, menuRef, dropPos } = useDropdownMenu(triggerRef)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [showInventory, setShowInventory] = useState(false)
  // Ouvert par « Chercher un aliment » : même panneau, curseur déjà dans le champ
  const [inventorySearchFirst, setInventorySearchFirst] = useState(false)
  const viderLeFrigo = useViderLeFrigo({ stock, lang, onEmptyOptimistic, onEmptyConfirm, onEmptyUndo })
  const windowWidth = useWindowWidth()
  const isDesktop = windowWidth >= 1280
  const stockCount = stock?.size ?? 0
  const hasStock = stockCount > 0
  const receiptScanEnabled = useFeatureFlag('receipt_scan', false)

  if (!isHome) return null
  const slot = typeof document !== 'undefined' ? document.getElementById('header-fab-slot') : null
  if (!slot) return null

  const primary = getFabPrimaryAction({ isDesktop, activeTab, doorOpen, pantryOpen })
  const micLabel = jaLoading ? t.mic_init : (voiceListening ? t.mic_stop : t.mic_add)

  const run = (fn) => () => { setOpen(false); fn?.() }
  const handlePrimary = run(() => {
    if (primary?.kind === 'open-fridge') onOpenFridge?.()
    else if (primary?.kind === 'close-fridge') onCloseFridge?.()
    else if (primary?.kind === 'close-pantry') onClosePantry?.()
  })
  const handleInventory = () => { setOpen(false); setInventorySearchFirst(false); setShowInventory(true) }
  const handleSearchFood = () => { setOpen(false); setInventorySearchFirst(true); setShowInventory(true) }
  const handleRecipes = run(onShowRecipes)
  const handleLeftovers = run(onShowLeftovers)
  const handleVoice = run(onVoiceToggle)
  const handleReceiptScan = run(onReceiptScanStart)
  const handleEmptyConfirm = () => {
    setConfirmOpen(false)
    viderLeFrigo()
  }

  const sepColor = darkMode ? '#1E2E42' : 'var(--color-border-warm)'
  const sep = <div aria-hidden="true" style={{ width: '1px', height: '22px', background: sepColor, margin: '0 6px', flexShrink: 0 }} />

  const primaryIcon = primary?.kind === 'open-fridge'
    ? <LuDoorOpen size={18} aria-hidden="true" />
    : <LuDoorClosed size={18} aria-hidden="true" />

  return (
    <>
      {createPortal(
        <div style={{ display: 'contents' }}>
          {isDesktop && sep}
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            {/* Une icône seule : son nom se voit au survol, comme les autres
                icônes de l'en-tête (UX-17 ; décision du 2026-10-08). Pas pendant que le
                menu est ouvert : la bulle le recouvrirait. */}
            <Tooltip text={t.fab_label} darkMode={darkMode} disabled={open}>
              <button
                ref={triggerRef}
                onClick={() => setOpen(v => !v)}
                aria-label={t.fab_label}
                aria-expanded={open}
                aria-haspopup="menu"
                // Fermé, il luit comme les poignées du frigo (cf. .fp-luit-bouton)
                className={open ? undefined : 'fp-luit-bouton'}
                style={{
                  width: 44, height: 44, borderRadius: 12, border: 'none',
                  background: open ? (darkMode ? '#1A2535' : 'var(--color-bg-warm)') : 'var(--gradient-deep)',
                  color: open ? (darkMode ? '#8AACCA' : '#6B4030') : 'white',
                  boxShadow: open ? '0 2px 8px rgba(0,0,0,0.18)' : '0 4px 16px rgba(212,106,16,0.45)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'background 0.18s, box-shadow 0.18s',
                }}
              >
                {open ? <LuX size={20} aria-hidden="true" /> : <LuGrid2X2 size={20} aria-hidden="true" />}
              </button>
            </Tooltip>
            <MenuShell ref={menuRef} open={open} onClose={() => setOpen(false)} ariaLabel={t.fab_label} dropPos={dropPos} darkMode={darkMode}>
              <div style={{ padding: '6px' }}>
                {/* Trois verbes, dans l'ordre où on les fait (spec 2026-09-11) :
                    Remplir → Vérifier → Cuisiner. Chaque entrée porte une ligne
                    d'explication (aria-describedby). « Vider » vit désormais dans
                    le panneau Inventaire : action destructrice, hors d'un FAB. */}
                <SectionLabel label={t.section_fill} darkMode={darkMode} />
                <div role="group" aria-label={t.section_fill}>
                  {primary && (
                    <MenuItem icon={primaryIcon} label={t[primary.labelKey]} hint={t[`hint_${primary.labelKey}`]} onClick={handlePrimary} darkMode={darkMode} />
                  )}
                  {/* Audit 2026-10-02 : chercher un aliment est le chemin le plus court
                      (≈ 3 gestes contre 22 tapes bac par bac) — il était rangé sous
                      « Vérifier ». Même panneau que l'Inventaire, champ actif. */}
                  <MenuItem icon={<LuSearch size={17} aria-hidden="true" />} label={t.search_food} hint={t.hint_search_food} onClick={handleSearchFood} darkMode={darkMode} />
                  <MenuItem icon={<LuMic size={17} aria-hidden="true" />} label={micLabel} hint={t.hint_mic} onClick={handleVoice} disabled={jaLoading} darkMode={darkMode} />
                  {receiptScanEnabled && (
                    <MenuItem icon={<LuCamera size={17} aria-hidden="true" />} label={t.photo_receipt} hint={t.hint_receipt} onClick={handleReceiptScan} darkMode={darkMode} />
                  )}
                </div>
                <SectionLabel label={t.section_check} darkMode={darkMode} />
                <div role="group" aria-label={t.section_check}>
                  <MenuItem icon={<LuClipboardList size={17} aria-hidden="true" />} label={t.inventory(stockCount)} hint={t.hint_inventory} onClick={handleInventory} darkMode={darkMode} />
                  <MenuItem icon={<LuCookingPot size={17} aria-hidden="true" />} label={t.leftovers} hint={t.hint_leftovers} onClick={handleLeftovers} badge={leftoversExpiredCount} darkMode={darkMode} />
                </div>
                <SectionLabel label={t.section_cook} darkMode={darkMode} />
                <div role="group" aria-label={t.section_cook}>
                  <MenuItem icon={<LuChefHat size={17} aria-hidden="true" />} label={recipesLabel ?? t.recipes} hint={t.hint_recipes} onClick={handleRecipes} darkMode={darkMode} />
                </div>
              </div>
            </MenuShell>
          </div>
          {isDesktop && sep}
        </div>,
        slot,
      )}
      <ConfirmModal open={confirmOpen} onCancel={() => setConfirmOpen(false)} onConfirm={handleEmptyConfirm} t={t} darkMode={darkMode} />
      {showInventory && (
        <InventoryPanel
          lang={lang}
          darkMode={darkMode}
          focusSearch={inventorySearchFirst}
          onClose={() => setShowInventory(false)}
          onEmptyRequest={() => { if (hasStock) setConfirmOpen(true) }}
        />
      )}
    </>
  )
}
