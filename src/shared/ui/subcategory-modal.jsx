import { useRef, useState } from 'react'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import Emoji from '@shared/ui/emoji'
import FoodIcon from '@shared/ui/food-icon'
import { FOOD_ICONS } from '@shared/static/icon-map'
import { SUBCATEGORY_COLORS } from '@shared/static/subcategory-colors'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import { useIngredientsById } from '@shared/contexts/data-provider'
import { resolveAllergens } from '@shared/lib/ingredients/ingredient-resolver'

const COLORS = {
 freezer: { bg: '#E8F4F8', text: '#5B9AAE' },
 fresh: { bg: '#E8F5E9', text: '#7BB078' },
 leftovers: { bg: '#F5F5F5', text: '#9E9E9E' },
 vegetable: { bg: '#F1F5E8', text: '#6B8E23' },
 crisper: { bg: '#F1F5E8', text: '#6B8E23' },
 dry: { bg: '#FEF8E8', text: '#C4A555' },
 spices: { bg: '#F5E6D3', text: '#B8751A' },
}

const EMPTY_EMOJIS = { today: '📅', thisweek: '🗓️' }

// Pseudo-groupe des ingrédients sans group_id : dans un bac qui a des groupes,
// ils suivent le même flow (en-tête pliable) sous « Autres » au lieu de flotter
// en grille orpheline (demande user 2026-08-27). L'id ne peut collisionner avec
// aucun id d'ingrédient (préfixes fr-/vg-/frz-/gp-/sp-…).
const OTHERS_ID = '__others__'

const MODAL_I18N = {
 fr: {
 today: 'Ajoute tes restes du jour ici.',
 thisweek: 'Ajoute tes restes de la semaine ici.',
 default: 'Aucun ingrédient pour cette catégorie.',
 allergenWarning: 'Contient un allergène déclaré',
 othersLabel: 'Autres',
 closeLabel: 'Fermer',
 locale: 'fr',
 },
 en: {
 today: 'Add your leftovers from today here.',
 thisweek: 'Add your leftovers from this week here.',
 default: 'No ingredients for this category.',
 allergenWarning: 'Contains a declared allergen',
 othersLabel: 'Others',
 closeLabel: 'Close',
 locale: 'en',
 },
}

// Tuile d'ingrédient — extraite le 2026-08-28 (audit).
//
// 🔴 Ce bloc était écrit TROIS fois dans ce fichier : branche « groupes »,
// branche « Autres » et branche « sans groupe ». 130 lignes redondantes sur
// 489, soit 27 % du fichier. Et la dérive avait DÉJÀ eu lieu : un `diff` des
// copies montrait un décalage d'animation de 20 ms d'un côté, 28 de l'autre,
// sans raison. La prochaine correction (allergène, image, accessibilité) en
// aurait touché deux sur trois.
//
// ⚠️ Le décalage a été unifié à 28 ms — la valeur des deux copies sur trois.
// C'est un changement VISIBLE, assumé ici plutôt que subi.
function IngredientTile({ item, idx, isSelected, warn, colors, label, allergenTitle, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(item.id)}
      aria-pressed={isSelected}
      className="relative flex flex-col items-center gap-2 rounded-2xl p-3 cursor-pointer select-none"
      style={{
        background: isSelected ? `${colors.text}18` : colors.bg,
        border: `2px solid ${isSelected ? colors.text + '65' : warn ? '#f59e0b55' : 'transparent'}`,
        boxShadow: isSelected ? `0 2px 12px ${colors.text}22` : '0 2px 8px rgba(0,0,0,0.07)',
        animation: 'tile-enter 0.3s cubic-bezier(0.4,0,0.2,1) both',
        animationDelay: `${idx * 28}ms`,
        transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {isSelected && (
        <div style={{
          position: 'absolute', top: '6px', right: '6px',
          width: '16px', height: '16px', borderRadius: '50%',
          background: colors.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '9px', color: 'white', fontWeight: 700,
        }}>✓</div>
      )}
      {warn && (
        <div style={{
          position: 'absolute', top: '5px', left: '5px',
          fontSize: '11px', lineHeight: 1,
          filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))',
        }} title={allergenTitle}>⚠️</div>
      )}
      <Emoji char={item.emoji} size={28} imageUrl={item.image_url} />
      <span className="text-[11px] font-semibold text-center leading-tight" style={{ color: colors.text }}>
        {label}
      </span>
    </button>
  )
}

function buildGrouped(ingredients, getLabel, locale) {
 const all = ingredients ?? []
 const parentIds = new Set(all.filter(i => i.group_id).map(i => i.group_id))
 const parents = all.filter(i => parentIds.has(i.id))
 const childrenByParent = {}
 const childIds = new Set()
 for (const ing of all) {
 if (!ing.group_id) continue
 childIds.add(ing.id)
 if (!childrenByParent[ing.group_id]) childrenByParent[ing.group_id] = []
 childrenByParent[ing.group_id].push(ing)
 }
 const standalone = all.filter(i => !i.group_id && !parentIds.has(i.id))
 parents.sort((a, b) => getLabel(a).localeCompare(getLabel(b), locale, { sensitivity: 'base' }))
 for (const arr of Object.values(childrenByParent)) {
 arr.sort((a, b) => getLabel(a).localeCompare(getLabel(b), locale, { sensitivity: 'base' }))
 }
 standalone.sort((a, b) => getLabel(a).localeCompare(getLabel(b), locale, { sensitivity: 'base' }))
 return { parents, childrenByParent, standalone, parentIds }
}

export default function SubcategoryModal({ compartment, subcategory, ingredients, stock, onToggle, onClose, lang = 'fr', darkMode = false, allergenPrefs = [] }) {
 const t = MODAL_I18N[lang] ?? MODAL_I18N.fr
 const windowWidth = useWindowWidth()
 const isMobile = windowWidth < 768
 const colors = SUBCATEGORY_COLORS[subcategory.id] ?? COLORS[compartment.id] ?? { bg: '#F0F0F0', text: '#777' }
 const scrollRef = useRef(null)
 const [showScrollTop, setShowScrollTop] = useState(false)
 const ingredientsById = useIngredientsById()
 const getLabel = (item) => item.labels?.[lang] ?? item.label ?? ''
 const hasAllergen = (id) => allergenPrefs.length > 0 && resolveAllergens(id, ingredientsById).some(a => allergenPrefs.includes(a))
 const { parents, childrenByParent, standalone } = buildGrouped(ingredients, getLabel, t.locale)
 const allItems = ingredients ?? []
 const emptyText = t[subcategory.id] ?? t.default
 const emptyEmoji = EMPTY_EMOJIS[subcategory.id] ?? '🗂️'
 const selectedCount = allItems.filter(item => stock.has(item.id)).length
 const hasGroups = parents.length > 0
 const [expandedGroups, setExpandedGroups] = useState(() => new Set([...parents.map(p => p.id), OTHERS_ID]))
 const toggleGroup = (id) => setExpandedGroups(prev => {
 const next = new Set(prev)
 next.has(id) ? next.delete(id) : next.add(id)
 return next
 })

 // Focus trap a11y. Remplace l'Escape window-level.
 const dialogRef = useRef(null)
 useFocusTrap(dialogRef, { active: true, onEscape: onClose })
 useCloseOnBackButton(true, onClose)

 return (
 <div
 className={`fixed inset-0 z-50 flex fp-modal-backdrop ${isMobile ? 'items-end' : 'items-center justify-center p-6'}`}
 style={{
 background: isMobile ? 'rgba(18,10,4,0.32)' : 'rgba(18,10,4,0.50)',
 backdropFilter: isMobile ? 'blur(3px)' : 'blur(7px)',
 }}
 onClick={onClose}
 >
 <div
 ref={dialogRef}
 role="dialog"
 aria-modal="true"
 aria-label={subcategory?.label?.[lang] ?? subcategory?.label?.fr ?? 'Sous-catégorie'}
 className={`relative overflow-hidden ${!isMobile ? 'fp-modal-panel' : ''}`}
 style={{
 ...(isMobile
 ? { width: '100%', height: '88dvh', borderRadius: '22px 22px 0 0', boxShadow: '0 -6px 36px rgba(0,0,0,0.16)' }
 : { width: '500px', maxHeight: '78dvh', borderRadius: '24px', boxShadow: '0 8px 48px rgba(0,0,0,0.22)' }
 ),
 background: darkMode ? '#131E2C' : '#FDFAF6',
 animation: isMobile
 ? 'panel-slide-up 0.38s cubic-bezier(0.34,1.06,0.64,1) both'
 : undefined,
 display: 'flex',
 flexDirection: 'column',
 }}
 onClick={(e) => e.stopPropagation()}
 >
 {isMobile && (
 <div style={{
 width: '36px', height: '4px', borderRadius: '2px',
 background: colors.text + '38',
 margin: '10px auto 2px',
 flexShrink: 0,
 }} />
 )}

 {/* Header */}
 <div
 className="flex items-center gap-3 px-6 py-4 shrink-0"
 style={{ background: colors.bg, borderBottom: `1px solid ${colors.text}20` }}
 >
 {FOOD_ICONS[subcategory.id]
 ? <FoodIcon id={subcategory.id} size={36} color={colors.text} />
 : <Emoji char={subcategory.emoji} size={36} />
 }
 <div className="flex flex-col">
 <span className="text-xs font-medium opacity-55" style={{ color: colors.text }}>
 {compartment.label}
 </span>
 <span className="text-xl font-bold leading-tight" style={{ color: colors.text }}>
 {subcategory.label}
 </span>
 </div>

 {selectedCount > 0 && (
 <div
 className="ml-2 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold"
 style={{ background: colors.text + '18', color: colors.text }}
 >
 <span>✓</span>
 <span>{selectedCount} / {allItems.length}</span>
 </div>
 )}

 <button
 onClick={onClose}
 aria-label={t.closeLabel}
 className="close-x ml-auto text-lg opacity-35 px-2"
 style={{ color: colors.text }}
 >
 ✕
 </button>
 </div>

 {/* Grille */}
 <div
 ref={scrollRef}
 className="overflow-y-auto p-4 flex-1"
 onScroll={e => setShowScrollTop(e.currentTarget.scrollTop > 80)}
 >
 {allItems.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-14 gap-3 opacity-40">
 <Emoji char={emptyEmoji} size={48} />
 <p className="text-sm text-center text-[var(--color-muted)]">
 {emptyText}
 </p>
 </div>
 ) : hasGroups ? (
 <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
 {/* Groupes */}
 {parents.map(parent => {
 const children = childrenByParent[parent.id] ?? []
 const isExpanded = expandedGroups.has(parent.id)
 const childInStock = children.filter(c => stock.has(c.id)).length
 const cols = isMobile ? 3 : 4
 return (
 <div key={parent.id}>
 {/* En-tête de groupe — non sélectionnable (le user dit que ça portait à confusion :
     la catégorie générique "Bœuf", "Poisson"… ne se traite plus comme un item stockable
     distinct). La sélection passe par les variantes (Bavette, Entrecôte, etc.).
     Click sur le header = expand/collapse. childInStock reste affiché pour info.
     Note V4 voix : le compteur childInStock peut guider la saisie vocale. */}
 <button
 type="button"
 onClick={() => toggleGroup(parent.id)}
 aria-expanded={isExpanded}
 style={{
 width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
 marginBottom: isExpanded ? '8px' : 0,
 padding: '8px 12px', borderRadius: '14px',
 background: `${colors.text}0A`,
 border: `2px solid ${colors.text}25`,
 transition: 'all 0.2s',
 userSelect: 'none',
 cursor: 'pointer',
 textAlign: 'left',
 }}
 >
 <Emoji char={parent.emoji} size={20} />
 <span style={{ fontSize: '13px', fontWeight: 700, color: colors.text, flex: 1 }}>
 {getLabel(parent)}
 </span>
 {childInStock > 0 && (
 <span style={{
 fontSize: '10px', fontWeight: 700, color: colors.text,
 background: colors.text + '22', borderRadius: '10px', padding: '1px 6px',
 }}>{childInStock}/{children.length}</span>
 )}
 <span
 aria-hidden="true"
 style={{
 width: '24px', height: '24px', borderRadius: '8px',
 background: `${colors.text}12`, flexShrink: 0,
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 color: colors.text, fontSize: '11px',
 transition: 'transform 0.2s',
 transform: isExpanded ? 'rotate(180deg)' : 'none',
 }}
 >
 ▾
 </span>
 </button>
 {/* Grille des variantes */}
 {isExpanded && (
 <div
 style={{
 display: 'grid', gap: '10px',
 gridTemplateColumns: `repeat(${cols}, 1fr)`,
 paddingLeft: '8px',
 borderLeft: `2px solid ${colors.text}20`,
 marginLeft: '6px',
 }}
 >
 {children.map((item, idx) => {
 const isSelected = stock.has(item.id)
 const warn = hasAllergen(item.id)
 return (
 <IngredientTile
 key={item.id}
 item={item}
 idx={idx}
 isSelected={isSelected}
 warn={warn}
 colors={colors}
 label={getLabel(item)}
 allergenTitle={t.allergenWarning}
 onToggle={onToggle}
 />
 )
 })}
 </div>
 )}
 </div>
 )
 })}
 {/* Ingrédients sans groupe : section « Autres », même flow que les groupes */}
 {standalone.length > 0 && (() => {
 const isExpanded = expandedGroups.has(OTHERS_ID)
 const othersInStock = standalone.filter(i => stock.has(i.id)).length
 return (
 <div>
 <button
 type="button"
 onClick={() => toggleGroup(OTHERS_ID)}
 aria-expanded={isExpanded}
 style={{
 width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
 marginBottom: isExpanded ? '8px' : 0,
 padding: '8px 12px', borderRadius: '14px',
 background: `${colors.text}0A`,
 border: `2px solid ${colors.text}25`,
 transition: 'all 0.2s',
 userSelect: 'none',
 cursor: 'pointer',
 textAlign: 'left',
 }}
 >
 <Emoji char="🧺" size={20} />
 <span style={{ fontSize: '13px', fontWeight: 700, color: colors.text, flex: 1 }}>
 {t.othersLabel}
 </span>
 {othersInStock > 0 && (
 <span style={{
 fontSize: '10px', fontWeight: 700, color: colors.text,
 background: colors.text + '22', borderRadius: '10px', padding: '1px 6px',
 }}>{othersInStock}/{standalone.length}</span>
 )}
 <span
 aria-hidden="true"
 style={{
 width: '24px', height: '24px', borderRadius: '8px',
 background: `${colors.text}12`, flexShrink: 0,
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 color: colors.text, fontSize: '11px',
 transition: 'transform 0.2s',
 transform: isExpanded ? 'rotate(180deg)' : 'none',
 }}
 >
 ▾
 </span>
 </button>
 {isExpanded && (
 <div style={{
 display: 'grid', gap: '10px',
 gridTemplateColumns: `repeat(${isMobile ? 3 : 4}, 1fr)`,
 paddingLeft: '8px',
 borderLeft: `2px solid ${colors.text}20`,
 marginLeft: '6px',
 }}>
 {standalone.map((item, idx) => {
 const isSelected = stock.has(item.id)
 const warn = hasAllergen(item.id)
 return (
 <IngredientTile
 key={item.id}
 item={item}
 idx={idx}
 isSelected={isSelected}
 warn={warn}
 colors={colors}
 label={getLabel(item)}
 allergenTitle={t.allergenWarning}
 onToggle={onToggle}
 />
 )
 })}
 </div>
 )}
 </div>
 )
 })()}
 </div>
 ) : (
 <div className={`grid gap-3 ${isMobile ? 'grid-cols-3' : 'grid-cols-4'}`}>
 {standalone.map((item, idx) => {
 const isSelected = stock.has(item.id)
 const warn = hasAllergen(item.id)
 return (
 <IngredientTile
 key={item.id}
 item={item}
 idx={idx}
 isSelected={isSelected}
 warn={warn}
 colors={colors}
 label={getLabel(item)}
 allergenTitle={t.allergenWarning}
 onToggle={onToggle}
 />
 )
 })}
 </div>
 )}
 </div>

 {/* Bouton remonter en haut — centré horizontalement par rapport au modal */}
 <button
 onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
 style={{
 position: 'absolute', bottom: '20px', left: '50%',
 width: '56px', height: '56px', borderRadius: '50%',
 background: 'var(--gradient-deep)',
 boxShadow: '0 4px 16px rgba(200,100,16,0.32)',
 border: 'none', cursor: 'pointer',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 opacity: showScrollTop ? 0.85 : 0,
 pointerEvents: showScrollTop ? 'auto' : 'none',
 transform: showScrollTop ? 'translate(-50%, 0) scale(1)' : 'translate(-50%, 10px) scale(0.85)',
 transition: 'opacity 0.25s ease, transform 0.25s ease',
 zIndex: 10,
 }}
 >
 {[0, 0.9].map((delay, i) => (
 <div key={i} style={{
 position: 'absolute', inset: 0, borderRadius: '50%',
 border: '1.5px solid rgba(224,120,32,0.45)',
 animation: showScrollTop ? `tap-ring 2.2s ease-out ${delay}s infinite` : 'none',
 }} />
 ))}
 <svg width="18" height="18" viewBox="0 0 14 14" fill="none" style={{ position: 'relative', zIndex: 1 }}>
 <path d="M7 11V3M7 3L3.5 6.5M7 3L10.5 6.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
 </svg>
 </button>
 </div>
 </div>
 )
}
