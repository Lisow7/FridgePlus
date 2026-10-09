import { useState, useRef, useEffect, useCallback, useId, useMemo } from 'react'
import { useAnchoredPopover } from '@shared/hooks/use-anchored-popover'
import { AnchoredBubble } from './anchored-popover'
import { splitStepWithAnnotations } from '@shared/lib/recipes/step-annotations'
import { useBaseRecipes } from '@shared/contexts/data-provider'
import { pickRecipeName } from '@shared/lib/recipes/recipe-i18n'

// Rend le texte d'une étape avec deux types de termes cliquables :
//  - glossaire (verbe technique) : infobulle de définition, reste sur place.
//  - recette de base (nom de préparation) : bouton de navigation vers une
//    autre recette (via onOpenBaseRecipe), visuellement différencié pour ne
//    pas laisser croire « clic = définition ».

function GlossaryTerm({ value, def, lang, darkMode }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const popRef = useRef(null)
  const popId = useId()
  const close = useCallback(() => setOpen(false), [])
  const pos = useAnchoredPopover({ anchorRef: btnRef, open, onClose: close, width: 260 })

  useEffect(() => {
    if (!open) return
    const onPointer = (e) => {
      if (btnRef.current?.contains(e.target)) return
      if (popRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])

  const definition = def[lang] ?? def.fr

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-describedby={open ? popId : undefined}
        style={{
          background: 'none', border: 'none', padding: 0, margin: 0,
          font: 'inherit', color: 'inherit', cursor: 'help',
          textDecoration: 'underline dotted',
          textDecorationColor: 'var(--color-brand-500, #E07820)',
          textUnderlineOffset: '2px',
        }}
      >
        {value}
      </button>
      <AnchoredBubble pos={pos} popRef={popRef} id={popId} darkMode={darkMode}>
        <strong style={{ display: 'block', textTransform: 'capitalize', marginBottom: '2px' }}>
          {value}
        </strong>
        {definition}
      </AnchoredBubble>
    </>
  )
}

const LINK_STYLE = {
  textDecoration: 'underline solid',
  textDecorationColor: 'var(--color-info, #2563EB)',
  textDecorationThickness: '1.5px',
  textUnderlineOffset: '2px',
  color: 'var(--color-info, #2563EB)',
  font: 'inherit', fontWeight: 600,
  background: 'var(--color-info-soft, rgba(37,99,235,0.08))',
  border: 'none', padding: '1px 5px 1px 2px', borderRadius: '5px',
  cursor: 'pointer', whiteSpace: 'nowrap',
}

function BaseRecipeTerm({ value, recipeIds, lang, darkMode, onOpenBaseRecipe }) {
  const { recipeNames } = useBaseRecipes()
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const popRef = useRef(null)
  const popId = useId()
  const close = useCallback(() => setOpen(false), [])
  const pos = useAnchoredPopover({ anchorRef: btnRef, open, onClose: close, width: 240 })

  useEffect(() => {
    if (!open) return
    const onPointer = (e) => {
      if (btnRef.current?.contains(e.target)) return
      if (popRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])

  if (recipeIds.length === 1) {
    return (
      <button type="button" onClick={() => onOpenBaseRecipe(recipeIds[0])} style={LINK_STYLE}>
        {value}<span aria-hidden="true"> ↗</span>
      </button>
    )
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-describedby={open ? popId : undefined}
        style={LINK_STYLE}
      >
        {value}<span aria-hidden="true"> ↗</span>
      </button>
      <AnchoredBubble pos={pos} popRef={popRef} id={popId} darkMode={darkMode} role="menu">
        {recipeIds.map(id => (
          <button
            key={id}
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onOpenBaseRecipe(id) }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: 'none', border: 'none', padding: '6px 4px',
              font: 'inherit', color: 'inherit', cursor: 'pointer',
            }}
          >
            {pickRecipeName({ id, name: recipeNames[id] }, null, lang)}
          </button>
        ))}
      </AnchoredBubble>
    </>
  )
}

/**
 * @param {{text:string, lang?:string, darkMode?:boolean, currentRecipeId:string, onOpenBaseRecipe:(id:string)=>void}} props
 */
export default function StepText({ text, lang = 'fr', darkMode = false, currentRecipeId, onOpenBaseRecipe }) {
  const { recipesById } = useBaseRecipes()
  const segments = useMemo(
    () => splitStepWithAnnotations(text, lang, { currentRecipeId, recipesById }),
    [text, lang, currentRecipeId, recipesById],
  )
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'text') return <span key={i}>{seg.value}</span>
        if (seg.type === 'glossary') {
          return <GlossaryTerm key={i} value={seg.value} def={seg.payload} lang={lang} darkMode={darkMode} />
        }
        return (
          <BaseRecipeTerm
            key={i}
            value={seg.value}
            recipeIds={seg.payload}
            lang={lang}
            darkMode={darkMode}
            onOpenBaseRecipe={onOpenBaseRecipe}
          />
        )
      })}
    </>
  )
}
