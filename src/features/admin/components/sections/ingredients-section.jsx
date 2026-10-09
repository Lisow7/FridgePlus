import { useState, useCallback, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { LuPlus, LuPencil, LuTrash2 } from 'react-icons/lu'
import { adminGetIngredients, adminGetIngredientById, adminUpsertIngredient, adminDeleteIngredient } from '@features/admin/api/admin'
import { SUBCATEGORIES, SUBCAT_LABELS } from '@features/admin/lib/ingredient-taxonomy'
import { useAdmin } from '../../providers/admin-provider'
import IngredientForm from './ingredient-form'
import { ConfirmDeleteModal } from '@shared/ui/confirm-dialog/confirm-modals'
import FeedbackBanner from '../shared/feedback-banner'
import SearchInput from '../shared/search-input'
import Button from '@shared/ui/button'
import IconButton from '@shared/ui/icon-button'
import EmptyState from '@shared/ui/empty-state'
import Pagination from '@shared/ui/pagination'

const PER_PAGE = 50

// ── Section principale ────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
export default function IngredientsSection({ lang = 'fr', darkMode = false, isMobile = false }) {
  const { refreshStats, focusEditId, setFocusEditId } = useAdmin()

  const border    = darkMode ? '#2A3A50' : '#D9CCBA'
  const textColor = darkMode ? '#C8D8E8' : '#1A0F00'
  const muted     = darkMode ? '#7A90A8' : '#5C4033'
  const rowBg     = darkMode ? '#141F2E' : '#F2E8D8'

  const [ingList,        setIngList]        = useState([])
  const [ingCount,       setIngCount]       = useState(0)
  const [ingPage,        setIngPage]        = useState(0)
  const [ingSearch,      setIngSearch]      = useState('')
  const [ingLoading,     setIngLoading]     = useState(false)
  const [editIngredient, setEditIngredient] = useState(null)
  const [ingSort,        setIngSort]        = useState('subcategory')
  const [ingSubcat,      setIngSubcat]      = useState('')
  const [confirmDelete,  setConfirmDelete]  = useState(null)
  const [feedback,       setFeedback]       = useState(null)

  function showFeedback(ok, msg) {
    setFeedback({ ok, msg })
    setTimeout(() => setFeedback(null), 3000)
  }

  const loadIngredients = useCallback(async () => {
    setIngLoading(true)
    const { data, count } = await adminGetIngredients({ page: ingPage, search: ingSearch, subcategory: ingSubcat })
    setIngList(data ?? []); setIngCount(count ?? 0); setIngLoading(false)
  }, [ingPage, ingSearch, ingSubcat])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadIngredients() }, [loadIngredients])

  // Drill-down Qualité : ouvre directement l'éditeur de l'ingrédient ciblé.
  useEffect(() => {
    if (!focusEditId) return
    let cancelled = false
    ;(async () => {
      const { data } = await adminGetIngredientById(focusEditId)
      if (cancelled) return
      if (data) setEditIngredient({ ...data, _isNew: false })
      else showFeedback(false, 'Ingrédient introuvable.')
      setFocusEditId(null)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusEditId])

  const sortedList = useMemo(() => {
    const list = [...ingList]
    if (ingSort === 'name') return list.sort((a, b) => (a.labels?.fr ?? '').localeCompare(b.labels?.fr ?? '', 'fr'))
    if (ingSort === 'id')   return list.sort((a, b) => a.id.localeCompare(b.id))
    return list
  }, [ingList, ingSort])

  async function handleSaveIngredient(row) {
    const result = await adminUpsertIngredient(row)
    if (!result.error) {
      setEditIngredient(null)
      showFeedback(true, row._isNew ? 'Ingrédient ajouté.' : 'Ingrédient enregistré.')
      loadIngredients(); refreshStats()
    }
    return result
  }

  async function handleConfirmDelete() {
    const id = confirmDelete
    setConfirmDelete(null)
    if (!id) return
    const { error } = await adminDeleteIngredient(id)
    if (error) showFeedback(false, 'Erreur lors de la suppression.')
    else showFeedback(true, 'Ingrédient supprimé.')
    loadIngredients(); refreshStats()
  }


  if (editIngredient) {
    return <IngredientForm item={editIngredient} onSave={handleSaveIngredient} onBack={() => setEditIngredient(null)} darkMode={darkMode} border={border} textColor={textColor} muted={muted} isMobile={isMobile} />
  }

  return (
    <div>
      <FeedbackBanner feedback={feedback} />
      <div style={{ display:'flex', gap:8, marginBottom:8 }}>
        <SearchInput value={ingSearch} onChange={v => { setIngSearch(v); setIngPage(0) }} placeholder="Rechercher…" darkMode={darkMode} />
        <Button
          onClick={() => setEditIngredient({ _isNew:true })}
          className="h-auto rounded-[10px] bg-[#E07820] px-3.5 py-2 text-sm font-bold text-white"
          style={{ gap: 5 }}
        >
          <LuPlus size={14} /> Ajouter
        </Button>
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
        <select value={ingSubcat} onChange={e => { setIngSubcat(e.target.value); setIngPage(0) }}
          style={{ flex:'1 1 180px', padding:'7px 10px', borderRadius:8, border:`1px solid ${ingSubcat ? 'var(--color-brand-500)' : border}`, background: darkMode ? '#141F2E' : '#FFF', color: ingSubcat ? 'var(--color-brand-500)' : muted, fontSize:12, outline:'none', fontFamily:'inherit', cursor:'pointer' }}>
          <option value=''>Toutes les sous-catégories</option>
          {SUBCATEGORIES.map(sc => <option key={sc} value={sc}>{SUBCAT_LABELS[sc] ?? sc}</option>)}
        </select>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {[['subcategory','Sous-cat.'], ['name','Nom'], ['id','ID']].map(([v, l]) => (
            <Button
              key={v}
              variant="ghost"
              aria-pressed={ingSort === v}
              onClick={() => setIngSort(v)}
              className="h-auto rounded-md border px-2.5 py-1 text-xs hover:bg-transparent"
              style={{
                borderColor: ingSort === v ? 'var(--color-brand-500)' : border,
                background: ingSort === v ? 'rgba(224,120,32,0.12)' : 'transparent',
                color: ingSort === v ? 'var(--color-brand-500)' : muted,
              }}
            >
              {l}
            </Button>
          ))}
        </div>
      </div>

      {ingLoading
        ? <div style={{ textAlign:'center', padding:'40px', color:muted, fontSize:13 }}>Chargement…</div>
        : sortedList.length === 0
        ? <EmptyState muted={muted}>Aucun ingrédient.</EmptyState>
        : (
          <>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {sortedList.map(ing => (
                <div key={ing.id} style={{ padding:'10px 14px', borderRadius:10, background:rowBg, border:`1px solid ${border}`, display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:20, flexShrink:0 }}>{ing.emoji}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:600, color:textColor, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ing.labels?.fr ?? '—'}</div>
                    <div style={{ fontSize:12, color:muted, marginTop:1 }}>{ing.id} · {ing.subcategory}</div>
                  </div>
                  <div style={{ display:'flex', gap:2, flexShrink:0 }}>
                    <IconButton color="var(--color-info)" onClick={() => setEditIngredient({ ...ing, _isNew:false })} aria-label="Modifier">
                      <LuPencil size={14} />
                    </IconButton>
                    <IconButton color="var(--color-danger)" onClick={() => setConfirmDelete(ing.id)} aria-label="Supprimer">
                      <LuTrash2 size={14} />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>
            {ingCount > PER_PAGE && (
              <Pagination
                page={ingPage}
                totalPages={Math.ceil(ingCount / PER_PAGE)}
                onPageChange={setIngPage}
                itemsCount={ingCount}
                itemsLabel="ingrédients"
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
          title="Supprimer cet ingrédient ?"
          body="L'ingrédient sera supprimé du catalogue. Cette action est définitive — vérifiez qu'aucune recette ne le référence avant de continuer."
          confirmLabel="Supprimer" cancelLabel="Annuler"
          onConfirm={handleConfirmDelete} onCancel={() => setConfirmDelete(null)}
          darkMode={darkMode}
        />, document.body
      )}
    </div>
  )
}
