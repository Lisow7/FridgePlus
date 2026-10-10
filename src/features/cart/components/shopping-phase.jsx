import { useMemo, useState, useRef, useLayoutEffect } from 'react'
import { LuShare2, LuSquareCheck, LuSquare, LuSave, LuArrowRight, LuEye, LuEyeOff } from 'react-icons/lu'
import { formatQty, toGrams } from '@shared/lib/recipes/recipe-utils'
import { useIngredientLookup } from '@shared/contexts/data-provider'
import CartShareSheet from './cart-share-sheet'
import SaveShoppingListModal from './save-shopping-list-modal'
import {
  AISLE_ORDER, AISLE_BY_SUBCAT, AISLE_EMOJI, AISLE_LABELS,
} from '@features/cart/lib/cart-helpers'

// ─── consolidateItems copié depuis shopping-cart-panel.jsx ─────────────────
// (sera retiré du panel à la suppression finale — Task 11)

const CONSOLIDABLE_PARENTS = new Set(['fr-oeuf'])
const LIQUID_UNITS = new Set(['cl', 'ml', 'L', 'cs', 'cc'])
const TO_CL = { cl: 1, ml: 0.1, L: 100, cs: 1.5, cc: 0.5 }
const SPOON_TO_G = { cs: 15, cc: 5 }

function getConsolidationKey(lookup, ingredientId) {
  if (!ingredientId || !lookup) return null
  const parent = lookup.getCanonicalKey?.(ingredientId)
  return parent && CONSOLIDABLE_PARENTS.has(parent) ? parent : ingredientId
}

function consolidateItems(basket, lookup) {
  const map = new Map()
  basket.forEach(item => {
    const canonical = getConsolidationKey(lookup, item.ingredient_id) ?? item.ingredient_id
    const key = canonical ?? (item.label ?? '').toLowerCase().trim()
    const amount = item.amount ?? 0
    if (!map.has(key)) {
      map.set(key, {
        ingredient_id: item.ingredient_id,
        canonical_id: canonical,
        label: item.label,
        subcat: item.subcat ?? lookup?.getSubCategory?.(item.ingredient_id) ?? null,
        totalAmount: amount,
        unit: item.unit ?? 'g',
        totalPrice: item.price ?? 0,
        isManual: !item.recipe_id,
        checked: !!item.checked,
        ids: [item.id],
      })
      return
    }
    const e = map.get(key)
    if (item.recipe_id) e.isManual = false
    e.ids.push(item.id)
    if (!item.checked) e.checked = false
    if (item.unit === e.unit) {
      e.totalAmount = Math.round((e.totalAmount + amount) * 10) / 10
    } else {
      const bothLiquid = LIQUID_UNITS.has(e.unit) && LIQUID_UNITS.has(item.unit)
      if (bothLiquid) {
        const cA = e.totalAmount * (TO_CL[e.unit] ?? 0)
        const cB = amount * (TO_CL[item.unit] ?? 0)
        e.totalAmount = Math.round((cA + cB) * 10) / 10
        e.unit = 'cl'
      } else {
        const gA = toGrams(e.totalAmount, e.unit, e.ingredient_id) || (SPOON_TO_G[e.unit] ?? 0) * e.totalAmount
        const gB = toGrams(amount, item.unit, item.ingredient_id) || (SPOON_TO_G[item.unit] ?? 0) * amount
        if (gA > 0 && gB > 0) {
          e.totalAmount = Math.round((gA + gB) * 10) / 10
          e.unit = 'g'
        } else {
          e.totalAmount = Math.round((e.totalAmount + amount) * 10) / 10
        }
      }
    }
    e.totalPrice = Math.round((e.totalPrice + (item.price ?? 0)) * 100) / 100
  })
  return [...map.values()].map(e => {
    if ((e.unit === 'cs' || e.unit === 'cc') && SPOON_TO_G[e.unit]) {
      return { ...e, totalAmount: Math.round(e.totalAmount * SPOON_TO_G[e.unit]), unit: 'g' }
    }
    return e
  })
}

function buildAisleGroups(rows) {
  const byAisle = new Map(AISLE_ORDER.map(a => [a, []]))
  rows.forEach(row => {
    const aisle = AISLE_BY_SUBCAT[row.subcat] ?? 'other'
    byAisle.get(aisle)?.push(row)
  })
  return AISLE_ORDER
    .map(aisle => ({ aisle, rows: byAisle.get(aisle) ?? [] }))
    .filter(g => g.rows.length > 0)
}

const I18N = {
  fr: {
    progress: (x, y) => `${x} / ${y} cochés`,
    done: 'Courses terminées !',
    share: 'Partager',
    save: 'Enregistrer',
    checkAll: 'Tout cocher',
    uncheckAll: 'Tout décocher',
    hideChecked: 'Cacher les cochés',
    showChecked: 'Afficher les cochés',
    remaining: (n) => `${n} restant${n > 1 ? 's' : ''}`,
    validateAll: 'J’ai tout acheté → Rentrer',
    validatePartial: 'Valider ce que j’ai acheté →',
    noItems: 'Aucun article à cocher',
    noItemsHint: 'Ajoute des articles ou charge une liste depuis l’onglet Préparer.',
    uncheck: 'Décocher',
    check: 'Cocher',
  },
  en: {
    progress: (x, y) => `${x} / ${y} checked`,
    done: 'Shopping done!',
    share: 'Share',
    save: 'Save',
    checkAll: 'Check all',
    uncheckAll: 'Uncheck all',
    hideChecked: 'Hide checked',
    showChecked: 'Show checked',
    remaining: (n) => `${n} left`,
    validateAll: 'All bought → Go home',
    validatePartial: 'Validate what I bought →',
    noItems: 'No items to check off',
    noItemsHint: 'Add items or load a list from the Prepare tab.',
    uncheck: 'Uncheck',
    check: 'Check',
  },
}

// ShoppingPhase — Phase 2 : cocher les articles rayon par rayon.
// Usage mobile one-hand au caddie. Groupement par rayon (parcours logique),
// feedback cocher/décocher, barre de progression aria-live.
export default function ShoppingPhase({
  basket,
  lang = 'fr',
  darkMode = false,
  userId,
  ingredientsById,
  onToggleItem,
  onGoToHome,
  onSaveList,
}) {
  const lookup = useIngredientLookup()
  const t = I18N[lang] ?? I18N.fr
  const aisleLabels = AISLE_LABELS[lang] ?? AISLE_LABELS.fr
  const [shareOpen, setShareOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [hideChecked, setHideChecked] = useState(false)

  // La barre de progression est `position: fixed` (repère viewport), tandis que
  // les en-têtes de rayon sont `position: sticky` → leur `top` est mesuré depuis
  // le content-box du conteneur de scroll (<main>, qui a un padding-top). Coder
  // le `top` en dur (217px) ignorait ce padding → les en-têtes se collaient ~96px
  // trop bas et recouvraient la 1re ligne du rayon. On mesure donc l'offset réel
  // = bas de la barre fixed − haut du content-box du scroller. Robuste aux
  // breakpoints, à la hauteur de la barre (locale) et au padding du layout.
  const progressBarRef = useRef(null)
  const [stickyTop, setStickyTop] = useState(217)
  useLayoutEffect(() => {
    const compute = () => {
      const pb = progressBarRef.current
      if (!pb) return
      const scroller = pb.closest('main') ?? document.scrollingElement
      const cs = getComputedStyle(scroller)
      const contentTop = scroller.getBoundingClientRect().top + parseFloat(cs.paddingTop || '0')
      setStickyTop(Math.max(0, Math.round(pb.getBoundingClientRect().bottom - contentTop)))
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [lang])

  const consolidated = useMemo(() => consolidateItems(basket, lookup), [basket, lookup])
  const aisleGroups = useMemo(() => buildAisleGroups(consolidated), [consolidated])
  // Filtre « cacher les cochés » : masque les lignes cochées et les rayons vidés.
  const visibleGroups = useMemo(
    () => hideChecked
      ? aisleGroups.map(g => ({ ...g, rows: g.rows.filter(r => !r.checked) })).filter(g => g.rows.length > 0)
      : aisleGroups,
    [aisleGroups, hideChecked]
  )

  // Payload du lien partageable (page publique + QR code) : lignes consolidées
  // par rayon, sans PII. emoji résolu depuis le référentiel ingrédients.
  const shareRows = useMemo(
    () => aisleGroups.flatMap(({ aisle, rows }) =>
      rows.map(row => ({
        label: row.label,
        emoji: ingredientsById?.get?.(row.canonical_id ?? row.ingredient_id)?.emoji ?? '🛒',
        amount: row.totalAmount,
        unit: row.unit,
        price: row.totalPrice ?? 0,
        aisle,
      }))
    ),
    [aisleGroups, ingredientsById]
  )
  const shareTotal = useMemo(
    () => Math.round(consolidated.reduce((s, r) => s + (r.totalPrice ?? 0), 0) * 100) / 100,
    [consolidated]
  )

  const total = consolidated.length
  const checked = consolidated.filter(r => r.checked).length
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0
  const allDone = total > 0 && checked >= total

  const fg = darkMode ? '#E8EEF5' : '#1a0e00'
  const muted = darkMode ? '#7A90A8' : '#8A6A60'

  const handleToggleRow = (row) => {
    row.ids.forEach(id => onToggleItem?.(id, !row.checked))
  }

  const handleToggleAll = () => {
    if (allDone) {
      // Tout décocher
      consolidated.filter(r => r.checked).forEach(row => handleToggleRow(row))
    } else {
      // Tout cocher
      consolidated.filter(r => !r.checked).forEach(row => handleToggleRow(row))
    }
  }

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="text-4xl" aria-hidden="true">🛒</span>
        <p className="text-[14px] font-semibold" style={{ color: muted }}>
          {t.noItems}
        </p>
        <p className="text-[12px] max-w-[240px]" style={{ color: muted, opacity: 0.7 }}>
          {t.noItemsHint}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Barre de progression — fixed sous le stepper (top 150/158px) */}
      <div
        ref={progressBarRef}
        className="fixed top-[150px] lg:top-[158px] left-0 right-0 z-30 px-4 py-2 border-b"
        style={{
          background: darkMode ? '#0F1923' : '#EDE0D0',
          borderColor: darkMode ? '#1A2A3D' : 'rgba(0,0,0,0.08)',
        }}
      >
        <div className="max-w-[680px] mx-auto flex flex-col gap-1">
          <div
            className="h-1.5 rounded-[4px] overflow-hidden"
            style={{ background: darkMode ? '#1A2A3D' : 'rgba(0,0,0,0.07)' }}
          >
            <div
              className="h-full rounded-[4px] transition-all duration-300"
              style={{
                width: `${pct}%`,
                background: allDone
                  ? 'linear-gradient(90deg,#16A34A,#4ADE80)'
                  : 'linear-gradient(90deg,#D46A10,#F7A85E)',
              }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t.progress(checked, total)}
            />
          </div>
          <div className="flex items-center justify-between">
            <p
              className="text-[11px] font-semibold"
              style={{ color: allDone ? '#15803D' : muted }}
              aria-live="polite"
              aria-atomic="true"
            >
              {allDone ? `✅ ${t.done}` : `${t.progress(checked, total)} · ${t.remaining(total - checked)}`}
            </p>
            <div className="flex items-center gap-2">
              {checked > 0 && !allDone && (
                <button
                  onClick={() => setHideChecked(v => !v)}
                  aria-pressed={hideChecked}
                  className="flex items-center gap-1 text-[11px] font-semibold cursor-pointer bg-transparent border-none min-h-[32px] px-1"
                  style={{ color: muted }}
                >
                  {hideChecked ? <><LuEye size={13} />{t.showChecked}</> : <><LuEyeOff size={13} />{t.hideChecked}</>}
                </button>
              )}
              <button
                onClick={handleToggleAll}
                className="flex items-center gap-1 text-[11px] font-semibold cursor-pointer bg-transparent border-none min-h-[32px] px-1"
                style={{ color: allDone ? '#7A90A8' : '#D46A10' }}
              >
                {allDone
                  ? <><LuSquare size={13} />{t.uncheckAll}</>
                  : <><LuSquareCheck size={13} />{t.checkAll}</>
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer compensant la progress bar fixed (py-2×2 + h-1.5 + gap-1 + min-h-32 + border = 59px) */}
      <div aria-hidden="true" className="h-[59px]" />

      {/* Rayons */}
      {visibleGroups.map(({ aisle, rows }) => (
        <div key={aisle} className="flex flex-col gap-2">
          {/* En-tête de rayon sticky — z-20 < progress bar (z-30) pour glisser
              SOUS la barre quand il est poussé hors écran au scroll (et non
              par-dessus). `top` mesuré (cf. stickyTop) pour se caler pile sous
              la barre fixed. Reste au-dessus des lignes (statiques, z auto). */}
          <div
            className="sticky z-20 -mx-4 px-4 pt-2 pb-1.5"
            style={{
              top: stickyTop,
              background: darkMode ? '#0B1420' : '#F5EDE0',
              borderBottom: `1.5px solid ${darkMode ? 'rgba(212,106,16,0.25)' : 'rgba(212,106,16,0.30)'}`,
            }}
          >
            <p
              className="text-[12px] font-black uppercase tracking-[0.08em] flex items-center gap-1.5"
              style={{ color: '#D46A10' }}
            >
              <span className="text-[15px] leading-none" aria-hidden="true">{AISLE_EMOJI[aisle]}</span>
              {aisleLabels[aisle]}
            </p>
          </div>
          {rows.map(row => {
            const rowKey = row.canonical_id ?? row.ingredient_id ?? row.label
            return (
              <div
                key={rowKey}
                className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 border transition-opacity"
                style={{
                  background: darkMode ? '#131E2C' : '#fff',
                  borderColor: darkMode ? '#1A2A3D' : 'rgba(0,0,0,0.07)',
                  opacity: row.checked ? 0.45 : 1,
                }}
              >
                {/* Checkbox */}
                <button
                  onClick={() => handleToggleRow(row)}
                  role="checkbox"
                  aria-checked={row.checked}
                  aria-label={`${row.checked ? t.uncheck : t.check} ${row.label}`}
                  className="w-5 h-5 rounded-[6px] flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors min-w-[20px]"
                  style={{
                    background: row.checked ? '#16A34A' : 'transparent',
                    border: row.checked ? '2px solid #16A34A' : '2px solid #D46A10',
                    color: 'white',
                  }}
                >
                  {row.checked && <span className="text-[11px] leading-none">✓</span>}
                </button>

                {/* Label */}
                <span
                  className="flex-1 text-[13px] font-medium"
                  style={{
                    color: fg,
                    textDecorationLine: row.checked ? 'line-through' : 'none',
                  }}
                >
                  {row.label}
                </span>

                {/* Quantité */}
                {row.totalAmount > 0 && (
                  <span
                    className="text-[11px] font-semibold rounded-[6px] px-2 py-0.5 flex-shrink-0"
                    style={{
                      color: muted,
                      background: darkMode ? '#1A2A3D' : '#F5EDE0',
                    }}
                  >
                    {row.unit === 'pcs'
                      ? `×${row.totalAmount}`
                      : (formatQty(row.totalAmount, row.unit, lang) ?? `${row.totalAmount} ${row.unit}`)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ))}

      {/* Actions secondaires : partager + sauvegarder */}
      <div className="flex gap-2">
        <button
          onClick={() => setShareOpen(true)}
          className="flex flex-1 items-center justify-center gap-2 rounded-[10px] py-3 text-[13px] font-semibold border cursor-pointer min-h-[44px]"
          style={{
            background: darkMode ? '#131E2C' : '#fff',
            borderColor: darkMode ? '#1A2A3D' : 'rgba(0,0,0,0.08)',
            color: muted,
          }}
        >
          <LuShare2 size={15} />
          {t.share}
        </button>
        {onSaveList && (
          <button
            onClick={() => setSaveOpen(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-[10px] py-3 text-[13px] font-semibold border cursor-pointer min-h-[44px]"
            style={{
              background: darkMode ? '#131E2C' : '#fff',
              borderColor: darkMode ? '#1A2A3D' : 'rgba(0,0,0,0.08)',
              color: muted,
            }}
          >
            <LuSave size={15} />
            {t.save}
          </button>
        )}
      </div>

      {/* CTA principal → étape suivante */}
      {onGoToHome && (
        <button
          onClick={onGoToHome}
          className="flex items-center justify-center gap-2 w-full rounded-[12px] py-4 text-[15px] font-extrabold border-none cursor-pointer min-h-[52px] transition-all"
          style={{
            background: allDone
              ? 'linear-gradient(135deg, #16A34A, #15803D)'
              : 'var(--gradient-deep)',
            color: 'white',
            boxShadow: allDone
              ? '0 4px 16px rgba(22,163,74,0.30)'
              : '0 4px 16px rgba(212,106,16,0.30)',
          }}
        >
          {allDone ? t.validateAll : t.validatePartial}
          <LuArrowRight size={18} />
        </button>
      )}

      <CartShareSheet
        open={shareOpen}
        lang={lang}
        darkMode={darkMode}
        onClose={() => setShareOpen(false)}
        userId={userId}
        shareRows={shareRows}
        shareTotal={shareTotal}
      />

      {saveOpen && (
        <SaveShoppingListModal
          lang={lang}
          darkMode={darkMode}
          itemsCount={basket.length}
          isEmpty={basket.length === 0}
          onConfirm={(name) => { onSaveList?.(name); setSaveOpen(false) }}
          onClose={() => setSaveOpen(false)}
        />
      )}
    </div>
  )
}
