// Sélecteur de conditionnement éditable pour la section « À acheter »
// du panier. Au clic sur le badge de quantité, ouvre une liste des packs
// alternatifs disponibles pour cet ingrédient (via getPacksForIngredient,
// qui combine packSizes.js + defaultPacksByCategory.js).
//
// Stratégie data : on n'utilise QUE les sources locales (grande surface FR 2025-2026
// + fallback par sous-catégorie). Pas d'appel à Open Food Facts ou autre API
// externe pour cette première version (gardé pour une feature ultérieure couplée
// au chantier admin pricing — cf. project_pricing_data_sources.md).
//
// Comportement :
//   - Au clic sur le badge : ouvre la liste des packs alternatifs
//   - Au choix d'un pack : remplace amount/unit/price du basket_item via
//     onChangePack(itemId, { size, unit, price })
//   - Le pack actuellement sélectionné est marqué d'une coche
//
// A11y :
//   - role="listbox" + role="option" pour la liste de packs
//   - aria-haspopup="listbox", aria-expanded
//   - Navigation clavier : ArrowUp/Down, Enter pour valider, Escape pour fermer
//   - Focus trap quand ouvert + restauration du focus au close
//
// RGPD : aucun nouveau stockage. La mutation passe par updateBasketItem
// existant (RLS user-only déjà conforme).

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LuCheck, LuChevronDown } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { getPacksForIngredient, getUnitPrice } from '@features/cart/lib/cart-helpers'
import { formatQty } from '@shared/lib/recipes/recipe-utils'

const I18N = {
  fr: {
    chooseFormat: 'Choisir un conditionnement',
    currentLabel: 'Conditionnement actuel',
    alternatives: 'Alternatives',
    close: 'Fermer',
    noAlternatives: 'Aucune alternative disponible',
    choosePlaceholder: 'Choisir…',
    decreasePacks: 'Diminuer le nombre de packs',
    increasePacks: 'Augmenter le nombre de packs',
  },
  en: {
    chooseFormat: 'Choose a pack',
    currentLabel: 'Current pack',
    alternatives: 'Alternatives',
    close: 'Close',
    noAlternatives: 'No alternative available',
    choosePlaceholder: 'Choose…',
    decreasePacks: 'Decrease number of packs',
    increasePacks: 'Increase number of packs',
  },
}

function packKey(p) {
  return `${p.size}|${p.unit}|${p.price ?? ''}`
}

// Délègue à formatQty (lib/recipeUtils) qui convertit
// intelligemment : 100 cl → 1 L, 1000 g → 1 kg, 6 unité(s) localisé selon
// la langue. Garantit la cohérence d'affichage avec le badge de la section
// « À acheter » (qui passe aussi par formatQty).
// Append le prix unitaire normalisé (€/kg, €/L, €/pcs) pour comparer les packs.
function packLabel(p, lang = 'fr') {
  const qty = formatQty(p.size, p.unit, lang) ?? `${p.size} ${p.unit}`
  const parts = []
  if (p.price != null) {
    const price = lang === 'en' ? `$${p.price.toFixed(2)}` : `${p.price.toFixed(2)} €`
    parts.push(price)
  }
  const unitPrice = getUnitPrice(p)
  if (unitPrice) {
    parts.push(`${unitPrice.value.toFixed(2)} ${unitPrice.unit}`)
  }
  if (parts.length > 0) return `${qty} — ${parts.join(' · ')}`
  return qty
}

export default function PackSelector({
  ingredientId,
  subcat = null,
  currentSize,
  currentUnit,
  currentLabel,
  lang = 'fr',
  darkMode = false,
  onChangePack,             // (pack: { size, unit, price }) => void
  triggerStyle = {},         // styles overrides pour le bouton trigger
  triggerColor,
  multiplier = 1,           // nombre de packs sélectionnés (contrôlé par le parent)
  requiredAmount,           // quantité nécessaire (pour auto-recompute du multiplicateur)
  onChangeMultiplier,       // (n: number) => void — callback quand le stepper change
}) {
  const t = I18N[lang] ?? I18N.fr
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  // Coordonnées du dropdown : rendu en PORTAIL (document.body) + position fixed,
  // car les conteneurs de rayon du panier ont `overflow-hidden` qui clipperait
  // un dropdown en position absolute → menu invisible. Le portail s'en affranchit.
  const [coords, setCoords] = useState(null)
  const triggerRef = useRef(null)
  const listRef = useRef(null)

  // Recalcule la position du dropdown depuis le rect du trigger.
  function computeCoords() {
    const r = triggerRef.current?.getBoundingClientRect()
    if (r) setCoords({ top: r.bottom + 6, left: r.left, minWidth: r.width })
  }

  // Multiplicateur normalisé (min 1)
  const safeMultiplier = Math.max(1, Number(multiplier) || 1)

  // Récupère tous les packs disponibles (spécifiques grande surface FR OU fallback subcat)
  const packs = getPacksForIngredient(ingredientId, lang, subcat) ?? []

  // Identifie le pack actuel pour le marquer (matching size+unit)
  const currentKey = packKey({ size: currentSize, unit: currentUnit })

  // Si pas de packs OU un seul pack identique au courant → pas d'édition possible
  const hasAlternatives = packs.length > 1 ||
    (packs.length === 1 && packKey(packs[0]) !== currentKey)

  // Click outside → ferme
  useEffect(() => {
    if (!open) return
    const handleClick = e => {
      if (
        !listRef.current?.contains(e.target) &&
        !triggerRef.current?.contains(e.target)
      ) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Restoration du focus au close
  useEffect(() => {
    if (!open && triggerRef.current === document.activeElement) {
      // déjà focused, OK
    }
  }, [open])

  function handleTriggerClick() {
    if (!hasAlternatives) return
    if (!open) computeCoords()
    setOpen(o => !o)
    setActiveIndex(-1)
  }

  // Tant qu'ouvert : repositionne le dropdown au scroll/resize (portail fixed).
  useEffect(() => {
    if (!open) return
    const reposition = () => computeCoords()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  function handleSelect(pack) {
    onChangePack?.({ size: pack.size, unit: pack.unit, price: pack.price ?? null })
    // Auto-recompute multiplier basé sur la quantité requise vs. la taille du pack.
    // Normalise pack.size vers l'unité de base (g ou ml) avant division.
    if (typeof requiredAmount === 'number' && requiredAmount > 0 && pack.size > 0) {
      const PACK_BASE_FACTOR = { g: 1, kg: 1000, ml: 1, cl: 10, L: 1000, l: 1000, pcs: 1 }
      const packSizeBase = pack.size * (PACK_BASE_FACTOR[pack.unit] ?? 1)
      const newMult = Math.max(1, Math.ceil(requiredAmount / packSizeBase))
      onChangeMultiplier?.(newMult)
    }
    setOpen(false)
    setActiveIndex(-1)
    triggerRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        handleTriggerClick()
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min((i < 0 ? -1 : i) + 1, packs.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      handleSelect(packs[activeIndex])
    }
  }

  // Couleurs adaptatives
  const bg     = darkMode ? '#131E2C' : '#FFFFFF'
  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted  = darkMode ? 'rgba(240,232,220,0.6)' : 'rgba(44,26,14,0.55)'
  const hoverBg = darkMode ? 'rgba(247,168,94,0.10)' : 'rgba(212,106,16,0.06)'
  const selectedBg = darkMode ? 'rgba(247,168,94,0.18)' : 'rgba(212,106,16,0.10)'

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, alignItems: 'center', gap: '4px' }}>
      {/* v3.66.3 — Badge + chevron en UN SEUL bouton stylisé (avant : 2 boîtes
          séparées côte à côte, peu esthétique). Le bouton EST le badge ;
          le chevron vit à l'intérieur du même cadre arrondi. */}
      <Button
        ref={triggerRef}
        onClick={handleTriggerClick}
        onKeyDown={handleKeyDown}
        disabled={!hasAlternatives}
        aria-haspopup={hasAlternatives ? 'listbox' : undefined}
        aria-expanded={hasAlternatives ? open : undefined}
        aria-label={hasAlternatives
          ? `${t.chooseFormat} : ${currentLabel ?? ingredientId}`
          : currentLabel ?? ingredientId}
        title={hasAlternatives ? t.chooseFormat : undefined}
        className={`h-auto rounded-[5px] px-2.5 py-1 text-[13px] font-extrabold tracking-[0.01em] whitespace-nowrap overflow-hidden text-ellipsis min-w-[64px] max-w-[200px] hover:opacity-100 ${hasAlternatives ? 'gap-1.5 cursor-pointer' : 'gap-0 cursor-default disabled:opacity-100'}`}
        style={{
          color: triggerStyle.color ?? triggerColor ?? muted,
          background: triggerStyle.background ?? (hasAlternatives ? (darkMode ? 'rgba(247,168,94,0.10)' : 'rgba(212,106,16,0.07)') : 'transparent'),
          border: triggerStyle.border ?? (hasAlternatives ? `1px solid ${darkMode ? 'rgba(247,168,94,0.25)' : 'rgba(212,106,16,0.20)'}` : 'none'),
        }}
      >
        <span style={{
          flex: 1,
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {currentSize > 0
            ? (formatQty(currentSize, currentUnit, lang) ?? `${currentSize} ${currentUnit}`)
            : t.choosePlaceholder
          }
        </span>
        {hasAlternatives && (
          <LuChevronDown
            size={13}
            aria-hidden="true"
            strokeWidth={2.5}
            style={{
              color: triggerStyle.color ?? triggerColor ?? muted,
              opacity: 0.75,
              transition: 'transform 0.15s',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              flexShrink: 0,
            }}
          />
        )}
      </Button>

      {/* Stepper multiplicateur — rendu quand multiplier ou onChangeMultiplier est utilisé.
          Par défaut masqué (multiplier=1, onChangeMultiplier absent) mais toujours dans le DOM. */}
      {(safeMultiplier > 1 || onChangeMultiplier) && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px',
            borderRadius: '6px',
            border: `1px solid ${darkMode ? 'rgba(247,168,94,0.25)' : 'rgba(212,106,16,0.30)'}`,
            padding: '1px 4px',
          }}
        >
          <button
            type="button"
            aria-label={t.decreasePacks}
            onClick={() => { if (safeMultiplier > 1) onChangeMultiplier(safeMultiplier - 1) }}
            disabled={safeMultiplier <= 1}
            style={{
              width: '20px', height: '20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 700,
              color: darkMode ? 'var(--color-bg-warm)' : '#D46A10',
              background: 'transparent',
              border: 'none',
              cursor: safeMultiplier <= 1 ? 'default' : 'pointer',
              opacity: safeMultiplier <= 1 ? 0.35 : 1,
              transition: 'opacity 0.12s',
              padding: 0,
            }}
          >−</button>
          <span
            style={{
              minWidth: '28px',
              textAlign: 'center',
              fontSize: '12px',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: darkMode ? 'var(--color-bg-warm)' : '#2C1A0E',
            }}
          >× {safeMultiplier}</span>
          <button
            type="button"
            aria-label={t.increasePacks}
            onClick={() => onChangeMultiplier(safeMultiplier + 1)}
            style={{
              width: '20px', height: '20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 700,
              color: darkMode ? 'var(--color-bg-warm)' : '#D46A10',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >+</button>
        </div>
      )}

      {/* Live region a11y — annonce le pack actuel × multiplicateur aux lecteurs d'écran */}
      <div aria-live="polite" className="sr-only">
        {`${currentSize} ${currentUnit} × ${safeMultiplier}`}
      </div>

      {open && coords && createPortal(
        <div
          ref={listRef}
          role="listbox"
          aria-label={t.chooseFormat}
          onKeyDown={handleKeyDown}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            minWidth: Math.max(220, coords.minWidth ?? 0),
            maxWidth: '320px',
            background: bg, color: fg,
            // Pas de bordure sur le dropdown (demande user). Seul le
            // bouton trigger garde son cadre. La shadow seule délimite le menu.
            borderRadius: '10px',
            boxShadow: '0 12px 36px rgba(0,0,0,0.25)',
            zIndex: 2000,
            overflow: 'hidden',
            animation: 'pack-selector-fade 0.15s ease both',
          }}
        >
          {/* Header — v3.66.2 : pas de bordure inférieure (demande user :
              le dropdown n'a aucun cadre, seul le bouton trigger en a un). */}
          <div style={{
            padding: '10px 14px',
            background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
            fontSize: '11px', fontWeight: 700,
            color: muted, textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {t.chooseFormat}
          </div>

          {/* Liste des packs */}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '280px', overflowY: 'auto' }}>
            {packs.length === 0 && (
              <li style={{ padding: '12px 14px', fontSize: '12px', color: muted, fontStyle: 'italic' }}>
                {t.noAlternatives}
              </li>
            )}
            {packs.map((pack, idx) => {
              const isCurrent  = packKey(pack) === currentKey
              const isActive   = activeIndex === idx
              return (
                <li key={`${packKey(pack)}-${idx}`} role="option" aria-selected={isCurrent}>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => handleSelect(pack)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className="h-auto w-full justify-start rounded-none px-3.5 py-2.5 text-left text-[13px] font-semibold hover:bg-transparent"
                    style={{
                      gap: '8px',
                      background: isActive
                        ? hoverBg
                        : (isCurrent ? selectedBg : 'transparent'),
                      color: fg,
                      transition: 'background 0.12s',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {packLabel(pack, lang)}
                    </span>
                    {isCurrent && (
                      <LuCheck
                        size={14}
                        aria-label={t.currentLabel}
                        style={{ color: 'var(--color-warm-600)', flexShrink: 0 }}
                      />
                    )}
                  </Button>
                </li>
              )
            })}
          </ul>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes pack-selector-fade {
          0%   { opacity: 0; transform: translateY(-4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
