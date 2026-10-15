import { useMemo, useState } from 'react'
import { LuTrash2, LuCheck, LuShoppingBag, LuArrowLeft } from 'react-icons/lu'
import { useConfirm } from '@shared/ui/confirm-dialog/confirm-provider'
import { suffixS } from '@shared/lib/i18n/pluralize'
import { formatPrix } from '@shared/lib/i18n/prix'

const I18N = {
  fr: {
    doneCta: "J’ai fait mes courses !",
    doneCtaPartial: "Valider ce que j’ai acheté",
    doneHint: 'Transfère les articles achetés dans ton frigo et vide la liste.',
    allCheckedTitle: 'Récapitulatif',
    partialTitle: 'Articles cochés',
    notAllChecked: (n, total) => `${total - n} article${total - n > 1 ? 's' : ''} non acheté${total - n > 1 ? 's' : ''} — resteront dans ton panier pour la prochaine fois.`,
    totalLabel: 'Total estimé',
    itemsLabel: (n) => `${n} article${n > 1 ? 's' : ''} achetés`,
    emptyTitle: 'Ton panier est vide',
    emptyHint: 'Retourne en « Préparer » pour ajouter des articles.',
    andMore: (n) => `+ ${n} autre${n > 1 ? 's' : ''}`,
    collapse: 'Voir moins',
    miscLabel: 'Articles divers',
    fridgeNote: (n) => `✅ ${n} ingrédient${n > 1 ? 's' : ''} ${n > 1 ? 'seront ajoutés' : 'sera ajouté'} à ton frigo`,
    clearEmergency: 'Vider sans transférer',
    clearConfirm: 'Vider le panier sans transférer au frigo ?',
    clearOk: 'Vider le panier',
    echecFrigo: "Rien n’est passé au frigo : tes articles sont toujours dans le panier. Réessaie.",
    echecPanier: "Tes articles sont au frigo, mais n’ont pas pu être retirés du panier. Réessaie.",
  },
  en: {
    doneCta: "I’m done shopping!",
    doneCtaPartial: "Validate what I bought",
    doneHint: 'Transfers purchased items to your fridge and empties the list.',
    allCheckedTitle: 'Summary',
    partialTitle: 'Checked items',
    notAllChecked: (n, total) => `${total - n} item${suffixS(total - n, 'en')} not bought — will stay in your cart for next time.`,
    totalLabel: 'Estimated total',
    itemsLabel: (n) => `${n} item${suffixS(n, 'en')} bought`,
    emptyTitle: 'Your cart is empty',
    emptyHint: 'Go back to "Prepare" to add items.',
    andMore: (n) => `+ ${n} more`,
    collapse: 'Show less',
    miscLabel: 'Misc items',
    fridgeNote: (n) => `✅ ${n} ingredient${suffixS(n, 'en')} will be added to your fridge`,
    clearEmergency: 'Empty without transferring',
    clearConfirm: 'Empty the cart without transferring to the fridge?',
    clearOk: 'Empty the cart',
    echecFrigo: 'Nothing went into your fridge: your items are still in your cart. Try again.',
    echecPanier: 'Your items are in your fridge, but could not be removed from your cart. Try again.',
  },
}

function ItemRow({ item, cardBorder, muted }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-t" style={{ borderColor: cardBorder }}>
      <span
        className="w-4 h-4 rounded-[4px] flex items-center justify-center flex-shrink-0 text-white text-[10px]"
        style={{ background: '#16A34A' }}
        aria-hidden="true"
      >✓</span>
      <span className="flex-1 text-[12px] line-through" style={{ color: muted }}>{item.label}</span>
    </div>
  )
}

function GroupCard({ group, cardBg, cardBorder, fg, muted, chipBg, t }) {
  const MAX_SHOWN = 3
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? group.items : group.items.slice(0, MAX_SHOWN)
  const rest = group.items.length - MAX_SHOWN
  return (
    <div className="rounded-[12px] border overflow-hidden" style={{ background: cardBg, borderColor: cardBorder }}>
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        <span className="text-xl" aria-hidden="true">{group.emoji}</span>
        <p className="text-[12px] font-bold truncate" style={{ color: fg }}>{group.name}</p>
        <span className="ml-auto text-[10px] font-semibold rounded-[5px] px-1.5 py-0.5" style={{ background: chipBg, color: muted }}>
          {group.items.length}
        </span>
      </div>
      {shown.map(item => <ItemRow key={item.id} item={item} cardBorder={cardBorder} muted={muted} />)}
      {rest > 0 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full text-[11px] text-center py-2 border-t bg-transparent border-x-0 border-b-0 cursor-pointer min-h-[36px]"
          style={{ color: '#D46A10', borderColor: cardBorder }}
        >
          {expanded ? t.collapse : t.andMore(rest)}
        </button>
      )}
    </div>
  )
}

// HomePhase — Phase 3 : valider les courses et transférer au frigo.
// Le bouton CTA est toujours actif (même si tout n'est pas coché) :
// les articles non cochés sont auto-sauvegardés en liste « En attente ».
export default function HomePhase({
  basket = [],
  lang = 'fr',
  darkMode = false,
  onCompleteShopping,
  onClearBasket,
}) {
  const t = I18N[lang] ?? I18N.fr
  const confirm = useConfirm()
  const [loading, setLoading] = useState(false)
  // L'échec de « J'ai fait mes courses » se dit (audit du 2026-10-04) :
  // 'frigo' = rien n'est passé, 'panier' = au frigo mais encore au panier.
  const [echec, setEchec] = useState(null)

  const checkedItems  = basket.filter(i => i.checked)
  const uncheckedItems = basket.filter(i => !i.checked)
  const allDone = basket.length > 0 && uncheckedItems.length === 0
  const isEmpty = basket.length === 0

  const fg       = darkMode ? '#E8EEF5' : '#1a0e00'
  const muted    = darkMode ? '#7A90A8' : '#8A6A60'
  const cardBg   = darkMode ? '#131E2C' : '#fff'
  const cardBorder = darkMode ? '#1A2A3D' : 'rgba(0,0,0,0.08)'
  const chipBg   = darkMode ? '#1A2A3D' : '#F5EDE0'

  const { recipeGroups, manualCheckedItems } = useMemo(() => {
    const map = new Map()
    const manual = []
    for (const item of checkedItems) {
      if (!item.recipe_id) { manual.push(item); continue }
      if (!map.has(item.recipe_id)) {
        map.set(item.recipe_id, { recipe_id: item.recipe_id, emoji: item.recipe_emoji, name: item.recipe_name, items: [] })
      }
      map.get(item.recipe_id).items.push(item)
    }
    return { recipeGroups: [...map.values()], manualCheckedItems: manual }
  }, [checkedItems])

  const checkedPrice = checkedItems.reduce((sum, i) => sum + (i.price ?? 0), 0)
  const uniqueFridgeCount = new Set(checkedItems.map(i => i.ingredient_id).filter(Boolean)).size

  const handleComplete = async () => {
    if (!onCompleteShopping || loading) return
    setLoading(true)
    setEchec(null)
    try {
      const resultat = await onCompleteShopping(basket, {})
      if (resultat?.error) setEchec(resultat.resteAuPanier ? 'panier' : 'frigo')
    } finally {
      setLoading(false)
    }
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="text-5xl" aria-hidden="true">🏠</span>
        <p className="text-[15px] font-bold" style={{ color: fg }}>{t.emptyTitle}</p>
        <p className="text-[13px] max-w-[240px]" style={{ color: muted }}>{t.emptyHint}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Stats récap */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col items-center justify-center rounded-[12px] px-3 py-4 border" style={{ background: cardBg, borderColor: cardBorder }}>
          <LuShoppingBag size={20} style={{ color: '#D46A10', marginBottom: 6 }} />
          <p className="text-[18px] font-black" style={{ color: fg }}>{checkedItems.length}<span className="text-[12px] font-semibold ml-1" style={{ color: muted }}>/ {basket.length}</span></p>
          <p className="text-[11px] font-semibold text-center" style={{ color: muted }}>{t.itemsLabel(checkedItems.length)}</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-[12px] px-3 py-4 border" style={{ background: cardBg, borderColor: cardBorder }}>
          <span className="text-xl mb-1" aria-hidden="true">💶</span>
          <p className="text-[18px] font-black" style={{ color: '#D46A10' }}>
            {checkedPrice > 0 ? formatPrix(checkedPrice, lang, { approx: true }) : '—'}
          </p>
          <p className="text-[11px] font-semibold" style={{ color: muted }}>{t.totalLabel}</p>
        </div>
      </div>

      {/* Résumé articles cochés */}
      {(recipeGroups.length > 0 || manualCheckedItems.length > 0) && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.06em]" style={{ color: muted }}>
            {allDone ? t.allCheckedTitle : t.partialTitle} ({checkedItems.length}/{basket.length})
          </p>
          {recipeGroups.map(group => (
            <GroupCard key={group.recipe_id} group={group} cardBg={cardBg} cardBorder={cardBorder} fg={fg} muted={muted} chipBg={chipBg} t={t} />
          ))}
          {manualCheckedItems.length > 0 && (
            <GroupCard
              group={{ emoji: '🛍️', name: t.miscLabel, items: manualCheckedItems }}
              cardBg={cardBg} cardBorder={cardBorder} fg={fg} muted={muted} chipBg={chipBg} t={t}
            />
          )}
        </div>
      )}

      {/* Info articles non achetés */}
      {uncheckedItems.length > 0 && (
        <div className="flex items-start gap-2 rounded-[10px] px-3 py-2.5 border" style={{ background: darkMode ? '#1A2A3D' : '#FFF7ED', borderColor: '#F7A85E' }}>
          <LuArrowLeft size={14} style={{ color: '#D46A10', marginTop: 1, flexShrink: 0 }} />
          <p className="text-[12px] font-medium" style={{ color: '#D46A10' }}>
            {t.notAllChecked(checkedItems.length, basket.length)}
          </p>
        </div>
      )}

      {/* Note frigo */}
      {uniqueFridgeCount > 0 && (
        <p className="text-[12px] text-center" style={{ color: darkMode ? '#4ADE80' : '#15803D' }}>
          {t.fridgeNote(uniqueFridgeCount)}
        </p>
      )}

      {/* CTA principal */}
      <button
        onClick={handleComplete}
        disabled={loading || checkedItems.length === 0}
        className="flex items-center justify-center gap-2 w-full rounded-[12px] py-4 text-[15px] font-extrabold border-none transition-all min-h-[52px]"
        style={{
          background: checkedItems.length > 0
            ? 'linear-gradient(135deg, #16A34A, #15803D)'
            : (darkMode ? '#1A2A3D' : 'rgba(0,0,0,0.08)'),
          color: checkedItems.length > 0 ? 'white' : muted,
          boxShadow: checkedItems.length > 0 ? '0 4px 16px rgba(22,163,74,0.30)' : 'none',
          cursor: checkedItems.length > 0 && !loading ? 'pointer' : 'not-allowed',
          opacity: loading ? 0.7 : 1,
        }}
        aria-disabled={checkedItems.length === 0}
      >
        <LuCheck size={18} />
        {loading ? '…' : (allDone ? t.doneCta : t.doneCtaPartial)}
      </button>

      {echec && (
        <p role="alert" className="text-center text-[13px] font-bold" style={{ color: 'var(--color-danger)' }}>
          {echec === 'panier' ? t.echecPanier : t.echecFrigo}
        </p>
      )}

      <p className="text-center text-[12px]" style={{ color: muted }}>{t.doneHint}</p>

      {/* Vider d'urgence — action destructive minimaliste */}
      <button
        onClick={async () => {
          if (await confirm({ title: t.clearConfirm, confirmLabel: t.clearOk, danger: true })) onClearBasket?.()
        }}
        className="flex items-center justify-center gap-1.5 mx-auto text-[11px] font-medium bg-transparent border-none cursor-pointer py-1"
        style={{ color: darkMode ? '#4A5568' : '#A09080' }}
      >
        <LuTrash2 size={12} />
        {t.clearEmergency}
      </button>
    </div>
  )
}
