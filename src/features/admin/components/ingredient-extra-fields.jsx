import { useState, useId } from 'react'
import { useAllergenTypes } from '@shared/contexts/data-provider'
import Button from '@shared/ui/button'
import Field from '@shared/ui/field'
import PuceACocher from './shared/puce-a-cocher'

// Composant des champs étendus d'un ingrédient (v3.3.12).
// Couvre : default_unit, allergens[], breaks_diets[], nutrition (5 macros : cal/prot/carb/fat/fib).
// pack_size est laissé en JSON brut (édition rare, structure complexe).
//
// Utilisé dans IngredientForm (AdminPanel.jsx) — sera intégré aux composants
// `IngredientsSection.jsx` lors de l'extraction complète d'AdminPanel.

const UNIT_OPTIONS = [
  { value: '',      label: '— non défini —' },
  { value: 'g',     label: 'g (grammes)' },
  { value: 'ml',    label: 'ml (millilitres)' },
  { value: 'piece', label: 'pièce' },
  { value: 'tbsp',  label: 'cuillère à soupe' },
  { value: 'tsp',   label: 'cuillère à café' },
  { value: 'cup',   label: 'tasse' },
]

// `halal` retiré temporairement (cf. HIDDEN_DIETS dans
// recipeConstants.js). Réactivation = ré-ajouter la clé.
const DIET_KEYS = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free']

const NUTRITION_FIELDS = [
  { key: 'cal',  label: 'Calories', unit: 'kcal' },
  { key: 'prot', label: 'Protéines', unit: 'g' },
  { key: 'carb', label: 'Glucides', unit: 'g' },
  { key: 'fat',  label: 'Lipides', unit: 'g' },
  { key: 'fib',  label: 'Fibres', unit: 'g' },
]

export default function IngredientExtraFields({
  defaultUnit, setDefaultUnit,
  allergens,   setAllergens,
  breaksDiets, setBreaksDiets,
  nutrition,   setNutrition,
  packSize,    setPackSize,
  darkMode, border, textColor, muted, isMobile,
}) {
  const allergenTypes = useAllergenTypes()
  const allergenKeys  = Object.keys(allergenTypes)
  const [expanded, setExpanded] = useState(false)
  const allergenesId = useId()
  const regimesId = useId()

  const inp  = { padding:'8px 11px', borderRadius:'8px', border:`1px solid ${border}`, background: darkMode ? '#141F2E' : '#FFF', color: textColor, fontSize:'15px', outline:'none', fontFamily:'inherit', width:'100%', boxSizing:'border-box' }
  const lbl  = { fontSize:'13px', color: muted, display:'block', marginBottom:'4px' }
  const chip = (active) => ({
    padding:'4px 10px', borderRadius:'14px', fontSize:'12px',
    border: `1px solid ${active ? 'var(--color-brand-500)' : border}`,
    background: active ? 'var(--color-brand-500)' : 'transparent',
    color: active ? '#FFF' : muted,
    cursor:'pointer', userSelect:'none',
  })

  const toggleArrayItem = (arr, key, setter) => {
    setter(arr.includes(key) ? arr.filter(k => k !== key) : [...arr, key])
  }

  const setNutritionField = (key, value) => {
    setNutrition({ ...nutrition, [key]: value === '' ? 0 : Number(value) })
  }

  const packSizeJson = JSON.stringify(packSize ?? {}, null, 2)
  const handlePackSizeChange = (str) => {
    try {
      setPackSize(str.trim() ? JSON.parse(str) : {})
    } catch {
      // ignore parse errors silently — l'admin verra un JSON invalide
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        className="h-auto self-start rounded-lg border bg-transparent px-2.5 py-1.5 text-[13px] hover:bg-transparent"
        style={{ gap: '6px', borderColor: border, color: muted }}
      >
        <span>{expanded ? '▲' : '▼'}</span>
        <span>Champs étendus (unité, allergènes, régimes, nutrition){!expanded && (defaultUnit || allergens.length || breaksDiets.length) ? '  ✓' : ''}</span>
      </Button>

      {expanded && (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px', padding:'12px', borderRadius:'10px', background: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)', border:`1px solid ${border}` }}>

          {/* Unité par défaut */}
          <Field label="Unité par défaut" labelStyle={lbl}>
            <select style={inp} value={defaultUnit ?? ''} onChange={e => setDefaultUnit(e.target.value || null)}>
              {UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </Field>

          {/* Allergènes */}
          <div role="group" aria-labelledby={allergenesId}>
            <span id={allergenesId} style={lbl}>Allergènes — clique pour cocher / décocher</span>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
              {allergenKeys.length === 0
                ? <span style={{ fontSize:'12px', color: muted }}>(chargement…)</span>
                : allergenKeys.map(key => {
                    const meta = allergenTypes[key]
                    const active = allergens.includes(key)
                    return (
                      <PuceACocher key={key} cochee={active} style={chip(active)} onBasculer={() => toggleArrayItem(allergens, key, setAllergens)}>
                        {meta?.icon ? `${meta.icon} ` : ''}{meta?.labels?.fr ?? key}
                      </PuceACocher>
                    )
                  })
              }
            </div>
          </div>

          {/* Régimes cassés */}
          <div role="group" aria-labelledby={regimesId}>
            <span id={regimesId} style={lbl}>Régimes incompatibles <span style={{ opacity:0.55 }}>— quels régimes cet ingrédient « casse »</span></span>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
              {DIET_KEYS.map(key => {
                const active = breaksDiets.includes(key)
                return (
                  <PuceACocher key={key} cochee={active} style={chip(active)} onBasculer={() => toggleArrayItem(breaksDiets, key, setBreaksDiets)}>
                    {key}
                  </PuceACocher>
                )
              })}
            </div>
          </div>

          {/* Nutrition (par 100g) */}
          <div>
            <label style={lbl}>Nutrition <span style={{ opacity:0.55 }}>— pour 100g</span></label>
            <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap:'8px' }}>
              {NUTRITION_FIELDS.map(f => (
                <Field key={f.key} label={`${f.label} (${f.unit})`} labelStyle={{ fontSize:'12px', color: muted, marginBottom:'2px', display:'block' }}>
                  <input
                    style={inp}
                    type="number"
                    step="0.1"
                    value={nutrition?.[f.key] ?? 0}
                    onChange={e => setNutritionField(f.key, e.target.value)}
                  />
                </Field>
              ))}
            </div>
          </div>

          {/* Pack size — JSON brut */}
          <Field label={<>Conditionnements <span style={{ opacity:0.55 }}>— JSON. Voir <code>packSizes.js</code> pour exemples.</span></>} labelStyle={lbl}>
            <textarea
              style={{ ...inp, fontFamily:'monospace', fontSize:'12px', minHeight:'80px', resize:'vertical' }}
              value={packSizeJson}
              onChange={e => handlePackSizeChange(e.target.value)}
              placeholder='{"fr": [{"size": 500, "unit": "g", "price": 2.50}]}'
            />
          </Field>
        </div>
      )}
    </>
  )
}
