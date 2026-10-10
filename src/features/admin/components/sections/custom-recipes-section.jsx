import ModerationReasonModal from './moderation-reason-modal'
import { useState, useMemo, useId } from 'react'
import { createPortal } from 'react-dom'
import { LuCheck, LuBan, LuPencil, LuTrash2, LuSparkles, LuClock } from 'react-icons/lu'
import { TYPE_OPTIONS as RECIPE_TYPE_OPTIONS, DIFFICULTY_LABELS as RECIPE_DIFF_LABELS } from '@shared/static/recipe-constants'
import { useCountries, useIngredientsById } from '@shared/contexts/data-provider'
import { countRecipeIssues } from '@shared/lib/recipes/recipe-completeness'
import { useUndo } from '@shared/contexts/undo-provider'
import {
  adminGetRecipesByStatus, adminSetRecipeStatus, adminDeleteRecipe,
  adminUpdateCommunityRecipe, adminPromoteRecipeToBase,
} from '@features/admin/api/admin'
import { useAdmin } from '../../providers/admin-provider'
import { hasNoImage, countMissingImages } from '@features/admin/lib/missing-image'
import { MissingImageControls, MissingImageBadge } from '@features/admin/components/MissingImageControls'
import RecipeFormModal from '@features/recipes/components/recipe-form-modal'
import HoverIconButton from '../shared/hover-icon-button'
import { ConfirmDeleteModal, ConfirmActionModal } from '@shared/ui/confirm-dialog/confirm-modals'
import FeedbackBanner from '../shared/feedback-banner'
import ChargementRate from '../shared/chargement-rate'
import BulkActionBar from '../shared/bulk-action-bar'
import CaseDeSelection from '../shared/case-de-selection'
import { appliquerEnLot, messageDeLot } from '@features/admin/lib/appliquer-en-lot'
import { useSelection } from '@features/admin/hooks/use-selection'
import Button from '@shared/ui/button'
import { formatDate } from '@shared/lib/format-date'
import { useReloader } from '@shared/hooks/use-reloader'
import { leverSiErreur } from '@shared/lib/supabase/lever-si-erreur'
import { useFeedback } from '@features/admin/hooks/use-feedback'
import { supprimerAvecAnnulation, messageErreurAdmin } from '@features/admin/lib/ecritures-admin'
import { texteLisible, fondTeinte } from '@shared/lib/couleurs/texte-lisible'

const STATUS_COLORS = {
  pending:  { bg:'rgba(251,191,36,0.15)', color:'var(--color-warning)' },
  approved: { bg:'rgba(34,197,94,0.12)',  color:'var(--color-success)' },
  rejected: { bg:'rgba(239,68,68,0.12)',  color:'var(--color-danger)' },
}


function fmtDate(str, lang = 'fr') { return str ? formatDate(str, lang) : '' }

const I18N = {
  fr: {
    pending:'En attente', approved:'Approuvées', rejected:'Rejetées',
    approve:'Approuver', reject:'Rejeter', pendingAction:'Corrections', editCommunity:'Modifier',
    noRecipes:'Aucune recette dans cette catégorie.',
    filterAll:'Tous', search:'Rechercher une recette',
    timeQuick:'≤ 20 min', timeMedium:'21–45 min', timeLong:'> 45 min',
    confirmDeleteRecipeTitle:'Supprimer cette recette ?',
    confirmDeleteRecipeBody:'La recette sera retirée. Tu auras 10 secondes pour annuler.',
    confirmDeleteAction:'Supprimer', confirmCancel:'Annuler',
    undoRecipeRemoved:'Recette supprimée',
    confirmPromoteTitle:'Promouvoir cette recette ?',
    confirmPromoteBody:(name) => `« ${name} » sera ajoutée au catalogue de recettes officielles. L'auteur recevra une notification.`,
    confirmPromoteAction:'Promouvoir',
    desc:'Modérez les recettes soumises par la communauté.',
    moderationModalTitles: {
      rejected: 'Motif du refus',
      pending:  'Corrections demandées',
      approved: 'Message pour l\'auteur (optionnel)',
    },
    moderationModalConfirm: 'Confirmer',
    // Libellé écrit au-dessus du champ (décision du 2026-10-06) ; la note
    // est toujours facultative : « Confirmer » part même sans elle.
    moderationModalNoteLabels: {
      rejected: 'Précisions supplémentaires (facultatif)',
      pending:  'Détails des corrections attendues (facultatif)',
      approved: 'Message de félicitations ou note (facultatif)',
    },
  },
  en: {
    pending:'Pending', approved:'Approved', rejected:'Rejected',
    approve:'Approve', reject:'Reject', pendingAction:'Corrections', editCommunity:'Edit',
    noRecipes:'No recipes.',
    filterAll:'All', search:'Search a recipe',
    timeQuick:'≤ 20 min', timeMedium:'21–45 min', timeLong:'> 45 min',
    confirmDeleteRecipeTitle:'Delete this recipe?',
    confirmDeleteRecipeBody:'The recipe will be removed. You will have 10 seconds to undo.',
    confirmDeleteAction:'Delete', confirmCancel:'Cancel',
    undoRecipeRemoved:'Recipe deleted',
    confirmPromoteTitle:'Promote this recipe?',
    confirmPromoteBody:(name) => `"${name}" will be added to the official catalog. The author will be notified.`,
    confirmPromoteAction:'Promote',
    desc:'Moderate recipes submitted by the community.',
    moderationModalTitles: {
      rejected: 'Reason for rejection',
      pending:  'Corrections requested',
      approved: 'Message for the author (optional)',
    },
    moderationModalConfirm: 'Confirm',
    moderationModalNoteLabels: {
      rejected: 'Additional details (optional)',
      pending:  'Details about expected corrections (optional)',
      approved: 'Congratulations message or note (optional)',
    },
  },
}
I18N.es = I18N.en
I18N.de = I18N.en
I18N.ja = I18N.en


export default function CustomRecipesSection({ lang = 'fr', darkMode = false }) {
  const t = I18N[lang] ?? I18N.fr
  const countries = useCountries()
  const ingredientsById = useIngredientsById()
  const { trigger } = useUndo()
  const { pendingCount, setPendingCount, refreshStats } = useAdmin()
  const sel = useSelection()
  const rechercheId = useId()

  const border    = darkMode ? '#2A3A50' : '#D9CCBA'
  const textColor = darkMode ? '#C8D8E8' : '#1A0F00'
  const muted     = darkMode ? '#7A90A8' : '#5C4033'
  const rowBg     = darkMode ? '#141F2E' : '#F2E8D8'

  const [recipes,             setRecipes]             = useState([])
  const [recipeFilter,        setRecipeFilter]        = useState('pending')
  const [recipeSearch,        setRecipeSearch]        = useState('')
  const [recipeTypeFilter,    setRecipeTypeFilter]    = useState('')
  const [recipeDiffFilter,    setRecipeDiffFilter]    = useState('')
  const [recipeCountryFilter, setRecipeCountryFilter] = useState('')
  const [recipeTimeFilter,    setRecipeTimeFilter]    = useState('')
  const [editingRecipe,       setEditingRecipe]       = useState(null)
  const [hiddenRecipeIds,     setHiddenRecipeIds]     = useState(() => new Set())
  const [confirmDeleteRecipe, setConfirmDeleteRecipe] = useState(null)
  const [confirmBulkDelete,   setConfirmBulkDelete]   = useState(false)
  const [confirmBulkApprove,  setConfirmBulkApprove]  = useState(false)
  const [confirmPromoteRecipe,setConfirmPromoteRecipe]= useState(null)
  const [moderationTarget,    setModerationTarget]    = useState(null)
  const [bulkRejectOpen,      setBulkRejectOpen]      = useState(false)
  const [showOnlyMissing,     setShowOnlyMissing]     = useState(false)
  const [feedback,            showFeedback]           = useFeedback()

  // `useReloader` garantit le `finally` (sans lui, une erreur réseau laissait
  // le voyant allumé pour toujours) et périme les réponses en retard : sans ça,
  // enchaîner deux filtres laissait la plus ancienne écraser la plus récente.
  const { loading, error: erreurChargement, reload: loadRecipes } = useReloader(async (estObsolete) => {
    const { data } = leverSiErreur(await adminGetRecipesByStatus(recipeFilter))
    if (estObsolete()) return
    setRecipes(data ?? [])
  }, [recipeFilter])

  const filteredRecipes = useMemo(() => {
    let list = recipes.filter(r => !hiddenRecipeIds.has(r.id))
    if (recipeSearch.trim()) {
      const s = recipeSearch.trim().toLowerCase()
      list = list.filter(r => r.title?.toLowerCase().includes(s) || r.username?.toLowerCase().includes(s))
    }
    if (recipeTypeFilter)    list = list.filter(r => r.data?.type === recipeTypeFilter)
    if (recipeDiffFilter)    list = list.filter(r => r.data?.difficulty === recipeDiffFilter)
    if (recipeCountryFilter) list = list.filter(r => r.data?.country === recipeCountryFilter)
    if (recipeTimeFilter) {
      list = list.filter(r => {
        const mins = parseInt(r.data?.time) || 0
        if (recipeTimeFilter === 'quick')  return mins > 0 && mins <= 20
        if (recipeTimeFilter === 'medium') return mins > 20 && mins <= 45
        if (recipeTimeFilter === 'long')   return mins > 45
        return true
      })
    }
    return list
  }, [recipes, hiddenRecipeIds, recipeSearch, recipeTypeFilter, recipeDiffFilter, recipeCountryFilter, recipeTimeFilter])

  const missingCount = useMemo(() => countMissingImages(filteredRecipes), [filteredRecipes])
  const displayedRecipes = useMemo(
    () => showOnlyMissing ? filteredRecipes.filter(hasNoImage) : filteredRecipes,
    [filteredRecipes, showOnlyMissing]
  )

  function handleSetStatus(id, status, recipeName = '') {
    setModerationTarget({ id, status, recipeName })
  }

  async function handleConfirmStatusWithReason(reason) {
    const { id, status } = moderationTarget
    setModerationTarget(null)
    const { error } = await adminSetRecipeStatus(id, status, reason)
    // Refusée : la recette reste dans la file et le badge ne bouge pas (audit ADM-02).
    if (error) { showFeedback(false, messageErreurAdmin(error, lang)); return }
    setRecipes(r => r.filter(x => x.id !== id))
    if (recipeFilter === 'pending') setPendingCount(c => Math.max(0, c - 1))
    if (status === 'pending') setPendingCount(c => c + 1)
  }

  // Les trois actions groupées suivent un seul chemin.
  // 🔴 Retirer les lignes SANS CONDITION faisait disparaitre de la file des
  // recettes restees en attente en base : l'administrateur croyait avoir
  // modere. On ne purge donc que sur succes complet, sinon on recharge.
  async function appliquerALaSelection(action, libelle) {
    const ids = sel.ids
    if (!ids.length) return
    const bilan = await appliquerEnLot(ids, action)
    if (bilan.toutReussi) {
      setRecipes(r => r.filter(x => !sel.selected.has(x.id)))
      if (recipeFilter === 'pending') setPendingCount(c => Math.max(0, c - bilan.reussis))
    } else {
      loadRecipes()
    }
    sel.clear()
    showFeedback(bilan.toutReussi, messageDeLot(bilan, libelle))
  }
  const libelleDeLot = (fr, en) => n => lang === 'fr' ? `recette${n > 1 ? 's' : ''} ${fr}${n > 1 ? 's' : ''}` : `recipe(s) ${en}`

  // Approuver rend les recettes publiques (`is_public`) : la sélection passe
  // par une confirmation, comme sa suppression (audit du 2026-10-04, ADM-23).
  function handleBulkApprove() {
    setConfirmBulkApprove(false)
    return appliquerALaSelection(id => adminSetRecipeStatus(id, 'approved'), libelleDeLot('approuvée', 'approved'))
  }

  function handleBulkReject(reason) {
    setBulkRejectOpen(false)
    return appliquerALaSelection(id => adminSetRecipeStatus(id, 'rejected', reason), libelleDeLot('rejetée', 'rejected'))
  }

  function handleDeleteRecipe(id) { setConfirmDeleteRecipe(id) }
  function handleConfirmDeleteRecipe() {
    const id = confirmDeleteRecipe
    setConfirmDeleteRecipe(null)
    if (!id) return
    supprimerAvecAnnulation(trigger, {
      label: t.undoRecipeRemoved, id, setMasques: setHiddenRecipeIds,
      supprimer: () => adminDeleteRecipe(id),
      retirer: () => setRecipes(r => r.filter(x => x.id !== id)),
      siEchec: (e) => showFeedback(false, messageErreurAdmin(e, lang)),
    })
  }

  function handleConfirmBulkDelete() {
    setConfirmBulkDelete(false)
    return appliquerALaSelection(id => adminDeleteRecipe(id), libelleDeLot('supprimée', 'deleted'))
  }

  function handlePromoteRecipe(id, name) { setConfirmPromoteRecipe({ id, name }) }
  async function handleConfirmPromoteRecipe() {
    const target = confirmPromoteRecipe
    setConfirmPromoteRecipe(null)
    if (!target) return
    const { data, error } = await adminPromoteRecipeToBase(target.id)
    if (error) { showFeedback(false, (lang === 'fr' ? 'Erreur : ' : 'Error: ') + (error.message ?? String(error))); return }
    if (data?.promoted === false && data?.reason === 'already_promoted') {
      showFeedback(false, lang === 'fr' ? 'Cette recette est déjà promue.' : 'This recipe is already promoted.')
      return
    }
    showFeedback(true, lang === 'fr'
      ? `Recette promue : « ${data.base_id} ». L'auteur a été notifié.`
      : `Recipe promoted as « ${data.base_id} ». Author notified.`)
    refreshStats()
  }

  const FILTERS = [
    { key:'pending',  label: t.pending  },
    { key:'approved', label: t.approved },
    { key:'rejected', label: t.rejected },
  ]

  const filterBtn = (active, onClick, color, label) => (
    <Button
      key={label}
      variant="ghost"
      aria-pressed={active}
      onClick={onClick}
      className="h-auto rounded-lg px-3 py-1.5 text-[13px] hover:bg-transparent"
      style={{
        fontWeight: active ? 700 : 500,
        background: active ? STATUS_COLORS[color]?.bg ?? 'rgba(224,120,32,0.12)' : (darkMode ? '#141F2E' : 'var(--color-bg-warm)'),
        color: active ? texteLisible(STATUS_COLORS[color]?.color ?? 'var(--color-brand-500)') : muted,
        transition: 'all 0.15s',
      }}
    >
      {label}
    </Button>
  )

  const chipBtn = (active, onClick, color, label) => (
    <Button
      key={label}
      variant="ghost"
      aria-pressed={active}
      onClick={onClick}
      className="h-auto min-h-6 rounded-lg border px-2.5 py-0.5 text-xs hover:bg-transparent"
      style={{
        borderColor: active ? color : border,
        background: active ? fondTeinte(color, 10) : 'transparent',
        color: active ? texteLisible(color) : muted,
      }}
    >
      {label}
    </Button>
  )

  return (
    <div>
      <FeedbackBanner feedback={feedback} />

      {/* Filtre statut */}
      <div style={{ display:'flex', gap:6, marginBottom:16 }}>
        {FILTERS.map(({ key, label }) =>
          filterBtn(recipeFilter === key, () => { setRecipeFilter(key); setRecipeSearch(''); setRecipeTypeFilter(''); setRecipeDiffFilter(''); setRecipeCountryFilter(''); setRecipeTimeFilter('') }, key, `${label}${key === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}`)
        )}
      </div>

      {/* Recherche — libellé visible (décision du 2026-10-06) */}
      <label htmlFor={rechercheId} style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--color-muted)', marginBottom:4 }}>{t.search}</label>
      <input id={rechercheId} value={recipeSearch} onChange={e => setRecipeSearch(e.target.value)}
        style={{ width:'100%', padding:'7px 12px', borderRadius:10, border:`1px solid ${border}`, background: darkMode ? '#141F2E' : '#FFF', color:textColor, fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box', marginBottom:8 }} />

      {/* Filtres secondaires */}
      <div style={{ display:'flex', gap:4, marginBottom:6, flexWrap:'wrap' }}>
        {chipBtn(!recipeTypeFilter, () => setRecipeTypeFilter(''), 'var(--color-info)', t.filterAll)}
        {(RECIPE_TYPE_OPTIONS[lang] ?? RECIPE_TYPE_OPTIONS.fr).filter(o => o.value !== 'all').map(({ value, label }) =>
          chipBtn(recipeTypeFilter === value, () => setRecipeTypeFilter(value), 'var(--color-info)', label)
        )}
      </div>
      <div style={{ display:'flex', gap:4, marginBottom:6, flexWrap:'wrap' }}>
        {chipBtn(!recipeDiffFilter, () => setRecipeDiffFilter(''), 'var(--color-success)', t.filterAll)}
        {Object.keys(RECIPE_DIFF_LABELS.fr).map(v =>
          chipBtn(recipeDiffFilter === v, () => setRecipeDiffFilter(v), 'var(--color-success)', RECIPE_DIFF_LABELS[lang]?.[v] ?? v)
        )}
      </div>
      <div style={{ display:'flex', gap:4, marginBottom:6, flexWrap:'wrap' }}>
        {chipBtn(!recipeTimeFilter, () => setRecipeTimeFilter(''), '#7C3AED', t.filterAll)}
        {[['quick', t.timeQuick], ['medium', t.timeMedium], ['long', t.timeLong]].map(([v, l]) =>
          chipBtn(recipeTimeFilter === v, () => setRecipeTimeFilter(v), '#7C3AED', `⏱ ${l}`)
        )}
      </div>
      <div style={{ display:'flex', gap:4, marginBottom:8, flexWrap:'wrap' }}>
        {chipBtn(!recipeCountryFilter, () => setRecipeCountryFilter(''), 'var(--color-warning)', t.filterAll)}
        {Object.entries(countries).map(([code, d]) =>
          chipBtn(recipeCountryFilter === code, () => setRecipeCountryFilter(code), 'var(--color-warning)', `${d.flag} ${d.names?.[lang] ?? d.names?.fr ?? code}`)
        )}
      </div>
      <div style={{ marginBottom:14 }}>
        <MissingImageControls count={missingCount} active={showOnlyMissing} onToggle={() => setShowOnlyMissing(v => !v)} lang={lang} />
      </div>

      {/* Liste */}
      {loading
        ? <div style={{ textAlign:'center', padding:'40px', color:muted, fontSize:13 }}>Chargement…</div>
        : erreurChargement
        ? <ChargementRate error={erreurChargement} onRetry={loadRecipes} lang={lang} />
        : displayedRecipes.length === 0
        ? <p style={{ textAlign:'center', padding:'36px 0', color:muted, fontSize:13, opacity:0.7 }}>{t.noRecipes}</p>
        : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {displayedRecipes.map(recipe => {
              const sc = STATUS_COLORS[recipe.moderation_status] ?? STATUS_COLORS.pending
              const status = recipe.moderation_status
              return (
                <div key={recipe.id} style={{ padding:'14px 16px', borderRadius:12, background:rowBg, border:`1px solid ${border}`, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  {recipeFilter === 'pending' && (
                    <CaseDeSelection cochee={sel.isSelected(recipe.id)} onBasculer={() => sel.toggle(recipe.id)} nom={lang === 'fr' ? 'Sélectionner cette recette' : 'Select this recipe'} />
                  )}
                  <span style={{ fontSize:22, flexShrink:0 }}>{recipe.data?.emoji ?? '🍽️'}</span>
                  {/* Le titre garde 160 px : sans ce plancher, pastilles et actions
                      l'écrasaient à ZÉRO au téléphone (mesuré le 2026-10-08). */}
                  <div style={{ flex:'1 1 160px', minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:textColor, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{recipe.title}</span>
                      {hasNoImage(recipe) && <MissingImageBadge lang={lang} />}
                    </div>
                    <div style={{ fontSize:12, color:muted, marginTop:2 }}>{recipe.username ?? recipe.user_id?.slice(0,8)+'…'} · {fmtDate(recipe.created_at)}</div>
                  </div>
                  {recipe.data?.ai_moderation_status === 'error' && (
                    <span
                      title={lang === 'fr' ? 'La modération IA a échoué — à examiner manuellement en priorité.' : 'AI moderation failed — manual review required in priority.'}
                      style={{ fontSize:12, fontWeight:600, padding:'3px 8px', borderRadius:6, background:'rgba(245,158,11,0.18)', color:'#92400E', flexShrink:0, display:'inline-flex', alignItems:'center', gap:4 }}
                    >
                      <span aria-hidden="true">⚠️ {lang === 'fr' ? 'IA' : 'AI'}</span>
                      <span className="sr-only">{lang === 'fr' ? 'Modération IA en erreur' : 'AI moderation error'}</span>
                    </span>
                  )}
                  {/* R-09 — signal de complétude (re-calculé à l'affichage, pas de stockage).
                      Assiste la modération a priori : repère vite les recettes douteuses. */}
                  {status === 'pending' && (() => {
                    const n = countRecipeIssues(recipe.data, (id) => ingredientsById.has(id))
                    if (n === 0) return null
                    return (
                      <span
                        title={lang === 'fr' ? `${n} problème(s) de complétude détecté(s) — à examiner.` : `${n} completeness issue(s) detected — please review.`}
                        style={{ fontSize:12, fontWeight:600, padding:'3px 8px', borderRadius:6, background:'rgba(239,68,68,0.14)', color:'#B91C1C', flexShrink:0, display:'inline-flex', alignItems:'center', gap:4 }}
                      >
                        <span aria-hidden="true">⚠️ {n}</span>
                        <span className="sr-only">{lang === 'fr' ? `${n} problème(s) de complétude` : `${n} completeness issue(s)`}</span>
                      </span>
                    )
                  })()}
                  {status !== 'pending' && (
                    <span style={{ fontSize:12, fontWeight:600, padding:'3px 8px', borderRadius:6, background:sc.bg, color:sc.color, flexShrink:0 }}>{t[status] ?? status}</span>
                  )}
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginLeft:'auto' }}>
                    <HoverIconButton onClick={() => setEditingRecipe({ id:recipe.id, ...recipe.data, moderation_status:recipe.moderation_status, isCustom:true })} icon={<LuPencil size={13} />} label={t.editCommunity} bg='rgba(99,179,237,0.15)' color='#2B6CB0' />
                    {status === 'pending' && <>
                      <HoverIconButton onClick={() => handleSetStatus(recipe.id, 'approved', recipe.title)} icon={<LuCheck size={13} />} label={t.approve} bg='rgba(34,197,94,0.15)' color='var(--color-success)' />
                      <HoverIconButton onClick={() => handleSetStatus(recipe.id, 'rejected', recipe.title)} icon={<LuBan size={13} />} label={t.reject} bg='rgba(239,68,68,0.12)' color='var(--color-danger)' />
                    </>}
                    {status === 'approved' && recipe.data?.consent_to_promote && (
                      <HoverIconButton onClick={() => handlePromoteRecipe(recipe.id, recipe.data?.name?.fr ?? recipe.data?.name?.en ?? 'recipe')} icon={<LuSparkles size={13} />} label={lang === 'fr' ? 'Promouvoir' : 'Promote'} bg='rgba(247,168,94,0.18)' color='#C05A10' />
                    )}
                    {status === 'approved' && (
                      <HoverIconButton onClick={() => handleSetStatus(recipe.id, 'rejected', recipe.title)} icon={<LuBan size={13} />} label={t.reject} bg='rgba(239,68,68,0.12)' color='var(--color-danger)' />
                    )}
                    {status === 'rejected' && (
                      <HoverIconButton onClick={() => handleSetStatus(recipe.id, 'approved', recipe.title)} icon={<LuCheck size={13} />} label={t.approve} bg='rgba(34,197,94,0.15)' color='var(--color-success)' />
                    )}
                    {(status === 'approved' || status === 'rejected') && (
                      <HoverIconButton onClick={() => handleSetStatus(recipe.id, 'pending', recipe.title)} icon={<LuClock size={13} />} label={t.pendingAction} bg='rgba(251,191,36,0.15)' color='var(--color-warning)' />
                    )}
                    <HoverIconButton onClick={() => handleDeleteRecipe(recipe.id)} icon={<LuTrash2 size={13} />} label={t.confirmDeleteAction} bg='rgba(239,68,68,0.10)' color='var(--color-danger)' />
                  </div>
                </div>
              )
            })}
          </div>
        )
      }

      {recipeFilter === 'pending' && (
        <BulkActionBar
          count={sel.count} lang={lang} darkMode={darkMode} onClear={sel.clear}
          actions={[
            { label: lang === 'fr' ? 'Approuver la sélection' : 'Approve selection', onClick: () => setConfirmBulkApprove(true) },
            { label: lang === 'fr' ? 'Rejeter la sélection' : 'Reject selection', onClick: () => setBulkRejectOpen(true), danger: true },
            { label: lang === 'fr' ? 'Supprimer la sélection' : 'Delete selection', onClick: () => setConfirmBulkDelete(true), danger: true },
          ]}
        />
      )}

      {editingRecipe && (
        <RecipeFormModal
          initialRecipe={editingRecipe}
          onSave={async (recipe) => {
            const resultat = await adminUpdateCommunityRecipe(editingRecipe.id, recipe)
            if (!resultat.error) loadRecipes()
            return resultat // refusée : le formulaire reste ouvert, la saisie gardée
          }}
          onClose={() => setEditingRecipe(null)}
          lang={lang} darkMode={darkMode} hidePublishOption
        />
      )}

      {confirmDeleteRecipe && createPortal(
        <ConfirmDeleteModal
          title={t.confirmDeleteRecipeTitle} body={t.confirmDeleteRecipeBody}
          confirmLabel={t.confirmDeleteAction} cancelLabel={t.confirmCancel}
          onConfirm={handleConfirmDeleteRecipe} onCancel={() => setConfirmDeleteRecipe(null)}
          darkMode={darkMode}
        />, document.body
      )}
      {confirmPromoteRecipe && createPortal(
        <ConfirmActionModal
          title={t.confirmPromoteTitle} body={t.confirmPromoteBody(confirmPromoteRecipe.name)}
          confirmLabel={t.confirmPromoteAction} cancelLabel={t.confirmCancel}
          onConfirm={handleConfirmPromoteRecipe} onCancel={() => setConfirmPromoteRecipe(null)}
          darkMode={darkMode}
        />, document.body
      )}
      {moderationTarget && createPortal(
        <ModerationReasonModal
          t={t} statusColors={STATUS_COLORS}
          target={moderationTarget}
          lang={lang}
          darkMode={darkMode}
          onConfirm={handleConfirmStatusWithReason}
          onCancel={() => setModerationTarget(null)}
        />, document.body
      )}
      {bulkRejectOpen && createPortal(
        <ModerationReasonModal
          t={t} statusColors={STATUS_COLORS}
          target={{ status: 'rejected', recipeName: lang === 'fr' ? `${sel.count} recette${sel.count > 1 ? 's' : ''}` : `${sel.count} recipe(s)` }}
          lang={lang}
          darkMode={darkMode}
          onConfirm={handleBulkReject}
          onCancel={() => setBulkRejectOpen(false)}
        />, document.body
      )}
      {confirmBulkApprove && createPortal(
        <ConfirmActionModal
          title={lang === 'fr' ? `Approuver ${sel.count} recette${sel.count > 1 ? 's' : ''} ?` : `Approve ${sel.count} recipe(s)?`}
          body={lang === 'fr' ? (sel.count > 1 ? 'Elles deviennent publiques, visibles par tous.' : 'Elle devient publique, visible par tous.') : 'They become public, visible to everyone.'}
          confirmLabel={t.approve} cancelLabel={t.confirmCancel}
          onConfirm={handleBulkApprove} onCancel={() => setConfirmBulkApprove(false)}
          darkMode={darkMode}
        />, document.body
      )}
      {confirmBulkDelete && createPortal(
        <ConfirmDeleteModal
          title={lang === 'fr' ? `Supprimer ${sel.count} recette${sel.count > 1 ? 's' : ''} ?` : `Delete ${sel.count} recipe(s)?`}
          body={lang === 'fr' ? 'Les recettes sélectionnées seront supprimées. Action définitive.' : 'The selected recipes will be deleted. This is permanent.'}
          confirmLabel={t.confirmDeleteAction} cancelLabel={t.confirmCancel}
          onConfirm={handleConfirmBulkDelete} onCancel={() => setConfirmBulkDelete(false)}
          darkMode={darkMode}
        />, document.body
      )}
    </div>
  )
}
