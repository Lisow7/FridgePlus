import { LuHeart, LuMessageCircle, LuTrash2, LuFlag } from 'react-icons/lu'
import AvatarImg from '@shared/ui/avatar-img'
import Button from '@shared/ui/button'
import { formatRelativeTime } from '@shared/lib/i18n/notifications-i18n'
import { getC } from './community-theme'
import { authorName } from '@shared/lib/author-name'

// Carte d'une réponse dans le détail d'un post — extraite de community-page.jsx
// (2026-07-25, audit front §2). Feuille : aucune dépendance vers un autre
// composant communauté. Présentationnel — état et handlers arrivent en props
// depuis DetailView.
export function ReplyCard({ reply, isOwn, canReport, canLike, canReplyTo, liked, replyToUsername, onDelete, onReport, onToggleLike, onReplyTo, onShowProfile, t, lang, darkMode }) {
  const C = getC(darkMode)
  const author = authorName(reply, t)
  const canShowProfile = !!(reply.user_id && reply.profile?.username && onShowProfile)
  return (
    <div style={{
      padding: '11px 14px', borderRadius: '10px',
      border: `1px solid ${C.border}`, background: C.surface2,
      display: 'flex', flexDirection: 'column', gap: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Button variant="ghost"
          type="button"
          onClick={canShowProfile ? () => onShowProfile(reply.user_id) : undefined}
          disabled={!canShowProfile}
          aria-label={canShowProfile ? t.profileViewBtn(author) : undefined}
          className="h-auto flex-1 min-w-0 justify-start rounded-none bg-transparent p-0 text-left hover:bg-transparent disabled:opacity-100"
          style={{
            gap: '8px',
            color: 'inherit',
            font: 'inherit',
          }}
        >
          <AvatarImg avatarId={reply.profile?.avatar_id} size={24}
            style={{ flexShrink: 0, borderRadius: '50%', border: `1px solid ${C.border}` }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              fontSize: '14px', fontWeight: 700, color: C.hi,
              textDecoration: canShowProfile ? 'underline' : 'none',
              textDecorationColor: 'transparent',
              textUnderlineOffset: '2px',
              transition: 'text-decoration-color .15s',
            }}
            onMouseEnter={canShowProfile ? (e) => { e.currentTarget.style.textDecorationColor = C.orange } : undefined}
            onMouseLeave={canShowProfile ? (e) => { e.currentTarget.style.textDecorationColor = 'transparent' } : undefined}
            >{author}</span>
            {replyToUsername && (
              <span style={{ fontSize: '12px', color: C.cyan, marginLeft: '6px' }}>↳ @{replyToUsername}</span>
            )}
          </div>
        </Button>
        <span style={{ fontSize: '13px', color: C.mid, flexShrink: 0 }}>{formatRelativeTime(reply.created_at, lang)}</span>
        {isOwn ? (
          <Button variant="ghost" size="icon"
            onClick={onDelete} aria-label={t.delete}
            className="h-auto w-auto p-0.5 hover:bg-transparent"
            style={{ color: C.danger, opacity: 0.7, transition: 'opacity .15s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = 1}
            onMouseLeave={e => e.currentTarget.style.opacity = 0.7}>
            <LuTrash2 size={13} />
          </Button>
        ) : canReport && (
          <Button variant="ghost" size="icon"
            onClick={onReport} aria-label={t.report}
            className="h-auto w-auto p-0.5 hover:bg-transparent"
            style={{ color: C.mid, opacity: 0.5, transition: 'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = C.danger }}
            onMouseLeave={e => { e.currentTarget.style.opacity = 0.5; e.currentTarget.style.color = C.mid }}>
            <LuFlag size={13} />
          </Button>
        )}
      </div>
      <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.5, color: C.mid, whiteSpace: 'pre-wrap' }}>{reply.body}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Button variant="ghost"
          onClick={onToggleLike}
          disabled={!canLike}
          aria-pressed={liked}
          // Sans nom, le bouton s'annonçait « 0, bouton bascule » : le compteur
          // seul ne dit pas ce que fait le bouton.
          aria-label={t.likeReplyBtn}
          className="h-auto rounded-md px-1 py-0.5 text-sm font-semibold disabled:opacity-50 hover:bg-transparent"
          style={{ gap: '4px', color: liked ? C.magenta : C.mid }}>
          <LuHeart size={12} fill={liked ? 'currentColor' : 'none'} strokeWidth={2.5} />
          {reply.likes_count ?? 0}
        </Button>
        {canReplyTo && onReplyTo && (
          <Button variant="ghost"
            onClick={onReplyTo}
            className="h-auto rounded-md px-1 py-0.5 text-sm font-semibold hover:bg-transparent"
            style={{ gap: '4px', color: C.mid, transition: 'color .15s' }}
            onMouseEnter={e => e.currentTarget.style.color = C.orange}
            onMouseLeave={e => e.currentTarget.style.color = C.mid}>
            <LuMessageCircle size={12} />
            {t.replyToBtn}
          </Button>
        )}
      </div>
    </div>
  )
}
