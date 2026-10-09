import { LuChevronRight, LuTrash2, LuCheck } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { texteLisible } from '@shared/lib/couleurs/texte-lisible'

// Une ligne de la liste des tickets : ouvrir, marquer résolu, supprimer.
//
// Trois boutons CÔTE À CÔTE, et non plus un bouton qui en contenait un autre
// (« Marquer résolu ») et un `<span onClick>` pour supprimer (audit du
// 2026-10-04, ADM-19 b et A11Y-10) : HTML invalide, suppression inatteignable
// au clavier, et un lecteur d'écran lisait la ligne comme un seul bouton.
// Les actions portent le titre du ticket dans leur nom : dans une liste,
// « Supprimer » seul ne dit pas lequel.
export default function SupportTicketRow({ ticket, statusCfg, typeCfg, date, onOpen, onQuickResolve, onRequestDelete, darkMode, rowBg, fg, muted, border }) {
  const sc = statusCfg[ticket.status] ?? statusCfg.open
  const tc = typeCfg[ticket.type] ?? { icon: '📩', label: ticket.type ?? 'Ticket' }
  const survol = darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'
  return (
    <div
      onMouseEnter={e => { e.currentTarget.style.background = survol }}
      onMouseLeave={e => { e.currentTarget.style.background = rowBg }}
      className="rounded-[10px] border"
      style={{ display: 'flex', alignItems: 'center', gap: 4, paddingRight: 8, background: rowBg, borderColor: ticket.has_unread_admin ? 'var(--color-info)' : border, transition: 'background 0.15s' }}
    >
      <Button
        variant="ghost"
        onClick={() => onOpen(ticket)}
        className="h-auto min-w-0 flex-1 justify-start rounded-[10px] bg-transparent py-2.5 pl-3.5 pr-1 text-left font-normal hover:bg-transparent"
        style={{ gap: 10 }}
      >
        <span aria-hidden="true" title={tc.label} style={{ fontSize: 16, flexShrink: 0 }}>{tc.icon}</span>
        <span style={{ display: 'block', flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: ticket.has_unread_admin ? 700 : 600, color: fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {ticket.title}
            </span>
            {ticket.has_unread_admin && (
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-info)', flexShrink: 0 }} title="Nouveau message" />
            )}
            {ticket.has_unread_user && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(212,106,16,0.15)', color: 'var(--color-brand-600)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                Rép. utilisateur
              </span>
            )}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Le type, dit par l'icône à l'œil, est dit en toutes lettres au lecteur d'écran. */}
            <span className="sr-only">{tc.label}</span>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 4, background: sc.bg, color: texteLisible(sc.color) }}>{sc.label}</span>
            <span style={{ fontSize: 11, color: muted }}>{ticket.username ?? '—'}</span>
            <span style={{ fontSize: 11, color: muted }}>{date}</span>
          </span>
        </span>
        <LuChevronRight size={13} aria-hidden="true" style={{ color: muted, flexShrink: 0 }} />
      </Button>

      {/* Résoudre en un clic */}
      {ticket.status !== 'resolved' && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onQuickResolve(ticket.id)}
          title="Marquer résolu"
          aria-label={`Marquer « ${ticket.title} » résolu`}
          className="h-7 w-7 flex-shrink-0 rounded-[7px] border hover:bg-transparent"
          style={{ borderColor: 'rgba(22,163,74,0.35)', background: 'rgba(22,163,74,0.08)', color: 'var(--color-success)' }}
        >
          <LuCheck size={12} />
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRequestDelete(ticket.id)}
        title="Supprimer le ticket"
        aria-label={`Supprimer le ticket « ${ticket.title} »`}
        className="h-7 w-7 flex-shrink-0 rounded-[7px] bg-transparent hover:bg-transparent"
        style={{ color: 'var(--color-danger)' }}
      >
        <LuTrash2 size={13} />
      </Button>
    </div>
  )
}
