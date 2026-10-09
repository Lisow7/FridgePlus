import { LuPencil, LuTrash2, LuFlag, LuSend } from 'react-icons/lu'
import AvatarImg from '@shared/ui/avatar-img'
import Button from '@shared/ui/button'
import { formatRelativeTime } from '@shared/lib/i18n/notifications-i18n'
import { categoryLabel } from '@shared/lib/i18n/community-i18n'
import { getC, catColor } from './community-theme'
import { CategoryIcon } from './community-category-icon'
import { LoadingState } from './community-feed-states'
import { RecipePreviewCard } from './community-recipe-preview-card'
import { EmojiReactionBar } from './community-emoji-reaction-bar'
import { ReplyCard } from './community-reply-card'
import { usePostDetail } from '../hooks/use-post-detail'

// Vue détail d'un post communauté — extraite de community-page.jsx (2026-07-26,
// audit front §2). Dernier composeur : rend le post complet, le fil de réponses
// (ReplyCard, racines + enfants) et le composer pinné.
//
// L'état vit dans usePostDetail (#872) ; il ne reste ici que le rendu et la
// dérivation pure (filtre des utilisateurs bloqués, racines/enfants, cible de
// réponse), volontairement laissée dans la vue.
export function DetailView({ postId, user, t, lang, isMobile, reactionsMap, onReact, onDelete, onEdit, onReport, muteStatus, canInteract, isOwn, darkMode, recipeNames, onShowRecipe, onShowProfile, blockedUserIds }) {
  const C = getC(darkMode)
  const {
    post, replies, likedReplyIds,
    replyBody, setReplyBody,
    replyToId, setReplyToId,
    submitError, submitting,
    handleToggleReplyLike, handleReactPost, handleReplySubmit, handleDeleteReply,
  } = usePostDetail({ postId, user, t, canInteract, reactionsMap, onReact })

  if (post === null && replies === null) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="cp-feed" style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <LoadingState darkMode={darkMode} />
        </div>
      </div>
    )
  }
  if (!post) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.mid }}>{t.deletedToast}</div>
  }

  const cc = catColor(post.category, darkMode)
  const author = post.profile?.username ?? t.deletedAuthor
  const myReaction = reactionsMap.get(post.id)
  // Filtre les réponses des utilisateurs bloqués.
  const allUnfiltered = replies ?? []
  const all = blockedUserIds && blockedUserIds.size > 0
    ? allUnfiltered.filter(r => !blockedUserIds.has(r.user_id))
    : allUnfiltered
  const roots = all.filter(r => !r.parent_reply_id)
  const childrenByParent = all.reduce((acc, r) => {
    if (r.parent_reply_id) { if (!acc[r.parent_reply_id]) acc[r.parent_reply_id] = []; acc[r.parent_reply_id].push(r) }
    return acc
  }, {})
  const targetReply = replyToId ? all.find(r => r.id === replyToId) : null

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="cp-feed" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Post complet */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderLeft: `3px solid ${cc.color}`,
          borderRadius: '14px', padding: '16px',
          display: 'flex', flexDirection: 'column', gap: '12px',
          boxShadow: `0 1px 4px rgba(0,0,0,${darkMode ? '.25' : '.06'})`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {(() => {
              const canShow = !!(post.user_id && post.profile?.username && onShowProfile)
              return (
                <Button variant="ghost"
                  type="button"
                  onClick={canShow ? () => onShowProfile(post.user_id) : undefined}
                  disabled={!canShow}
                  aria-label={canShow ? t.profileViewBtn(author) : undefined}
                  className="h-auto flex-1 min-w-0 justify-start rounded-none bg-transparent p-0 text-left hover:bg-transparent disabled:opacity-100"
                  style={{
                    gap: '10px',
                    color: 'inherit',
                    font: 'inherit',
                  }}
                >
                  <AvatarImg avatarId={post.profile?.avatar_id} size={34}
                    style={{ flexShrink: 0, border: `1.5px solid ${cc.color}55`, borderRadius: '50%' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '16px', fontWeight: 700, color: C.hi,
                      textDecoration: canShow ? 'underline' : 'none',
                      textDecorationColor: 'transparent',
                      textUnderlineOffset: '3px',
                      transition: 'text-decoration-color .15s',
                    }}
                    onMouseEnter={canShow ? (e) => { e.currentTarget.style.textDecorationColor = C.orange } : undefined}
                    onMouseLeave={canShow ? (e) => { e.currentTarget.style.textDecorationColor = 'transparent' } : undefined}
                    >{author}</div>
                    <div style={{ fontSize: '13px', color: C.mid }}>{formatRelativeTime(post.created_at, lang)}</div>
                  </div>
                </Button>
              )
            })()}
            <span style={{
              fontSize: '12px', fontWeight: 800,
              padding: '3px 9px', borderRadius: '8px',
              background: cc.dim, color: cc.color,
              border: `1px solid ${cc.color}44`,
              textTransform: 'uppercase', letterSpacing: '0.04em',
              display: 'inline-flex', alignItems: 'center', gap: '4px',
            }}>
              <CategoryIcon cat={post.category} size={9} />
              {categoryLabel(t, post.category)}
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: isMobile ? '20px' : '24px', fontWeight: 900, color: C.hi, lineHeight: 1.3 }}>{post.title}</h2>
          <p style={{ margin: 0, fontSize: '16px', lineHeight: 1.65, color: C.mid, whiteSpace: 'pre-wrap' }}>{post.body}</p>
          {post.recipe_id && (
            <RecipePreviewCard
              recipeId={post.recipe_id}
              recipeNames={recipeNames}
              lang={lang}
              darkMode={darkMode}
              onShowRecipe={onShowRecipe}
            />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '10px', borderTop: `1px solid ${C.border}` }}>
            <EmojiReactionBar
              myReaction={myReaction}
              totalCount={post.likes_count}
              canReact={canInteract}
              disabledReason={canInteract ? null : (muteStatus?.muted ? t.mutedBanner : t.termsDeclinedBanner)}
              onReact={handleReactPost}
              darkMode={darkMode}
              size="lg"
              lang={lang}
            />
            <span style={{ fontSize: '14px', color: C.mid }}>{t.repliesCount(post.replies_count)}</span>
            <div style={{ flex: 1 }} />
            {isOwn(post) ? (
              <>
                <Button variant="ghost"
                  onClick={() => onEdit(post)}
                  className="h-auto rounded-md p-1.5 text-sm font-semibold hover:bg-transparent"
                  style={{ color: C.mid, gap: '4px', transition: 'color .15s' }}
                  onMouseEnter={e => e.currentTarget.style.color = C.cyan}
                  onMouseLeave={e => e.currentTarget.style.color = C.mid}>
                  <LuPencil size={14} /> {!isMobile && t.edit}
                </Button>
                <Button variant="ghost"
                  onClick={() => onDelete(post.id)}
                  className="h-auto rounded-md p-1.5 text-sm font-semibold hover:bg-transparent"
                  style={{ color: C.danger, gap: '4px', opacity: 0.7, transition: 'opacity .15s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0.7}>
                  <LuTrash2 size={14} /> {!isMobile && t.delete}
                </Button>
              </>
            ) : canInteract && (
              <Button variant="ghost"
                onClick={() => onReport('community_post', post.id)}
                className="h-auto rounded-md p-1.5 text-sm font-semibold hover:bg-transparent"
                style={{ color: C.mid, gap: '4px', opacity: 0.5, transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = C.danger }}
                onMouseLeave={e => { e.currentTarget.style.opacity = 0.5; e.currentTarget.style.color = C.mid }}>
                <LuFlag size={14} /> {!isMobile && t.report}
              </Button>
            )}
          </div>
        </div>

        {/* Séparateur */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1, height: 1, background: C.border }} />
          <span style={{ fontSize: '13px', color: C.mid, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t.repliesCount(all.length)}
          </span>
          <div style={{ flex: 1, height: 1, background: C.border }} />
        </div>

        {/* Replies */}
        {all.length === 0 ? (
          <p style={{ fontSize: '15px', color: C.mid, fontStyle: 'italic', textAlign: 'center', margin: 0 }}>{t.replyEmpty}</p>
        ) : (
          roots.map(root => (
            <div key={root.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <ReplyCard reply={root}
                isOwn={user?.id && root.user_id === user.id}
                canReport={canInteract && root.user_id !== user?.id}
                liked={likedReplyIds.has(root.id)}
                canLike={canInteract}
                canReplyTo={canInteract}
                onDelete={() => handleDeleteReply(root.id)}
                onReport={() => onReport('community_reply', root.id)}
                onToggleLike={() => handleToggleReplyLike(root.id)}
                onReplyTo={() => setReplyToId(root.id)}
                onShowProfile={onShowProfile}
                t={t} lang={lang} darkMode={darkMode}
              />
              {(childrenByParent[root.id] ?? []).length > 0 && (
                <div style={{ marginLeft: '16px', paddingLeft: '12px', borderLeft: `2px solid ${C.cyan}44`, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {childrenByParent[root.id].map(child => (
                    <ReplyCard key={child.id} reply={child}
                      isOwn={user?.id && child.user_id === user.id}
                      canReport={canInteract && child.user_id !== user?.id}
                      liked={likedReplyIds.has(child.id)}
                      canLike={canInteract}
                      canReplyTo={false}
                      replyToUsername={root.profile?.username ?? t.deletedAuthor}
                      onDelete={() => handleDeleteReply(child.id)}
                      onReport={() => onReport('community_reply', child.id)}
                      onToggleLike={() => handleToggleReplyLike(child.id)}
                      onShowProfile={onShowProfile}
                      t={t} lang={lang} darkMode={darkMode}
                    />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        <div style={{ height: '8px' }} />
      </div>

      {/* Composer pinné */}
      {user?.id && muteStatus?.muted ? (
        <div style={{ flexShrink: 0, padding: '12px 16px', borderTop: `1px solid ${C.border}`, background: C.surface, color: C.danger, fontSize: '14px', textAlign: 'center' }}>
          ⚠️ {t.mutedBanner}
        </div>
      ) : user?.id && !canInteract ? (
        <div style={{ flexShrink: 0, padding: '12px 16px', borderTop: `1px solid ${C.border}`, background: C.surface, color: C.mid, fontSize: '14px', textAlign: 'center' }}>
          📜 {t.termsDeclinedBanner}
        </div>
      ) : user?.id ? (
        <div style={{ flexShrink: 0, padding: '10px 14px', borderTop: `1px solid ${C.border}`, background: C.surface, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {targetReply && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '6px', background: C.cyanDim, border: `1px solid ${C.cyan}44`, fontSize: '13px', fontWeight: 600, color: C.cyan }}>
              <span style={{ flex: 1 }}>↳ {t.replyToUser(targetReply.profile?.username ?? t.deletedAuthor)}</span>
              <Button variant="ghost"
                onClick={() => setReplyToId(null)} type="button"
                className="h-auto rounded-none px-1.5 py-0.5 text-[13px] font-bold hover:bg-transparent"
                style={{ color: 'inherit' }}>
                ✕ {t.replyToCancel}
              </Button>
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <textarea
              className="cp-textarea"
              value={replyBody}
              onChange={e => setReplyBody(e.target.value)}
              placeholder={t.replyPh}
              maxLength={2000}
              rows={2}
              style={{
                flex: 1, padding: '9px 12px', borderRadius: '8px',
                border: `1.5px solid ${C.border}`,
                background: C.surface2, color: C.hi, fontSize: '15px',
                resize: 'none', fontFamily: 'inherit',
                transition: 'border-color .15s, box-shadow .15s',
              }}
            />
            <Button
              onClick={handleReplySubmit}
              loading={submitting}
              disabled={submitting || !replyBody.trim()}
              aria-label={t.sendReplyAria}
              className="h-auto shrink-0 rounded-lg px-3.5 py-2"
              style={{
                background: replyBody.trim()
                  ? `linear-gradient(135deg, ${C.orange}, ${darkMode ? '#FF9A00' : '#E07020'})`
                  : C.lo,
                color: replyBody.trim() ? (darkMode ? '#000' : '#fff') : C.mid,
                transition: 'all .15s',
                boxShadow: replyBody.trim() ? `0 0 12px ${C.orangeDim}` : 'none',
              }}>
              <LuSend size={15} />
            </Button>
          </div>
          {submitError && <div style={{ fontSize: '14px', color: C.danger }}>{submitError}</div>}
        </div>
      ) : (
        <div style={{ flexShrink: 0, padding: '12px 16px', borderTop: `1px solid ${C.border}`, background: C.surface, color: C.mid, fontSize: '14px', textAlign: 'center' }}>
          {t.loginToPost}
        </div>
      )}
    </div>
  )
}
