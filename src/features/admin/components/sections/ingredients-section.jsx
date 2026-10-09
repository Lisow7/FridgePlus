import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { LuPlus, LuPencil, LuTrash2 } from 'react-icons/lu'
import { adminGetIngredients, adminGetIngredientById, adminUpsertIngredient, adminDeleteIngredient, adminCountIngredientUsage } from '@features/admin/api/admin'
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
import { useReloader } from '@shared/hooks/use-reloader'
import { leverSiErreur } from '@shared/lib/supabase/lever-si-erreur'
import { useDebouncedValue } from '@shared/hooks/use-debounced-value'
import { useFeedback } from '@features/admin/hooks/use-feedback'
import ChargementRate from '../shared/chargement-rate'
import { texteLisible } from '@shared/lib/couleurs/texte-lisible'

const PER_PAGE = 50

// ── Section principale ────────────────────────────────────────────────────────

// Ce que la suppression va casser, compté (`usage` : null si le compte a échoué).
function texteDeSuppression(usage) {
  if (usage === null) return 'Impossible de compter les recettes qui s\'en servent : vérifie avant de continuer. Cette action est définitive.'
  if (usage === 0) return 'Aucune recette ne s\'en sert. Cette action est définitive.'
  return usage > 1
    ? `${usage} recettes s'en servent : il deviendra introuvable pour elles. Cette action est définitive.`
    : '1 recette s\'en sert : il deviendra introuvable pour elle. Cette action est définitive.'
}

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
  const [editIngredient, setEditIngredient] = useState(null)
  const [ingSort,        setIngSort]        = useState('subcategory')
  const [ingSubcat,      setIngSubcat]      = useState('')
  const [confirmDelete,  setConfirmDelete]  = useState(null)
  const [feedback,       showFeedback]      = useFeedback(3000)
  // Une requête quand on cesse de taper, pas une par frappe (audit ADM-09).
  const rechercheStable = useDebouncedValue(ingSearch)

  // `useReloader` : un `finally`, une garde contre la réponse obsolète, et
  // l'échec dit au lieu d'« Aucun ingrédient » (audit ADM-08, ADM-09).
  const { loading: ingLoading, error: erreurChargement, reload: loadIngredients } = useReloader(async (estObsolete) => {
    const { data, count } = leverSiErreur(await adminGetIngredients({ page: ingPage, search: rechercheStable, subcategory: ingSubcat, sort: ingSort }))
    if (estObsolete()) return
    setIngList(data ?? []); setIngCount(count ?? 0)
  }, [ingPage, rechercheStable, ingSubcat, ingSort])

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

  // Le tri vient de la base, sur tout le catalogue (audit ADM-10) : ici, il ne
  // rangeait que la page affichée.
  const sortedList = ingList

  async function handleSaveIngredient(row) {
    const result = await adminUpsertIngredient(row)
    if (!result.error) {
      setEditIngredient(null)
      showFeedback(true, row._isNew ? 'Ingrédient ajouté.' : 'Ingrédient enregistré.')
      loadIngredients(); refreshStats()
    }
    return result
  }

  // La confirmation dit combien de recettes s'en servent : elle demandait de
  // « vérifier qu'aucune recette ne le référence », sans liste ni compteur
  // (audit du 2026-10-04, ADM-16).
  async function demanderLaSuppression(ing) {
    const { count, error } = await adminCountIngredientUsage(ing.id)
    setConfirmDelete({ id: ing.id, usage: error ? null : count })
  }

  async function handleConfirmDelete() {
    const id = confirmDelete?.id
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
        <SearchInput value={ingSearch} onChange={v => { setIngSearch(v); setIngPage(0) }} label="Rechercher un ingrédient" darkMode={darkMode} />
        <Button
          onClick={() => setEditIngredient({ _isNew:true })}
          className="h-auto rounded-[10px] bg-[#B85000] px-3.5 py-2 text-sm font-bold text-white"
          style={{ gap: 5 }}
        >
          <LuPlus size={14} /> Ajouter
        </Button>
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
        <select aria-label="Filtrer par sous-catégorie" value={ingSubcat} onChange={e => { setIngSubcat(e.target.value); setIngPage(0) }}
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
              onClick={() => { setIngSort(v); setIngPage(0) }}
              className="h-auto rounded-md border px-2.5 py-1 text-xs hover:bg-transparent"
              style={{
                borderColor: ingSort === v ? 'var(--color-brand-500)' : border,
                background: ingSort === v ? 'rgba(224,120,32,0.12)' : 'transparent',
                color: ingSort === v ? texteLisible('var(--color-brand-500)') : muted,
              }}
            >
              {l}
            </Button>
          ))}
        </div>
      </div>

      {ingLoading
        ? <div style={{ textAlign:'center', padding:'40px', color:muted, fontSize:13 }}>Chargement…</div>
        : erreurChargement
        ? <ChargementRate error={erreurChargement} onRetry={loadIngredients} lang={lang} />
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
                    <IconButton color="var(--color-danger)" onClick={() => demanderLaSuppression(ing)} aria-label="Supprimer">
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
          body={texteDeSuppression(confirmDelete.usage)}
          confirmLabel="Supprimer" cancelLabel="Annuler"
          onConfirm={handleConfirmDelete} onCancel={() => setConfirmDelete(null)}
          darkMode={darkMode}
        />, document.body
      )}
    </div>
  )
}
