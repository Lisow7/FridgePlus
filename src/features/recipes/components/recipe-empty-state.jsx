import { LuHeart, LuBookOpen, LuPlus, LuRefreshCw, LuUtensilsCrossed } from 'react-icons/lu'
import Button from '@shared/ui/button'

// Plus de cartes fantômes sous les états vides (décision du 2026-10-03) : trois
// cartes grises qui pâlissent se lisaient comme un chargement bloqué (audit
// d'intuitivité du 2026-10-02) — un squelette promet du contenu qui arrive.

// Un écran vide propose de quoi repartir (UX-12, maquette de la décision du 2026-10-08) :
// les recettes prêtes — ou toutes, frigo vide, puisque « Prêt » retombe alors
// sur toutes — et la recherche.
export function EmptyFavorites({ darkMode, t, stockSize = 0, onShowRecipes, onSearch }) {
  const frigoGarni = stockSize > 0
  return (
    <div className="flex flex-col items-center h-full px-5">
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: '272px' }}>
        <div
          className="w-[76px] h-[76px] rounded-full flex items-center justify-center shrink-0"
          style={{
            background: darkMode ? 'rgba(224,88,120,0.14)' : 'rgba(224,88,120,0.10)',
            boxShadow: '0 0 0 8px rgba(224,88,120,0.06)',
          }}
        >
          <LuHeart size={34} style={{ color: '#E05878' }} />
        </div>
        <div className="text-center flex flex-col gap-2">
          <p className="text-lg font-bold m-0" style={{ color: 'var(--color-charcoal)' }}>{t.noFavoritesTitle}</p>
          <p className="text-sm m-0 max-w-[250px] leading-relaxed" style={{ color: 'var(--color-muted)' }}>{t.noFavoritesHint}</p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-[250px]">
          <Button onClick={() => onShowRecipes?.(frigoGarni ? 'ready' : 'all')} className="w-full">
            {frigoGarni ? t.favoritesShowReady : t.favoritesShowAll}
          </Button>
          <Button variant="secondary" onClick={() => onSearch?.()} className="w-full">
            {t.favoritesSearch}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function EmptyCustomRecipes({ darkMode, t, onCreate }) {
  return (
    <div className="flex flex-col items-center h-full px-5">
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: '272px' }}>
        <div
          className="w-[76px] h-[76px] rounded-full flex items-center justify-center shrink-0"
          style={{
            background: darkMode ? 'rgba(123,176,120,0.14)' : 'rgba(123,176,120,0.10)',
            boxShadow: '0 0 0 8px rgba(123,176,120,0.06)',
          }}
        >
          <LuBookOpen size={34} style={{ color: '#7BB078' }} />
        </div>
        <div className="text-center flex flex-col gap-2">
          <p className="text-lg font-bold m-0" style={{ color: 'var(--color-charcoal)' }}>{t.noCustomTitle}</p>
          <p className="text-sm m-0 max-w-[250px] leading-relaxed" style={{ color: 'var(--color-muted)' }}>{t.noCustomHint}</p>
        </div>
        <Button
          onClick={onCreate}
          className="h-auto rounded-xl px-6 py-3 text-sm font-bold text-white hover:brightness-110"
          style={{ background: '#7BB078', boxShadow: '0 3px 14px rgba(123,176,120,0.35)' }}
        >
          <LuPlus size={18} />
          {t.createRecipe}
        </Button>
      </div>
    </div>
  )
}

export function EmptyGeneric({ t, stockSize, onResetFilters, onOpenFridge, darkMode }) {
  const isEmpty = stockSize === 0
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4" style={{ padding: '32px 20px' }}>
      <div
        style={{
          width: 72, height: 72, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: darkMode ? 'rgba(224,120,32,0.13)' : 'rgba(224,120,32,0.09)',
          boxShadow: '0 0 0 8px rgba(224,120,32,0.05)',
          opacity: 0.75,
        }}
      >
        <LuUtensilsCrossed size={30} style={{ color: 'var(--color-brand-500)' }} />
      </div>
      <div className="flex flex-col items-center gap-2 text-center" style={{ maxWidth: 260 }}>
        <p className="text-base font-semibold m-0" style={{ color: 'var(--color-charcoal)', opacity: 0.75 }}>
          {isEmpty ? t.noIngredients : t.noRecipes}
        </p>
      </div>
      {isEmpty && onOpenFridge && (
        <Button
          onClick={onOpenFridge}
          className="h-auto rounded-xl border-[1.5px] bg-[rgba(224,120,32,0.12)] px-5 py-2.5 text-sm font-bold hover:bg-[rgba(224,120,32,0.20)]"
          style={{ color: 'var(--color-brand-500)', borderColor: 'rgba(224,120,32,0.30)' }}
        >
          {t.openFridge ?? 'Ouvrir le frigo'}
        </Button>
      )}
      {!isEmpty && onResetFilters && (
        <Button
          onClick={onResetFilters}
          className="h-auto rounded-xl border-[1.5px] bg-[rgba(224,120,32,0.12)] px-5 py-2.5 text-sm font-bold hover:bg-[rgba(224,120,32,0.20)]"
          style={{ color: 'var(--color-brand-500)', borderColor: 'rgba(224,120,32,0.30)' }}
        >
          <LuRefreshCw size={14} />
          {t.clearFilters ?? 'Effacer les filtres'}
        </Button>
      )}
    </div>
  )
}
