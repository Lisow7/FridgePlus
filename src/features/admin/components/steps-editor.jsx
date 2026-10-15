import { useState, useEffect } from 'react'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable'
import { LuPlus } from 'react-icons/lu'
import RecipeFormSortableStep from '@features/recipes/components/recipe-form-sortable-step'
import Button from '@shared/ui/button'
import { stepLangs, stepCount, addStep, removeStep, moveStep, setStepText } from '@shared/lib/recipes/recipe-steps'

// Éditeur d'étapes pour l'admin (recettes base). Les étapes sont multilingues
// ({fr:[...],en:[...]}) ; l'admin édite la langue `lang` (source = fr), et les
// opérations structurelles (ajout/suppression/réordonnancement) s'appliquent en
// LOCKSTEP sur toutes les langues via les helpers recipe-steps (préserve les
// traductions existantes). Réutilise RecipeFormSortableStep (drag + mic + auto-resize).

const I18N = {
  fr: { add: 'Ajouter une étape', placeholderStep: 'Décris l\'étape…', dragStep: 'Déplacer l\'étape', deleteStep: 'Supprimer l\'étape', startMic: 'Dicter', stopMic: 'Arrêter la dictée', empty: 'Aucune étape. Ajoute la première.' },
}

let _sid = 0
const newId = () => `step-${Date.now()}-${_sid++}`

export default function StepsEditor({ steps, lang = 'fr', onChange, darkMode = false }) {
  const t = I18N.fr
  const count = stepCount(steps)
  const [ids, setIds] = useState(() => Array.from({ length: count }, newId))

  // Resynchronise les ids si le nombre d'étapes change de l'extérieur (import, reset)
  useEffect(() => {
    setIds((prev) => {
      if (prev.length === count) return prev
      if (count > prev.length) return [...prev, ...Array.from({ length: count - prev.length }, newId)]
      return prev.slice(0, count)
    })
     
  }, [count])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const rows = ids.map((id, i) => ({ id, text: steps?.[lang]?.[i] ?? '' }))

  const handleText = (id, text) => {
    const i = ids.indexOf(id)
    if (i !== -1) onChange(setStepText(steps ?? {}, lang, i, text))
  }
  const handleDelete = (id) => {
    const i = ids.indexOf(id)
    if (i === -1) return
    setIds((prev) => prev.filter((x) => x !== id))
    onChange(removeStep(steps ?? {}, i))
  }
  const handleAdd = () => {
    setIds((prev) => [...prev, newId()])
    onChange(addStep(steps ?? {}, stepLangs(steps).length ? stepLangs(steps) : [lang]))
  }
  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(active.id)
    const to = ids.indexOf(over.id)
    if (from === -1 || to === -1) return
    setIds((prev) => arrayMove(prev, from, to))
    onChange(moveStep(steps ?? {}, from, to))
  }

  return (
    <div>
      {rows.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--color-muted)', fontStyle: 'italic', marginBottom: 8 }}>{t.empty}</div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {rows.map((step, i) => (
            <RecipeFormSortableStep
              key={step.id}
              step={step}
              index={i}
              onChange={handleText}
              onDelete={handleDelete}
              darkMode={darkMode}
              t={t}
              lang={lang}
            />
          ))}
        </SortableContext>
      </DndContext>
      <Button
        variant="ghost"
        onClick={handleAdd}
        className="h-auto rounded-lg border bg-transparent px-2.5 py-1.5 text-[13px] hover:bg-transparent"
        style={{ gap: 6, borderColor: 'var(--color-border-warm)', color: 'var(--color-brand-500)', marginTop: 4 }}
      >
        <LuPlus size={14} /> {t.add}
      </Button>
    </div>
  )
}
