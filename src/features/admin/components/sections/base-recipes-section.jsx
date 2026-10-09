import { useState, useCallback, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { LuPlus, LuPencil, LuTrash2 } from 'react-icons/lu'
import { adminGetBaseRecipes, adminGetBaseRecipeById, adminUpsertBaseRecipe, adminDeleteBaseRecipe, adminGetFavoriteCountsByIds, countMissingImageBaseRecipes } from '@features/admin/api/admin'
import { hasNoImage } from '@features/admin/lib/missing-image'
import { MissingImageControls, MissingImageBadge } from '@features/admin/components/MissingImageControls'
import { useAdmin } from '../../providers/admin-provider'
import { ConfirmDeleteModal } from '@shared/ui/confirm-dialog/confirm-modals'
import FeedbackBanner from '../shared/feedback-banner'
import SearchInput from '../shared/search-input'
import Button from '@shared/ui/button'
import IconButton from '@shared/ui/icon-button'
import EmptyState from '@shared/ui/empty-state'
import Pagination from '@shared/ui/pagination'
import { useReloader } from '@shared/hooks/use-reloader'
import { leverSiErreur } from '@shared/lib/supabase/lever-si-erreur'
import { useDebouncedValue } from '@shared/hooks/use-debounced-value'
import { useFeedback } from '@features/admin/hooks/use-feedback'
import ChargementRate from '../shared/chargement-rate'
import { DIFF_OPTIONS, DIFF_LABELS, TYPE_OPTIONS, TYPE_LABELS } from '@features/admin/data/base-recipe-options'

const PER_PAGE = 50

import BaseRecipeForm from './base-recipe-form'
import { texteLisible } from '@shared/lib/couleurs/texte-lisible'

// ── Section principale ────────────────────────────────────────────────────────

 
export default function BaseRecipesSection({ lang = 'fr', darkMode = false, isMobile = false }) {
  const { refreshStats, focusEditId, setFocusEditId } = useAdmin()

  const border    = darkMode ? '#2A3A50' : '#D9CCBA'
  const textColor = darkMode ? '#C8D8E8' : '#1A0F00'
  const muted     = darkMode ? '#7A90A8' : '#5C4033'
  const rowBg     = darkMode ? '#141F2E' : '#F2E8D8'

  const [brList,         setBrList]         = useState([])
  const [brCount,        setBrCount]        = useState(0)
  const [brPage,         setBrPage]         = useState(0)
  const [brSearch,       setBrSearch]       = useState('')
  const [editBaseRecipe, setEditBaseRecipe] = useState(null)
  const [brSort,         setBrSort]         = useState('id')
  const [brFavCounts,    setBrFavCounts]    = useState({})
  const [brType,         setBrType]         = useState('')
  const [brDiff,         setBrDiff]         = useState('')
  const [brTimeFilter,   setBrTimeFilter]   = useState('')
  const [confirmDelete,  setConfirmDelete]  = useState(null)
  const [feedback,       showFeedback]      = useFeedback(3000)
  const [showOnlyMissing, setShowOnlyMissing] = useState(false)
  const [missingCount,    setMissingCount]    = useState(0)
  const rechercheStable = useDebouncedValue(brSearch) // une requête quand on cesse de taper (ADM-09)

  // `useReloader` (audit ADM-09) : si les favoris levaient, « Chargement… » restait
  // affiché pour toujours. Ils sont un détail : leur échec laisse la liste.
  const { loading: brLoading, error: erreurChargement, reload: loadBaseRecipes } = useReloader(async (estObsolete) => {
    const { data, count } = leverSiErreur(await adminGetBaseRecipes({ page: brPage, search: rechercheStable, type: brType, difficulty: brDiff, timeRange: brTimeFilter, missingImage: showOnlyMissing, sort: brSort }))
    if (estObsolete()) return
    setBrList(data ?? []); setBrCount(count ?? 0)
    let favoris = {}
    try { if (data?.length) favoris = await adminGetFavoriteCountsByIds(data.map(r => r.id)) } catch { /* détail */ }
    if (!estObsolete()) setBrFavCounts(favoris)
  }, [brPage, rechercheStable, brType, brDiff, brTimeFilter, showOnlyMissing, brSort])

  const loadMissingCount = useCallback(() => { countMissingImageBaseRecipes().then(setMissingCount) }, [])
  useEffect(() => { loadMissingCount() }, [loadMissingCount])

  // Drill-down Qualité : ouvre directement l'éditeur de la recette ciblée.
  useEffect(() => {
    if (!focusEditId) return
    let cancelled = false
    ;(async () => {
      const { data } = await adminGetBaseRecipeById(focusEditId)
      if (cancelled) return
      if (data) setEditBaseRecipe({ ...data, _isNew: false })
      else showFeedback(false, 'Recette introuvable.')
      setFocusEditId(null)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusEditId])

  // Nom, type, identifiant : triés par la base, sur tout le catalogue (audit
  // ADM-10). Les favoris se comptent page par page : ce tri-là reste ici, et
  // son bouton dit « cette page ».
  const sortedList = useMemo(() => (brSort === 'favorites'
    ? [...brList].sort((a, b) => (brFavCounts[b.id] ?? 0) - (brFavCounts[a.id] ?? 0))
    : brList), [brList, brSort, brFavCounts])

  async function handleSaveBaseRecipe(row) {
    const result = await adminUpsertBaseRecipe(row)
    if (!result.error) {
      setEditBaseRecipe(null)
      showFeedback(true, row._isNew ? 'Recette ajoutée.' : 'Recette enregistrée.')
      loadBaseRecipes(); refreshStats(); loadMissingCount()
    }
    return result
  }

  async function handleConfirmDelete() {
    const id = confirmDelete
    setConfirmDelete(null)
    if (!id) return
    const { error } = await adminDeleteBaseRecipe(id)
    if (error) showFeedback(false, 'Erreur lors de la suppression.')
    else showFeedback(true, 'Recette supprimée.')
    loadBaseRecipes(); refreshStats(); loadMissingCount()
  }

  // eslint-disable-next-line no-unused-vars
  const chipBtn = (active, onClick, color, label) => (
    <Button
      key={label}
      variant="ghost"
      aria-pressed={active}
      onClick={onClick}
      className="h-auto rounded-lg border px-2.5 py-0.5 text-xs hover:bg-transparent"
      style={{
        borderColor: active ? color : border,
        background: active ? `${color}1A` : 'transparent',
        color: active ? color : muted,
      }}
    >
      {label}
    </Button>
  )

  if (editBaseRecipe) {
    return <BaseRecipeForm item={editBaseRecipe} onSave={handleSaveBaseRecipe} onBack={() => setEditBaseRecipe(null)} darkMode={darkMode} border={border} textColor={textColor} muted={muted} isMobile={isMobile} />
  }

  return (
    <div>
      <FeedbackBanner feedback={feedback} />
      <div style={{ display:'flex', gap:8, marginBottom:8 }}>
        <SearchInput value={brSearch} onChange={v => { setBrSearch(v); setBrPage(0) }} label="Rechercher une recette" darkMode={darkMode} />
        <Button
          onClick={() => setEditBaseRecipe({ _isNew:true })}
          className="h-auto rounded-[10px] bg-[#B85000] px-3.5 py-2 text-sm font-bold text-white"
          style={{ gap: 5 }}
        >
          <LuPlus size={14} /> Ajouter
        </Button>
      </div>

      {/* Tri */}
      <div style={{ display:'flex', gap:4, marginBottom:8, flexWrap:'wrap' }}>
        {[['id','ID'], ['name','Nom'], ['type','Type'], ['favorites','Favoris (cette page)']].map(([v, l]) => (
          <Button
            key={v}
            variant="ghost"
            aria-pressed={brSort === v}
            onClick={() => { setBrSort(v); setBrPage(0) }}
            className="h-auto rounded-lg border px-2.5 py-0.5 text-xs hover:bg-transparent"
            style={{
              borderColor: brSort === v ? 'var(--color-brand-500)' : border,
              background: brSort === v ? 'rgba(224,120,32,0.12)' : 'transparent',
              color: brSort === v ? texteLisible('var(--color-brand-500)') : muted,
            }}
          >
            {l}
          </Button>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
        <select aria-label="Filtrer par type" value={brType} onChange={e => { setBrType(e.target.value); setBrPage(0) }}
          style={{ flex:'1 1 140px', padding:'7px 10px', borderRadius:8, border:`1px solid ${brType ? 'var(--color-info)' : border}`, background: darkMode ? '#141F2E' : '#FFF', color: brType ? 'var(--color-info)' : muted, fontSize:12, outline:'none', fontFamily:'inherit', cursor:'pointer' }}>
          <option value=''>Tous les types</option>
          {TYPE_OPTIONS.map(v => <option key={v} value={v}>{TYPE_LABELS[v] ?? v}</option>)}
        </select>
        <select aria-label="Filtrer par difficulté" value={brDiff} onChange={e => { setBrDiff(e.target.value); setBrPage(0) }}
          style={{ flex:'1 1 140px', padding:'7px 10px', borderRadius:8, border:`1px solid ${brDiff ? 'var(--color-success)' : border}`, background: darkMode ? '#141F2E' : '#FFF', color: brDiff ? 'var(--color-success)' : muted, fontSize:12, outline:'none', fontFamily:'inherit', cursor:'pointer' }}>
          <option value=''>Toutes difficultés</option>
          {DIFF_OPTIONS.map(v => <option key={v} value={v}>{DIFF_LABELS[v] ?? v}</option>)}
        </select>
        <select aria-label="Filtrer par temps" value={brTimeFilter} onChange={e => { setBrTimeFilter(e.target.value); setBrPage(0) }}
          style={{ flex:'1 1 140px', padding:'7px 10px', borderRadius:8, border:`1px solid ${brTimeFilter ? '#7C3AED' : border}`, background: darkMode ? '#141F2E' : '#FFF', color: brTimeFilter ? '#7C3AED' : muted, fontSize:12, outline:'none', fontFamily:'inherit', cursor:'pointer' }}>
          <option value=''>Tout temps</option>
          <option value='quick'>⏱ ≤ 20 min</option>
          <option value='medium'>⏱ 21–45 min</option>
          <option value='long'>⏱ {'>'} 45 min</option>
        </select>
        <MissingImageControls
          count={missingCount}
          active={showOnlyMissing}
          onToggle={() => { setShowOnlyMissing(v => !v); setBrPage(0) }}
          lang={lang}
        />
      </div>

      {brLoading
        ? <div style={{ textAlign:'center', padding:'40px', color:muted, fontSize:13 }}>Chargement…</div>
        : erreurChargement
        ? <ChargementRate error={erreurChargement} onRetry={loadBaseRecipes} lang={lang} />
        : sortedList.length === 0
        ? <EmptyState muted={muted}>Aucune recette de base.</EmptyState>
        : (
          <>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {sortedList.map(rec => (
                <div key={rec.id} style={{ padding:'10px 14px', borderRadius:10, background:rowBg, border:`1px solid ${border}`, display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:20, flexShrink:0 }}>{rec.emoji}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:600, color:textColor, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:6 }}>
                      {rec.name?.fr ?? '—'}
                      {hasNoImage(rec) && <MissingImageBadge lang={lang} />}
                    </div>
                    <div style={{ fontSize:12, color:muted, marginTop:1, display:'flex', gap:6, flexWrap:'wrap' }}>
                      <span>{rec.id}</span>
                      <span>·</span>
                      <span>{rec.type}</span>
                      <span>·</span>
                      <span>{rec.difficulty}</span>
                      {rec.country && <><span>·</span><span>{rec.country}</span></>}
                      {rec.status === 'archived' && <span style={{ padding:'1px 6px', borderRadius:8, background:'rgba(100,100,100,0.15)', color:muted }}>archivé</span>}
                    </div>
                  </div>
                  <span style={{ fontSize:12, color: (brFavCounts[rec.id] ?? 0) > 0 ? 'var(--color-brand-500)' : muted, background: (brFavCounts[rec.id] ?? 0) > 0 ? 'rgba(224,120,32,0.1)' : 'transparent', padding:'2px 7px', borderRadius:20, flexShrink:0, minWidth:36, textAlign:'center' }}>
                    ❤️ {brFavCounts[rec.id] ?? 0}
                  </span>
                  <div style={{ display:'flex', gap:2, flexShrink:0 }}>
                    <IconButton color="var(--color-info)" onClick={() => setEditBaseRecipe({ ...rec, _isNew:false })} aria-label="Modifier">
                      <LuPencil size={14} />
                    </IconButton>
                    <IconButton color="var(--color-danger)" onClick={() => setConfirmDelete(rec.id)} aria-label="Supprimer">
                      <LuTrash2 size={14} />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>
            {brCount > PER_PAGE && (
              <Pagination
                page={brPage}
                totalPages={Math.ceil(brCount / PER_PAGE)}
                onPageChange={setBrPage}
                itemsCount={brCount}
                itemsLabel="recettes"
                mode="icon"
                border={border}
                muted={muted}
                text={textColor}
              />
            )}
          </>
        )
      }

      {confirmDelete && createPortal(
        <ConfirmDeleteModal
          title="Supprimer cette recette de base ?"
          body="La recette sera supprimée du catalogue officiel. Cette action est définitive — les utilisateurs qui l'avaient en favori la perdront."
          confirmLabel="Supprimer" cancelLabel="Annuler"
          onConfirm={handleConfirmDelete} onCancel={() => setConfirmDelete(null)}
          darkMode={darkMode}
        />, document.body
      )}
    </div>
  )
}
