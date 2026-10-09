import { LEFTOVERS_I18N as I18N } from '@features/fridge/i18n/leftovers-i18n'
import { useState, useRef, useCallback, useMemo } from 'react'
import { LuX, LuPlus } from 'react-icons/lu'
import Button from '@shared/ui/button'
import Field from '@shared/ui/field'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { useIngredients, useBaseRecipes, useGroupMaps } from '@shared/contexts/data-provider'
import { isLeftoverExpired } from '@features/fridge/api/leftovers'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import { useUndo } from '@shared/contexts/undo-provider'
import { getIngredientItemsFlat, getIngredientIds, isIngredientRequired } from '@shared/lib/recipes/recipe-ingredients'
import LeftoverCard from './leftover-card'
import LeftoversCreateView from './leftovers-create-view'

const isToday = (dateStr) => new Date(dateStr).toDateString() === new Date().toDateString()

// `getDlcTone`, `CountdownBadge` et `LeftoverCard` extraits dans
// `./leftover-card.jsx` (CountdownBadge + helper sont privés au fichier).

export default function LeftoversModal({ view, leftovers: rawLeftovers, savedCount = 0, stock, customRecipes = [], publicRecipes = [], onAdd, onDelete, lang, darkMode, onClose, user, onShowAuth }) {
  const INGREDIENTS = useIngredients()
  const { recipes: BASE_RECIPES, recipeNames: RECIPE_NAMES } = useBaseRecipes()
  const windowWidth = useWindowWidth()
  const isDesktop = windowWidth >= 768
  const t = I18N[lang] ?? I18N.fr
  const { trigger } = useUndo()

  // Suppression annulable (10s) sur « Marquer comme consommé ».
  // Optimistic UI : la card disparaît tout de suite, un toast en bas
  // d'écran propose « Annuler ». À l'expiration du timer (10s), l'API
  // delete est réellement appelée. Si l'user clique « Annuler », l'id
  // est retiré de hiddenIds et le reste réapparaît.
  // Pas de modale de confirmation préalable (action légère, l'undo
  // suffit ; cohérent avec retirer item / recette du panier).
  const [hiddenIds, setHiddenIds] = useState(() => new Set())
  const leftovers = useMemo(
    () => rawLeftovers.filter(l => !hiddenIds.has(l.id)),
    [rawLeftovers, hiddenIds],
  )

  const handleDeleteUndoable = useCallback((id) => {
    setHiddenIds(prev => { const next = new Set(prev); next.add(id); return next })
    trigger({
      label: t.undoLeftoverRemoved,
      onConfirm: () => onDelete?.(id),
      onUndo: () => setHiddenIds(prev => { const next = new Set(prev); next.delete(id); return next }),
    })
  }, [trigger, onDelete, t.undoLeftoverRemoved])

  // Focus trap a11y.
  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, { active: true, onEscape: onClose })
  useCloseOnBackButton(true, onClose)

  const [innerView, setInnerView] = useState('list')
  const [addMode, setAddMode] = useState('ingredients')
  const [selectedIngId, setSelectedIngId] = useState(null)
  const [selectedRecipeId, setSelectedRecipeId] = useState(null)
  const [freeName, setFreeName] = useState('')
  const [freeEmoji, setFreeEmoji] = useState('🥡')
  const [dlcDays, setDlcDays] = useState(3)
  const [hygieneOpen, setHygieneOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sortMode, setSortMode] = useState('dlc')
  const [toast, setToast] = useState(null)
  // Recherche : filtre la liste des restes (vue thisweek), des ingrédients en stock,
  // et des recettes lors de la création d'un reste.
  const [searchQ, setSearchQ] = useState('')
  const searchNorm = searchQ.trim().toLowerCase()

  const bg     = darkMode ? '#0F1923' : '#FDFAF6'
  const border = darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'
  const muted  = darkMode ? '#7A90A8' : '#7A5F56'

  // "today" = juste ceux créés aujourd'hui
  // "thisweek" = vue d'ensemble = TOUS les restes (peu importe le jour de création)
  const viewLeftovers = view === 'today'
    ? leftovers.filter(l => isToday(l.created_at))
    : leftovers

  const sortLeftovers = (arr) => {
    if (sortMode === 'name') {
      return [...arr].sort((a, b) => a.name.localeCompare(b.name, t.locale))
    }
    // 'dlc' — par date d'expiration croissante (les plus urgents en haut)
    return [...arr].sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at))
  }

  // Filtre par recherche (nom ou ingrédient lié) — actif seulement en vue thisweek
  const matchesSearch = (l) => {
    if (!searchNorm) return true
    if (l.name?.toLowerCase().includes(searchNorm)) return true
    if (l.ingredient_id) {
      for (const arr of Object.values(INGREDIENTS)) {
        const ing = arr.find(i => i.id === l.ingredient_id)
        if (ing && (ing.labels?.[lang] ?? ing.labels?.fr ?? '').toLowerCase().includes(searchNorm)) return true
      }
    }
    return false
  }
  const filteredViewLeftovers = view === 'thisweek' ? viewLeftovers.filter(matchesSearch) : viewLeftovers
  const activeOnes  = sortLeftovers(filteredViewLeftovers.filter(l => !isLeftoverExpired(l.expires_at)))
  const expiredOnes = sortLeftovers(filteredViewLeftovers.filter(l =>  isLeftoverExpired(l.expires_at)))

  // Ingrédients déjà utilisés dans un reste actif (pour dédup)
  const usedIngredientIds = new Set(
    leftovers
      .filter(l => l.ingredient_id && !isLeftoverExpired(l.expires_at))
      .map(l => l.ingredient_id)
  )
  // Liste des ingrédients en stock — dédupliqués par ID (ils peuvent
  // apparaître dans plusieurs sous-catégories de INGREDIENTS).
  const stockIngredients = (() => {
    const seen = new Set()
    const out = []
    for (const arr of Object.values(INGREDIENTS)) {
      for (const ing of arr) {
        if (seen.has(ing.id)) continue
        if (!stock.has(ing.id)) continue
        if (usedIngredientIds.has(ing.id)) continue
        seen.add(ing.id)
        out.push(ing)
      }
    }
    return out
  })()

  // Noms de recettes déjà utilisés (pour dédup)
  const usedRecipeNames = new Set(
    leftovers
      .filter(l => !l.ingredient_id && !isLeftoverExpired(l.expires_at))
      .map(l => l.name)
  )
  const groupMaps = useGroupMaps()
  const recipeName = (r) => r.isCustom ? (r.name ?? r.id) : (RECIPE_NAMES?.[r.id]?.[lang] ?? r.id)

  // Stock élargi (parents + enfants) pour le scoring de match frigo
  const expandedStock = (() => {
    const set = new Set(stock ?? [])
    if (groupMaps) {
      for (const id of stock ?? []) {
        const parent = groupMaps.parentMap?.[id]
        if (parent) set.add(parent)
        const children = groupMaps.groupMap?.[id]
        if (children) children.forEach(c => set.add(c))
      }
    }
    return set
  })()

  // Recettes utilisées pour créer un reste dans les dernières 24h → priorité haute
  const recentlyCookedNames = new Set(
    leftovers
      // eslint-disable-next-line react-hooks/purity -- Date.now() pour fenêtre 24h, OK lors du render
      .filter(l => !l.ingredient_id && (Date.now() - new Date(l.created_at).getTime()) < 24 * 60 * 60 * 1000)
      .map(l => l.name)
  )

  // Liste des recettes — dédupliquées par ID, filtrées + scorées :
  //   1) recettes "réalisées dans les 24h" (heuristique : reste créé depuis cette recette)
  //   2) recettes dont les ingrédients matchent le frigo (matchPercent élevé)
  //   3) toutes les autres recettes (alpha)
  const availableRecipes = (() => {
    const seen = new Set()
    const out = []
    const merge = [
      ...(BASE_RECIPES ?? []),
      ...customRecipes,
      ...publicRecipes,
    ]
    for (const r of merge) {
      if (!r || !r.id) continue
      if (seen.has(r.id)) continue
      const ingredientItems = getIngredientItemsFlat(r)
      if (ingredientItems.length === 0) continue
      const name = recipeName(r)
      if (!name || usedRecipeNames.has(name)) continue
      seen.add(r.id)
      // Score de match frigo (ingrédients requis dans le stock)
      const required = ingredientItems.filter(isIngredientRequired)
      const matched = required.filter(i => getIngredientIds(i).some(id => expandedStock.has(id))).length
      const matchPercent = required.length > 0 ? matched / required.length : 0
      const isRecent = recentlyCookedNames.has(name)
      // Priorité combinée : recent (200) >> match (0..100) >> alpha
      const priority = (isRecent ? 200 : 0) + Math.round(matchPercent * 100)
      out.push({ id: r.id, name, emoji: r.emoji ?? '🍲', priority, isRecent, matchPercent })
    }
    out.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority
      return a.name.localeCompare(b.name, t.locale)
    })
    return out
  })()

  const handleAdd = async () => {
    if (saving) return
    let name = ''
    let emoji = '🥡'
    let ingredient_id = null
    if (addMode === 'ingredients') {
      const ing = stockIngredients.find(i => i.id === selectedIngId)
      if (ing) { name = ing.labels?.[lang] ?? ing.labels?.fr ?? ing.id; emoji = ing.emoji ?? '🥡'; ingredient_id = ing.id }
    } else if (addMode === 'recipes') {
      const r = availableRecipes.find(x => x.id === selectedRecipeId)
      if (r) { name = r.name; emoji = r.emoji }
    } else {
      name = freeName.trim()
      emoji = freeEmoji
    }
    if (!name) return

    setSaving(true)
    await onAdd({ name, emoji, ingredient_id, dlc_days: dlcDays })
    setSaving(false)
    setInnerView('list')
    setSelectedIngId(null)
    setSelectedRecipeId(null)
    setFreeName('')
    setFreeEmoji('🥡')
    setDlcDays(3)
    setToast({ message: t.toastAdded, name, emoji })
    window.setTimeout(() => setToast(null), 2500)
  }

  const canAdd =
    addMode === 'ingredients' ? !!selectedIngId :
    addMode === 'recipes'     ? !!selectedRecipeId :
                                 !!freeName.trim()

  const title = view === 'today' ? t.today : t.thisweek

  return (
    <div
      onClick={onClose}
      className="fp-modal-backdrop"
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(18,10,4,0.35)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isDesktop ? '24px' : '0',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="fp-modal-panel"
        style={{
        position: 'relative',
        ...(isDesktop
          ? { width: '600px', maxWidth: '100%', maxHeight: '100%' }
          : { width: '100%', height: '100%' }
        ),
        background: bg,
        borderRadius: isDesktop ? '20px' : '0',
        border: `1.5px solid ${border}`,
        boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '16px 20px 14px',
          borderBottom: `1px solid ${border}`,
          flexShrink: 0,
        }}>
          {innerView === 'create' ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setInnerView('list')}
              aria-label={t.cancel}
              className="h-auto w-auto p-1"
              style={{ color: muted }}
            >
              <LuX size={18} />
            </Button>
          ) : (
            <span style={{ fontSize: '22px', lineHeight: 1 }}>🥡</span>
          )}
          <span style={{ flex: 1, fontWeight: 700, fontSize: '16px', color: 'var(--color-charcoal)' }}>
            {innerView === 'create' ? t.add : title}
          </span>
          {innerView !== 'create' && user && savedCount > 0 && (
            <span title={t.savedHint} style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-success)', whiteSpace: 'nowrap' }}>
              🌿 {t.savedCount(savedCount)}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t.close}
            className="h-auto w-auto p-1"
            style={{ color: muted }}
          >
            <LuX size={20} />
          </Button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px' }}>
          {!user ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', paddingTop: '32px' }}>
              <span style={{ fontSize: '48px' }}>🔒</span>
              <p style={{ fontSize: '15px', color: muted, textAlign: 'center' }}>{t.loginRequired}</p>
              <Button
                onClick={() => { onClose(); onShowAuth?.() }}
                className="h-auto rounded-[10px] bg-gradient-to-br from-[#2E4A6A] to-[#1A2F48] px-7 py-[11px] text-sm font-bold text-white hover:opacity-90"
              >
                {t.login}
              </Button>
            </div>
          ) : innerView === 'list' ? (
            <div>
              {/* Barre de recherche — vue "cette semaine" uniquement, à partir de 4 restes */}
              {view === 'thisweek' && viewLeftovers.length > 3 && (
                <div style={{ marginBottom: '10px' }}>
                  <Field label={t.searchLeftoverAria} labelStyle={{ display: 'block', fontSize: '12px', fontWeight: 700, color: muted, marginBottom: '6px' }}>
                  <input
                    type="search"
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    placeholder={t.searchLeftover}
                    style={{
                      width: '100%', padding: '9px 14px',
                      borderRadius: '10px',
                      border: `1px solid ${darkMode ? '#2A3A50' : '#E8D5B8'}`,
                      background: darkMode ? '#1A2535' : '#FFF',
                      color: 'var(--color-charcoal)', fontSize: '13px',
                      outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                    }}
                  />
                  </Field>
                </div>
              )}
              {/* Sélecteur de tri — uniquement vue "cette semaine" et au moins 1 reste */}
              {view === 'thisweek' && (activeOnes.length + expiredOnes.length) > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: muted }}>{t.sortBy} :</span>
                  <div style={{ display: 'flex', background: darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)', borderRadius: '8px', padding: '3px', gap: '2px' }}>
                    {[
                      { id: 'dlc',  label: t.sortByDlc },
                      { id: 'name', label: t.sortByName },
                    ].map(opt => (
                      <Button
                        key={opt.id}
                        variant="ghost"
                        onClick={() => setSortMode(opt.id)}
                        className={`h-auto rounded-md px-3 py-1 text-xs hover:bg-transparent ${sortMode === opt.id ? 'font-bold shadow-[0_1px_4px_rgba(0,0,0,0.10)]' : 'font-medium'}`}
                        style={{
                          background: sortMode === opt.id ? (darkMode ? '#243650' : '#FDFAF6') : 'transparent',
                          color: sortMode === opt.id ? 'var(--color-warm-600)' : muted,
                        }}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Restes actifs */}
              {activeOnes.length === 0 && expiredOnes.length === 0 ? (
                <p style={{ fontSize: '14px', color: muted, textAlign: 'center', paddingTop: '24px' }}>
                  {searchNorm ? t.noSearchResult : (view === 'today' ? t.noLeftovers : t.noLeftoversWeek)}
                </p>
              ) : (
                <>
                  {activeOnes.length > 0 && (
                    <div>
                      {view === 'thisweek' && expiredOnes.length > 0 && (
                        <div style={{ fontSize: '11px', fontWeight: 600, color: muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                          {t.activeSection}
                        </div>
                      )}
                      {activeOnes.map(l => (
                        <LeftoverCard key={l.id} leftover={l} onDelete={handleDeleteUndoable} t={t} lang={lang} darkMode={darkMode} INGREDIENTS={INGREDIENTS} />
                      ))}
                    </div>
                  )}
                  {expiredOnes.length > 0 && (
                    <div style={{ marginTop: activeOnes.length > 0 ? '16px' : 0 }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#B91C1C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                        ⚠️ {t.expiredSection}
                      </div>
                      {expiredOnes.map(l => (
                        <LeftoverCard key={l.id} leftover={l} onDelete={handleDeleteUndoable} t={t} lang={lang} darkMode={darkMode} INGREDIENTS={INGREDIENTS} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            /* Vue création */
            <LeftoversCreateView
              form={{
                addMode, setAddMode,
                selectedIngId, setSelectedIngId,
                selectedRecipeId, setSelectedRecipeId,
                freeName, setFreeName,
                freeEmoji, setFreeEmoji,
                dlcDays, setDlcDays,
                hygieneOpen, setHygieneOpen,
                searchQ, setSearchQ,
              }}
              theme={{ border, muted, darkMode }}
              data={{ INGREDIENTS, availableRecipes, stockIngredients, searchNorm }}
              i18n={{ t, lang }}
            />
          )}
        </div>

        {/* Footer */}
        {user && (
          <div style={{
            padding: '12px 20px', borderTop: `1px solid ${border}`,
            display: 'flex', gap: '10px', flexShrink: 0,
          }}>
            {innerView === 'list' && view === 'today' ? (
              <Button
                onClick={() => setInnerView('create')}
                className="h-auto flex-1 gap-2 rounded-[12px] bg-gradient-to-br from-[#2E4A6A] to-[#1A2F48] py-3 text-sm font-bold text-white hover:opacity-90"
              >
                <LuPlus size={16} />
                {t.add}
              </Button>
            ) : innerView === 'create' ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setInnerView('list')}
                  className="h-auto flex-1 rounded-[12px] border-[1.5px] py-3 text-sm font-semibold"
                  style={{
                    borderColor: border,
                    background: darkMode ? '#1A2535' : '#F5EDE0',
                    color: 'var(--color-charcoal)',
                  }}
                >
                  {t.cancel}
                </Button>
                <Button
                  onClick={handleAdd}
                  loading={saving}
                  disabled={!canAdd || saving}
                  className={`h-auto flex-[2] rounded-[12px] py-3 text-sm font-bold ${canAdd && !saving ? 'bg-gradient-to-br from-[#2E4A6A] to-[#1A2F48] text-white' : ''}`}
                  style={canAdd && !saving ? undefined : { background: darkMode ? '#2A3A4D' : '#D0C8BC', color: muted }}
                >
                  {t.addBtn}
                </Button>
              </>
            ) : null}
          </div>
        )}

        {/* Toast confirmation création */}
        {toast && (
          <div style={{
            position: 'absolute', bottom: '88px', left: '50%', transform: 'translateX(-50%)',
            background: 'var(--color-success)', color: 'white',
            padding: '10px 18px', borderRadius: '999px',
            display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: '13px', fontWeight: 700,
            boxShadow: '0 8px 24px rgba(22,163,74,0.35)',
            animation: 'modal-enter 0.22s ease both',
            zIndex: 60, pointerEvents: 'none',
            maxWidth: 'calc(100% - 32px)',
          }}>
            <span style={{ fontSize: '16px' }}>{toast.emoji}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {toast.message} — {toast.name}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
