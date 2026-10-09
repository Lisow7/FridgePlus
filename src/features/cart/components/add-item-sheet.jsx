import { useState, useRef } from 'react'
import { LuX, LuSearch, LuSparkles } from 'react-icons/lu'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useConfirm } from '@shared/ui/confirm-dialog/confirm-provider'
import CartManualAdd from './cart-manual-add'
import CartSuggestionsModal from './cart-suggestions-modal'

const I18N = {
  fr: {
    title: 'Ajouter un article',
    closeLabel: 'Fermer',
    tabs: { search: 'Recherche', suggest: 'Suggestions ✨' },
  },
  en: {
    title: 'Add an item',
    closeLabel: 'Close',
    tabs: { search: 'Search', suggest: 'Suggestions ✨' },
  },
}

const TABS = [
  { id: 'search', Icon: LuSearch },
  { id: 'suggest', Icon: LuSparkles },
]

const DUP_I18N = {
  fr: {
    confirm: (label, source) =>
      `${label} déjà dans ton panier via ${source}. Ajouter quand même ?`,
    manualSource: '(ajouté manuellement)',
  },
  en: {
    confirm: (label, source) =>
      `${label} already in your basket via ${source}. Add anyway?`,
    manualSource: '(added manually)',
  },
}

// AddItemSheet — bottom sheet 2 onglets (Recherche / Suggestions).
// Réunit CartManualAdd (recherche + packs) et CartSuggestionsModal.
export default function AddItemSheet({
  open,
  lang = 'fr',
  darkMode = false,
  onClose,
  onAddManualItem,
  onAddToCart,
  onShowRecipes,
  basket,
  userId,
}) {
  const [tab, setTab] = useState('search')
  const t = I18N[lang] ?? I18N.fr
  const tDup = DUP_I18N[lang] ?? DUP_I18N.fr
  const confirm = useConfirm()

  // Wrapper around onAddManualItem that detects duplicates and asks for
  // confirmation before proceeding. Returns early (without calling
  // onAddManualItem) if the user cancels.
  const handleAddWithDupCheck = async (item) => {
    const existing = basket?.find(b => b.ingredient_id === item.ingredient_id)
    if (existing) {
      const source = existing.recipe_name ?? tDup.manualSource
      const ok = await confirm({ title: tDup.confirm(item.label, source) })
      if (!ok) return
    }
    return onAddManualItem?.(item)
  }

  useCloseOnBackButton(open, onClose)
  // Piège de focus + Escape + restitution (audit clavier 2026-08-25) : cette
  // feuille est aria-modal mais son voile n est qu un div cliquable — au
  // clavier, elle était sans issue.
  const sheetRef = useRef(null)
  useFocusTrap(sheetRef, { active: open, onEscape: onClose })

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.title}
        className="fixed left-0 right-0 z-50 rounded-t-[16px] overflow-hidden"
        style={{
          // Reserve la hauteur du bandeau cookies (cf. `use-bottom-inset`).
          // En `bottom-0`, la feuille passait DESSOUS sur mobile et ses
          // controles du bas devenaient inatteignables — le defaut qui a frappe
          // la production deux fois en deux jours.
          bottom: 'var(--fp-bottom-inset, 0px)',
          background: darkMode ? '#0F1923' : '#FDFAF6',
          maxHeight: '85dvh',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: darkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <h2 className="text-base font-bold" style={{ color: darkMode ? '#E8EEF5' : '#1a0e00' }}>{t.title}</h2>
          <button onClick={onClose} aria-label={t.closeLabel} className="p-1 rounded-[8px] bg-transparent border-none cursor-pointer" style={{ color: darkMode ? '#7A90A8' : '#8A6A60' }}>
            <LuX size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-4 pb-3">
          {TABS.map(tabItem => {
            const TabIcon = tabItem.Icon
            return (
              <button
                key={tabItem.id}
                onClick={() => setTab(tabItem.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-bold border-none cursor-pointer transition-colors min-h-[36px]"
                style={{
                  background: tabItem.id === tab ? '#D46A10' : (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
                  color: tabItem.id === tab ? 'white' : (darkMode ? '#7A90A8' : '#6A4F45'),
                }}
              >
                <TabIcon size={13} />
                {t.tabs[tabItem.id]}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-4 pb-6" style={{ maxHeight: 'calc(85dvh - 130px)' }}>
          {tab === 'search' && (
            <CartManualAdd
              lang={lang}
              darkMode={darkMode}
              basket={basket}
              onAdd={handleAddWithDupCheck}
            />
          )}
          {tab === 'suggest' && (
            <CartSuggestionsModal
              lang={lang}
              darkMode={darkMode}
              userId={userId}
              onManualAdd={handleAddWithDupCheck}
              onAddToCart={onAddToCart}
              onShowRecipes={onShowRecipes}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </>
  )
}
