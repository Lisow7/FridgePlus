import { useState, useEffect, useMemo, useId } from 'react'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { LuGripVertical, LuTrash2, LuPlus, LuClipboardPaste } from 'react-icons/lu'
import { useIngredients } from '@shared/contexts/data-provider'
import Button from '@shared/ui/button'
import { parseIngredientList } from '@shared/lib/recipes/recipe-ingredient-parser'
import { matchIngredient, buildLabels } from '@shared/lib/recipes/recipe-ingredient-helpers'

// Éditeur d'ingrédients admin (recettes base). Slot = { ids:[], qty:{amount,unit},
// labels:{fr,…}, required }. Remplace la saisie JSON.
//  - Zone « coller » : texte libre → parser FR → lignes structurées + rapprochement
//    catalogue (matchIngredient) + libellé auto (buildLabels) pour les NOUVELLES lignes.
//  - Libellés EXISTANTS jamais réécrits (le champ libellé est éditable à la main ;
//    rien ne l'écrase automatiquement). Réordonnancement dnd.

const DATALIST_ID = 'admin-ingredient-catalog'

const I18N = {
  fr: { paste: 'Coller des ingrédients', pasteDo: 'Importer', add: 'Ajouter un ingrédient',
        ph: 'ex. : 2 oignons, 200 g de farine', search: 'Ingrédient', searchEx: 'ex. : oignon', amt: 'Qté', unit: 'Unité',
        label: 'Libellé affiché', labelEx: 'ex. : 2 oignons émincés', req: 'Requis', del: 'Supprimer', drag: 'Déplacer', toCreate: 'à créer', empty: 'Aucun ingrédient.' },
}

let _iid = 0
const newId = () => `ing-${Date.now()}-${_iid++}`

function flattenCatalog(ingredients) {
  const out = []
  const seen = new Set()
  for (const items of Object.values(ingredients ?? {})) {
    for (const it of items) {
      if (seen.has(it.id)) continue
      seen.add(it.id)
      out.push({ id: it.id, labels: it.labels, emoji: it.emoji })
    }
  }
  return out
}

function IngredientRow({ id, slot, lang, catalog, catalogById, t, darkMode, onUpdate, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const primaryId = slot.ids?.[0] ?? ''
  const matched = !!primaryId && !!catalogById[primaryId]
  const [pick, setPick] = useState(() => catalogById[primaryId]?.labels?.[lang] ?? catalogById[primaryId]?.labels?.fr ?? '')

  const inp = { border: `1px solid ${darkMode ? '#2A3A50' : '#D9CCBA'}`, borderRadius: 7, padding: '5px 7px', background: darkMode ? '#141F2E' : '#FFF', color: darkMode ? '#C8D8E8' : '#1A0F00', fontSize: 13, fontWeight: 400, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }
  // Chaque champ sous son libellé (décision du 2026-10-06, « libellés =
  // visibles ») : une fois rempli, « 200 » et « g » gardent leur nom.
  const legende = { display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, fontWeight: 700, color: 'var(--color-muted)' }

  const resolvePick = (txt) => {
    setPick(txt)
    const exact = catalog.find((c) => (c.labels?.[lang] ?? c.labels?.fr ?? '').toLowerCase() === txt.trim().toLowerCase())
    if (exact) onUpdate(id, { ids: [exact.id] })
  }
  const resolveBlur = () => {
    if (!pick.trim()) return
    const m = matchIngredient(pick, catalog)
    if (m) onUpdate(id, { ids: [m.id] })
  }

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, border: `1px solid ${darkMode ? '#243450' : '#ECE3D5'}`, borderRadius: 9, padding: 7, marginBottom: 6, background: darkMode ? '#0F1923' : '#FFF' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Button variant="ghost" size="icon" aria-label={t.drag} {...attributes} {...listeners} className="h-auto w-auto hover:bg-transparent" style={{ cursor: 'grab', padding: 2, color: 'var(--color-muted)', touchAction: 'none' }}>
          <LuGripVertical size={15} />
        </Button>
        <span title={matched ? 'catalogue' : t.toCreate} style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: matched ? '#2e9e5b' : '#E07820' }} />
        <label style={{ ...legende, flex: '2 1 150px' }}>{t.search}
          <input list={DATALIST_ID} value={pick} placeholder={t.searchEx}
            onChange={(e) => resolvePick(e.target.value)} onBlur={resolveBlur}
            style={{ ...inp, width: '100%' }} />
        </label>
        <label style={legende}>{t.amt}
          <input type="number" step="any" min="0" value={slot.qty?.amount ?? ''}
            onChange={(e) => onUpdate(id, { qty: { ...slot.qty, amount: e.target.value === '' ? null : parseFloat(e.target.value) } })}
            style={{ ...inp, width: 60 }} />
        </label>
        <label style={legende}>{t.unit}
          <input value={slot.qty?.unit ?? ''}
            onChange={(e) => onUpdate(id, { qty: { ...slot.qty, unit: e.target.value } })}
            style={{ ...inp, width: 70 }} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-muted)' }}>
          <input type="checkbox" checked={slot.required !== false} onChange={(e) => onUpdate(id, { required: e.target.checked })} /> {t.req}
        </label>
        <Button variant="ghost" size="icon" onClick={() => onRemove(id)} aria-label={t.del} className="h-auto w-auto hover:bg-transparent" style={{ padding: 4, color: '#D07070', marginLeft: 'auto' }}>
          <LuTrash2 size={14} />
        </Button>
      </div>
      <label style={{ ...legende, marginTop: 5 }}>{t.label}
        <input value={slot.labels?.[lang] ?? ''} placeholder={t.labelEx}
          onChange={(e) => onUpdate(id, { labels: { ...slot.labels, [lang]: e.target.value } })}
          style={{ ...inp, width: '100%', fontSize: 12, color: 'var(--color-muted)' }} />
      </label>
    </div>
  )
}

export default function IngredientsEditor({ ingredients = [], lang = 'fr', onChange, darkMode = false }) {
  const t = I18N.fr
  const rawCatalog = useIngredients()
  const catalog = useMemo(() => flattenCatalog(rawCatalog), [rawCatalog])
  const catalogById = useMemo(() => Object.fromEntries(catalog.map((c) => [c.id, c])), [catalog])

  const [ids, setIds] = useState(() => ingredients.map(newId))
  const [paste, setPaste] = useState('')
  const collerId = useId()

  useEffect(() => {
    setIds((prev) => {
      if (prev.length === ingredients.length) return prev
      if (ingredients.length > prev.length) return [...prev, ...Array.from({ length: ingredients.length - prev.length }, newId)]
      return prev.slice(0, ingredients.length)
    })
     
  }, [ingredients.length])

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  const updateSlot = (id, patch) => {
    const i = ids.indexOf(id)
    if (i === -1) return
    onChange(ingredients.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }
  const removeSlot = (id) => {
    const i = ids.indexOf(id)
    if (i === -1) return
    setIds((prev) => prev.filter((x) => x !== id))
    onChange(ingredients.filter((_, idx) => idx !== i))
  }
  const addSlot = () => {
    setIds((prev) => [...prev, newId()])
    onChange([...ingredients, { ids: [], qty: { amount: null, unit: '' }, labels: {}, required: true }])
  }
  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(active.id), to = ids.indexOf(over.id)
    if (from === -1 || to === -1) return
    setIds((prev) => arrayMove(prev, from, to))
    onChange(arrayMove(ingredients, from, to))
  }
  const handleImport = () => {
    const parsed = parseIngredientList(paste)
    if (!parsed.length) return
    const newSlots = parsed.map((p) => {
      const m = matchIngredient(p.name, catalog)
      const cat = m ? catalogById[m.id] : null
      const qty = { amount: p.amount, unit: p.unit ?? '' }
      // Libellé auto UNIQUEMENT pour ces nouvelles lignes (jamais sur l'existant).
      const labels = cat ? buildLabels(qty, cat.labels) : { [lang]: p.raw }
      return { ids: m ? [m.id] : [], qty, labels, required: true }
    })
    setIds((prev) => [...prev, ...newSlots.map(newId)])
    onChange([...ingredients, ...newSlots])
    setPaste('')
  }

  return (
    <div>
      {/* Zone coller */}
      <label htmlFor={collerId} style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', marginBottom: 4 }}>{t.paste}</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'flex-start' }}>
        <textarea id={collerId} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={t.ph} rows={2}
          style={{ flex: 1, border: `1px dashed ${darkMode ? '#3A5070' : '#cdbfa8'}`, borderRadius: 8, padding: 8, background: darkMode ? '#11202F' : '#FCF7EF', color: darkMode ? '#C8D8E8' : '#5a4030', fontSize: 12, outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
        <Button onClick={handleImport} disabled={!paste.trim()} className="h-auto rounded-lg bg-[#B85000] px-3 py-2 text-xs font-bold text-white" style={{ gap: 5, flexShrink: 0 }}>
          <LuClipboardPaste size={14} /> {t.pasteDo}
        </Button>
      </div>

      {ids.length === 0 && <div style={{ fontSize: 12, color: 'var(--color-muted)', fontStyle: 'italic', marginBottom: 8 }}>{t.empty}</div>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ingredients.map((slot, i) => (
            <IngredientRow key={ids[i] ?? i} id={ids[i] ?? `tmp-${i}`} slot={slot} lang={lang}
              catalog={catalog} catalogById={catalogById} t={t} darkMode={darkMode}
              onUpdate={updateSlot} onRemove={removeSlot} />
          ))}
        </SortableContext>
      </DndContext>

      <datalist id={DATALIST_ID}>
        {catalog.map((c) => <option key={c.id} value={c.labels?.[lang] ?? c.labels?.fr ?? c.id} />)}
      </datalist>

      <Button variant="ghost" onClick={addSlot} className="h-auto rounded-lg border bg-transparent px-2.5 py-1.5 text-[13px] hover:bg-transparent" style={{ gap: 6, borderColor: 'var(--color-border-warm)', color: 'var(--color-brand-500)', marginTop: 4 }}>
        <LuPlus size={14} /> {t.add}
      </Button>
    </div>
  )
}
