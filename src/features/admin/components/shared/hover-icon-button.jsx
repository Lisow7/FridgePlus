import Button from '@shared/ui/button'

// Un bouton d'action de modération : l'icône, et son libellé.
//
// Sur un bureau, le libellé se déplie au survol ET quand le clavier
// sélectionne le bouton ; sur un écran tactile (`hover: none`), il est toujours
// là. Il ne se dépliait qu'au survol de la souris (audit du 2026-10-04,
// ADM-19 a) : au téléphone, l'admin modérait avec des icônes muettes. Mesuré
// le 2026-10-08 (lot 12g), avant correction : 0 px de libellé, à 360 et 390 px.
// Le texte reste dans le bouton, replié ou non : c'est son nom accessible.
const DEPLIE = 'group-hover:max-w-48 group-hover:opacity-100 group-focus-visible:max-w-48 group-focus-visible:opacity-100 [@media(hover:none)]:max-w-48 [@media(hover:none)]:opacity-100'

export default function HoverIconButton({ onClick, icon, label, bg, color }) {
  return (
    <Button
      onClick={onClick}
      className="group h-auto min-h-7 flex-shrink-0 rounded-lg px-2 py-[7px] font-bold opacity-[0.82] transition-opacity duration-150 hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
      style={{ gap: 4, background: bg, color }}
    >
      {icon}
      {label && (
        <span className={`max-w-0 overflow-hidden whitespace-nowrap text-[13px] opacity-0 transition-[max-width,opacity] duration-200 ${DEPLIE}`}>
          {label}
        </span>
      )}
    </Button>
  )
}
