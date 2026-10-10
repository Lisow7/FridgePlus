import { useState } from 'react'
import { LuChevronDown, LuTrash2 } from 'react-icons/lu'
import { useConfirm } from '@shared/ui/confirm-dialog/confirm-provider'
import PackSelector from './pack-selector'

const I18N = {
  fr: {
    expand: 'Afficher les sources',
    collapse: 'Masquer les sources',
    remove: (label) => `Retirer ${label}`,
    confirmRemoveAll: 'Retirer toutes les occurrences de cet ingrédient ?',
    removeAllOk: 'Tout retirer',
    sourcesLabel: (sources, _lang = 'fr') =>
      sources.map(s => s.manual
        ? `${s.amount} manuel`
        : `${s.amount} pour ${s.recipe_name}`
      ).join(', '),
  },
  en: {
    expand: 'Show sources',
    collapse: 'Hide sources',
    remove: (label) => `Remove ${label}`,
    confirmRemoveAll: 'Remove all occurrences of this ingredient?',
    removeAllOk: 'Remove all',
    sourcesLabel: (sources) =>
      sources.map(s => s.manual
        ? `${s.amount} manual`
        : `${s.amount} for ${s.recipe_name}`
      ).join(', '),
  },
}

export default function PrepareIngredientRow({
  ingredient,
  lang = 'fr',
  darkMode = false,
  onRemoveItem,
  onRemoveAllByIngredient,
  onChangePack,
  onChangeMultiplier,
  packMultiplier = 1,
  currentPack = null,
}) {
  const t = I18N[lang] ?? I18N.fr
  const confirm = useConfirm()
  const [expanded, setExpanded] = useState(false)

  const isMultiSource = (ingredient.sources?.length ?? 0) > 1

  const handleRemove = async () => {
    if (isMultiSource) {
      if (await confirm({ title: t.confirmRemoveAll, confirmLabel: t.removeAllOk, danger: true })) onRemoveAllByIngredient?.(ingredient.ingredient_id)
    } else {
      onRemoveItem?.(ingredient.rowIds[0])
    }
  }

  return (
    <div className="flex items-start gap-2 px-3 py-2 border-b last:border-b-0">
      <span className="text-xl flex-shrink-0">{ingredient.emoji ?? '🍽️'}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold truncate">{ingredient.label}</span>
          <span className="text-[12px] text-[#8A6A60] tabular-nums">
            {ingredient.totalAmount} {ingredient.unit}
          </span>
        </div>
        {expanded && isMultiSource && (
          <p className="text-[11px] text-[#8A6A60] mt-1">{t.sourcesLabel(ingredient.sources, lang)}</p>
        )}
      </div>
      <PackSelector
        ingredientId={ingredient.ingredient_id}
        subcat={ingredient.subcat}
        currentSize={currentPack?.size ?? ingredient.totalAmount}
        currentUnit={currentPack?.unit ?? ingredient.unit}
        currentLabel={currentPack ? `${currentPack.size} ${currentPack.unit}` : ingredient.label}
        lang={lang}
        darkMode={darkMode}
        multiplier={packMultiplier}
        requiredAmount={ingredient.totalAmount}
        onChangePack={onChangePack}
        onChangeMultiplier={onChangeMultiplier}
      />
      {isMultiSource && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          aria-label={expanded ? t.collapse : t.expand}
          aria-expanded={expanded}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[#8A6A60]"
        >
          <LuChevronDown size={14} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </button>
      )}
      <button
        type="button"
        onClick={handleRemove}
        aria-label={t.remove(ingredient.label)}
        className="w-7 h-7 rounded-md flex items-center justify-center text-[#8A6A60]"
      >
        <LuTrash2 size={14} />
      </button>
    </div>
  )
}
