import { LuCheck, LuMinus, LuPencil } from 'react-icons/lu'
import Button from '@shared/ui/button'

// Une ligne de l'onglet Tarifs : identifiant, nom, sous-catégorie, une
// pastille de couverture par langue proposée, packs, « Éditer ». Sortie de
// pricing-section.jsx quand la pagination l'a fait passer les 500 lignes
// (budget de taille des composants).
export default function PricingRow({ row: r, t, langs, border, muted, fg, onEdit }) {
  return (
    <tr className="fp-ligne-survol" style={{ borderBottom: `1px solid ${border}` }}>
      <td style={{ ...tdStyle(muted), fontFamily: 'monospace', fontSize: '11px' }}>{r.id}</td>
      <td style={tdStyle(fg)}>{r.label}</td>
      <td style={{ ...tdStyle(muted), fontSize: '11px' }}>{r.subcat}</td>
      <td style={{ ...tdStyle(fg), textAlign: 'center', whiteSpace: 'nowrap' }}>
        {langs.map(l => {
          // La pastille se nomme en français et dit sa langue (« FR : prix
          // définis ») — plus « ok » / « missing », derniers libellés ARIA
          // anglais de l'admin (audit du 2026-10-04, A11Y-23).
          const nom = (r.byLangCoverage[l] ? t.coverageYes : t.coverageNo).replace('{{lang}}', l.toUpperCase())
          return (
            <span key={l} role="img" aria-label={nom} title={nom} style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '20px', marginRight: '2px',
              color: r.byLangCoverage[l] ? 'var(--color-warm-600)' : 'rgba(127,127,127,0.4)',
            }}>
              {r.byLangCoverage[l]
                ? <LuCheck size={12} aria-hidden="true" />
                : <LuMinus size={12} aria-hidden="true" />}
            </span>
          )
        })}
      </td>
      <td style={{ ...tdStyle(fg), fontSize: '11px' }}>
        {r.packs.length > 0 ? (
          r.hasSpecific
            ? r.packs.map(p => `${p.size}${p.unit} (~${p.price}€)`).join(' · ')
            : <span style={{ color: muted, fontStyle: 'italic' }}>{t.packsFromSubcat}</span>
        ) : (
          <span style={{ color: muted }}>—</span>
        )}
        {r.isEdited && (
          <span style={{
            marginLeft: '8px', fontSize: '10px',
            padding: '2px 6px', borderRadius: '4px',
            background: 'rgba(247,168,94,0.20)',
            color: 'var(--color-warm-600)',
            fontWeight: 700,
          }}>
            {t.edited}
          </span>
        )}
      </td>
      <td style={{ ...tdStyle(fg), textAlign: 'right' }}>
        <Button
          variant="ghost"
          onClick={() => onEdit(r.id)}
          aria-label={`${t.edit} ${r.label}`}
          className="inline-flex h-auto rounded-md border bg-transparent px-2.5 py-1 text-[11px] font-semibold hover:bg-transparent"
          style={{ gap: '4px', borderColor: border, color: fg }}
        >
          <LuPencil size={11} aria-hidden="true" />
          {t.edit}
        </Button>
      </td>
    </tr>
  )
}

const tdStyle = (fg) => ({
  padding: '8px 12px', color: fg, verticalAlign: 'middle',
})
