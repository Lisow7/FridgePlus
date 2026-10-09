// Formulaire d'une recette de base (création et modification), sorti de
// base-recipes-section.jsx : avec la garde de sortie (ADM-18), la section
// dépassait son budget de taille.
import { useState, useId } from 'react'
import { createPortal } from 'react-dom'
import { useCountries, useAllergenTypes } from '@shared/contexts/data-provider'
import StepsEditor from '../steps-editor'
import IngredientsEditor from '../ingredients-editor'
import RecipeLivePreview from '../recipe-live-preview'
import { scaleQuantities } from '@shared/lib/recipes/recipe-scaling'
import Button from '@shared/ui/button'
import { useDialogue } from '@shared/hooks/use-dialogue'
import { useFermetureGardee } from '@shared/hooks/use-fermeture-gardee'
import { useModifie } from '@shared/hooks/use-modifie'
import SegmentedControl from '@shared/ui/segmented-control'
import Field from '@shared/ui/field'
import PuceACocher from '../shared/puce-a-cocher'
import { DIFF_OPTIONS, DIFF_LABELS, TYPE_OPTIONS, TYPE_LABELS, STATUS_OPTIONS, STATUS_LABELS, DIET_KEYS, DIET_LABELS } from '@features/admin/data/base-recipe-options'

// ── Formulaire recette de base ────────────────────────────────────────────────

const QUESTION_DE_SORTIE = { title: 'Abandonner les modifications ?', body: 'Ce que tu as changé sera perdu.' }

export default function BaseRecipeForm({ item, onSave, onBack, darkMode, border, textColor, muted, isMobile }) {
  const isNew       = item._isNew
  const allergenTypes = useAllergenTypes()
  const countries     = useCountries()
  const allergenKeys  = Object.keys(allergenTypes)
  const allergenesId  = useId()
  const regimesId     = useId()

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
  // Quitter avec des modifications demande d'abord (ADM-18 : une recette longue
  // — étapes, ingrédients — se perdait sur un tap, Échap compris).
  const modifie = useModifie({ nameForm, descForm, emoji, imageUrl, difficulty, type, status, timeMins, prepMins, cookMins, servings, country, allergens, diet, ingredients, steps })
  const { fermer } = useFermetureGardee({ onClose: onBack, brouillon: modifie, question: QUESTION_DE_SORTIE })
  // Une vraie boîte de dialogue : rôle, nom, focus piégé, Échap (A11Y-01).
  const dialogue = useDialogue({ onClose: fermer })

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
    <div {...dialogue.proprietes} style={{ position:'fixed', inset:0, zIndex:80, background: darkMode ? '#0B1420' : '#FBF7F1', display:'flex', flexDirection:'column' }}>
      {/* Barre d'en-tête (toujours visible) */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding: isMobile ? '10px 14px' : '12px 22px', borderBottom:`1px solid ${border}`, flexShrink:0, background: darkMode ? '#111E2D' : '#FFF' }}>
        <Button variant="ghost" onClick={fermer} className="h-auto rounded-lg border bg-transparent px-3 py-1.5 text-sm hover:bg-transparent" style={{ borderColor:border, color:muted }}>← Retour</Button>
        <span id={dialogue.titreId} style={{ fontSize:16, fontWeight:800, color:textColor }}>{isNew ? 'Nouvelle recette de base' : 'Modifier recette de base'}</span>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <Button variant="ghost" onClick={fermer} className="h-auto rounded-lg border bg-transparent px-[18px] py-2 text-sm hover:bg-transparent" style={{ borderColor:border, color:muted }}>Annuler</Button>
          <Button onClick={handleSave} loading={saving} disabled={saving} className="h-auto rounded-lg bg-[#B85000] px-[18px] py-2 text-sm font-bold text-white">{saving ? '…' : 'Enregistrer'}</Button>
        </div>
      </div>

      {/* Corps : formulaire | aperçu live */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        <div style={{ flex: isMobile ? '1 1 100%' : '1 1 58%', overflowY:'auto', padding: isMobile ? '14px' : '18px 24px' }}>
      {error && <div style={{ marginBottom:12, padding:'8px 12px', borderRadius:8, background:'rgba(239,68,68,0.1)', color:'var(--color-danger)', fontSize:13 }}>{error}</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:10, maxWidth:720 }}>

        {!isNew && (
          <Field label="ID" labelStyle={lbl}>
            <input style={{ ...inp, opacity:0.65, fontFamily:'monospace', fontSize:13 }} value={item.id ?? ''} readOnly />
          </Field>
        )}

        {/* Emoji + Nom FR + Statut */}
        <div style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', gap:8, alignItems:'end' }}>
          <Field label="Emoji" labelStyle={lbl}>
            <input style={{ ...inp, width:56, textAlign:'center', fontSize:20 }} value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="🍽️" maxLength={2} />
          </Field>
          <Field label="Nom FR *" labelStyle={{ ...lbl, fontWeight:700, color:textColor }}>
            <input style={inp} value={nameForm.fr ?? ''} onChange={e => setNameForm(n => ({ ...n, fr: e.target.value }))} placeholder="Nom de la recette" />
          </Field>
          <Field label="Statut" labelStyle={lbl}>
            <select style={{ ...inp, width:'auto' }} value={status} onChange={e => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map(v => <option key={v} value={v}>{STATUS_LABELS[v]}</option>)}
            </select>
          </Field>
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
              <Field key={l} label={<><span className="sr-only">Nom </span>{l.toUpperCase()}</>} labelStyle={lbl}>
                <input style={inp} value={nameForm[l] ?? ''} onChange={e => setNameForm(n => ({ ...n, [l]: e.target.value }))} />
              </Field>
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
              <Field key={l} label={<><span className="sr-only">Description </span>{l.toUpperCase()}</>} labelStyle={lbl}>
                <textarea style={{ ...inp, height:60, resize:'vertical' }} value={descForm[l] ?? ''} onChange={e => setDescForm(d => ({ ...d, [l]: e.target.value }))} />
              </Field>
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
          <Field label="Type" labelStyle={lbl}>
            <select style={inp} value={type} onChange={e => setType(e.target.value)}>
              {TYPE_OPTIONS.map(v => <option key={v} value={v}>{TYPE_LABELS[v] ?? v}</option>)}
            </select>
          </Field>
        </div>

        {/* Pays */}
        <Field label="Pays d'origine" labelStyle={lbl}>
          <select style={inp} value={country} onChange={e => setCountry(e.target.value)}>
            <option value="">— Aucun —</option>
            {Object.entries(countries).map(([code, d]) => (
              <option key={code} value={code}>{d.flag} {d.names?.fr ?? code}</option>
            ))}
          </select>
        </Field>

        {/* Temps */}
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap:10 }}>
          <Field label="Temps total (min)" labelStyle={{ ...lbl, fontWeight:600, color:textColor }}>
            <input style={inp} type="number" value={timeMins} onChange={e => setTimeMins(e.target.value)} min={1} />
          </Field>
          <Field label="Prép. (min, optionnel)" labelStyle={lbl}>
            <input style={inp} type="number" value={prepMins} onChange={e => setPrepMins(e.target.value)} min={0} placeholder="—" />
          </Field>
          <Field label="Cuisson (min, optionnel)" labelStyle={lbl}>
            <input style={inp} type="number" value={cookMins} onChange={e => setCookMins(e.target.value)} min={0} placeholder="—" />
          </Field>
          <Field label="Portions" labelStyle={lbl}>
            <input style={inp} type="number" value={servings} onChange={e => setServings(e.target.value)} min={1} max={12} />
          </Field>
        </div>

        {/* Allergènes */}
        <div role="group" aria-labelledby={allergenesId}>
          <span id={allergenesId} style={lbl}>Allergènes</span>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            {allergenKeys.length === 0
              ? <span style={{ fontSize:12, color:muted, fontStyle:'italic' }}>Chargement…</span>
              : allergenKeys.map(key => {
                  const meta = allergenTypes[key]
                  const active = allergens.includes(key)
                  return (
                    <PuceACocher key={key} cochee={active} style={chip(active, 'var(--color-danger)')} onBasculer={() => toggleArray(allergens, key, setAllergens)}>
                      {meta?.icon ?? ''} {meta?.labels?.fr ?? key}
                    </PuceACocher>
                  )
                })
            }
          </div>
        </div>

        {/* Régimes */}
        <div role="group" aria-labelledby={regimesId}>
          <span id={regimesId} style={lbl}>Régimes alimentaires</span>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            {DIET_KEYS.map(key => {
              const active = (diet ?? []).includes(key)
              return (
                <PuceACocher key={key} cochee={active} style={chip(active, 'var(--color-success)')} onBasculer={() => toggleArray(diet ?? [], key, setDiet)}>
                  {DIET_LABELS[key] ?? key}
                </PuceACocher>
              )
            })}
          </div>
        </div>

        {/* Image */}
        <Field label="Image (URL) — sinon l'emoji sert de visuel" labelStyle={lbl}>
          <input style={inp} value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://… (ou laisser vide)" />
        </Field>

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
