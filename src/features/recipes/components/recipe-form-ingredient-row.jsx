import { useState, useRef, useEffect, useMemo, useId } from 'react'
import { LuTrash2, LuMic } from 'react-icons/lu'
import Button from '@shared/ui/button'
import RecipeFormSelectDropdown from './recipe-form-select-dropdown'
import { normalize, toKatakana, getKuromojiTokenizer, tokenizeJapanese, LANG_TO_LOCALE } from '@shared/hooks/use-voice-recognition'
import { getUnitHints } from '@shared/static/ingredient-unit-hints'
import { localizeUnit } from '@shared/lib/recipes/recipe-utils'
import { WEIGHT_UNITS, UNIT_FALLBACK, UNIT_DEFAULT_IDS, cleanTranscript } from '@features/recipes/lib/recipe-form-units'

// Ligne « ingrédient » du formulaire de recette (sélecteur + quantité + unité
// + dictée + suppression), extraite de `recipe-form-modal.jsx` le 2026-07-30
// (§2 audit front : aucun fichier composant > 500 lignes).
//
// Feuille avec état local (recherche, dropdown ouvert, dictée) ; le parent
// garde la liste et reçoit les changements via `onUpdate`/`onDelete`. Les
// unités et le nettoyage de dictée viennent de `lib/recipe-form-units.js`,
// sorti du parent juste avant pour éviter un import enfant → parent.

export default function IngredientRow({ item, flatIngredients, groupedIngredients, onUpdate, onDelete, darkMode, t, hasError, lang }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [micListening, setMicListening] = useState(false)
  const ref = useRef(null)
  const searchRef = useRef(null)
  // Libellés visibles (décision du 2026-10-06, « libellés = visibles »).
  const rechercheId = useId()
  const choixId = useId()
  const qteId = useId()
  const qteLibelleId = useId()
  const recognitionRef = useRef(null)
  const silenceTimerRef = useRef(null)
  const kuromojiRef = useRef(null)
  const hasVoice = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  // Pré-charge kuromoji dès que lang === 'ja', pour qu'il soit prêt quand le micro démarre
  useEffect(() => {
    if (lang !== 'ja') return
    if (kuromojiRef.current) return
    getKuromojiTokenizer()
      .then(t => { kuromojiRef.current = t })
      .catch(() => {/* noop — fallback cleanTranscript */})
  }, [lang])

  const startMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    // Déclenche aussi le chargement kuromoji si pas encore fait (micro cliqué en premier)
    if (lang === 'ja' && !kuromojiRef.current) {
      getKuromojiTokenizer()
        .then(t => { kuromojiRef.current = t })
        .catch(() => {})
    }
    const r = new SR()
    r.lang = LANG_TO_LOCALE[lang] ?? 'fr-FR'
    r.interimResults = false
    r.maxAlternatives = 1
    silenceTimerRef.current = setTimeout(() => r.stop(), 3000)
    r.onresult = (e) => {
      clearTimeout(silenceTimerRef.current)
      const raw = e.results[0]?.[0]?.transcript ?? ''
      let cleaned
      if (lang === 'ja' && kuromojiRef.current) {
        // kuromoji : extrait les noms (名詞) et prend le premier comme requête
        const nouns = tokenizeJapanese(raw, kuromojiRef.current)
        cleaned = nouns.join('').slice(0, 15)
      } else {
        // cleanTranscript retire verbes/articles avant de tronquer à 15 car.
        cleaned = cleanTranscript(raw, lang).slice(0, 15)
      }
      if (cleaned) setSearch(cleaned)
      setMicListening(false)
    }
    r.onend = () => setMicListening(false)
    r.onerror = () => { clearTimeout(silenceTimerRef.current); setMicListening(false) }
    recognitionRef.current = r
    r.start()
    setOpen(true)
    setMicListening(true)
  }

  const stopMic = () => { clearTimeout(silenceTimerRef.current); recognitionRef.current?.stop(); setMicListening(false) }

  useEffect(() => () => { clearTimeout(silenceTimerRef.current); recognitionRef.current?.stop() }, [])

  useEffect(() => {
    if (!open) return
    const handler = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50)
  }, [open])

  const filtered = useMemo(() => {
    // Pour le japonais : normalise hiragana → katakana avant comparaison
    // (le STT peut renvoyer にんじん alors que le label est ニンジン)
    const norm = lang === 'ja'
      ? (s) => toKatakana(normalize(s))
      : normalize
    const q = norm(search.trim())
    if (!q) return []
    // Essaie aussi sans le -s final (pluriel simple EN/FR/ES/DE : "tomates" → "tomate")
    const qSingular = lang !== 'ja' && q.length > 3 && (q.endsWith('s') || q.endsWith('x')) ? q.slice(0, -1) : null
    const seen = new Set()
    return flatIngredients
      .filter(i => {
        const lbl = norm(i.label)
        return lbl.includes(q) || (qSingular && lbl.includes(qSingular))
      })
      .sort((a, b) => {
        const aN = norm(a.label)
        const bN = norm(b.label)
        const aStarts = aN.startsWith(q)
        const bStarts = bN.startsWith(q)
        if (aStarts && !bStarts) return -1
        if (!aStarts && bStarts) return 1
        return a.label.localeCompare(b.label)
      })
      .filter(i => {
        const key = norm(i.label)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 50)
  }, [search, flatIngredients, lang])

  const selected = flatIngredients.find(i => i.id === item.ingredientId)
  const isSearching = search.trim().length > 0

  const ingButton = (ing) => (
    <Button
      key={ing.id}
      variant="ghost"
      role="option"
      aria-selected={ing.id === item.ingredientId}
      onClick={() => {
        // Unité par défaut : suggérée selon l'ingrédient (gousse pour ail, branche
        // pour thym, sachet pour levure, tranche pour jambon…). Fallback : g ou
        // 'unité' pour les légumes/fruits hérités de UNIT_DEFAULT_IDS.
        const hints = getUnitHints(ing.id)
        const localized = localizeUnit(1, hints.defaultUnit, lang)
        const fallback = UNIT_DEFAULT_IDS.has(ing.id) ? (UNIT_FALLBACK[lang] ?? UNIT_FALLBACK.fr) : 'g'
        const unit = (WEIGHT_UNITS[lang] ?? WEIGHT_UNITS.fr).includes(localized) ? localized : fallback
        onUpdate(item._key, { ingredientId: ing.id, labels: ing.allLabels, qty: { ...item.qty, unit } })
        setOpen(false); setSearch('')
      }}
      className="h-auto w-full justify-start gap-2 rounded-none px-3 py-2 text-[15px] font-normal text-left hover:bg-transparent"
      style={{
        background: ing.id === item.ingredientId ? (darkMode ? '#1A3A2A' : '#E8F5E9') : 'transparent',
        color: 'var(--color-charcoal)',
      }}
      onMouseEnter={e => { if (ing.id !== item.ingredientId) e.currentTarget.style.background = darkMode ? '#1A2535' : '#F5EFE6' }}
      onMouseLeave={e => { if (ing.id !== item.ingredientId) e.currentTarget.style.background = 'transparent' }}
    >
      <span>{ing.emoji}</span>
      <span>{ing.label}</span>
    </Button>
  )

  return (
    <div style={{ display:'flex', gap:'6px', alignItems:'center', marginBottom:'8px', flexWrap:'wrap' }}>
      <div ref={ref} style={{ position:'relative', flex:'2 1 160px', minWidth:0 }}>
        <Button
          id={choixId}
          onClick={() => { setOpen(v => !v); setSearch('') }}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="h-auto w-full justify-start gap-1.5 overflow-hidden rounded-lg border-[1.5px] px-2.5 py-2 text-[13px] font-normal hover:opacity-100"
          style={{
            borderColor: hasError ? '#D07070' : (darkMode ? 'var(--color-dark-surface)' : '#E8E0D4'),
            background: darkMode ? '#0F1923' : '#FFF',
            color: selected ? 'var(--color-charcoal)' : 'var(--color-muted)',
            textAlign: 'left',
          }}
        >
          {selected
            ? <><span style={{flexShrink:0}}>{selected.emoji}</span><span style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{selected.label}</span></>
            : <span>{t.selectIngredient}</span>
          }
        </Button>
        {open && (
          <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:300, background: darkMode ? '#131E2C' : '#FDFAF6', border: darkMode ? '1.5px solid #1A2A3D' : '1.5px solid #EDE4D4', borderRadius:'10px', boxShadow:'0 4px 24px rgba(0,0,0,0.18)', overflow:'hidden' }}>
            <label htmlFor={rechercheId} style={{ display:'block', fontSize:'11px', fontWeight:700, color:'var(--color-muted)', padding:'8px 12px 0' }}>{t.ingredientSearchAria}</label>
            <div style={{ display:'flex', alignItems:'center', borderBottom: darkMode ? '1px solid #1A2A3D' : '1px solid #EDE4D4', background: darkMode ? '#0F1923' : '#FFF' }}>
              <input
                id={rechercheId}
                ref={searchRef}
                value={search}
                onChange={e => { setSearch(e.target.value); if (micListening) stopMic() }}
                onKeyDown={e => {
                  e.stopPropagation()
                  if (e.key === 'Escape') { setOpen(false); setSearch('') }
                }}
                placeholder={t.searchIngredient}
                maxLength={15}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                style={{ flex:1, padding:'9px 12px', border:'none', background:'transparent', color:'var(--color-charcoal)', fontSize:'13px', outline:'none' }}
              />
              {hasVoice && (
                <Button
                  variant="ghost"
                  size="icon"
                  onMouseDown={e => e.preventDefault()}
                  onClick={micListening ? stopMic : startMic}
                  title={micListening ? '…' : '🎤'}
                  aria-pressed={micListening}
                  aria-label={micListening ? 'Stop voice' : 'Start voice'}
                  className="h-auto w-auto rounded-md py-1 px-2 hover:bg-transparent"
                  style={{
                    flexShrink:0, marginRight:'4px',
                    background: micListening ? '#E53535' : 'transparent',
                    color: micListening ? 'white' : (darkMode ? '#7A90A8' : 'var(--color-muted)'),
                    transition:'all 0.2s',
                    animation: micListening ? 'soft-blink 1s ease-in-out infinite' : 'none',
                  }}
                >
                  <LuMic size={14} />
                </Button>
              )}
            </div>
            <div style={{ maxHeight:'240px', overflowY:'auto' }}>
              {isSearching ? (
                filtered.length > 0
                  ? filtered.map(ingButton)
                  : <p style={{ padding:'10px 12px', fontSize:'13px', color:'var(--color-muted)', margin:0 }}>–</p>
              ) : (
                groupedIngredients.map(group => (
                  <div key={group.id}>
                    <div style={{ padding:'6px 12px 4px', fontSize:'11px', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--color-brand-500)', background: darkMode ? '#0F1923' : '#FFF8F0', borderBottom: darkMode ? '1px solid #1A2A3D' : '1px solid #F0E8D8', display:'flex', alignItems:'center', gap:'5px' }}>
                      <span>{group.emoji}</span><span>{group.label}</span>
                    </div>
                    {group.items.map(ingButton)}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      <div style={{ display:'flex', gap:'6px', alignItems:'center', flexShrink:0 }}>
        {/* « Qté » visible, à gauche ; le nom entendu dit aussi l'ingrédient. */}
        <label id={qteLibelleId} htmlFor={qteId} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted)' }}>{t.qtyShort}</label>
        <input
          id={qteId}
          type="number" min="0" placeholder="0"
          aria-labelledby={selected ? `${qteLibelleId} ${choixId}` : qteLibelleId}
          value={item.qty.amount}
          onChange={e => onUpdate(item._key, { qty: { ...item.qty, amount: e.target.value } })}
          style={{ width:'64px', padding:'8px 6px', borderRadius:'8px', border: darkMode ? '1.5px solid #1A2A3D' : '1.5px solid #E8E0D4', background: darkMode ? '#0F1923' : '#FFF', color:'var(--color-charcoal)', fontSize:'13px', outline:'none', flexShrink:0, textAlign:'center' }}
        />
        <div style={{ width:'115px', flexShrink:0 }}>
          <RecipeFormSelectDropdown
            options={(WEIGHT_UNITS[lang] ?? WEIGHT_UNITS.fr).map(u => {
              // Affichage : singulier si 0 ou 1, pluriel à partir de 2.
              // La valeur stockée reste le libellé canonique (singulier).
              const n = Number(item.qty.amount) || 1
              const localized = localizeUnit(n, u, lang)
              return { value: u, label: localized || u }
            })}
            value={item.qty.unit}
            onChange={u => onUpdate(item._key, { qty: { ...item.qty, unit: u } })}
            darkMode={darkMode}
            compact
          />
        </div>
        <Button
          onClick={() => onUpdate(item._key, { required: !item.required })}
          aria-pressed={item.required}
          className="h-auto whitespace-nowrap rounded-lg border-[1.5px] px-2.5 py-1.5 text-[11px] font-bold"
          style={{
            flexShrink: 0,
            borderColor: item.required ? 'var(--color-brand-500)' : '#9CA3AF',
            background: item.required ? (darkMode ? 'rgba(224,120,32,0.15)' : '#FEF3E2') : 'transparent',
            color: item.required ? 'var(--color-brand-500)' : 'var(--color-muted)',
          }}
        >
          {item.required ? t.fieldRequired : t.fieldOptional}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(item._key)}
          aria-label={t.deleteIngredient}
          className="h-auto w-auto p-1.5 hover:bg-transparent"
          style={{ color:'#D07070', flexShrink:0 }}
        >
          <LuTrash2 size={15} />
        </Button>
      </div>
    </div>
  )
}
