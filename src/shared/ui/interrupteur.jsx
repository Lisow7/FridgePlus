import Button from '@shared/ui/button'

// Un interrupteur (rôle « switch ») : nommé par le libellé visible qu'il
// désigne (`labelledBy`), activable au clavier comme un bouton. Sorti de la
// fenêtre « Cookies et données » le 2026-10-10 pour servir aussi aux
// notifications des Préférences : une seule allure pour tous les réglages
// immédiats.
export default function Interrupteur({ checked, disabled, onChange, labelledBy }) {
  return (
    <Button
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={onChange}
      className="relative h-6 w-11 shrink-0 rounded-xl p-0 disabled:opacity-60"
      style={{
        background: checked ? 'var(--color-brand-500)' : '#888',
        transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: checked ? 22 : 2,
        width: 20, height: 20, borderRadius: '50%',
        background: 'white',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </Button>
  )
}
