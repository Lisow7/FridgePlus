import { useState, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { getMissingFields } from '@shared/lib/ingredients/ingredient-completeness'
import { useIngredientsById } from '@shared/contexts/data-provider'
import { useConfirm } from '@shared/ui/confirm-dialog/confirm-provider'
import { useFermetureGardee } from '@shared/hooks/use-fermeture-gardee'
import { useModifie } from '@shared/hooks/use-modifie'
import {
  FOOD_EMOJIS, SUBCATEGORY_TO_STORAGE, SUBCATEGORIES, PREFIX_OPTIONS, SUBCAT_LABELS,
  slugify, norm,
} from '@features/admin/lib/ingredient-taxonomy'
import IngredientExtraFields from '../ingredient-extra-fields'
import Button from '@shared/ui/button'
import Field from '@shared/ui/field'

// ── EmojiPicker ───────────────────────────────────────────────────────────────

function EmojiPicker({ id: emojiId, value, onChange, darkMode, border, textColor }) {
  const [open, setOpen] = useState(false)
  const [pos,  setPos]  = useState({ top:0, left:0 })
  // eslint-disable-next-line no-unused-vars
  const triggerRef = useState(null)[0]
  // eslint-disable-next-line no-unused-vars
  const refBox = { current: null }
  // eslint-disable-next-line no-unused-vars
  const popupRef = { current: null }

  // Simplified: use a ref via callback
  const [trigRef, setTrigRef] = useState(null)
  const [popRef,  setPopRef]  = useState(null)

  useEffect(() => {
    if (!open) return
    const h = e => {
      if (!trigRef?.contains(e.target) && !popRef?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open, trigRef, popRef])

  const handleOpen = () => {
    if (trigRef) {
      const rect = trigRef.getBoundingClientRect()
      const PW = 228, PH = 250
      let top  = rect.bottom + 4
      let left = Math.max(4, rect.right - PW)
      if (top + PH > window.innerHeight - 8) top = rect.top - PH - 4
      if (left + PW > window.innerWidth  - 4) left = window.innerWidth - PW - 4
      setPos({ top, left })
    }
    setOpen(v => !v)
  }

  const popBg = darkMode ? '#131E2C' : '#FDFAF6'
  const inp = { padding:'7px', borderRadius:'8px', border:`1px solid ${border}`, background: darkMode ? '#141F2E' : '#FFF', color:textColor, fontSize:'20px', outline:'none', width:'56px', boxSizing:'border-box', textAlign:'center', cursor:'pointer' }

  return (
    <div style={{ display:'inline-block' }}>
      <input id={emojiId} ref={setTrigRef} style={inp} value={value} readOnly placeholder="🍅" onClick={handleOpen} onChange={() => {}} />
      {open && createPortal(
        <div ref={setPopRef} style={{ position:'fixed', top:pos.top, left:pos.left, zIndex:9999, background:popBg, border:`1px solid ${border}`, borderRadius:'12px', padding:'8px', display:'flex', flexWrap:'wrap', gap:'1px', width:'228px', boxShadow:'0 8px 24px rgba(0,0,0,0.2)' }}>
          {FOOD_EMOJIS.map(em => (
            <Button
              key={em}
              variant="ghost"
              aria-pressed={value === em}
              onClick={() => { onChange(em); setOpen(false) }}
              className="h-auto rounded-md p-1 text-lg leading-none hover:bg-transparent"
              style={{ background: value === em ? 'rgba(224,120,32,0.18)' : 'transparent' }}
            >
              {em}
            </Button>
          ))}
        </div>, document.body
      )}
    </div>
  )
}

// ── Formulaire ingrédient ─────────────────────────────────────────────────────

const QUESTION_DE_SORTIE = { title: 'Abandonner les modifications ?', body: 'Ce que tu as changé sera perdu.' }

export default function IngredientForm({ item, onSave, onBack, darkMode, border, textColor, muted, isMobile }) {
  const isNew = item._isNew
  // Libellés écrits à l'écran et reliés à leurs champs (décision du 2026-10-06).
  const idLibelleId = useId()
  const emojiId = useId()
  const detectPrefix = (id = '') => {
    for (const opt of PREFIX_OPTIONS) {
      if (id.startsWith(opt.value)) return { prefix: opt.value, suffix: id.slice(opt.value.length) }
    }
    return { prefix: 'fr-', suffix: id }
  }
  const { prefix: initPrefix, suffix: initSuffix } = isNew ? { prefix:'fr-', suffix:'' } : detectPrefix(item.id ?? '')

  const [idPrefix,    setIdPrefix]    = useState(initPrefix)
  const [idSuffix,    setIdSuffix]    = useState(initSuffix)
  const [emoji,       setEmoji]       = useState(item.emoji ?? '')
  // Sprint 7 PR S7.f — Form admin aligné sur FR/EN.
  const [labels,      setLabels]      = useState({ fr:'', en:'', ...(item.labels ?? {}) })
  const [subcategory, setSubcategory] = useState(item.subcategory ?? SUBCATEGORIES[0])
  const [sortOrder,   setSortOrder]   = useState(item.sort_order ?? 0)
  const [groupId,     setGroupId]     = useState(item.group_id ?? '')
  const [defaultUnit, setDefaultUnit] = useState(item.default_unit ?? null)
  const [allergens,   setAllergens]   = useState(item.allergens ?? [])
  const [breaksDiets, setBreaksDiets] = useState(item.breaks_diets ?? [])
  const [nutrition,   setNutrition]   = useState(item.nutrition ?? {})
  const [packSize,    setPackSize]    = useState(item.pack_size ?? {})
  const [showTrans,   setShowTrans]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState(null)
  // Quitter avec des modifications demande d'abord (ADM-18 : « ← Retour » et
  // « Annuler » perdaient la saisie sans prévenir).
  const modifie = useModifie({ idPrefix, idSuffix, emoji, labels, subcategory, sortOrder, groupId, defaultUnit, allergens, breaksDiets, nutrition, packSize })
  const { fermer } = useFermetureGardee({ onClose: onBack, brouillon: modifie, question: QUESTION_DE_SORTIE })

  const ingredientsById = useIngredientsById()
  const confirm = useConfirm()

  function prefillFromGroup() {
    const gid = groupId.trim()
    if (!gid) return
    const sibling = [...ingredientsById.values()].find(
      i => i.id !== item.id
        && (i.group_id === gid || i.id === gid)
        && i.nutrition && Object.keys(i.nutrition).length > 0
    )
    if (!sibling) return
    setNutrition(sibling.nutrition ?? {})
    setPackSize(sibling.pack_size ?? {})
    setAllergens(sibling.allergens ?? [])
    setBreaksDiets(sibling.breaks_diets ?? [])
    setDefaultUnit(sibling.default_unit ?? null)
  }

  function findDuplicate() {
    const target = norm(labels?.fr)
    if (!target) return null
    for (const other of ingredientsById.values()) {
      if (other.id !== item.id && norm(other.labels?.fr) === target) return other
    }
    return null
  }

  const fullId = isNew ? (idPrefix + slugify(idSuffix)) : (item.id ?? '')

  const handlePrefixChange = (newPrefix) => {
    setIdPrefix(newPrefix)
    const prefixOpt = PREFIX_OPTIONS.find(p => p.value === newPrefix)
    if (prefixOpt?.subcats?.length) setSubcategory(prefixOpt.subcats[0])
  }

  const availableSubcats = isNew ? (PREFIX_OPTIONS.find(p => p.value === idPrefix)?.subcats ?? SUBCATEGORIES) : SUBCATEGORIES

  const missingFields = getMissingFields({
    labels,
    emoji,
    subcategory,
    storage: SUBCATEGORY_TO_STORAGE[subcategory] ?? 'gp',
    default_unit: defaultUnit,
    nutrition,
    pack_size: packSize,
  })

  async function handleSave() {
    if (missingFields.length > 0) {
      const ok = await confirm({
        title: `Données incomplètes (${missingFields.join(', ')}). Cet ingrédient risque d'être mal connecté à certaines fonctionnalités. Enregistrer quand même ?`,
        confirmLabel: 'Enregistrer quand même',
      })
      if (!ok) return
    }
    if (isNew) {
      const dup = findDuplicate()
      if (dup) {
        const ok = await confirm({
          title: `Un ingrédient nommé « ${dup.labels?.fr} » (${dup.id}) existe déjà. `
            + `Créer un doublon quand même ?`,
          confirmLabel: 'Créer quand même',
        })
        if (!ok) return
      }
    }
    if (!fullId.trim())    { setError('ID requis');       return }
    if (!emoji.trim())     { setError('Emoji requis');    return }
    if (!labels.fr.trim()) { setError('Label FR requis'); return }
    setSaving(true); setError(null)
    const { error: err } = await onSave({
      id: fullId, emoji, labels, subcategory,
      storage: SUBCATEGORY_TO_STORAGE[subcategory] ?? 'gp',
      sort_order: parseInt(sortOrder) || 0,
      group_id: groupId.trim() || null,
      default_unit: defaultUnit, allergens, breaks_diets: breaksDiets,
      nutrition, pack_size: packSize, _isNew: isNew,
    })
    // La base refuse un identifiant déjà pris (insert, ADM-16) : le dire en clair.
    if (err) { setError(err.code === '23505' ? `L'identifiant « ${fullId} » existe déjà : modifie-le avant d'enregistrer.` : err.message); setSaving(false) }
  }

  const inp = { padding:'8px 11px', borderRadius:'8px', border:`1px solid ${border}`, background: darkMode ? '#141F2E' : '#FFF', color:textColor, fontSize:'15px', outline:'none', fontFamily:'inherit', width:'100%', boxSizing:'border-box' }
  const lbl = { fontSize:'13px', color:muted, display:'block', marginBottom:'4px' }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <Button
          variant="ghost"
          onClick={fermer}
          className="h-auto rounded-none bg-transparent p-0 text-sm hover:bg-transparent"
          style={{ color: muted }}
        >
          ← Retour
        </Button>
        <span style={{ fontSize:16, fontWeight:700, color:textColor }}>{isNew ? 'Nouvel ingrédient' : 'Modifier ingrédient'}</span>
      </div>
      {error && <div style={{ marginBottom:12, padding:'8px 12px', borderRadius:8, background:'rgba(239,68,68,0.1)', color:'var(--color-danger)', fontSize:13 }}>{error}</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {isNew ? (
          <div>
            <span id={idLibelleId} style={lbl}>ID <span style={{ opacity:0.55, fontWeight:400 }}>— auto-généré</span></span>
            {/* Le libellé visible nomme les deux champs ; « préfixe » et « suite » les distinguent à l'oreille. */}
            <span id={`${idLibelleId}-prefixe`} className="sr-only">préfixe</span>
            <span id={`${idLibelleId}-suite`} className="sr-only">suite</span>
            <div style={{ display:'flex', flexDirection: isMobile ? 'column' : 'row', gap:6 }}>
              <select aria-labelledby={`${idLibelleId} ${idLibelleId}-prefixe`} style={{ ...inp, width:'auto', minWidth: isMobile ? '100%' : '150px' }} value={idPrefix} onChange={e => handlePrefixChange(e.target.value)}>
                {PREFIX_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label} ({opt.value})</option>)}
              </select>
              <input aria-labelledby={`${idLibelleId} ${idLibelleId}-suite`} style={{ ...inp, flex:1 }} value={idSuffix} onChange={e => setIdSuffix(e.target.value)} placeholder="ex. : tomate" />
            </div>
            {idSuffix.trim() && <div style={{ marginTop:4, fontSize:13, color:muted }}>→ ID : <span style={{ fontFamily:'monospace', color:'var(--color-info)', fontWeight:700 }}>{fullId}</span></div>}
          </div>
        ) : (
          <Field label="ID" labelStyle={lbl}>
            <input style={{ ...inp, opacity:0.65, fontFamily:'monospace', fontSize:13 }} value={item.id ?? ''} readOnly />
          </Field>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:8, alignItems:'end' }}>
          <div>
            <label htmlFor={emojiId} style={lbl}>Emoji</label>
            <EmojiPicker id={emojiId} value={emoji} onChange={setEmoji} darkMode={darkMode} border={border} textColor={textColor} />
          </div>
          <Field label="FR *" labelStyle={{ ...lbl, fontWeight:700, color:textColor }}>
            <input style={inp} value={labels.fr ?? ''} onChange={e => setLabels(l => ({ ...l, fr: e.target.value }))} placeholder="Tomate" />
          </Field>
        </div>

        <Button
          variant="ghost"
          aria-expanded={showTrans}
          onClick={() => setShowTrans(v => !v)}
          className="h-auto self-start rounded-lg border bg-transparent px-2.5 py-1.5 text-[13px] hover:bg-transparent"
          style={{ gap: 6, borderColor: border, color: muted }}
        >
          {showTrans ? '▲' : '▼'} Traductions EN / ES / DE / JA
        </Button>
        {showTrans && (
          <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:8, padding:10, borderRadius:10, background: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)', border:`1px solid ${border}` }}>
            {['en','es','de','ja'].map(l => (
              <Field key={l} label={l.toUpperCase()} labelStyle={lbl}>
                <input style={inp} value={labels[l] ?? ''} onChange={e => setLabels(p => ({ ...p, [l]: e.target.value }))} />
              </Field>
            ))}
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 80px', gap:8 }}>
          <Field label="Sous-catégorie" labelStyle={lbl}>
            <select style={inp} value={subcategory} onChange={e => setSubcategory(e.target.value)}>
              {availableSubcats.map(s => <option key={s} value={s}>{SUBCAT_LABELS[s] ?? s}</option>)}
            </select>
          </Field>
          <Field label="Ordre" labelStyle={lbl}>
            <input style={inp} type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
          </Field>
        </div>

        <Field label={<>Groupe parent <span style={{ opacity:0.55, fontWeight:400 }}>— optionnel</span></>} labelStyle={lbl}>
          <input style={inp} value={groupId} onChange={e => setGroupId(e.target.value)} placeholder="ex: fr-oeuf, fr-fromage…" />
        </Field>

        {isNew && groupId.trim() && (
          <Button variant="ghost" onClick={prefillFromGroup} style={{ alignSelf: 'flex-start' }}>
            Pré-remplir depuis la catégorie
          </Button>
        )}

        <IngredientExtraFields
          defaultUnit={defaultUnit} setDefaultUnit={setDefaultUnit}
          allergens={allergens}     setAllergens={setAllergens}
          breaksDiets={breaksDiets} setBreaksDiets={setBreaksDiets}
          nutrition={nutrition}     setNutrition={setNutrition}
          packSize={packSize}       setPackSize={setPackSize}
          darkMode={darkMode} border={border} textColor={textColor} muted={muted} isMobile={isMobile}
        />
      </div>

      {missingFields.length > 0 && (
        <div style={{ marginTop:16, fontSize:'13px', color:'var(--color-warning)', padding:'8px 11px', borderRadius:'8px', background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.4)' }}>
          À compléter pour une intégration complète : {missingFields.join(', ')}
        </div>
      )}

      <div style={{ display:'flex', gap:8, marginTop:20, justifyContent:'flex-end' }}>
        <Button
          variant="ghost"
          onClick={fermer}
          className="h-auto rounded-lg border bg-transparent px-[18px] py-2 text-sm hover:bg-transparent"
          style={{ borderColor: border, color: muted }}
        >
          Annuler
        </Button>
        <Button
          onClick={handleSave}
          loading={saving}
          disabled={saving}
          className="h-auto rounded-lg bg-[#B85000] px-[18px] py-2 text-sm font-bold text-white"
        >
          {saving ? '…' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  )
}
