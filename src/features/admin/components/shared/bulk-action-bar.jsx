import { LuX } from 'react-icons/lu'
import Button from '@shared/ui/button'

// Barre d'actions groupées (Vague A — file de modération). Apparaît quand des
// éléments sont sélectionnés : « N sélectionné(s) » + actions + tout désélectionner.
// Placée APRÈS la liste et collée au bas de la zone qui défile (lot 12g,
// ADM-20) : en tête de liste, elle faisait sauter la liste au premier cochage
// (143 px mesurés à 360 px) et restait hors de l'écran quand on cochait une
// ligne basse. Fond opaque : collée, elle passe par-dessus les lignes.
// actions = [{ label, onClick, danger?, icon? }].
export default function BulkActionBar({ count = 0, actions = [], onClear, lang = 'fr', darkMode = false }) {
  if (!count) return null
  const selLabel = lang === 'fr'
    ? `${count} sélectionné${count > 1 ? 's' : ''}`
    : `${count} selected`
  const border = darkMode ? '#2A3A50' : '#D9CCBA'
  return (
    <div role="toolbar" aria-label={lang === 'fr' ? 'Actions groupées' : 'Bulk actions'}
      style={{ position: 'sticky', bottom: 0, zIndex: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 12px', marginTop: 8, borderRadius: 10, background: darkMode ? 'linear-gradient(rgba(224,120,32,0.14), rgba(224,120,32,0.14)), var(--color-dark-surface)' : 'linear-gradient(rgba(224,120,32,0.10), rgba(224,120,32,0.10)), var(--color-surface)', border: '1px solid rgba(224,120,32,0.35)', boxShadow: '0 -4px 12px rgba(0,0,0,0.08)' }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-brand-500)' }}>{selLabel}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 4 }}>
        {actions.map((a) => (
          <Button key={a.label} variant="ghost" onClick={a.onClick}
            className="h-auto rounded-lg border px-2.5 py-1 text-xs font-semibold hover:bg-transparent"
            style={{ gap: 5, borderColor: a.danger ? 'var(--color-danger)' : border, color: a.danger ? 'var(--color-danger)' : (darkMode ? '#C8D8E8' : '#1A0F00') }}>
            {a.icon}{a.label}
          </Button>
        ))}
      </div>
      <Button variant="ghost" size="icon" onClick={onClear}
        aria-label={lang === 'fr' ? 'Tout désélectionner' : 'Clear selection'}
        className="ml-auto h-7 w-7 bg-transparent hover:bg-transparent" style={{ color: 'var(--color-muted)' }}>
        <LuX size={15} />
      </Button>
    </div>
  )
}
