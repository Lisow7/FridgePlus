import { useState, useCallback, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { LuPlus, LuPencil, LuTrash2 } from 'react-icons/lu'
import { adminGetBaseRecipes, adminGetBaseRecipeById, adminUpsertBaseRecipe, adminDeleteBaseRecipe, adminGetFavoriteCountsByIds, countMissingImageBaseRecipes } from '@features/admin/api/admin'
import { hasNoImage } from '@features/admin/lib/missing-image'
import { MissingImageControls, MissingImageBadge } from '@features/admin/components/MissingImageControls'
import { useAdmin } from '../../providers/admin-provider'
import { useCountries, useAllergenTypes } from '@shared/contexts/data-provider'
import { ConfirmDeleteModal } from '@shared/ui/confirm-dialog/confirm-modals'
import FeedbackBanner from '../shared/feedback-banner'
import SearchInput from '../shared/search-input'
import StepsEditor from '../steps-editor'
import IngredientsEditor from '../ingredients-editor'
import RecipeLivePreview from '../recipe-live-preview'
import { scaleQuantities } from '@shared/lib/recipes/recipe-scaling'
import Button from '@shared/ui/button'
import IconButton from '@shared/ui/icon-button'
import EmptyState from '@shared/ui/empty-state'
import Pagination from '@shared/ui/pagination'
import SegmentedControl from '@shared/ui/segmented-control'
import {
  DIFF_OPTIONS, DIFF_LABELS, TYPE_OPTIONS, TYPE_LABELS,
  STATUS_OPTIONS, STATUS_LABELS, DIET_KEYS, DIET_LABELS,
} from '@features/admin/data/base-recipe-options'

const PER_PAGE = 50

// ── Formulaire recette de base ────────────────────────────────────────────────

function BaseRecipeForm({ item, onSave, onBack, darkMode, border, textColor, muted, isMobile }) {
  const isNew       = item._isNew
  const allergenTypes = useAllergenTypes()
  const countries     = useCountries()
  const allergenKeys  = Object.keys(allergenTypes)

  // Sprint 7 PR S7.f — Forms admin alignés sur FR/EN.
  const [nameForm,    setNameForm]    = useState({ fr:'', en:'', ...(item.name ?? {}) })
  const [descForm,    setDescForm]    = useState({ fr:'', en:'', ...(item.description ?? {}) })
  const [emoji,       setEmoji]       = useState(item.emoji ?? '')
  const [imageUrl,    setImageUrl]    = useState(item.image_url ?? '')
  const [difficulty,  setDifficulty]  = useState(item.difficulty ?? 'easy')
  const [type,        setType]        = useState(item.type ?? 'main')
  const [status,      setStatus]      = useState(item.status ?? 'published')
  const [timeMins,    setTimeMins]    = useState(item.time_min ?? item.time ?? 30)
  const [prepMins,    setPrepMins]    = useState(item.prep_time_min ?? '')
  const [cookMins,    setCookMins]    = useState(item.cook_time_min ?? '')
  const [servings,    setServings]    = useState(item.servings ?? 4)
  const [country,     setCountry]     = useState(item.country ?? '')
  const [allergens,   setAllergens]   = useState(item.allergens ?? [])
  const [diet,        setDiet]        = useState(item.diet ?? [])
  const [ingredients, setIngredients] = useState(item.ingredients ?? [])
  const [steps,       setSteps]       = useState(item.steps ?? {})
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState(null)
  const [showNames,   setShowNames]   = useState(false)
  const [showDesc,    setShowDesc]    = useState(false)

  function toggleArray(arr, key, setter) {
    setter(arr.includes(key) ? arr.filter(k => k !== key) : [...arr, key])
  }

  async function handleSave() {
    if (!emoji.trim())       { setError('Emoji requis');     return }
    if (!nameForm.fr.trim()) { setError('Nom FR requis');    return }
    setSaving(true); setError(null)
    const { error: err } = await onSave({
      ...(isNew ? {} : { id: item.id }),
      emoji, image_url: imageUrl || null, name: nameForm, description: descForm,
      difficulty, type, status,
      time_min:      parseInt(timeMins)  || 30,
      prep_time_min: prepMins !== '' ? (parseInt(prepMins) || null) : null,
      cook_time_min: cookMins !== '' ? (parseInt(cookMins) || null) : null,
      servings:      parseInt(servings)  || 4,
      country:       country || null,
      allergens,
      diet,
      ingredients,
      steps,
      // Repassées telles quelles, sinon la vue les réécrit à NULL (cf. le select).
      promoted_from_id:     item.promoted_from_id ?? null,
      promoted_at:          item.promoted_at ?? null,
      original_author_id:   item.original_author_id ?? null,
      original_author_name: item.original_author_name ?? null,
      _isNew: isNew,
    })
    if (err) { setError(err.message); setSaving(false) }
  }

  const inp    = { padding:'8px 11px', borderRadius:8, border:`1px solid ${border}`, background: darkMode ? '#141F2E' : '#FFF', color:textColor, fontSize:15, outline:'none', fontFamily:'inherit', width:'100%', boxSizing:'border-box' }
  const lbl    = { fontSize:13, color:muted, display:'block', marginBottom:4 }
  const chip = (active, color = 'var(--color-info)') => ({ padding:'3px 9px', borderRadius:4, fontSize:12, cursor:'pointer', border:`1px solid ${active ? color : border}`, background: active ? `${color}22` : 'transparent', color: active ? color : muted, fontFamily:'inherit', userSelect:'none' })

  return createPortal(
    <div style={{ position:'fixed', inset:0, zIndex:80, background: darkMode ? '#0B1420' : '#FBF7F1', display:'flex', flexDirection:'column' }}>
      {/* Barre d'en-tête (toujours visible) */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding: isMobile ? '10px 14px' : '12px 22px', borderBottom:`1px solid ${border}`, flexShrink:0, background: darkMode ? '#111E2D' : '#FFF' }}>
        <Button variant="ghost" onClick={onBack} className="h-auto rounded-lg border bg-transparent px-3 py-1.5 text-sm hover:bg-transparent" style={{ borderColor:border, color:muted }}>← Retour</Button>
        <span style={{ fontSize:16, fontWeight:800, color:textColor }}>{isNew ? 'Nouvelle recette de base' : 'Modifier recette de base'}</span>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <Button variant="ghost" onClick={onBack} className="h-auto rounded-lg border bg-transparent px-[18px] py-2 text-sm hover:bg-transparent" style={{ borderColor:border, color:muted }}>Annuler</Button>
          <Button onClick={handleSave} loading={saving} disabled={saving} className="h-auto rounded-lg bg-[#E07820] px-[18px] py-2 text-sm font-bold text-white">{saving ? '…' : 'Enregistrer'}</Button>
        </div>
      </div>

      {/* Corps : formulaire | aperçu live */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        <div style={{ flex: isMobile ? '1 1 100%' : '1 1 58%', overflowY:'auto', padding: isMobile ? '14px' : '18px 24px' }}>
      {error && <div style={{ marginBottom:12, padding:'8px 12px', borderRadius:8, background:'rgba(239,68,68,0.1)', color:'var(--color-danger)', fontSize:13 }}>{error}</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:10, maxWidth:720 }}>

        {!isNew && (
          <div>
            <label style={lbl}>ID</label>
            <input style={{ ...inp, opacity:0.65, fontFamily:'monospace', fontSize:13 }} value={item.id ?? ''} readOnly />
          </div>
        )}

        {/* Emoji + Nom FR + Statut */}
        <div style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', gap:8, alignItems:'end' }}>
          <div>
            <label style={lbl}>Emoji</label>
            <input style={{ ...inp, width:56, textAlign:'center', fontSize:20 }} value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="🍽️" maxLength={2} />
          </div>
          <div>
            <label style={{ ...lbl, fontWeight:700, color:textColor }}>Nom FR *</label>
            <input style={inp} value={nameForm.fr ?? ''} onChange={e => setNameForm(n => ({ ...n, fr: e.target.value }))} placeholder="Nom de la recette" />
          </div>
          <div>
            <label style={lbl}>Statut</label>
            <select style={{ ...inp, width:'auto' }} value={status} onChange={e => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map(v => <option key={v} value={v}>{STATUS_LABELS[v]}</option>)}
            </select>
          </div>
        </div>

        {/* Noms EN/ES/DE/JA */}
        <Button
          variant="ghost"
          aria-expanded={showNames}
          onClick={() => setShowNames(v => !v)}
          className="h-auto self-start rounded-lg border bg-transparent px-2.5 py-1.5 text-[13px] hover:bg-transparent"
          style={{ gap: 6, borderColor: border, color: muted }}
        >
          {showNames ? '▲' : '▼'} Noms EN / ES / DE / JA
        </Button>
        {showNames && (
          <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:8, padding:10, borderRadius:10, background: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)', border:`1px solid ${border}` }}>
            {['en','es','de','ja'].map(l => (
              <div key={l}>
                <label style={lbl}>{l.toUpperCase()}</label>
                <input style={inp} value={nameForm[l] ?? ''} onChange={e => setNameForm(n => ({ ...n, [l]: e.target.value }))} />
              </div>
            ))}
          </div>
        )}

        {/* Description */}
        <Button
          variant="ghost"
          aria-expanded={showDesc}
          onClick={() => setShowDesc(v => !v)}
          className="h-auto self-start rounded-lg border bg-transparent px-2.5 py-1.5 text-[13px] hover:bg-transparent"
          style={{ gap: 6, borderColor: border, color: muted }}
        >
          {showDesc ? '▲' : '▼'} Description {(descForm.fr || descForm.en) ? '✓' : ''}
        </Button>
        {showDesc && (
          <div style={{ display:'flex', flexDirection:'column', gap:8, padding:10, borderRadius:10, background: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)', border:`1px solid ${border}` }}>
            {['fr','en','es','de','ja'].map(l => (
              <div key={l}>
                <label style={lbl}>{l.toUpperCase()}</label>
                <textarea style={{ ...inp, height:60, resize:'vertical' }} value={descForm[l] ?? ''} onChange={e => setDescForm(d => ({ ...d, [l]: e.target.value }))} />
              </div>
            ))}
          </div>
        )}

        {/* Difficulté + Type */}
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:10 }}>
          <div>
            <label style={lbl}>Difficulté</label>
            <SegmentedControl
              aria-label="Difficulté"
              options={DIFF_OPTIONS.map(v => ({ value: v, label: DIFF_LABELS[v] }))}
              value={difficulty}
              onChange={setDifficulty}
              border={border}
              muted={muted}
            />
          </div>
          <div>
            <label style={lbl}>Type</label>
            <select style={inp} value={type} onChange={e => setType(e.target.value)}>
              {TYPE_OPTIONS.map(v => <option key={v} value={v}>{TYPE_LABELS[v] ?? v}</option>)}
            </select>
          </div>
        </div>

        {/* Pays */}
        <div>
          <label style={lbl}>Pays d'origine</label>
          <select style={inp} value={country} onChange={e => setCountry(e.target.value)}>
            <option value="">— Aucun —</option>
            {Object.entries(countries).map(([code, d]) => (
              <option key={code} value={code}>{d.flag} {d.names?.fr ?? code}</option>
            ))}
          </select>
        </div>

        {/* Temps */}
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap:10 }}>
          <div>
            <label style={{ ...lbl, fontWeight:600, color:textColor }}>Temps total (min)</label>
            <input style={inp} type="number" value={timeMins} onChange={e => setTimeMins(e.target.value)} min={1} />
          </div>
          <div>
            <label style={lbl}>Prép. (min, optionnel)</label>
            <input style={inp} type="number" value={prepMins} onChange={e => setPrepMins(e.target.value)} min={0} placeholder="—" />
          </div>
          <div>
            <label style={lbl}>Cuisson (min, optionnel)</label>
            <input style={inp} type="number" value={cookMins} onChange={e => setCookMins(e.target.value)} min={0} placeholder="—" />
          </div>
          <div>
            <label style={lbl}>Portions</label>
            <input style={inp} type="number" value={servings} onChange={e => setServings(e.target.value)} min={1} max={12} />
          </div>
        </div>

        {/* Allergènes */}
        <div>
          <label style={lbl}>Allergènes</label>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            {allergenKeys.length === 0
              ? <span style={{ fontSize:12, color:muted, fontStyle:'italic' }}>Chargement…</span>
              : allergenKeys.map(key => {
                  const meta = allergenTypes[key]
                  const active = allergens.includes(key)
                  return (
                    <span key={key} style={chip(active, 'var(--color-danger)')} onClick={() => toggleArray(allergens, key, setAllergens)}>
                      {meta?.icon ?? ''} {meta?.labels?.fr ?? key}
                    </span>
                  )
                })
            }
          </div>
        </div>

        {/* Régimes */}
        <div>
          <label style={lbl}>Régimes alimentaires</label>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            {DIET_KEYS.map(key => {
              const active = (diet ?? []).includes(key)
              return (
                <span key={key} style={chip(active, 'var(--color-success)')} onClick={() => toggleArray(diet ?? [], key, setDiet)}>
                  {DIET_LABELS[key] ?? key}
                </span>
              )
            })}
          </div>
        </div>

        {/* Image */}
        <div>
          <label style={lbl}>Image (URL) — sinon l'emoji sert de visuel</label>
          <input style={inp} value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://… (ou laisser vide)" />
        </div>

        {/* Ingrédients — éditeur structuré (catalogue + coller + libellé préservé) */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:6, marginBottom:4 }}>
            <label style={{ ...lbl, marginBottom:0 }}>Ingrédients</label>
            {ingredients.length > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ fontSize:11, color:muted }}>Échelle :</span>
                {[['÷2', 0.5], ['×2', 2], ['×3', 3]].map(([l, f]) => (
                  <Button key={l} variant="ghost"
                    onClick={() => { setIngredients(scaleQuantities(ingredients, f)); setServings(s => Math.max(1, Math.round((parseInt(s) || 1) * f))) }}
                    className="h-auto rounded-md border px-2 py-0.5 text-xs hover:bg-transparent" style={{ borderColor: border, color: muted }}>{l}</Button>
                ))}
              </div>
            )}
          </div>
          <IngredientsEditor ingredients={ingredients} lang="fr" onChange={setIngredients} darkMode={darkMode} />
        </div>

        {/* Étapes — éditeur structuré (multilingue, lockstep ; source FR) */}
        <div>
          <label style={lbl}>Étapes</label>
          <StepsEditor steps={steps} lang="fr" onChange={setSteps} darkMode={darkMode} />
        </div>
      </div>
        </div>

        {/* Colonne aperçu live (desktop) */}
        {!isMobile && (
          <div style={{ flex:'1 1 42%', overflowY:'auto', padding:'18px 24px', borderLeft:`1px solid ${border}`, background: darkMode ? '#0E1828' : '#F7F0E6' }}>
            <RecipeLivePreview emoji={emoji} imageUrl={imageUrl} name={nameForm} timeMins={timeMins} servings={servings} diet={diet} ingredients={ingredients} steps={steps} lang="fr" darkMode={darkMode} />
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

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
  const [brLoading,      setBrLoading]      = useState(false)
  const [editBaseRecipe, setEditBaseRecipe] = useState(null)
  const [brSort,         setBrSort]         = useState('id')
  const [brFavCounts,    setBrFavCounts]    = useState({})
  const [brType,         setBrType]         = useState('')
  const [brDiff,         setBrDiff]         = useState('')
  const [brTimeFilter,   setBrTimeFilter]   = useState('')
  const [confirmDelete,  setConfirmDelete]  = useState(null)
  const [feedback,       setFeedback]       = useState(null)
  const [showOnlyMissing, setShowOnlyMissing] = useState(false)
  const [missingCount,    setMissingCount]    = useState(0)

  function showFeedback(ok, msg) {
    setFeedback({ ok, msg })
    setTimeout(() => setFeedback(null), 3000)
  }

  const loadBaseRecipes = useCallback(async () => {
    setBrLoading(true)
    const { data, count } = await adminGetBaseRecipes({ page: brPage, search: brSearch, type: brType, difficulty: brDiff, timeRange: brTimeFilter, missingImage: showOnlyMissing })
    setBrList(data ?? []); setBrCount(count ?? 0)
    if (data?.length) {
      const counts = await adminGetFavoriteCountsByIds(data.map(r => r.id))
      setBrFavCounts(counts)
    }
    setBrLoading(false)
  }, [brPage, brSearch, brType, brDiff, brTimeFilter, showOnlyMissing])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadBaseRecipes() }, [loadBaseRecipes])

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

  const sortedList = useMemo(() => {
    const list = [...brList]
    if (brSort === 'name')      return list.sort((a, b) => (a.name?.fr ?? '').localeCompare(b.name?.fr ?? '', 'fr'))
    if (brSort === 'type')      return list.sort((a, b) => (a.type ?? '').localeCompare(b.type ?? ''))
    if (brSort === 'favorites') return list.sort((a, b) => (brFavCounts[b.id] ?? 0) - (brFavCounts[a.id] ?? 0))
    return list.sort((a, b) => a.id.localeCompare(b.id))
  }, [brList, brSort, brFavCounts])

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
        <SearchInput value={brSearch} onChange={v => { setBrSearch(v); setBrPage(0) }} placeholder="Rechercher…" darkMode={darkMode} />
        <Button
          onClick={() => setEditBaseRecipe({ _isNew:true })}
          className="h-auto rounded-[10px] bg-[#E07820] px-3.5 py-2 text-sm font-bold text-white"
          style={{ gap: 5 }}
        >
          <LuPlus size={14} /> Ajouter
        </Button>
      </div>

      {/* Tri */}
      <div style={{ display:'flex', gap:4, marginBottom:8, flexWrap:'wrap' }}>
        {[['id','ID'], ['name','Nom'], ['type','Type'], ['favorites','Favoris']].map(([v, l]) => (
          <Button
            key={v}
            variant="ghost"
            aria-pressed={brSort === v}
            onClick={() => setBrSort(v)}
            className="h-auto rounded-lg border px-2.5 py-0.5 text-xs hover:bg-transparent"
            style={{
              borderColor: brSort === v ? 'var(--color-brand-500)' : border,
              background: brSort === v ? 'rgba(224,120,32,0.12)' : 'transparent',
              color: brSort === v ? 'var(--color-brand-500)' : muted,
            }}
          >
            {l}
          </Button>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
        <select value={brType} onChange={e => { setBrType(e.target.value); setBrPage(0) }}
          style={{ flex:'1 1 140px', padding:'7px 10px', borderRadius:8, border:`1px solid ${brType ? 'var(--color-info)' : border}`, background: darkMode ? '#141F2E' : '#FFF', color: brType ? 'var(--color-info)' : muted, fontSize:12, outline:'none', fontFamily:'inherit', cursor:'pointer' }}>
          <option value=''>Tous les types</option>
          {TYPE_OPTIONS.map(v => <option key={v} value={v}>{TYPE_LABELS[v] ?? v}</option>)}
        </select>
        <select value={brDiff} onChange={e => { setBrDiff(e.target.value); setBrPage(0) }}
          style={{ flex:'1 1 140px', padding:'7px 10px', borderRadius:8, border:`1px solid ${brDiff ? 'var(--color-success)' : border}`, background: darkMode ? '#141F2E' : '#FFF', color: brDiff ? 'var(--color-success)' : muted, fontSize:12, outline:'none', fontFamily:'inherit', cursor:'pointer' }}>
          <option value=''>Toutes difficultés</option>
          {DIFF_OPTIONS.map(v => <option key={v} value={v}>{DIFF_LABELS[v] ?? v}</option>)}
        </select>
        <select value={brTimeFilter} onChange={e => { setBrTimeFilter(e.target.value); setBrPage(0) }}
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
