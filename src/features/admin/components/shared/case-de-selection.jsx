// La case qui sélectionne une ligne pour les actions groupées.
//
// 16 px à l'œil, mais une zone de 24 × 24 px au doigt : le `<label>` qui
// l'entoure prend le clic, et ses 4 px de marge l'écartent du bouton voisin.
// Mesuré par axe dans le panneau admin le 2026-10-08 (lot 12f) : la case des
// Signalements, 16 × 16 px, touchait le bouton de sa ligne (WCAG 2.5.8,
// `target-size`). Les quatre files de modération partagent celle-ci.
export default function CaseDeSelection({ cochee, onBasculer, nom, style }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 4, flexShrink: 0, cursor: 'pointer', ...style }}>
      <input type="checkbox" checked={cochee} onChange={onBasculer} aria-label={nom}
        style={{ width: 16, height: 16, margin: 0, cursor: 'pointer' }} />
    </label>
  )
}
