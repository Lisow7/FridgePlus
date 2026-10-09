import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { LuX, LuCheck, LuSearch, LuPlus } from 'react-icons/lu'
import { useIngredients } from '@shared/contexts/data-provider'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import Button from '@shared/ui/button'
import { Z_INDEX } from '@shared/lib/z-index'
// Alias à l'import : garde le nom local `normalize`, donc 0 site d'usage touché.
import { normalizeSearch as normalize } from '@shared/lib/matching/normalize-search'

const I18N = {
  fr: {
    title: 'Articles trouvés',
    addToFridge: 'Ajouter au frigo',
    cancel: 'Annuler',
    alreadyIn: 'Déjà dans ton frigo',
    searchPlaceholder: 'Ajouter un ingrédient manuellement…',
    searchNoResults: 'Aucun résultat',
    unmatchedSummary: n => `${n} article${n > 1 ? 's' : ''} non reconnu${n > 1 ? 's' : ''} — ajoute-les manuellement ci-dessous si besoin.`,
    choose: 'Choisir',
    dismiss: 'Ignorer',
    subtitle: n => `${n} seront ajoutés au frigo`,
  },
  en: {
    title: 'Items found',
    addToFridge: 'Add to fridge',
    cancel: 'Cancel',
    alreadyIn: 'Already in your fridge',
    searchPlaceholder: 'Add an ingredient manually…',
    searchNoResults: 'No results',
    unmatchedSummary: n => `${n} item${n > 1 ? 's' : ''} unrecognised — add ${n > 1 ? 'them' : 'it'} manually below if needed.`,
    choose: 'Choose',
    dismiss: 'Dismiss',
    subtitle: n => `${n} will be added to your fridge`,
  },
}

// ⚠️ La version locale ne développait pas la ligature « œ » : NFD ne la
// décompose pas, donc « boeuf » ne trouvait aucun des huit ingrédients écrits
// « bœuf » dans la revue du ticket scanné.

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

export default function ReceiptReviewPanel({
  lang = 'fr', darkMode = false,
  matched = [], ambiguous = [], unmatchedCount = 0,
  stock = new Set(), onAdd, onCancel,
}) {
  const allIngredients = useIngredients()
  const t = I18N[lang] ?? I18N.fr
  const windowWidth = useWindowWidth()
  const isDesktop = windowWidth >= 1280
  useCloseOnBackButton(true, onCancel)

  const [checkedIds, setCheckedIds] = useState(() => new Set(matched.filter(m => !stock.has(m.id)).map(m => m.id)))
  const [resolvedAmbiguous, setResolvedAmbiguous] = useState([]) // ingrédients résolus depuis un choix ambigu
  const [dismissedAmbigIdx, setDismissedAmbigIdx] = useState(() => new Set())
  const [manualAdded, setManualAdded] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  const flatList = useMemo(() => buildFlatList(allIngredients, lang), [allIngredients, lang])
  const allShownIds = useMemo(
    () => new Set([...matched, ...resolvedAmbiguous, ...manualAdded].map(i => i.id)),
    [matched, resolvedAmbiguous, manualAdded],
  )
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = normalize(searchQuery)
    return flatList.filter(ing => normalize(ing.label).includes(q) && !allShownIds.has(ing.id)).slice(0, 7)
  }, [searchQuery, flatList, allShownIds])

  const toggleCheck = (id) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const resolveAmbig = (idx, candidate) => {
    setDismissedAmbigIdx(prev => new Set(prev).add(idx))
    setResolvedAmbiguous(prev => [...prev, { id: candidate.id, labels: candidate.labels }])
    if (!stock.has(candidate.id)) setCheckedIds(prev => new Set(prev).add(candidate.id))
  }

  const dismissAmbig = (idx) => {
    setDismissedAmbigIdx(prev => new Set(prev).add(idx))
  }

  const addManual = (ing) => {
    setManualAdded(prev => [...prev, { id: ing.id, labels: ing.labels }])
    setCheckedIds(prev => new Set(prev).add(ing.id))
    setSearchQuery('')
  }

  const allItems = useMemo(() => {
    const raw = [...matched, ...resolvedAmbiguous, ...manualAdded]
    const seen = new Set()
    const deduped = []
    for (const item of raw) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      deduped.push(item)
    }
    return deduped
  }, [matched, resolvedAmbiguous, manualAdded])
  const checkedItems = allItems.filter(i => checkedIds.has(i.id) && !stock.has(i.id))
  const canAdd = checkedItems.length > 0

  const bg = darkMode ? '#0F1923' : '#FDFAF6'
  const border = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'
  const textMuted = darkMode ? '#7A90A8' : '#7A5F56'

  const panelStyle = isDesktop ? {
    position: 'fixed', top: 0, left: 0, width: '620px', height: '100vh',
    zIndex: Z_INDEX.MODAL, background: bg, borderRight: `1px solid ${border}`,
    boxShadow: '4px 0 32px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column',
  } : {
    position: 'fixed', inset: 0, zIndex: Z_INDEX.MODAL, background: bg,
    display: 'flex', flexDirection: 'column',
  }

  return createPortal(
    <>
      {isDesktop && <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: Z_INDEX.MODAL - 1, background: 'rgba(0,0,0,0.25)' }} />}
      <div style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 20px 16px', borderBottom: `1px solid ${border}` }}>
          <span style={{ fontSize: '22px' }}>🧾</span>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-charcoal)', margin: 0 }}>{t.title}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel} aria-label={t.cancel} className="h-[42px] w-[42px] shrink-0 rounded-[10px] bg-transparent p-0 hover:bg-transparent" style={{ color: '#E53535' }}>
            <LuX size={20} aria-hidden="true" />
          </Button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {ambiguous.map((amb, idx) => {
              if (dismissedAmbigIdx.has(idx)) return null
              return (
                <div key={`ambig-${idx}`} style={{ borderRadius: '10px', overflow: 'hidden', border: '1.5px solid rgba(37,99,235,0.4)', background: darkMode ? 'rgba(37,99,235,0.08)' : 'rgba(37,99,235,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px 8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: darkMode ? '#7DA6F0' : '#2563EB', flex: 1 }}>{t.choose}</span>
                    <Button variant="ghost" onClick={() => dismissAmbig(idx)} className="h-auto rounded-lg border bg-transparent px-2.5 py-0.5 text-[11px] font-semibold hover:bg-transparent" style={{ borderColor: darkMode ? '#304A68' : '#D8CCC0', color: textMuted }}>
                      {t.dismiss}
                    </Button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '0 14px 12px' }}>
                    {amb.candidates.map(cand => {
                      const label = cand.labels?.[lang] ?? cand.labels?.fr ?? cand.id
                      return (
                        <Button key={cand.id} onClick={() => resolveAmbig(idx, cand)} className="h-auto rounded-lg border-[1.5px] px-3 py-1 text-[13px] font-semibold" style={{ borderColor: 'rgba(37,99,235,0.5)', background: darkMode ? 'rgba(37,99,235,0.12)' : 'rgba(37,99,235,0.08)', color: darkMode ? '#7DA6F0' : '#2563EB' }}>
                          {label}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {unmatchedCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '13px 14px', borderRadius: '10px', border: '1.5px solid rgba(217,119,6,0.35)', background: darkMode ? 'rgba(217,119,6,0.08)' : 'rgba(217,119,6,0.05)' }}>
                <span style={{ fontSize: '19px' }}>❓</span>
                <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#B85000' }}>{t.unmatchedSummary(unmatchedCount)}</span>
              </div>
            )}

            {allItems.map(item => {
              const inStock = stock.has(item.id)
              const checked = checkedIds.has(item.id)
              const label = item.labels?.[lang] ?? item.labels?.fr ?? item.id
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  onClick={() => !inStock && toggleCheck(item.id)}
                  disabled={inStock}
                  aria-pressed={!inStock && checked}
                  className="h-auto w-full justify-start rounded-[10px] border-[1.5px] px-3.5 py-3 text-left hover:bg-transparent disabled:opacity-45"
                  style={{
                    gap: '12px',
                    borderColor: inStock ? (darkMode ? '#243650' : '#E2D8CC') : (checked ? 'rgba(50,180,120,0.5)' : (darkMode ? '#243650' : '#E2D8CC')),
                    background: inStock ? (darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)') : (checked ? (darkMode ? 'rgba(50,180,120,0.08)' : 'rgba(50,180,120,0.06)') : 'transparent'),
                  }}
                >
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
                    border: `1.5px solid ${!inStock && checked ? '#32B478' : (darkMode ? '#304E6E' : '#C4B8A8')}`,
                    background: !inStock && checked ? '#32B478' : (darkMode ? 'var(--color-dark-surface)' : '#F5EDE0'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {(checked || inStock) && <LuCheck size={13} style={{ color: !inStock && checked ? 'white' : (darkMode ? '#304E6E' : '#C4B8A8') }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: inStock ? textMuted : 'var(--color-charcoal)' }}>
                      {item.emoji ? `${item.emoji} ` : ''}{label}
                    </span>
                    {inStock && <p style={{ fontSize: '12px', color: textMuted, margin: '2px 0 0' }}>{t.alreadyIn}</p>}
                  </div>
                </Button>
              )
            })}
          </div>
        </div>

        <div style={{ padding: '8px 20px 0', flexShrink: 0, position: 'relative' }}>
          <LuSearch size={15} style={{ position: 'absolute', left: '32px', top: '50%', transform: 'translateY(-50%)', color: textMuted, pointerEvents: 'none', zIndex: 1 }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowSearch(true) }}
            onFocus={() => setShowSearch(true)}
            onBlur={() => setTimeout(() => setShowSearch(false), 150)}
            placeholder={t.searchPlaceholder}
            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '10px', border: `1.5px solid ${darkMode ? '#243650' : '#E2D8CC'}`, background: darkMode ? '#131E2C' : '#F5EDE0', color: 'var(--color-charcoal)', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }}
          />
          {showSearch && searchResults.length > 0 && (
            <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: '20px', right: '20px', background: darkMode ? '#131E2C' : '#FDFAF6', border: `1.5px solid ${border}`, borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.18)', overflow: 'hidden', zIndex: 10 }}>
              {searchResults.map(ing => (
                <Button key={ing.id} variant="ghost" onMouseDown={() => addManual(ing)} className="h-auto w-full justify-start rounded-none bg-transparent px-3.5 py-2.5 text-sm hover:bg-transparent" style={{ gap: '10px', color: 'var(--color-charcoal)' }}>
                  <LuPlus size={14} style={{ color: '#32B478', flexShrink: 0 }} />
                  <span>{ing.emoji}</span>
                  <span style={{ flex: 1 }}>{ing.label}</span>
                </Button>
              ))}
            </div>
          )}
          {showSearch && searchQuery.trim() && searchResults.length === 0 && (
            <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: '20px', right: '20px', background: darkMode ? '#131E2C' : '#FDFAF6', border: `1.5px solid ${border}`, borderRadius: '10px', padding: '12px 14px', fontSize: '13px', color: textMuted, zIndex: 10 }}>
              {t.searchNoResults}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 20px 20px', flexShrink: 0, borderTop: `1px solid ${border}`, marginTop: '8px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button variant="ghost" onClick={onCancel} className="h-auto flex-1 rounded-[10px] border-[1.5px] bg-transparent px-4 py-3.5 text-sm font-semibold hover:bg-transparent" style={{ borderColor: darkMode ? '#243650' : '#E2D8CC', color: 'var(--color-muted)' }}>
              {t.cancel}
            </Button>
            <Button
              onClick={() => canAdd && onAdd?.(checkedItems.map(i => i.id))}
              disabled={!canAdd}
              className="h-auto flex-[2] rounded-[10px] px-4 py-3.5 text-sm font-bold disabled:opacity-55"
              style={{ gap: '8px', background: canAdd ? 'linear-gradient(135deg, #38C478 0%, #28A460 100%)' : (darkMode ? 'var(--color-dark-surface)' : '#E8E0D8'), color: canAdd ? 'white' : textMuted }}
            >
              {t.addToFridge}
              {canAdd && <span style={{ background: 'rgba(255,255,255,0.28)', borderRadius: '10px', padding: '2px 8px', fontSize: '13px' }}>{checkedItems.length}</span>}
            </Button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
