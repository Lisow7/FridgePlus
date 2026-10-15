import { LuSparkles, LuPlus, LuSave, LuHouse } from 'react-icons/lu'
import WhatsNextRecipesCard from './whats-next-recipes-card'
import WhatsNextBudgetCard from './whats-next-budget-card'
import { suffixS } from '@shared/lib/i18n/pluralize'

const I18N = {
  fr: {
    title: 'Et après ?',
    done: (n) => `🎉 Bravo ! ${n} article${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} au frigo.`,
    empty: 'Termine tes courses pour voir tes suggestions.',
    save: 'Enregistrer la liste',
    newBasket: 'Préparer un nouveau panier',
    back: 'Retour au frigo',
  },
  en: {
    title: "What’s next?",
    done: (n) => `🎉 Done! ${n} item${suffixS(n, 'en')} added to your fridge.`,
    empty: 'Finish your shopping to see your suggestions.',
    save: 'Save the list',
    newBasket: 'Prepare a new cart',
    back: 'Back to fridge',
  },
}

// Phase 4 « Et après ? » — landing post-courses. Compose 2 cartes modulaires
// (recettes faisables + bilan) + CTAs de clôture. Empty-state si pas de snapshot.
export default function WhatsNextPhase({
  snapshot, recipes = [], lang = 'fr', darkMode = false, favorites = new Set(), recipeNames,
  onToggleFavorite, onShowRecipe, onShowAllRecipes, onShowSpendingDetail,
  onSaveList, onStartNewBasket, onBackToFridge,
}) {
  const t = I18N[lang] ?? I18N.fr
  const muted = darkMode ? '#7A90A8' : '#8A6A60'
  const fg = darkMode ? '#E8EEF5' : '#1a0e00'

  if (!snapshot) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <LuSparkles size={36} style={{ color: '#D46A10' }} aria-hidden="true" />
        <p className="text-[14px] font-semibold" style={{ color: muted }}>{t.empty}</p>
      </div>
    )
  }

  const cardBg = darkMode ? '#131E2C' : '#fff'
  const cardBorder = darkMode ? '#1A2A3D' : 'rgba(0,0,0,0.08)'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-[16px] font-extrabold flex items-center gap-2" style={{ color: fg }}>
          <LuSparkles size={18} style={{ color: '#D46A10' }} aria-hidden="true" /> {t.title}
        </h2>
        <p className="text-[13px]" style={{ color: muted }}>{t.done(snapshot.addedCount ?? 0)}</p>
      </div>

      <WhatsNextRecipesCard
        recipes={recipes.slice(0, 3)}
        lang={lang}
        darkMode={darkMode}
        favorites={favorites}
        recipeNames={recipeNames}
        onToggleFavorite={onToggleFavorite}
        onShowRecipe={onShowRecipe}
        onShowAll={onShowAllRecipes}
      />
      <WhatsNextBudgetCard snapshot={snapshot} lang={lang} darkMode={darkMode} onShowDetail={onShowSpendingDetail} />

      <button
        onClick={onStartNewBasket}
        className="flex items-center justify-center gap-2 w-full rounded-[12px] py-4 text-[15px] font-extrabold border-none cursor-pointer min-h-[52px]"
        style={{ background: 'var(--gradient-deep)', color: 'white' }}
      >
        <LuPlus size={18} /> {t.newBasket}
      </button>
      <div className="flex gap-2">
        <button
          onClick={onSaveList}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[11px] font-bold border cursor-pointer min-h-[44px]"
          style={{ background: cardBg, borderColor: cardBorder, color: muted }}
        >
          <LuSave size={14} /> {t.save}
        </button>
        <button
          onClick={onBackToFridge}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[11px] font-bold border cursor-pointer min-h-[44px]"
          style={{ background: cardBg, borderColor: cardBorder, color: muted }}
        >
          <LuHouse size={14} /> {t.back}
        </button>
      </div>
    </div>
  )
}
