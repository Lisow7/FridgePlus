import { AISLE_ORDER, AISLE_EMOJI, AISLE_LABELS, CONSOLIDABLE_PARENTS, aisleFromSubcat, consolidateForFridge } from '@features/cart/lib/fridge-aisles'
import { useState, useEffect, useMemo, useRef } from 'react'
import { LuX, LuCheck, LuRefrigerator, LuListPlus } from 'react-icons/lu'
import Button from '@shared/ui/button'
import Field from '@shared/ui/field'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import { useIngredients, useIngredientLookup } from '@shared/contexts/data-provider'
import { pluralizeLabel } from '@shared/lib/ingredients/ingredient-lookup'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { createShoppingList } from '@features/cart/api/shopping-lists'


const I18N = {
  fr: {
    title: "J'ai fait mes courses",
    subtitle: 'Sélectionne les ingrédients à ajouter au frigo',
    confirm: (n) => `Ajouter au frigo (${n})`,
    confirmNone: 'Aucun ingrédient sélectionné',
    cancel: 'Annuler',
    close: 'Fermer',
    selectAll: 'Tout sélectionner',
    selectNone: 'Tout désélectionner',
    savePromptTitle: 'Garder ce panier dans « Mes listes » ?',
    savePromptHint: 'Tu pourras la retrouver dans Mes listes pour la réutiliser.',
    saveListLabel: 'Nom de la liste',
    saveListExample: 'ex. : courses du samedi',
    saveAndAdd: 'Sauvegarder et ajouter',
    justAdd: 'Juste ajouter',
    defaultListName: () => {
      const d = new Date()
      return `Courses du ${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}`
    },
  },
  en: {
    title: "I've done my shopping",
    subtitle: 'Pick the ingredients to add to the fridge',
    confirm: (n) => `Add to fridge (${n})`,
    confirmNone: 'No ingredient selected',
    cancel: 'Cancel',
    close: 'Close',
    selectAll: 'Select all',
    selectNone: 'Deselect all',
    savePromptTitle: 'Keep this cart in “My lists”?',
    savePromptHint: 'You can find it later in My lists to reuse it.',
    saveListLabel: 'List name',
    saveListExample: 'e.g. Saturday groceries',
    saveAndAdd: 'Save and add',
    justAdd: 'Just add',
    defaultListName: () => {
      const d = new Date()
      return `Shopping ${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}`
    },
  },
}

export default function AddToFridgeModal({
  basket = [], lang = 'fr', darkMode = false,
  onClose, onConfirm,
  loadedListInfo = null,
  userId = null,
}) {
  const t = I18N[lang] ?? I18N.fr
  const windowWidth = useWindowWidth()
  const isDesktop = windowWidth >= 1024
  const lookup = useIngredientLookup()
  const ingredientsByCat = useIngredients()

  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, { active: true, onEscape: onClose })
  useCloseOnBackButton(true, onClose)

  // Map groupId → [ingredient, ...] pour le sélecteur de variantes.
  const groupVariantsMap = useMemo(() => {
    const map = new Map()
    for (const [catKey, list] of Object.entries(ingredientsByCat ?? {})) {
      // 'bof' = dairy+cheese+eggs fusionnés — déjà couverts par leurs sous-catégories,
      // les inclure ici doublerait chaque variante et provoquerait des clés React dupliquées.
      if (catKey === 'bof') continue
      if (!Array.isArray(list)) continue
      for (const ing of list) {
        if (!ing.group_id) continue
        if (!map.has(ing.group_id)) map.set(ing.group_id, [])
        map.get(ing.group_id).push(ing)
      }
    }
    return map
  }, [ingredientsByCat])

  const groupedRows = useMemo(() => {
    const consolidated = consolidateForFridge(basket, lookup)
    const map = new Map(AISLE_ORDER.map(a => [a, []]))
    for (const row of consolidated) {
      const aisle = aisleFromSubcat(lookup.getSubCategory(row.ingredient_id))
      const ing = lookup.getIngredient(row.ingredient_id)
      const isParent = CONSOLIDABLE_PARENTS.has(row.ingredient_id)

      const rawLabel = lookup.getLabel(row.ingredient_id, lang) ?? row.items[0]?.label
      const totalCount = row.items.reduce(
        (s, it) => s + (it.unit === 'pcs' || it.unit === 'unité' ? (it.amount ?? 0) : 0), 0,
      )
      const label = pluralizeLabel(rawLabel, Math.max(totalCount, 1), lang)

      // Variantes disponibles pour le sélecteur
      let variants = []
      if (isParent) {
        // Groupe consolidé (fr-oeuf) → enfants de ce groupe
        variants = groupVariantsMap.get(row.ingredient_id) ?? []
      } else {
        // Ingrédient avec group_id → fratrie
        const groupId = ing?.group_id
        if (groupId) variants = groupVariantsMap.get(groupId) ?? []
      }

      map.get(aisle)?.push({
        ingredient_id: row.ingredient_id,
        items: row.items,
        emoji: ing?.emoji ?? '📦',
        label,
        variants,
        defaultVariantId: row.firstVariantId,
      })
    }
    for (const list of map.values()) list.sort((a, b) => a.label.localeCompare(b.label))
    return AISLE_ORDER.map(a => ({ aisle: a, rows: map.get(a) ?? [] })).filter(g => g.rows.length > 0)
  }, [basket, lang, lookup, groupVariantsMap])

  const allIds = useMemo(() => groupedRows.flatMap(g => g.rows.map(r => r.ingredient_id)), [groupedRows])
  const [checkedIds, setCheckedIds] = useState(() => new Set(allIds))
  useEffect(() => { setCheckedIds(new Set(allIds)) }, [allIds.join('|')]) // eslint-disable-line

  // variantMap: { [rowIngredientId]: selectedVariantId }
  // Détermine quelle variante précise sera ajoutée au frigo pour chaque ligne.
  const [variantMap, setVariantMap] = useState({})

  // Étape courante : 'select' (liste d'ingrédients) ou 'save-prompt' (proposer de sauvegarder)
  const [step, setStep] = useState('select')
  const [saveListName, setSaveListName] = useState(() => t.defaultListName())
  const [isSaving, setIsSaving] = useState(false)

  const totalChecked = checkedIds.size
  const allChecked = totalChecked === allIds.length && allIds.length > 0

  function toggleId(id) {
    setCheckedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleAll() { setCheckedIds(allChecked ? new Set() : new Set(allIds)) }

  // ID effectif à mettre au frigo pour cette ligne (tenant compte du sélecteur de variantes).
  function getEffectiveId(row) {
    return variantMap[row.ingredient_id] ?? row.defaultVariantId ?? row.ingredient_id
  }

  function buildConfirmPayload() {
    const itemsToRemove = []
    const ingredientIds = []
    for (const g of groupedRows) {
      for (const row of g.rows) {
        if (checkedIds.has(row.ingredient_id)) {
          itemsToRemove.push(...row.items)
          ingredientIds.push(getEffectiveId(row))
        }
      }
    }
    return { ingredientIds, removedItems: itemsToRemove }
  }

  function doConfirm() {
    if (totalChecked === 0) return
    onConfirm(buildConfirmPayload())
  }

  function handleConfirmClick() {
    if (totalChecked === 0) return
    // Proposer de sauvegarder uniquement si le panier ne vient pas d'une liste existante.
    if (!loadedListInfo && userId) {
      setStep('save-prompt')
    } else {
      doConfirm()
    }
  }

  async function handleSaveAndAdd() {
    if (!userId) { doConfirm(); return }
    const name = (saveListName ?? '').trim() || t.defaultListName()
    setIsSaving(true)
    try {
      const snapshot = basket.map(it => ({
        ingredient_id: it.ingredient_id,
        label:         it.label,
        amount:        it.amount,
        unit:          it.unit,
        price:         it.price ?? null,
        checked:       it.checked ?? false,
        recipe_id:            it.recipe_id            ?? null,
        recipe_name:          it.recipe_name          ?? null,
        recipe_emoji:         it.recipe_emoji         ?? null,
        recipe_servings:      it.recipe_servings      ?? null,
        recipe_servings_initial: it.recipe_servings_initial ?? null,
        amount_initial:       it.amount_initial       ?? null,
      }))
      await createShoppingList(userId, name, snapshot)
      doConfirm()
    } finally {
      setIsSaving(false)
    }
  }

  const bg     = darkMode ? '#0F1923' : '#FDFAF6'
  const border = darkMode ? '#2A3A50' : 'var(--color-border-warm)'
  const text   = darkMode ? '#F0E8D8' : '#2A1A0A'
  const muted  = darkMode ? '#8A9EBA' : '#7A6055'
  const aisleLabels = AISLE_LABELS[lang] ?? AISLE_LABELS.fr
  const chipBg = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(18,10,4,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t.title}
        style={{
          position: 'fixed',
          ...(isDesktop ? { top: 0, right: 0, width: '620px', height: '100dvh' } : { inset: 0 }),
          zIndex: 61,
          display: 'flex', flexDirection: 'column',
          background: bg,
          borderLeft: isDesktop ? '3px solid #5BA055' : 'none',
          boxShadow: isDesktop ? (darkMode ? '-8px 0 32px rgba(0,0,0,0.55)' : '-8px 0 32px rgba(0,0,0,0.20)') : 'none',
          animation: isDesktop ? 'panel-slide-in 0.35s cubic-bezier(0.34,1.06,0.64,1) both' : 'panel-slide-up 0.35s cubic-bezier(0.34,1.06,0.64,1) both',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ flexShrink: 0, padding: '20px 22px 14px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <LuRefrigerator size={22} style={{ color: '#5BA055', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: text }}>{t.title}</div>
            <div style={{ fontSize: '14px', color: muted, marginTop: '4px', lineHeight: 1.4 }}>{t.subtitle}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t.close}
            className="h-auto w-auto p-1 opacity-40 hover:opacity-100"
            style={{ color: text }}
          >
            <LuX size={20} />
          </Button>
        </div>

        {/* Body scrollable */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {allIds.length > 1 && (
            <div style={{
              position: 'sticky', top: 0, zIndex: 2,
              padding: '10px 22px',
              background: bg,
              borderBottom: `1px solid ${border}`,
            }}>
              <Button
                variant="link"
                onClick={toggleAll}
                className="h-auto px-0 py-1 text-[13px] font-semibold text-[#5BA055] no-underline hover:underline"
              >
                {allChecked ? t.selectNone : t.selectAll}
              </Button>
            </div>
          )}
          {groupedRows.map(({ aisle, rows }) => (
            <div key={aisle}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 22px',
                position: 'sticky', top: allIds.length > 1 ? '40px' : 0, zIndex: 1,
                background: darkMode ? '#152030' : 'var(--color-bg-warm)',
                borderBottom: `1px solid ${border}`,
                fontSize: '13px', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                color: darkMode ? 'rgba(140,200,130,0.85)' : '#3A6A38',
              }}>
                <span style={{ fontSize: '17px' }}>{AISLE_EMOJI[aisle]}</span>
                <span style={{ flex: 1 }}>{aisleLabels[aisle]}</span>
                <span style={{ fontSize: '15px', fontWeight: 800, color: darkMode ? '#86C97A' : '#5BA055' }}>{rows.length}</span>
              </div>
              {rows.map(row => {
                const isChecked = checkedIds.has(row.ingredient_id)
                const effectiveId = getEffectiveId(row)
                const hasVariants = row.variants.length > 0
                // Label affiché = label de la variante sélectionnée si différente du défaut
                const effectiveIng = hasVariants
                  ? row.variants.find(v => v.id === effectiveId) ?? null
                  : null
                const displayLabel = effectiveIng
                  ? (effectiveIng.labels?.[lang] ?? effectiveIng.labels?.fr ?? row.label)
                  : row.label
                const displayEmoji = effectiveIng?.emoji ?? row.emoji

                return (
                  <div key={row.ingredient_id} style={{ borderBottom: `1px solid ${border}` }}>
                    {/* Ligne principale — coche + emoji + label */}
                    <Button
                      variant="ghost"
                      onClick={() => toggleId(row.ingredient_id)}
                      aria-pressed={isChecked}
                      className="h-auto w-full justify-start rounded-none bg-transparent text-left hover:bg-transparent"
                      style={{
                        gap: '14px',
                        padding: hasVariants ? '11px 22px 6px' : '13px 22px',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(91,160,85,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{
                        width: '22px', height: '22px', borderRadius: '6px',
                        flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isChecked ? '#5BA055' : 'transparent',
                        border: `2px solid ${isChecked ? '#5BA055' : (darkMode ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.30)')}`,
                        transition: 'background 0.15s, border 0.15s',
                      }}>
                        {isChecked && <LuCheck size={14} style={{ color: '#FFF', strokeWidth: 3 }} />}
                      </span>
                      <span style={{ fontSize: '20px', flexShrink: 0 }}>{displayEmoji}</span>
                      <span style={{
                        flex: 1, fontSize: '15px', fontWeight: 500,
                        color: text,
                        opacity: isChecked ? 1 : 0.55,
                        textDecoration: isChecked ? 'none' : 'line-through',
                      }}>
                        {displayLabel}
                      </span>
                    </Button>

                    {/* Sélecteur de variantes — chips avec retour à la ligne */}
                    {hasVariants && (
                      <div style={{
                        padding: '0 22px 10px 58px',
                        display: 'flex', flexWrap: 'wrap', gap: '6px',
                      }}>
                        {row.variants.map(v => {
                          const isSelected = effectiveId === v.id
                          const chipLabel = v.labels?.[lang] ?? v.labels?.fr ?? v.id
                          return (
                            <Button
                              key={v.id}
                              variant="ghost"
                              onClick={() => setVariantMap(prev => ({ ...prev, [row.ingredient_id]: v.id }))}
                              aria-pressed={isSelected}
                              className="h-auto rounded-md border-[1.5px] px-2.5 py-1 text-xs hover:bg-transparent"
                              style={{
                                borderColor: isSelected ? '#5BA055' : (darkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'),
                                background: isSelected ? (darkMode ? 'rgba(91,160,85,0.22)' : 'rgba(91,160,85,0.12)') : chipBg,
                                color: isSelected ? (darkMode ? '#86C97A' : '#3A6A38') : muted,
                                fontWeight: isSelected ? 700 : 400,
                                transition: 'all 0.15s',
                                opacity: isChecked ? 1 : 0.5,
                              }}
                            >
                              {chipLabel}
                            </Button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        {step === 'select' ? (
          <div style={{ flexShrink: 0, padding: '14px 22px', borderTop: `1px solid ${border}`, display: 'flex', gap: '10px' }}>
            <Button
              variant="secondary"
              onClick={onClose}
              className="h-auto flex-1 rounded-[12px] py-[13px] text-sm font-semibold"
              style={{ borderColor: border, color: text }}
            >
              {t.cancel}
            </Button>
            <Button
              onClick={handleConfirmClick}
              disabled={totalChecked === 0}
              className={`h-auto flex-[2] gap-2 rounded-[12px] py-[13px] text-[15px] font-bold ${totalChecked === 0 ? '' : 'bg-[#5BA055] text-white hover:bg-[#4A8E45] hover:opacity-100'}`}
              style={totalChecked === 0 ? { background: darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)', color: muted } : undefined}
            >
              <LuRefrigerator size={17} />
              {totalChecked === 0 ? t.confirmNone : t.confirm(totalChecked)}
            </Button>
          </div>
        ) : (
          /* Étape 2 — proposition de sauvegarde */
          <div style={{
            flexShrink: 0,
            padding: '18px 22px',
            borderTop: `2px solid ${darkMode ? 'rgba(91,160,85,0.35)' : 'rgba(91,160,85,0.30)'}`,
            background: darkMode ? 'rgba(21,32,48,0.95)' : 'rgba(240,248,238,0.98)',
            display: 'flex', flexDirection: 'column', gap: '12px',
          }}>
            {/* Titre + hint */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{
                width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(91,160,85,0.20) 0%, rgba(58,106,56,0.12) 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: darkMode ? '#86C97A' : '#3A6A38',
              }}>
                <LuListPlus size={16} />
              </span>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: text }}>{t.savePromptTitle}</div>
                <div style={{ fontSize: '12px', color: muted, marginTop: '3px', lineHeight: 1.4 }}>{t.savePromptHint}</div>
              </div>
            </div>

            {/* Nom de liste : un libellé visible, le texte grisé en exemple
                (décision du 2026-10-06, « libellés = visibles »). */}
            <Field label={t.saveListLabel} labelStyle={{ display: 'block', fontSize: '12px', fontWeight: 700, color: muted, marginBottom: '6px' }}>
            <input
              type="text"
              value={saveListName}
              onChange={e => setSaveListName(e.target.value)}
              placeholder={t.saveListExample}
              maxLength={80}
              style={{
                width: '100%', padding: '10px 14px',
                borderRadius: '10px',
                border: `1.5px solid ${darkMode ? 'rgba(91,160,85,0.40)' : 'rgba(91,160,85,0.40)'}`,
                background: darkMode ? 'rgba(255,255,255,0.05)' : '#FFF',
                color: text, fontSize: '14px', fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = '#5BA055'}
              onBlur={e => e.target.style.borderColor = darkMode ? 'rgba(91,160,85,0.40)' : 'rgba(91,160,85,0.40)'}
              autoFocus
            />
            </Field>

            {/* Boutons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="ghost"
                onClick={doConfirm}
                disabled={isSaving}
                className="h-auto flex-1 rounded-[10px] border bg-transparent px-3 py-3 text-[13px] font-semibold hover:bg-transparent"
                style={{ borderColor: border, color: text, transition: 'background 0.15s' }}
                onMouseEnter={e => { if (!isSaving) e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {t.justAdd}
              </Button>
              <Button
                onClick={handleSaveAndAdd}
                loading={isSaving}
                disabled={isSaving || !saveListName.trim()}
                className="h-auto flex-[2] rounded-[10px] px-3 py-3 text-sm font-bold"
                style={{
                  gap: '6px',
                  background: (isSaving || !saveListName.trim())
                    ? (darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)')
                    : '#5BA055',
                  color: (isSaving || !saveListName.trim()) ? muted : '#FFF',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!isSaving && saveListName.trim()) e.currentTarget.style.background = '#4A8E45' }}
                onMouseLeave={e => { if (!isSaving && saveListName.trim()) e.currentTarget.style.background = '#5BA055' }}
              >
                {!isSaving && <LuListPlus size={16} />}
                {t.saveAndAdd}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
