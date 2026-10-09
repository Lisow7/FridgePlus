import { Children, cloneElement, useId } from 'react'

// Un champ et son libellé RELIÉS (audit du 2026-10-04, A11Y-07).
//
// Le motif dominant de l'app était un `<label>` VOISIN du champ, jamais relié
// (`<div><label>Statut</label><select/></div>`) : un lecteur d'écran annonçait
// « zone de liste » sans dire laquelle, et un clic sur le libellé ne menait
// nulle part. `Field` garde exactement ce rendu — un conteneur, le libellé,
// le champ — et pose les liens : `htmlFor`/`id`, l'aide et l'erreur dans
// `aria-describedby`, `aria-invalid` quand il y a une erreur, l'erreur en
// `role="alert"`.
//
// Le champ est l'enfant unique : `<Field label="Statut"><select …/></Field>`.
// Son `id` et son `aria-describedby` éventuels sont gardés.
export default function Field({
  label, hint, error, children,
  labelStyle, labelClassName, hintStyle, errorStyle, style, className,
}) {
  const genere = useId()
  const champ = Children.only(children)
  const id = champ.props.id ?? genere
  const aideId = hint ? `${id}-aide` : null
  const erreurId = error ? `${id}-erreur` : null
  const decrit = [champ.props['aria-describedby'], aideId, erreurId].filter(Boolean).join(' ')

  return (
    <div style={style} className={className}>
      <label htmlFor={id} style={labelStyle} className={labelClassName}>{label}</label>
      {cloneElement(champ, {
        id,
        'aria-describedby': decrit || undefined,
        ...(error ? { 'aria-invalid': true } : {}),
      })}
      {hint && <div id={aideId} style={hintStyle}>{hint}</div>}
      {error && <div id={erreurId} role="alert" style={errorStyle}>{error}</div>}
    </div>
  )
}
