// ⚠️ `LuMic` manquait ici après l'extraction, et RIEN ne l'a signalé : ni le
// build, ni les 2050 tests, ni ESLint — `<LuMic />` est une BALISE JSX, donc
// invisible à `no-undef`, qui avait pourtant bien attrapé `lang` et `stock`
// (minuscules). Seule la QA visuelle l'a vu, l'écran tombant sur
// l'ErrorBoundary. D'où la règle : après chaque extraction, relever à la main
// les identifiants Majuscule — `grep -oE "<[A-Z][a-zA-Z0-9_]*"` comparé aux
// imports.
import { LuCheck, LuMic } from 'react-icons/lu'
import Button from '@shared/ui/button'

// Liste des ingrédients reconnus à la voix, extraite de
// `voice-confirm-panel.jsx` (637 l). Couvre les trois cas : aucun résultat,
// choix d'une ambiguïté, et ligne cochée/décochée.
//
// Le JSX est un DÉPLACEMENT LITTÉRAL : seule l'indentation change (un niveau
// de moins). Se prouve par `diff` contre HEAD en réindentant.
//
// FORME DES PROPS — quatre objets groupés plutôt qu'une douzaine de props
// éparses ; le composant les destructure aussitôt, donc le JSX déplacé n'est
// pas retouché d'un caractère.
//
// ⚠️ `STORAGE_HINTS`/`getStorageHint` et `GROUP_LABELS` descendent ici : leur
// seul autre usage était leur propre définition. `GROUP_ORDER` et `CAT_GROUP`
// restent au parent, qui construit le regroupement.
//
// ⚠️ Ce fichier n'exporte QUE son composant — y exporter une constante
// déclencherait `react-refresh/only-export-components`, or le plafond de
// warnings du projet est à 100 pile.

const STORAGE_HINTS = {
  frz: { fr: 'Surgelé',     en: 'Frozen',   icon: '❄️',  color: '#3B82F6' },
  fr:  { fr: 'Frais',       en: 'Fresh',   icon: '🌡️', color: '#0891B2' },
  vg:  { fr: 'Légumes',     en: 'Veggie',   icon: '🥦',  color: 'var(--color-success)' },
  gp:  { fr: 'Épicerie',    en: 'Pantry', icon: '🛒',  color: 'var(--color-warning)' },
  sp:  { fr: 'Condiment',   en: 'Spice', icon: '🧂',  color: '#8B5CF6' },
  bk:  { fr: 'Boulangerie', en: 'Bakery',   icon: '🍞',  color: '#B45309' },
  jp:  { fr: 'Japonais',    en: 'Japanese',   icon: '🍱',  color: '#BE185D' },
}

function getStorageHint(id) {
  if (!id) return null
  return STORAGE_HINTS[id.split('-')[0]] ?? null
}

const GROUP_LABELS = {
  bof:       { fr: 'Beurre·Œufs·Fromage', en: 'Dairy & Eggs', },
  meat:      { fr: 'Viande',              en: 'Meat', },
  fish:      { fr: 'Poisson',             en: 'Fish', },
  deli:      { fr: 'Charcuterie',         en: 'Deli', },
  vegetables:{ fr: 'Légumes',             en: 'Vegetables', },
  fruits:    { fr: 'Fruits',              en: 'Fruits', },
  frozen:    { fr: 'Surgelés',            en: 'Frozen', },
  grocery:   { fr: 'Épicerie sèche',      en: 'Dry goods', },
  spices:    { fr: 'Épices & Condiments', en: 'Spices & Condiments', },
  japanese:  { fr: 'Épicerie japonaise',  en: 'Japanese pantry', },
  other:     { fr: 'Autres',              en: 'Other', },
}

export default function VoiceMatchedList({ data, actions, theme, i18n }) {
  const { items, groupedDisplay, stock } = data
  const { toggleCheck, resolveAmbig, dismissAmbig } = actions
  const { textMuted, darkMode } = theme
  const { t, lang } = i18n

  // Le commentaire JSX « {/* Liste */} » qui précédait ce bloc chez le parent
  // est devenu ce commentaire-ci : le garder dans le `return` en aurait fait un
  // second enfant, ce qui aurait exigé un fragment pour rien.
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
      {items.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', minHeight: '200px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(229,53,53,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LuMic size={28} style={{ color: '#E53535', opacity: 0.6 }} />
          </div>
          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-charcoal)', margin: 0 }}>{t.noIngredients}</p>
          <p style={{ fontSize: '13px', color: textMuted, textAlign: 'center', maxWidth: '280px', lineHeight: 1.55, margin: 0 }}>{t.noIngredientsHint}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {groupedDisplay.map((item, itemIdx) => {
            // ── En-tête de groupe ──
            if (item.__header) {
              return (
                <div key={`hdr-${item.group}`} style={{
                  fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: textMuted, opacity: 0.6,
                  padding: itemIdx === 0 ? '0 2px 4px' : '8px 2px 4px',
                }}>
                  {GROUP_LABELS[item.group]?.[lang] ?? item.group}
                </div>
              )
            }

            // ── Item ambigu (non résolu) ──
            if (item.ambiguous) {
              return (
                <div key={`ambig-${itemIdx}`} style={{
                  borderRadius: '10px', overflow: 'hidden',
                  border: `1.5px solid rgba(224,140,32,0.45)`,
                  background: darkMode ? 'rgba(224,140,32,0.08)' : 'rgba(224,140,32,0.06)',
                }}>
                  {/* En-tête ambigu */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px 8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: darkMode ? '#E8A840' : '#A06010', flex: 1 }}>
                      « {item.word} » — {t.ambigHint ?? 'Lequel ?'}
                    </span>
                    <Button
                      variant="ghost"
                      onClick={() => dismissAmbig(item.word)}
                      className="h-auto rounded-lg border bg-transparent px-2.5 py-0.5 text-[11px] font-semibold hover:bg-transparent"
                      style={{
                        borderColor: darkMode ? '#304A68' : '#D8CCC0',
                        color: textMuted,
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#243650' : 'var(--color-bg-warm)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {t.dismiss ?? 'Ignorer'}
                    </Button>
                  </div>
                  {/* Candidats */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '0 14px 12px' }}>
                    {item.candidates.map(cand => {
                      const candLabel = cand.labels?.[lang] ?? cand.labels?.fr ?? cand.id
                      const inStock = stock.has(cand.id)
                      const hint = getStorageHint(cand.id)
                      return (
                        <Button
                          key={cand.id}
                          onClick={() => resolveAmbig(item.word, cand)}
                          className="h-auto rounded-lg border-[1.5px] px-3 py-1 text-[13px] font-semibold"
                          style={{
                            gap: '5px',
                            borderColor: inStock ? (darkMode ? '#243650' : '#D0C8BC') : 'rgba(224,140,32,0.5)',
                            background: inStock ? (darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)') : (darkMode ? 'rgba(224,140,32,0.12)' : 'rgba(224,140,32,0.08)'),
                            color: inStock ? textMuted : (darkMode ? '#E8A840' : '#A06010'),
                            transition: 'all 0.12s',
                            opacity: inStock ? 0.55 : 1,
                          }}
                        >
                          <span>{candLabel}</span>
                          {hint && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '2px',
                              fontSize: '11px', fontWeight: 500,
                              color: hint.color, opacity: inStock ? 0.6 : 0.85,
                            }}>
                              <span>{hint.icon}</span>
                              <span>{hint[lang] ?? hint.fr}</span>
                            </span>
                          )}
                          {inStock && <span style={{ fontSize: '10px', opacity: 0.7 }}>✓</span>}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              )
            }

            // ── Item confirmé (normal) ──
            const inStock = stock.has(item.id)
            const label = item.labels?.[lang] ?? item.labels?.fr ?? item.id
            return (
              <Button
                key={item.id ?? itemIdx}
                variant="ghost"
                onClick={() => !inStock && toggleCheck(item.id)}
                disabled={inStock}
                aria-pressed={!inStock && item.checked}
                className="h-auto w-full justify-start rounded-[10px] border-[1.5px] px-3.5 py-3 text-left hover:bg-transparent disabled:opacity-45"
                style={{
                  gap: '12px',
                  borderColor: inStock
                    ? (darkMode ? '#243650' : '#E2D8CC')
                    : (item.checked ? 'rgba(50,180,120,0.5)' : (darkMode ? '#243650' : '#E2D8CC')),
                  background: inStock
                    ? (darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)')
                    : (item.checked ? (darkMode ? 'rgba(50,180,120,0.08)' : 'rgba(50,180,120,0.06)') : 'transparent'),
                  transition: 'all 0.15s',
                }}
              >
                {/* Checkbox */}
                <div style={{
                  width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
                  border: `1.5px solid ${!inStock && item.checked ? '#32B478' : (darkMode ? '#304E6E' : '#C4B8A8')}`,
                  background: !inStock && item.checked ? '#32B478' : (darkMode ? 'var(--color-dark-surface)' : '#F5EDE0'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {(item.checked || inStock) && (
                    <LuCheck size={13} style={{ color: !inStock && item.checked ? 'white' : (darkMode ? '#304E6E' : '#C4B8A8') }} />
                  )}
                </div>

                {/* Label */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '15px', fontWeight: 600, color: inStock ? textMuted : 'var(--color-charcoal)' }}>
                    {label}
                  </span>
                  {inStock && (
                    <p style={{ fontSize: '12px', color: textMuted, margin: '2px 0 0', opacity: 0.8 }}>{t.alreadyIn}</p>
                  )}
                </div>

                {/* Point de confiance */}
                {!inStock && !item.manual && (
                  <div style={{
                    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                    background: '#32B478',
                    opacity: Math.max(0.3, item.confidence ?? 1),
                  }} />
                )}
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}
