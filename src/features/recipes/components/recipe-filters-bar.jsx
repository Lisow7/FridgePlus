import { Fragment, useRef, useId } from 'react'
import { LuSearch, LuGrid2X2, LuHeart, LuBookOpen, LuSlidersHorizontal, LuArrowUpDown } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { shouldShowReadyBadge } from '@features/recipes/lib/ready-badge'
import { compterLesFiltresActifs } from '@features/recipes/lib/recipe-active-filters'
import { ReadyBadgeDot } from './ready-badge-dot'

/**
 * Barre de filtres du panneau Recettes : recherche, tri, chips de filtre rapide
 * et bouton d'ouverture du tiroir de filtres avancés.
 *
 * Reçoit `filters` — l'objet de `useRecipeFilters`, déjà cohérent — en UNE prop
 * plutôt que ses ~15 clés à plat, et `theme` de même. Le tiroir lui-même reste
 * monté par le panneau ; seul son bouton d'ouverture vit ici.
 */
export default function RecipeFiltersBar({ filters, theme, t, stock, setFiltersDrawerOpen, searchRef: searchRefExterne }) {
  const { darkMode, isMobile, borderPanel } = theme
  const {
    totalCount, readyCount, almostCount, favCount, customCount, priorityCount, priorityIds, counts,
    searchQuery, setSearchQuery, filter, setFilter, sortMode, setSortMode,
  } = filters

  // Le panneau peut tenir la référence : « Chercher une recette » (favoris
  // vides) y pose le curseur.
  const searchRefLocal = useRef(null)
  const searchRef = searchRefExterne ?? searchRefLocal
  const champRechercheId = useId()
  // Les cartes Toutes / Prêt / Presque : leur phrase (« Tous les ingrédients
  // sont dans mon frigo »…) était écrite dans le dictionnaire et jamais rendue
  // (audit du 2026-10-04). Elle devient leur description — infobulle à la
  // souris, annoncée au lecteur d'écran — sans entrer dans leur nom.
  const descriptionId = useId()

  // Le même compte que l'en-tête du tiroir (une seule fonction, UX-07).
  const activeFiltersCount = compterLesFiltresActifs(filters)

  const FilterChipBtn = ({ isActive, onClick, icon, label, badge = 0, color, bg, className = '' }) => (
    <Button
      onClick={onClick}
      aria-pressed={isActive}
      className={`h-auto rounded-lg border-[1.5px] text-sm font-semibold whitespace-nowrap overflow-hidden ${className}`}
      style={{
        borderColor: isActive ? color : (isMobile ? `${color}55` : (darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)')),
        background: isActive ? bg : 'transparent',
        color:      isActive ? color : (isMobile ? `${color}99` : 'var(--color-muted)'),
        padding:    '8px 6px',
        flex:       isMobile ? '1 1 0%' : undefined,
        gap: '6px',
        transition: 'all 0.2s ease',
      }}
    >
      {icon}
      {/* Audit 2026-10-02 (P6) : sur mobile, une puce inactive n'était plus
          qu'une icône (♡, 📖) — sans texte, et sans nom accessible. La place
          existe (deux puces à parts égales) : le texte reste toujours. */}
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      {badge > 0 && (
        <span className="text-xs font-extrabold px-1 rounded shrink-0"
          style={{ background: isActive ? `${color}30` : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') }}>
          {badge}
        </span>
      )}
    </Button>
  )

  return (
  <div
    className="shrink-0 px-4 flex flex-col gap-2.5 py-2.5"
    style={{ borderBottom: `1px solid ${borderPanel}` }}
  >
    {/* 1. Recherche + tri — un libellé visible au-dessus du cadre (la loupe
        vit dedans), le texte grisé en exemple (décision du 2026-10-06). */}
    <label htmlFor={champRechercheId} className="text-xs font-bold" style={{ color: 'var(--color-muted)', marginBottom: '-6px' }}>{t.searchLabel}</label>
    <div
      className="flex items-center h-11 rounded-xl px-3.5 gap-2.5 transition-colors duration-150"
      style={{
        border: `1.5px solid ${searchQuery ? 'var(--color-brand-500)' : 'rgba(224,120,32,0.28)'}`,
        background: 'var(--input-bg)',
      }}
    >
      <LuSearch size={15} color={searchQuery ? 'var(--color-brand-500)' : (darkMode ? '#C07830' : '#B06828')} style={{ flexShrink: 0 }} />
      <input
        id={champRechercheId}
        ref={searchRef}
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder={t.searchPlaceholder}
        // Toute la hauteur du cadre (44 px) est cliquable, pas seulement la
        // ligne de texte (20 px) — WCAG 2.5.8, audit 2026-10-02.
        className="flex-1 min-w-0 self-stretch text-sm font-medium bg-transparent border-none outline-none"
        style={{ color: 'var(--color-charcoal)' }}
        onKeyDown={e => { if (e.key === 'Escape') setSearchQuery('') }}
      />
      {searchQuery && (
        <Button
          variant="ghost"
          onClick={() => setSearchQuery('')}
          aria-label={t.clearSearchLabel}
          className="h-auto rounded-none px-1 text-xs leading-none hover:bg-transparent"
          style={{ color: 'var(--color-brand-500)' }}>✕</Button>
      )}
      <div className="w-px h-4 shrink-0" style={{ background: 'rgba(224,120,32,0.2)' }} />
      <Button
        variant="ghost"
        onClick={() => setSortMode(m => m === 'match' ? 'alpha' : m === 'alpha' ? 'quick' : 'match')}
        title={sortMode === 'match' ? t.sortAlpha : sortMode === 'alpha' ? t.sortQuickLabel : t.sortByMatch}
        // Le nom dit le tri EN COURS (le title, l'action suivante) ; l'icône ⇅
        // dit « trier » à qui ne lit pas « % ». Cible de 32 px (P6).
        aria-label={sortMode === 'match' ? t.sortStateMatch : sortMode === 'alpha' ? t.sortStateAlpha : t.sortStateQuick}
        className="h-auto rounded px-2 py-0.5 text-xs font-extrabold tracking-wide shrink-0 hover:bg-transparent"
        style={{
          minHeight: 32, minWidth: 32, display: 'inline-flex', alignItems: 'center', gap: 3,
          background: sortMode !== 'match' ? (darkMode ? 'rgba(224,120,32,0.18)' : 'rgba(224,120,32,0.12)') : 'transparent',
          color: sortMode !== 'match' ? 'var(--color-brand-500)' : (darkMode ? '#C07830' : '#B06828'),
          transition: 'all 0.15s',
        }}
      ><LuArrowUpDown size={12} aria-hidden="true" />{sortMode === 'match' ? '%' : sortMode === 'alpha' ? 'A→Z' : '⏱'}</Button>
    </div>

    {/* 2. "Ce soir ?" — cartes contextuelles (uniquement si frigo non vide) */}
    {stock.size > 0 && (
      <div className="flex flex-col gap-1.5">
        <span
          className="text-[10px] font-bold uppercase tracking-wider pl-0.5"
          style={{ color: 'var(--color-muted)', opacity: 0.65 }}
        >
          {t.tonightLabel}
        </span>
        <div className="flex gap-2">
          {[
            { id: 'all',    count: counts?.byPrimary?.all ?? totalCount,     color: '#C4A880', label: t.allRecipes, desc: t.allRecipesDesc },
            { id: 'ready',  count: counts?.byPrimary?.ready ?? readyCount,   color: '#4CAF7D', label: t.ready,      desc: t.readyDesc },
            { id: 'almost', count: counts?.byPrimary?.almost ?? almostCount, color: 'var(--color-brand-500)', label: t.almost,     desc: t.almostDesc },
          ].map(card => {
            const active   = filter === card.id
            const disabled = card.count === 0
            const descId   = `${descriptionId}-${card.id}`
            return (
              <Fragment key={card.id}>
                <Button
                  variant="ghost"
                  onClick={() => !disabled && setFilter(f => f === card.id ? 'all' : card.id)}
                  disabled={disabled}
                  aria-pressed={active}
                  aria-describedby={descId}
                  title={card.desc}
                  className="h-auto flex-1 justify-start gap-2.5 rounded-xl border-[1.5px] px-3 py-2 hover:bg-transparent"
                  style={{
                    opacity:    disabled ? 0.42 : 1,
                    background: active ? `${card.color}12` : 'var(--card-bg)',
                    borderColor: active ? card.color : 'transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-extrabold"
                    style={{ background: `${card.color}22`, color: card.color, position: 'relative' }}
                  >
                    {card.count}
                    {card.id === 'ready' && (
                      <ReadyBadgeDot show={shouldShowReadyBadge(readyCount, filter)} />
                    )}
                  </div>
                  <div className="text-left min-w-0">
                    <div
                      className="text-xs font-bold leading-tight"
                      style={{ color: active ? card.color : 'var(--color-charcoal)' }}
                    >
                      {card.label}
                    </div>
                  </div>
                </Button>
                {/* Hors du bouton : dedans, la phrase entrerait dans son nom. */}
                <span id={descId} className="sr-only">{card.desc}</span>
              </Fragment>
            )
          })}
        </div>
        {priorityIds.size > 0 && (
          <Button
            variant="ghost"
            onClick={() => setFilter(f => f === 'priority' ? 'all' : 'priority')}
            aria-pressed={filter === 'priority'}
            className="h-auto w-full justify-start gap-2.5 rounded-xl border-[1.5px] px-3 py-2 hover:bg-transparent"
            style={{
              background: filter === 'priority' ? 'rgba(196,165,85,0.10)' : 'var(--card-bg)',
              borderColor: filter === 'priority' ? '#C4A555' : 'transparent',
              transition: 'all 0.15s',
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-extrabold"
              style={{ background: 'rgba(196,165,85,0.22)', color: '#C4A555' }}
            >
              {priorityCount}
            </div>
            <div className="text-left">
              <div className="text-xs font-bold leading-tight" style={{ color: filter === 'priority' ? '#C4A555' : 'var(--color-charcoal)' }}>
                {t.priority}
              </div>
              <div className="text-[10px] leading-tight" style={{ color: 'var(--color-muted)' }}>
                {t.priorityDesc}
              </div>
            </div>
          </Button>
        )}
      </div>
    )}

    {/* 3. Navigation secondaire */}
    {stock.size > 0 ? (
      /* Distribution uniforme — Toutes est dans les cartes contextuelles ci-dessus */
      <div className="flex items-center gap-1.5">
        {/* eslint-disable-next-line react-hooks/static-components */}
        <FilterChipBtn
          isActive={filter === 'favorites'}
          onClick={() => setFilter(f => f === 'favorites' ? 'all' : 'favorites')}
          icon={<LuHeart size={13} fill={filter === 'favorites' ? 'currentColor' : 'none'} />}
          label={t.favorites}
          badge={counts?.byPrimary?.favorites ?? favCount}
          color="#E05878" bg="rgba(224,88,120,0.10)"
          className="flex-1 min-w-0"
        />
        {/* eslint-disable-next-line react-hooks/static-components */}
        <FilterChipBtn
          isActive={filter === 'custom'}
          onClick={() => setFilter(f => f === 'custom' ? 'all' : 'custom')}
          icon={<LuBookOpen size={13} />}
          label={t.myRecipes}
          badge={customCount}
          color="#C4941E" bg="rgba(196,148,30,0.10)"
          className="flex-1 min-w-0"
        />

        {/* v3.191.0 — Saison/Léger ne sont plus en chips ici (doublon
            avec le drawer Préférences). Tout est désormais dans le
            drawer pour une barre du haut épurée. */}

        <div className="ml-auto" />

        <Button
          onClick={() => setFiltersDrawerOpen(true)}
          title={t.advancedFiltersLabel}
          aria-label={t.advancedFiltersLabel}
          className="relative h-9 shrink-0 gap-1.5 rounded-lg border-[1.5px] px-3 text-xs font-bold"
          style={{
            borderColor: activeFiltersCount > 0 ? 'var(--color-brand-500)' : (darkMode ? 'rgba(224,120,32,0.22)' : 'rgba(224,120,32,0.28)'),
            background: activeFiltersCount > 0 ? (darkMode ? 'rgba(224,120,32,0.12)' : 'rgba(224,120,32,0.08)') : 'transparent',
            color:      activeFiltersCount > 0 ? 'var(--color-brand-500)' : (darkMode ? '#C07830' : '#B06828'),
            transition: 'all 0.15s',
          }}
        >
          <LuSlidersHorizontal size={14} />
          {!isMobile && t.moreFilters}
          {activeFiltersCount > 0 && (
            <span style={{
              background: 'var(--color-brand-500)', color: '#FFFFFF',
              padding: '1px 6px', borderRadius: '999px',
              fontSize: '11px', fontWeight: 800,
              minWidth: '18px', textAlign: 'center', lineHeight: '14px',
            }}>
              {activeFiltersCount}
            </span>
          )}
        </Button>
      </div>
    ) : (
      /* Scrollable avec Toutes quand frigo vide */
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {/* eslint-disable-next-line react-hooks/static-components */}
          <FilterChipBtn
            isActive={filter === 'all'}
            onClick={() => setFilter('all')}
            icon={<LuGrid2X2 size={13} />}
            label={t.allRecipes}
            color="var(--color-brand-500)" bg="rgba(224,120,32,0.10)"
            className="shrink-0"
          />
          {/* eslint-disable-next-line react-hooks/static-components */}
          <FilterChipBtn
            isActive={filter === 'favorites'}
            onClick={() => setFilter(f => f === 'favorites' ? 'all' : 'favorites')}
            icon={<LuHeart size={13} fill={filter === 'favorites' ? 'currentColor' : 'none'} />}
            label={t.favorites}
            badge={counts?.byPrimary?.favorites ?? favCount}
            color="#E05878" bg="rgba(224,88,120,0.10)"
            className="shrink-0"
          />
          {/* eslint-disable-next-line react-hooks/static-components */}
          <FilterChipBtn
            isActive={filter === 'custom'}
            onClick={() => setFilter(f => f === 'custom' ? 'all' : 'custom')}
            icon={<LuBookOpen size={13} />}
            label={t.myRecipes}
            badge={customCount}
            color="#C4941E" bg="rgba(196,148,30,0.10)"
            className="shrink-0"
          />

          {/* v3.191.0 — Saison/Léger retirés (doublon avec drawer). */}
        </div>

        <div className="w-px h-5 shrink-0" style={{ background: darkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)' }} />

        <Button
          onClick={() => setFiltersDrawerOpen(true)}
          title={t.advancedFiltersLabel}
          aria-label={t.advancedFiltersLabel}
          className="relative h-9 shrink-0 gap-1.5 rounded-lg border-[1.5px] px-3 text-xs font-bold"
          style={{
            borderColor: activeFiltersCount > 0 ? 'var(--color-brand-500)' : (darkMode ? 'rgba(224,120,32,0.22)' : 'rgba(224,120,32,0.28)'),
            background: activeFiltersCount > 0 ? (darkMode ? 'rgba(224,120,32,0.12)' : 'rgba(224,120,32,0.08)') : 'transparent',
            color:      activeFiltersCount > 0 ? 'var(--color-brand-500)' : (darkMode ? '#C07830' : '#B06828'),
            transition: 'all 0.15s',
          }}
        >
          <LuSlidersHorizontal size={14} />
          {!isMobile && t.moreFilters}
          {activeFiltersCount > 0 && (
            <span style={{
              background: 'var(--color-brand-500)', color: '#FFFFFF',
              padding: '1px 6px', borderRadius: '999px',
              fontSize: '11px', fontWeight: 800,
              minWidth: '18px', textAlign: 'center', lineHeight: '14px',
            }}>
              {activeFiltersCount}
            </span>
          )}
        </Button>
      </div>
    )}

    {/* v3.191.0 — Anciennes sections « Filtres avancés » collapsible
        + résumé chips actifs supprimées : tout est désormais dans le
        `<RecipeFiltersDrawer />` ouvert via le bouton « Filtres ». */}
  </div>
  )
}
