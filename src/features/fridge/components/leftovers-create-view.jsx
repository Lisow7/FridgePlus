import { LuChevronDown, LuChevronUp } from 'react-icons/lu'
import Button from '@shared/ui/button'
import Field from '@shared/ui/field'
import { HYGIENE_GUIDE, getDlcForIngredient } from '@shared/static/hygiene-guide'
import { getDlcTone } from './leftover-card'

// Vue « création d'un reste », extraite de `leftovers-modal.jsx` (728 l).
//
// Le JSX est un DÉPLACEMENT LITTÉRAL : seule l'indentation change (un niveau
// de moins). Se prouve par `diff` contre HEAD en réindentant.
//
// FORME DES PROPS — quatre objets groupés plutôt que ~24 props éparses. C'est
// la décision qui fait tenir l'extraction : le composant destructure aussitôt,
// donc aucun des ~200 sites d'usage du JSX n'est retouché. Une 5ᵉ prop aurait
// signalé un mauvais regroupement (cf. le pattern validé sur support-panel).
//
// ⚠️ `FOOD_EMOJIS` descend ici et reste PRIVÉ à ce fichier. Il existe trois
// copies DIVERGENTES dans le dépôt (l'admin en a 90, celle-ci 20 — des emojis
// de restes uniquement, une autre dans recipe-form-modal). Même nom, contenus
// incompatibles : on la DÉPLACE, on ne la mutualise pas.
//
// ⚠️ Ce fichier n'exporte QUE son composant. Y exporter une constante
// déclencherait `react-refresh/only-export-components` — +1 warning, or le
// plafond du projet est à 100 pile.

const FOOD_EMOJIS = ['🥡','🍲','🥘','🍛','🍜','🍝','🍱','🥗','🥙','🌮','🌯','🥪','🍔','🍟','🍕','🍣','🍤','🥚','🥩','🐟']

export default function LeftoversCreateView({ form, theme, data, i18n }) {
  // `t` et `lang` vont toujours ensemble : les regrouper garde la signature à
  // quatre objets. Destructurés ici, le JSX déplacé n'est pas retouché.
  const { t, lang } = i18n
  const {
    addMode, setAddMode,
    selectedIngId, setSelectedIngId,
    selectedRecipeId, setSelectedRecipeId,
    freeName, setFreeName,
    freeEmoji, setFreeEmoji,
    dlcDays, setDlcDays,
    hygieneOpen, setHygieneOpen,
    searchQ, setSearchQ,
  } = form
  const { border, muted, darkMode } = theme
  const { INGREDIENTS, availableRecipes, stockIngredients, searchNorm } = data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Toggle mode */}
      <div style={{ display: 'flex', background: darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)', borderRadius: '10px', padding: '4px', gap: '2px' }}>
        {[
          { id: 'ingredients', label: t.fromIngredients },
          { id: 'recipes',     label: t.fromRecipes },
          { id: 'free',        label: t.freeText },
        ].map(opt => (
          <Button
            key={opt.id}
            variant="ghost"
            onClick={() => {
              setAddMode(opt.id)
              setSelectedIngId(null)
              setSelectedRecipeId(null)
              if (opt.id === 'recipes' && dlcDays > 3) setDlcDays(3)
            }}
            className={`h-auto flex-1 rounded-lg px-1.5 py-2 text-xs hover:bg-transparent ${addMode === opt.id ? 'font-bold shadow-[0_1px_6px_rgba(0,0,0,0.10)]' : 'font-medium'}`}
            style={{
              background: addMode === opt.id ? (darkMode ? '#243650' : '#FDFAF6') : 'transparent',
              color: addMode === opt.id ? 'var(--color-warm-600)' : muted,
            }}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Sélection ingrédient, recette ou nom libre */}
      {addMode === 'ingredients' ? (
        <div>
          {stockIngredients.length === 0 ? (
            <p style={{ fontSize: '13px', color: muted, textAlign: 'center', padding: '16px 0' }}>{t.stockEmpty}</p>
          ) : (
            <>
              {/* Recherche — affichée à partir de 6 ingrédients pour ne pas encombrer */}
              {stockIngredients.length > 6 && (
                <Field label={t.searchIngredientAria} labelStyle={{ display: 'block', fontSize: '12px', fontWeight: 700, color: muted, marginBottom: '6px' }}>
                <input
                  type="search"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  placeholder={t.searchIngredient}
                  style={{
                    width: '100%', padding: '8px 12px', marginBottom: '10px',
                    borderRadius: '8px',
                    border: `1px solid ${darkMode ? '#2A3A50' : '#E8D5B8'}`,
                    background: darkMode ? '#1A2535' : '#FFF',
                    color: 'var(--color-charcoal)', fontSize: '13px',
                    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
                </Field>
              )}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px',
              maxHeight: '220px', overflowY: 'auto',
            }}>
              {stockIngredients.filter(ing => {
                if (!searchNorm) return true
                const lbl = (ing.labels?.[lang] ?? ing.labels?.fr ?? '').toLowerCase()
                return lbl.includes(searchNorm)
              }).map(ing => (
                <Button
                  key={ing.id}
                  variant="ghost"
                  onClick={() => {
                    const next = ing.id === selectedIngId ? null : ing.id
                    setSelectedIngId(next)
                    if (next) setDlcDays(getDlcForIngredient(next, INGREDIENTS))
                  }}
                  className="h-auto flex-col gap-1 rounded-[10px] px-1.5 py-2.5 font-normal hover:bg-transparent"
                  style={{
                    background: selectedIngId === ing.id
                      ? (darkMode ? '#243650' : '#FFF3E0')
                      : (darkMode ? '#1A2535' : '#F5EDE0'),
                    outline: selectedIngId === ing.id ? '2px solid #E07820' : 'none',
                  }}
                >
                  <span style={{ fontSize: '22px' }}>{ing.emoji}</span>
                  <span style={{
                    fontSize: '11px', fontWeight: 500, textAlign: 'center',
                    color: 'var(--color-charcoal)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%',
                  }}>
                    {ing.labels?.[lang] ?? ing.labels?.fr ?? ing.id}
                  </span>
                </Button>
              ))}
            </div>
            </>
          )}
        </div>
      ) : addMode === 'recipes' ? (
        <div>
          {availableRecipes.length === 0 ? (
            <p style={{ fontSize: '13px', color: muted, textAlign: 'center', padding: '16px 0' }}>{t.noRecipes}</p>
          ) : (
            <>
              {/* Recherche universelle (24h prioritaires + match frigo + reste) */}
              <Field label={t.searchRecipeAria} labelStyle={{ display: 'block', fontSize: '12px', fontWeight: 700, color: muted, marginBottom: '6px' }}>
              <input
                type="search"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder={t.searchRecipe}
                style={{
                  width: '100%', padding: '8px 12px', marginBottom: '10px',
                  borderRadius: '8px',
                  border: `1px solid ${darkMode ? '#2A3A50' : '#E8D5B8'}`,
                  background: darkMode ? '#1A2535' : '#FFF',
                  color: 'var(--color-charcoal)', fontSize: '13px',
                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
              </Field>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px',
              maxHeight: '220px', overflowY: 'auto',
            }}>
              {availableRecipes
                .filter(r => !searchNorm || r.name.toLowerCase().includes(searchNorm))
                .map(r => (
                <Button
                  key={r.id}
                  variant="ghost"
                  onClick={() => {
                    const next = r.id === selectedRecipeId ? null : r.id
                    setSelectedRecipeId(next)
                    if (next) setDlcDays(3)
                  }}
                  className="h-auto flex-col gap-1 rounded-[10px] px-1.5 py-2.5 font-normal hover:bg-transparent"
                  style={{
                    background: selectedRecipeId === r.id
                      ? (darkMode ? '#243650' : '#FFF3E0')
                      : (darkMode ? '#1A2535' : '#F5EDE0'),
                    outline: selectedRecipeId === r.id ? '2px solid #E07820' : 'none',
                  }}
                >
                  <span style={{ fontSize: '22px' }}>{r.emoji}</span>
                  <span style={{
                    fontSize: '11px', fontWeight: 500, textAlign: 'center',
                    color: 'var(--color-charcoal)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%',
                  }}>
                    {r.name}
                  </span>
                  {/* Indicateurs de priorité */}
                  {r.isRecent && (
                    <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-brand-500)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>24h</span>
                  )}
                  {!r.isRecent && r.matchPercent === 1 && (
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#3A6A38', letterSpacing: '0.04em' }}>{t.inFridgeTag}</span>
                  )}
                </Button>
              ))}
            </div>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Field label={t.nameAria} labelStyle={{ display: 'block', fontSize: '12px', fontWeight: 700, color: muted, marginBottom: '6px' }}>
          <input
            value={freeName}
            onChange={e => setFreeName(e.target.value)}
            placeholder={t.namePlaceholder}
            maxLength={60}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: '10px',
              border: `1.5px solid ${border}`, background: darkMode ? '#1A2535' : 'white',
              color: 'var(--color-charcoal)', fontSize: '14px', fontFamily: 'inherit',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          </Field>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {FOOD_EMOJIS.map(em => (
              <Button
                key={em}
                variant="ghost"
                size="icon"
                onClick={() => setFreeEmoji(em)}
                aria-label={em}
                className="h-9 w-9 rounded-lg text-xl hover:bg-transparent"
                style={{
                  border: freeEmoji === em ? '2px solid #E07820' : `1px solid ${border}`,
                  background: freeEmoji === em ? (darkMode ? '#243650' : '#FFF3E0') : (darkMode ? '#1A2535' : '#FDFAF6'),
                }}
              >
                {em}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* DLC selector — recettes : max 3j ; sinon max 5j */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: muted, marginBottom: '8px' }}>{t.dlcLabel}</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(addMode === 'recipes' ? [1, 2, 3] : [1, 2, 3, 4, 5]).map(n => (
            <Button
              key={n}
              onClick={() => setDlcDays(n)}
              className={`h-auto flex-1 rounded-[10px] py-[9px] text-sm font-bold ${dlcDays === n ? 'bg-gradient-to-br from-[#2E4A6A] to-[#1A2F48] text-white' : ''}`}
              style={dlcDays === n ? undefined : {
                background: darkMode ? '#1A2535' : '#F5EDE0',
                color: 'var(--color-charcoal)',
              }}
            >
              {t.dayShort(n)}
            </Button>
          ))}
        </div>
      </div>

      {/* Guide hygiène dépliable */}
      <div style={{ borderRadius: '10px', border: `1px solid ${border}`, overflow: 'hidden' }}>
        <Button
          variant="ghost"
          onClick={() => setHygieneOpen(v => !v)}
          aria-expanded={hygieneOpen}
          className="h-auto w-full justify-between rounded-none bg-transparent px-3.5 py-2.5 hover:bg-transparent"
        >
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-charcoal)' }}>📋 {t.hygieneGuide}</span>
          {hygieneOpen ? <LuChevronUp size={14} color={muted} /> : <LuChevronDown size={14} color={muted} />}
        </Button>
        {hygieneOpen && (
          <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[1, 2, 3, 4, 5].map(d => {
              const items = HYGIENE_GUIDE.filter(g => g.days === d)
              if (items.length === 0) return null
              return (
                <div key={d}>
                  <div style={{
                    fontSize: '11px', fontWeight: 700, color: muted,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    marginBottom: '4px',
                  }}>
                    {t.dayShort(d)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {items.map(g => {
                      const tone = getDlcTone(g.days, darkMode)
                      return (
                        <div key={g.emoji + g.fr} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}>
                          <span style={{ fontSize: '18px' }}>{g.emoji}</span>
                          <span style={{ flex: 1, color: 'var(--color-charcoal)' }}>{g[lang] ?? g.fr}</span>
                          <span style={{
                            fontSize: '13px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px',
                            background: tone.bg, color: tone.color, whiteSpace: 'nowrap',
                          }}>
                            {t.dayShort(g.days)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
