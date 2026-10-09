import { LuChefHat, LuArrowRight, LuHeart } from 'react-icons/lu'
import Emoji from '@shared/ui/emoji'

const I18N = {
  fr: {
    title: 'Cuisine ton nouveau stock',
    match: (p) => `${Math.round(p * 100)} %`,
    all: 'Voir toutes les recettes possibles',
    empty: 'Aucune recette ne matche encore. Ajoute des ingrédients ou crée ta recette.',
    fav: 'Ajouter aux favoris',
  },
  en: {
    title: 'Cook your new stock',
    match: (p) => `${Math.round(p * 100)}%`,
    all: 'See all possible recipes',
    empty: 'No recipe matches yet. Add ingredients or create your own.',
    fav: 'Add to favorites',
  },
}

// Carte « Recettes faisables » — top recettes réalisables avec le stock courant
// (anti-gaspi : cuisine ce que tu as). `recipes` = liste déjà scorée/tronquée par
// la phase. Vignettes via Emoji (cascade image IA). Cœur favori rapide.
export default function WhatsNextRecipesCard({
  recipes = [], lang = 'fr', darkMode = false, favorites = new Set(), recipeNames,
  onToggleFavorite, onShowRecipe, onShowAll,
}) {
  const t = I18N[lang] ?? I18N.fr
  const fg = darkMode ? '#E8EEF5' : '#1a0e00'
  const muted = darkMode ? '#7A90A8' : '#8A6A60'
  const cardBg = darkMode ? '#131E2C' : '#fff'
  const cardBorder = darkMode ? '#1A2A3D' : 'rgba(0,0,0,0.08)'
  // Nom localisé : les recettes de base portent leur nom dans `recipeNames`
  // (pas dans recipe.name) ; fallback sur recipe.name (custom) puis l'id.
  const name = (r) =>
    recipeNames?.[r.id]?.[lang] ?? recipeNames?.[r.id]?.fr ??
    r.name?.[lang] ?? r.name?.fr ?? (typeof r.name === 'string' ? r.name : r.id)

  return (
    <div className="rounded-[12px] border p-4 flex flex-col gap-2" style={{ background: cardBg, borderColor: cardBorder }}>
      <div className="flex items-center gap-2">
        <LuChefHat size={16} style={{ color: '#D46A10' }} aria-hidden="true" />
        <span className="text-[12px] font-extrabold uppercase tracking-[0.06em]" style={{ color: muted }}>{t.title}</span>
      </div>
      {recipes.length === 0 ? (
        <p className="text-[12px] py-2" style={{ color: muted }}>{t.empty}</p>
      ) : (
        <ul className="flex flex-col">
          {recipes.map(r => {
            const isFav = favorites.has(r.id)
            return (
              <li key={r.id} className="flex items-center gap-3 py-2 border-b last:border-b-0" style={{ borderColor: cardBorder }}>
                <button
                  onClick={() => onShowRecipe?.(r)}
                  className="flex items-center gap-3 flex-1 min-w-0 bg-transparent border-none cursor-pointer text-left"
                >
                  <Emoji char={r.emoji} imageUrl={r.image_url} size={28} />
                  <span className="flex-1 text-[13px] font-semibold truncate" style={{ color: fg }}>{name(r)}</span>
                  <span className="text-[12px] font-bold" style={{ color: '#16A34A' }}>{t.match(r.matchPercent ?? 0)}</span>
                </button>
                <button
                  onClick={() => onToggleFavorite?.(r.id)}
                  aria-label={t.fav}
                  aria-pressed={isFav}
                  className="w-8 h-8 flex items-center justify-center bg-transparent border-none cursor-pointer flex-shrink-0"
                  style={{ color: '#E05878' }}
                >
                  <LuHeart size={16} fill={isFav ? 'currentColor' : 'none'} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {onShowAll && (
        <button
          onClick={onShowAll}
          className="flex items-center gap-1 text-[12px] font-bold text-[#D46A10] bg-transparent border-none cursor-pointer self-start min-h-[36px]"
        >
          {t.all} <LuArrowRight size={13} />
        </button>
      )}
    </div>
  )
}
