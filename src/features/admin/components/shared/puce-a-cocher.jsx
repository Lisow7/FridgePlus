import Button from '@shared/ui/button'

// Une puce qu'on coche ou décoche (allergènes, régimes) : un vrai bouton à
// bascule, atteignable au clavier, qui dit s'il est coché (audit du
// 2026-10-04, A11Y-10 : c'était un `<span onClick>`, ni focalisable ni annoncé).
// Le style reste celui de l'écran qui l'affiche.
export default function PuceACocher({ cochee, onBasculer, style, children }) {
  return (
    <Button variant="ghost" aria-pressed={cochee} onClick={onBasculer}
      className="h-auto font-normal hover:bg-transparent" style={style}>
      {children}
    </Button>
  )
}
