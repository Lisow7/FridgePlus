import Button from '@shared/ui/button'

// Le panier n'a pas pu être lu (audit du 2026-10-04, lot « le panier dit son
// échec ») : il paraissait vide, et depuis un panier vide, « Reprendre une
// liste » vidait en base un panier que personne n'avait vu. Cet écran dit
// l'échec à la place de « Ton panier est vide », et propose de relire.

const I18N = {
  fr: { message: "Ton panier n’a pas pu être chargé. Rien n’est perdu : réessaie.", reessayer: 'Réessayer' },
  en: { message: 'Your cart could not be loaded. Nothing is lost: try again.', reessayer: 'Try again' },
}

export default function PanierNonCharge({ lang = 'fr', onReessayer }) {
  const t = I18N[lang] ?? I18N.fr
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <p role="alert" className="text-[14px] font-bold max-w-[320px]" style={{ color: 'var(--color-danger)' }}>
        {t.message}
      </p>
      <Button variant="secondary" onClick={onReessayer} className="h-auto rounded-lg px-4 py-2 text-[13px] font-bold">
        {t.reessayer}
      </Button>
    </div>
  )
}
