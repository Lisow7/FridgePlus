import Button from '@shared/ui/button'
import RecipeFormSelectDropdown from './recipe-form-select-dropdown'
import { TYPE_COLORS } from '@shared/static/recipe-constants'
import { ERR_MSG, sectionStyle, sectionTitle } from './recipe-form-section-ui'

// Section « Détails » du formulaire de recette (pays, temps, difficulté, type,
// portions, régimes, allergènes), extraite de `recipe-form-modal.jsx` le
// 2026-07-31 (§2 audit front).
//
// Présentationnel : tout l'état reste dans le formulaire parent, qui pilote via
// `update`. Ces trois listes ne servaient qu'à cette section, elles descendent
// donc avec elle. L'habillage (`sectionStyle`, `sectionTitle`, `ERR_MSG`) vient
// du module commun sorti en #910 — sans lui, cette extraction aurait créé un
// import enfant → parent.

const DIET_KEYS = ['vegetarian','vegan','gluten-free','dairy-free']
const DIFFICULTIES = ['Très facile','Facile','Intermédiaire','Difficile']
const TYPES = ['Entrée & Soupe','Plat principal','Accompagnement','Salade','Dessert & Petit-déj']

export default function RecipeFormDetailsSection({
  form, update, errors, t, lang, darkMode,
  inputBase, label, allergenTypes, dietTypes, allergenKeys,
  countryOptions, toggleDiet,
}) {
  return (
    <>
          {/* Détails */}
          <div style={sectionStyle(darkMode)}>
            {sectionTitle(t.sectionDetails)}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>

              {/* Pays */}
              <div>
                <span style={label}>{t.fieldCountry}</span>
                <RecipeFormSelectDropdown
                  options={[{ value: '', label: '–' }, ...countryOptions.map(o => ({ value: o.value, label: o.label, flag: o.flag }))]}
                  value={form.country}
                  onChange={v => update('country', v)}
                  darkMode={darkMode}
                  hasError={!!errors.country}
                />
                {errors.country && <span style={ERR_MSG}>{errors.country}</span>}
              </div>

              {/* Temps */}
              <div>
                <span style={label}>{t.fieldTime}</span>
                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  <input type="number" min="1" max="999" value={form.time} onChange={e => update('time', e.target.value)} style={{ ...inputBase(errors.time), width:'70px', textAlign:'center', flexShrink:0 }} />
                  <span style={{ fontSize:'13px', color:'var(--color-muted)', whiteSpace:'nowrap' }}>min</span>
                </div>
                {errors.time && <span style={ERR_MSG}>{errors.time}</span>}
              </div>

              {/* Difficulté */}
              <div>
                <span style={label}>{t.fieldDifficulty}</span>
                <RecipeFormSelectDropdown
                  options={[{ value: '', label: '–' }, ...DIFFICULTIES.map(d => ({ value: d, label: d }))]}
                  value={form.difficulty}
                  onChange={v => update('difficulty', v)}
                  darkMode={darkMode}
                  hasError={!!errors.difficulty}
                />
                {errors.difficulty && <span style={ERR_MSG}>{errors.difficulty}</span>}
              </div>

              {/* Type */}
              <div>
                <span style={label}>{t.fieldType}</span>
                <RecipeFormSelectDropdown
                  options={[{ value: '', label: '–' }, ...TYPES.map(tp => ({ value: tp, label: tp }))]}
                  value={form.type}
                  onChange={v => update('type', v)}
                  darkMode={darkMode}
                  hasError={!!errors.type}
                  colorMap={TYPE_COLORS}
                />
                {errors.type && <span style={ERR_MSG}>{errors.type}</span>}
              </div>

              {/* Servings */}
              <div>
                <span style={label}>{t.fieldServings}</span>
                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  <div style={{ width:'80px' }}>
                    <RecipeFormSelectDropdown
                      options={Array.from({ length:12 }, (_,i) => ({ value: String(i+1), label: String(i+1) }))}
                      value={String(form.servings)}
                      onChange={v => update('servings', parseInt(v))}
                      darkMode={darkMode}
                      hasError={!!errors.servings}
                    />
                  </div>
                  <span style={{ fontSize:'13px', color:'var(--color-muted)' }}>{t.persons}</span>
                </div>
                {errors.servings && <span style={ERR_MSG}>{errors.servings}</span>}
              </div>

            </div>

            {/* Régime */}
            <div style={{ marginTop:'14px' }}>
              <span style={label}>{t.fieldDiet}</span>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                {DIET_KEYS.map(key => {
                  const active = form.diet.includes(key)
                  const colors = dietTypes[key]
                  const isManual = key === 'halal'
                  if (!colors) return null
                  return isManual ? (
                    <Button
                      key={key}
                      onClick={() => toggleDiet(key)}
                      aria-pressed={active}
                      className="h-auto rounded-lg border-[1.5px] px-3 py-1.5 text-[13px] font-semibold"
                      style={{
                        borderColor: active ? colors.color : (darkMode ? '#2A3A50' : '#E8D5B8'),
                        background: active ? colors.bg_color : 'transparent',
                        color: active ? colors.color : 'var(--color-muted)',
                        transition:'all 0.15s',
                      }}
                    >
                      {colors.labels?.[lang] ?? key}
                    </Button>
                  ) : (
                    <span
                      key={key}
                      title={t.autoDetected}
                      style={{ padding:'5px 12px', borderRadius:'8px', fontSize:'12px', fontWeight:600, cursor:'default', border: active ? `1.5px solid ${colors.color}` : (darkMode ? '1.5px solid #2A3A50' : '1.5px solid #E8D5B8'), background: active ? colors.bg_color : 'transparent', color: active ? colors.color : 'var(--color-muted)', opacity: active ? 1 : 0.5 }}
                    >
                      {colors.labels?.[lang] ?? key}
                    </span>
                  )
                })}
              </div>
              {form.diet.length === 0 && <p style={{ fontSize:'13px', color:'var(--color-muted)', margin:'6px 0 0 0', fontStyle:'italic' }}>{t.dietNone}</p>}
            </div>

            {/* Allergènes */}
            <div style={{ marginTop:'14px' }}>
              <span style={label}>{t.fieldAllergens}</span>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                {allergenKeys.map(key => {
                  const active = form.allergens.includes(key)
                  const info = allergenTypes[key]
                  return (
                    <span
                      key={key}
                      style={{ padding:'6px 13px', borderRadius:'8px', fontSize:'14px', fontWeight:600, cursor:'default', border: active ? '1.5px solid #D07070' : (darkMode ? '1.5px solid #2A3A50' : '1.5px solid #E8D5B8'), background: active ? (darkMode ? '#3A1A1A' : '#FFF0F0') : 'transparent', color: active ? '#C05050' : 'var(--color-muted)', opacity: active ? 1 : 0.45, transition:'all 0.15s' }}
                    >
                      {info?.icon} {info?.labels?.[lang] ?? info?.labels?.fr ?? key}
                    </span>
                  )
                })}
              </div>
              {form.allergens.length === 0 && <p style={{ fontSize:'14px', color:'var(--color-muted)', margin:'6px 0 0 0', fontStyle:'italic' }}>{t.allergensNone}</p>}
              <p style={{ fontSize:'13px', color:'var(--color-muted)', margin:'6px 0 0 0', fontStyle:'italic' }}>{t.allergensHint}</p>
            </div>
          </div>
    </>
  )
}
