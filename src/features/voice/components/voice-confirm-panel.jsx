import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { LuX, LuMic, LuSearch, LuPlus } from 'react-icons/lu'
import { useIngredients } from '@shared/contexts/data-provider'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import Button from '@shared/ui/button'
import VoiceMatchedList from './voice-matched-list'
// Alias : garde le nom local `normalize` (0 site d'usage touché). La version
// locale ne développait pas « œ » — « boeuf » ne trouvait pas « bœuf ».
import { normalizeSearch as normalize } from '@shared/lib/matching/normalize-search'

const I18N = {
  fr: {
    title: 'Ingrédients reconnus',
    addToFridge: 'Ajouter au frigo',
    cancel: 'Annuler',
    alreadyIn: 'Déjà dans ton frigo',
    allAlreadyIn: 'Tous ces ingrédients sont déjà dans ton frigo',
    searchPlaceholder: 'Ajouter un ingrédient manuellement…',
    searchNoResults: 'Aucun résultat',
    confirmCloseTitle: 'Abandonner la saisie vocale ?',
    confirmCloseBody: 'Les ingrédients reconnus ne seront pas ajoutés.',
    stay: 'Rester',
    abandon: 'Abandonner',
    ambigHint: 'Lequel veux-tu ?',
    dismiss: 'Ignorer',
    noIngredients: 'Aucun ingrédient détecté',
    noIngredientsHint: 'Lance la reconnaissance vocale et nomme les ingrédients de ton frigo.',
  },
  en: {
    title: 'Recognised ingredients',
    addToFridge: 'Add to fridge',
    cancel: 'Cancel',
    alreadyIn: 'Already in your fridge',
    allAlreadyIn: 'All these ingredients are already in your fridge',
    searchPlaceholder: 'Add an ingredient manually…',
    searchNoResults: 'No results',
    confirmCloseTitle: 'Abandon voice input?',
    confirmCloseBody: 'Detected ingredients will not be added.',
    stay: 'Stay',
    abandon: 'Abandon',
    ambigHint: 'Which one did you mean?',
    dismiss: 'Dismiss',
    noIngredients: 'No ingredient detected',
    noIngredientsHint: 'Start voice recognition and name the ingredients in your fridge.',
  },
}

// ─── Groupement par catégorie ────────────────────────────────────
// (`STORAGE_HINTS`/`getStorageHint` et `GROUP_LABELS` sont descendus dans
// `voice-matched-list.jsx`, seul endroit qui les consommait.)
const CAT_GROUP = {
  dairy: 'bof', cheese: 'bof', eggs: 'bof',
  meat: 'meat', 'frozen-meat': 'meat',
  fish: 'fish', 'frozen-fish': 'fish',
  deli: 'deli',
  vegetables: 'vegetables', 'frozen-veg': 'vegetables',
  fruits: 'fruits',
  'ready-meals': 'frozen', 'ice-cream': 'frozen', 'frozen-bread': 'frozen',
  'pasta-rice': 'grocery', canned: 'grocery', cereals: 'grocery', bread: 'grocery', sweet: 'grocery',
  'salt-spices': 'spices', herbs: 'spices', sauces: 'spices', oils: 'spices',
  tofu: 'japanese', rice: 'japanese', dry: 'japanese', basic: 'japanese',
  today: 'other', thisweek: 'other',
}
const GROUP_ORDER = ['bof', 'meat', 'fish', 'deli', 'vegetables', 'fruits', 'frozen', 'grocery', 'spices', 'japanese', 'other']
function buildIdToGroup(ingredients) {
  const map = new Map()
  for (const [catKey, arr] of Object.entries(ingredients)) {
    if (catKey === 'bof') continue
    const group = CAT_GROUP[catKey] ?? 'other'
    for (const ing of arr) {
      if (!map.has(ing.id)) map.set(ing.id, group)
    }
  }
  return map
}

function buildFlatList(ingredients, lang) {
  const seen = new Set()
  const list = []
  for (const arr of Object.values(ingredients)) {
    for (const ing of arr) {
      if (seen.has(ing.id)) continue
      seen.add(ing.id)
      const label = ing.labels?.[lang]
      if (label) list.push({ id: ing.id, label, emoji: ing.emoji, labels: ing.labels })
    }
  }
  return list.sort((a, b) => a.label.localeCompare(b.label))
}

export default function VoiceConfirmPanel({ lang = 'fr', matchedIngredients = [], stock = new Set(), onAdd, onCancel, onResumeVoice, isListening = false, darkMode = false }) {
  const allIngredients = useIngredients()
  const ID_TO_GROUP = useMemo(() => buildIdToGroup(allIngredients), [allIngredients])
  const t = I18N[lang] ?? I18N.fr
  const windowWidth = useWindowWidth()
  const isDesktop = windowWidth >= 1280

  const [items, setItems] = useState([])
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearch, setShowSearch] = useState(false)
  const [micHover, setMicHover] = useState(false)
  const flatListRef = useRef(null)
  const searchInputRef = useRef(null)

  const micLabel = isListening
    ? ({ fr:'Arrêter',                   en:'Stop', }[lang] ?? 'Arrêter')
    : ({ fr:'Dis-moi tes ingrédients', en:'Tell me your ingredients', }[lang] ?? 'Dis-moi tes ingrédients')

  // Merge new matched ingredients into items (don't reset existing checked state)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(prev => {
      // Clé unique : pour les items ambigus on utilise "ambig:word", sinon l'id
      const existingKeys = new Set(prev.map(i => i.ambiguous ? `ambig:${i.word}` : i.id))
      const seenIncoming = new Set()
      const incoming = matchedIngredients.filter(m => {
        const key = m.ambiguous ? `ambig:${m.word}` : m.id
        if (existingKeys.has(key) || seenIncoming.has(key)) return false
        seenIncoming.add(key)
        return true
      })
      if (incoming.length === 0) return prev
      return [...prev, ...incoming.map(m => {
        if (m.ambiguous) {
          return { id: null, word: m.word, candidates: m.candidates, ambiguous: true, confidence: m.confidence }
        }
        return { id: m.id, labels: m.labels, confidence: m.confidence, checked: !stock.has(m.id), manual: false }
      })]
    })
  }, [matchedIngredients]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    flatListRef.current = buildFlatList(allIngredients, lang)
  }, [allIngredients, lang])

  useEffect(() => {
    if (!searchQuery.trim() || !flatListRef.current) { setSearchResults([]); return }
    const q = normalize(searchQuery)
    const itemIds = new Set(items.map(i => i.id))
    setSearchResults(
      flatListRef.current
        .filter(ing => normalize(ing.label).includes(q) && !itemIds.has(ing.id))
        .slice(0, 7)
    )
  }, [searchQuery, items])

  const toggleCheck = (id) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item))
  }

  // Résolution d'un item ambigu : identifié par son word, pas par son index d'affichage
  const resolveAmbig = (word, candidate) => {
    setItems(prev => prev.map(item =>
      item.ambiguous && item.word === word
        ? { id: candidate.id, labels: candidate.labels, confidence: item.confidence, checked: !stock.has(candidate.id), manual: false }
        : item
    ))
  }

  // Supprime un item ambigu non résolu
  const dismissAmbig = (word) => {
    setItems(prev => prev.filter(item => !(item.ambiguous && item.word === word)))
  }

  const addManual = (ing) => {
    setItems(prev => [...prev, { id: ing.id, labels: ing.labels, confidence: 1, checked: !stock.has(ing.id), manual: true }])
    setSearchQuery('')
    setSearchResults([])
    searchInputRef.current?.focus()
  }

  // Items triés par groupe, avec en-têtes de section intercalées
  const groupedDisplay = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      if (a.ambiguous && !b.ambiguous) return 1
      if (!a.ambiguous && b.ambiguous) return -1
      const gA = GROUP_ORDER.indexOf(ID_TO_GROUP.get(a.id) ?? 'other')
      const gB = GROUP_ORDER.indexOf(ID_TO_GROUP.get(b.id) ?? 'other')
      return gA - gB
    })
    const result = []
    let currentGroup = null
    for (const item of sorted) {
      if (item.ambiguous) { result.push(item); continue }
      const group = ID_TO_GROUP.get(item.id) ?? 'other'
      if (group !== currentGroup) {
        currentGroup = group
        result.push({ __header: true, group })
      }
      result.push(item)
    }
    return result
  }, [items]) // eslint-disable-line react-hooks/exhaustive-deps

  const checkedItems = items.filter(i => i.id && i.checked && !stock.has(i.id))
  const allAlreadyInStock = items.length > 0 && items.filter(i => i.id).every(i => stock.has(i.id)) && items.every(i => !i.ambiguous)
  const canAdd = checkedItems.length > 0 && !allAlreadyInStock

  const handleClose = () => {
    if (items.length > 0) setShowCloseConfirm(true)
    else onCancel?.()
  }

  const bg = darkMode ? '#0F1923' : '#FDFAF6'
  const border = darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'
  const textMuted = darkMode ? '#7A90A8' : '#7A5F56'

  const panelStyle = isDesktop ? {
    position: 'fixed', top: 0, left: 0, width: '620px', height: '100vh',
    zIndex: 53, background: bg,
    borderRight: `1px solid ${border}`,
    boxShadow: '4px 0 32px rgba(0,0,0,0.12)',
    display: 'flex', flexDirection: 'column',
    animation: 'panel-slide-in-left 0.32s cubic-bezier(0.4,0,0.2,1) both',
  } : {
    position: 'fixed', inset: 0,
    zIndex: 53, background: bg,
    display: 'flex', flexDirection: 'column',
    animation: 'panel-slide-up 0.32s cubic-bezier(0.4,0,0.2,1) both',
  }

  return createPortal(
    <>
      {/* Backdrop desktop */}
      {isDesktop && (
        <div
          onClick={handleClose}
          className="fp-modal-backdrop"
          style={{
            position: 'fixed', inset: 0, zIndex: 52,
            background: 'rgba(0,0,0,0.25)',
          }}
        />
      )}

      {/* Panel */}
      <div style={panelStyle}>
        {/* En-tête */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '20px 20px 16px', borderBottom: `1px solid ${border}`, flexShrink: 0,
        }}>
          <h2 style={{ flex: 1, fontSize: '20px', fontWeight: 700, color: 'var(--color-charcoal)', margin: 0 }}>
            {t.title}
          </h2>

          {/* Bouton micro — reprend/arrête la reconnaissance */}
          <Button
            variant="ghost"
            onClick={onResumeVoice}
            onMouseEnter={() => setMicHover(true)}
            onMouseLeave={() => setMicHover(false)}
            aria-pressed={isListening}
            aria-label={micLabel}
            className="relative h-[42px] w-[42px] shrink-0 overflow-visible rounded-[10px] p-0 hover:bg-transparent"
            style={{
              background: micHover ? 'rgba(229,53,53,0.10)' : 'transparent',
              color: isListening ? 'white' : '#E53535',
              transition: 'all 0.2s',
            }}
          >
            {!isListening && (
              <span style={{
                position: 'absolute', inset: '-5px', borderRadius: '12px',
                border: '1.5px solid rgba(229,53,53,0.30)',
                animation: 'voice-pulse 2.4s ease-out infinite',
                pointerEvents: 'none',
              }} />
            )}
            {isListening && [0, 0.45].map(delay => (
              <span key={delay} style={{
                position: 'absolute', inset: 0, borderRadius: '10px',
                border: '1.5px solid rgba(255,255,255,0.5)',
                animation: `voice-wave 1.6s ease-out ${delay}s infinite`,
                pointerEvents: 'none',
              }} />
            ))}
            <LuMic size={20} />
          </Button>

          {/* Croix — ferme le panel */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            aria-label={t.cancel}
            className="h-[42px] w-[42px] shrink-0 rounded-[10px] bg-transparent p-0 hover:bg-transparent"
            style={{ color: '#E53535', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(229,53,53,0.10)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <LuX size={20} />
          </Button>
        </div>

        <VoiceMatchedList
          data={{ items, groupedDisplay, stock }}
          actions={{ toggleCheck, resolveAmbig, dismissAmbig }}
          theme={{ textMuted, darkMode }}
          i18n={{ t, lang }}
        />

        {/* Recherche manuelle */}
        <div style={{ padding: '8px 20px 0', flexShrink: 0, position: 'relative' }}>
          <LuSearch size={15} style={{ position: 'absolute', left: '32px', top: '50%', transform: 'translateY(-50%)', color: textMuted, pointerEvents: 'none', zIndex: 1 }} />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowSearch(true) }}
            onFocus={() => setShowSearch(true)}
            onBlur={() => setTimeout(() => setShowSearch(false), 150)}
            placeholder={t.searchPlaceholder}
            style={{
              width: '100%', padding: '10px 12px 10px 36px',
              borderRadius: '10px',
              border: `1.5px solid ${darkMode ? '#243650' : '#E2D8CC'}`,
              background: darkMode ? '#131E2C' : '#F5EDE0',
              color: 'var(--color-charcoal)', fontSize: '14px',
              outline: 'none', fontFamily: 'inherit',
            }}
          />
          {showSearch && searchResults.length > 0 && (
            <div style={{
              position: 'absolute', bottom: 'calc(100% + 4px)', left: '20px', right: '20px',
              background: darkMode ? '#131E2C' : '#FDFAF6',
              border: `1.5px solid ${border}`,
              borderRadius: '10px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
              overflow: 'hidden', zIndex: 10,
            }}>
              {searchResults.map(ing => (
                <Button
                  key={ing.id}
                  variant="ghost"
                  onMouseDown={() => addManual(ing)}
                  className="h-auto w-full justify-start rounded-none bg-transparent px-3.5 py-2.5 text-sm hover:bg-transparent"
                  style={{
                    gap: '10px',
                    color: 'var(--color-charcoal)',
                    transition: 'background 0.1s',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = darkMode ? 'var(--color-dark-surface)' : 'var(--color-bg-warm)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <LuPlus size={14} style={{ color: '#32B478', flexShrink: 0 }} />
                  <span>{ing.emoji}</span>
                  <span style={{ flex: 1 }}>{ing.label}</span>
                </Button>
              ))}
            </div>
          )}
          {showSearch && searchQuery.trim() && searchResults.length === 0 && (
            <div style={{
              position: 'absolute', bottom: 'calc(100% + 4px)', left: '20px', right: '20px',
              background: darkMode ? '#131E2C' : '#FDFAF6',
              border: `1.5px solid ${border}`,
              borderRadius: '10px', padding: '12px 14px',
              fontSize: '13px', color: textMuted,
              zIndex: 10,
            }}>
              {t.searchNoResults}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px 20px', flexShrink: 0, borderTop: `1px solid ${border}`, marginTop: '8px' }}>
          {allAlreadyInStock && (
            <p style={{ fontSize: '13px', color: textMuted, textAlign: 'center', marginBottom: '12px' }}>
              {t.allAlreadyIn}
            </p>
          )}
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button
              variant="ghost"
              onClick={handleClose}
              className="h-auto flex-1 rounded-[10px] border-[1.5px] bg-transparent px-4 py-3.5 text-sm font-semibold hover:bg-transparent"
              style={{
                borderColor: darkMode ? '#243650' : '#E2D8CC',
                color: 'var(--color-muted)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = darkMode ? 'var(--color-dark-surface)' : 'var(--color-bg-warm)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {t.cancel}
            </Button>
            <Button
              onClick={() => canAdd && onAdd?.(checkedItems.map(i => i.id))}
              disabled={!canAdd}
              className="h-auto flex-[2] rounded-[10px] px-4 py-3.5 text-sm font-bold disabled:opacity-55"
              style={{
                gap: '8px',
                background: canAdd ? 'linear-gradient(135deg, #38C478 0%, #28A460 100%)' : (darkMode ? 'var(--color-dark-surface)' : '#E8E0D8'),
                color: canAdd ? 'white' : textMuted,
                transition: 'opacity 0.15s',
              }}
            >
              {t.addToFridge}
              {canAdd && (
                <span style={{
                  background: 'rgba(255,255,255,0.28)', borderRadius: '10px',
                  padding: '2px 8px', fontSize: '13px',
                }}>
                  {checkedItems.length}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Dialog de confirmation fermeture */}
      {showCloseConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        }}>
          <div className="fp-modal-panel" style={{
            background: bg, borderRadius: '16px', border: `1.5px solid ${border}`,
            padding: '24px', maxWidth: '340px', width: '100%',
            boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-charcoal)', marginBottom: '8px' }}>
              {t.confirmCloseTitle}
            </h3>
            <p style={{ fontSize: '14px', color: textMuted, marginBottom: '20px', lineHeight: 1.5 }}>
              {t.confirmCloseBody}
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button
                variant="secondary"
                onClick={() => setShowCloseConfirm(false)}
                className="h-auto flex-1 rounded-[10px] border-[1.5px] px-4 py-3 text-sm font-semibold"
                style={{
                  borderColor: darkMode ? '#243650' : '#E2D8CC',
                  background: darkMode ? 'var(--color-dark-surface)' : '#F5EDE0',
                  color: 'var(--color-charcoal)',
                }}
              >
                {t.stay}
              </Button>
              <Button
                onClick={() => { setShowCloseConfirm(false); onCancel?.() }}
                className="h-auto flex-1 rounded-[10px] px-4 py-3 text-sm font-bold"
                style={{ background: 'rgba(229,53,53,0.12)', color: '#E53535' }}
              >
                {t.abandon}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  )
}
