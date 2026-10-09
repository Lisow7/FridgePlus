import { LuMessageCircle, LuPencil, LuTrash2, LuFlag } from 'react-icons/lu'
import AvatarImg from '@shared/ui/avatar-img'
import Button from '@shared/ui/button'
import { formatRelativeTime } from '@shared/lib/i18n/notifications-i18n'
import { categoryLabel } from '@shared/lib/i18n/community-i18n'
import { getC, catColor } from './community-theme'
import { CategoryIcon } from './community-category-icon'
import { RecipePreviewCard } from './community-recipe-preview-card'
import { EmojiReactionBar } from './community-emoji-reaction-bar'
import { authorName } from '@shared/lib/author-name'

// Carte d'un post dans le feed communauté — extraite de community-page.jsx
// (2026-07-25, audit front §2). Composeur : rend les feuilles déjà extraites
// (CategoryIcon, RecipePreviewCard, EmojiReactionBar). Présentationnel — tout
// l'état/les handlers arrivent en props depuis CommunityPage.
const GRAIN_SVG = "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

export function PostCard({ post, idx, myReaction, onOpen, onReact, onEdit, onDelete, onReport, isOwn, canLike, reactDisabledReason, canReport, t, lang, isMobile, darkMode, recipeNames, onShowRecipe, onShowProfile }) {
  const C = getC(darkMode)
  const cc = catColor(post.category, darkMode)
  const author = authorName(post, t)
  const stop = (handler) => (e) => { e.stopPropagation(); handler() }
  const canShowProfile = !!(post.user_id && post.profile?.username && onShowProfile)

  const categoryBadge = (
    <span style={{
      fontSize: '12px', fontWeight: 800,
      padding: '3px 8px', borderRadius: '8px',
      background: cc.dim, color: cc.color,
      border: `1px solid ${cc.color}44`,
      flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em',
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      alignSelf: 'flex-start',
    }}>
      <CategoryIcon cat={post.category} size={9} />
      {categoryLabel(t, post.category)}
    </span>
  )

  return (
    <article
      role="button" tabIndex={0}
      onClick={onOpen}
      // Seulement les touches venues du post lui-même : celles d'un bouton
      // interne remontaient ici, et Entrée sur « Supprimer » ouvrait le post à
      // la place (audit du 2026-10-04, A11Y-04).
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen() } }}
      className="cp-card"
      style={{
        '--cat-glow': cc.dim,
        position: 'relative',
        background: C.surface,
        borderRadius: '12px',
        border: `1px solid ${C.border}`,
        borderLeft: `3px solid ${cc.color}`,
        padding: isMobile ? '14px 14px 12px' : '16px 16px 13px',
        display: 'flex', flexDirection: 'column', gap: isMobile ? '8px' : '10px',
        cursor: 'pointer',
        animation: 'cp-fade-up .3s ease both',
        animationDelay: `${Math.min(idx * 40, 240)}ms`,
        boxShadow: `0 1px 4px rgba(0,0,0,${darkMode ? '.25' : '.06'})`,
      }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: GRAIN_SVG, opacity: darkMode ? 0.025 : 0.018 }} />
      </div>

      {/* Rangée auteur — sur mobile le badge est sorti de cette rangée.
          v3.166.0 : avatar+username cliquables → ouvre le profil communauté. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
        <Button variant="ghost"
          type="button"
          onClick={canShowProfile ? (e) => { e.stopPropagation(); onShowProfile(post.user_id) } : undefined}
          disabled={!canShowProfile}
          aria-label={canShowProfile ? t.profileViewBtn(author) : undefined}
          className="h-auto flex-1 min-w-0 justify-start rounded-md bg-transparent p-0 text-left hover:bg-transparent disabled:opacity-100"
          style={{
            gap: '10px',
            color: 'inherit',
            font: 'inherit',
          }}
        >
          <AvatarImg avatarId={post.profile?.avatar_id} size={isMobile ? 34 : 30}
            style={{ flexShrink: 0, border: `1.5px solid ${cc.color}55`, borderRadius: '50%' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '16px', fontWeight: 700, color: C.hi,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              textDecoration: canShowProfile ? 'underline' : 'none',
              textDecorationColor: 'transparent',
              textUnderlineOffset: '3px',
              transition: 'text-decoration-color .15s',
            }}
            onMouseEnter={canShowProfile ? (e) => { e.currentTarget.style.textDecorationColor = C.orange } : undefined}
            onMouseLeave={canShowProfile ? (e) => { e.currentTarget.style.textDecorationColor = 'transparent' } : undefined}
            >{author}</div>
            <div style={{ fontSize: '13px', color: C.mid }}>{formatRelativeTime(post.created_at, lang)}</div>
          </div>
        </Button>
        {!isMobile && categoryBadge}
      </div>

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: isMobile ? '17px' : '17px', fontWeight: 800, color: C.hi, lineHeight: 1.3, flex: 1, minWidth: 0 }}>{post.title}</h3>
          {isMobile && categoryBadge}
        </div>
        <p style={{
          margin: 0, fontSize: '15px', lineHeight: 1.6, color: C.mid,
          display: '-webkit-box', WebkitLineClamp: isMobile ? 2 : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{post.body}</p>
      </div>

      {post.recipe_id && (
        <div onClick={e => e.stopPropagation()}>
          <RecipePreviewCard
            recipeId={post.recipe_id}
            recipeNames={recipeNames}
            lang={lang}
            darkMode={darkMode}
            onShowRecipe={onShowRecipe}
          />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '8px', borderTop: `1px solid ${C.border}`, position: 'relative' }}>
        <div onClick={e => e.stopPropagation()}>
          <EmojiReactionBar
            myReaction={myReaction}
            totalCount={post.likes_count}
            canReact={canLike}
            disabledReason={reactDisabledReason}
            onReact={onReact}
            darkMode={darkMode}
            size="sm"
            lang={lang}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: C.mid, fontSize: '14px', fontWeight: 600, padding: '4px 6px' }}>
          <LuMessageCircle size={14} />
          {post.replies_count}
        </div>
        <div style={{ flex: 1 }} />
        {isOwn ? (
          <>
            <Button variant="ghost" size="icon"
              onClick={stop(onEdit)} aria-label={t.edit} title={t.edit}
              className="h-auto w-auto rounded-md border px-2 py-1.5 hover:bg-transparent"
              style={{
                background: C.cyanDim,
                borderColor: `${C.cyan}55`,
                color: C.cyan,
                transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.cyan; e.currentTarget.style.color = darkMode ? '#000' : '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = C.cyanDim; e.currentTarget.style.color = C.cyan }}>
              <LuPencil size={15} />
            </Button>
            <Button variant="ghost" size="icon"
              onClick={stop(onDelete)} aria-label={t.delete} title={t.delete}
              className="h-auto w-auto rounded-md border px-2 py-1.5 hover:bg-transparent"
              style={{
                background: C.dangerDim,
                borderColor: `${C.danger}55`,
                color: C.danger,
                transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.danger; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = C.dangerDim; e.currentTarget.style.color = C.danger }}>
              <LuTrash2 size={15} />
            </Button>
          </>
        ) : canReport && (
          <Button variant="ghost" size="icon"
            onClick={stop(onReport)} aria-label={t.report} title={t.report}
            className="h-auto w-auto rounded-md border bg-transparent px-2 py-1.5 hover:bg-transparent"
            style={{
              borderColor: C.border,
              color: C.mid,
              transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.dangerDim; e.currentTarget.style.borderColor = C.danger; e.currentTarget.style.color = C.danger }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.mid }}>
            <LuFlag size={14} />
          </Button>
        )}
      </div>
    </article>
  )
}
