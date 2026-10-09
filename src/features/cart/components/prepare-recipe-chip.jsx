import { useState } from 'react'
import { LuMinus, LuPlus, LuTrash2, LuChevronDown } from 'react-icons/lu'

const I18N = {
  fr: {
    persons: (n) => `${n} pers.`,
    increase: 'Augmenter les portions',
    decrease: 'Diminuer les portions',
    remove: (name) => `Retirer ${name}`,
    expand: 'Voir les ingrédients',
    collapse: 'Masquer les ingrédients',
  },
  en: {
    persons: (n) => `${n} ppl.`,
    increase: 'Increase servings',
    decrease: 'Decrease servings',
    remove: (name) => `Remove ${name}`,
    expand: 'Show ingredients',
    collapse: 'Hide ingredients',
  },
}

export default function PrepareRecipeChip({
  recipe,
  items = [],
  lang = 'fr',
  darkMode: _darkMode = false,
  onUpdateServings,
  onRemoveRecipe,
}) {
  const t = I18N[lang] ?? I18N.fr
  const servings = recipe.servings ?? 1
  const [expanded, setExpanded] = useState(false)
  const hasItems = items.length > 0

  return (
    <div className="rounded-md border bg-white">
      <div className="flex items-center gap-3 px-3 py-2">
        <span className="text-xl flex-shrink-0">{recipe.recipe_emoji ?? '🍽️'}</span>
        <span className="flex-1 text-[13px] font-bold truncate">{recipe.recipe_name}</span>
        <div className="flex items-center gap-1.5 rounded-md px-2 py-1 bg-[#F5EDE0]">
          <button
            type="button"
            aria-label={t.decrease}
            onClick={() => { if (servings > 1) onUpdateServings?.(recipe.recipe_id, servings - 1) }}
            disabled={servings <= 1}
            className="w-6 h-6 rounded-md text-white bg-[#D46A10] disabled:opacity-40 flex items-center justify-center"
          ><LuMinus size={12} /></button>
          <span className="text-[12px] font-bold min-w-[40px] text-center">{t.persons(servings)}</span>
          <button
            type="button"
            aria-label={t.increase}
            onClick={() => onUpdateServings?.(recipe.recipe_id, servings + 1)}
            className="w-6 h-6 rounded-md text-white bg-[#D46A10] flex items-center justify-center"
          ><LuPlus size={12} /></button>
        </div>
        {hasItems && (
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
          aria-label={t.remove(recipe.recipe_name)}
          onClick={() => onRemoveRecipe?.(recipe.recipe_id)}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[#8A6A60]"
        ><LuTrash2 size={14} /></button>
      </div>
      {expanded && hasItems && (
        <ul className="px-3 pb-2 pt-0 flex flex-col gap-1 border-t border-[#F0E6D8]">
          {items.map(it => (
            <li key={it.id} className="flex items-center justify-between gap-2 text-[12px] pt-1.5">
              <span className="truncate text-[#5A4A40]">{it.label}</span>
              <span className="flex-shrink-0 tabular-nums font-semibold text-[#8A6A60]">
                {it.amount} {it.unit}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
