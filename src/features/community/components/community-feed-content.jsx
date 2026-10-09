import { LuTrendingUp } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { CATEGORIES, categoryLabel } from '@shared/lib/i18n/community-i18n'
import { getC, catColor } from './community-theme'
import { CategoryIcon } from './community-category-icon'
import { TrendingCard } from './community-trending-card'
import { LoadingState, EmptyState } from './community-feed-states'
import { PostCard } from './community-post-card'

// Contenu du feed communauté (pills catégories + trending + tri + liste de
// posts) — extrait de community-page.jsx (2026-07-25, audit front §2).
// Composeur : rend les feuilles + PostCard déjà extraits. Présentationnel —
// état/handlers en props depuis CommunityPage. (La prop `user` de l'original,
// inutilisée, n'est pas reprise.)
export function FeedContent({ posts, trending, reactionsMap, category, setCategory, sort, setSort, search, onOpenPost, onReact, onEdit, onDelete, onReport, isOwn, canInteract, muteStatus, t, lang, isMobile, darkMode, recipeNames, onShowRecipe, onShowProfile, emptyAction = null }) {
  const C = getC(darkMode)
  // v3.418 — explique pourquoi le bouton "Réagir" est désactivé (muté vs
  // charte non signée), au lieu de rester muet comme avant. Même pattern
  // que le tooltip du bouton Composer (CPHeader ligne ~640).
  const reactDisabledReason = canInteract ? null : (muteStatus?.muted ? t.mutedBanner : t.termsDeclinedBanner)
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Pills catégories */}
      <div style={{ flexShrink: 0, padding: '12px 14px 0', borderBottom: `1px solid ${C.border}` }}>
        <div className="cp-pills" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '12px' }}>
          {['all', ...CATEGORIES].map(cat => {
            const cc = catColor(cat, darkMode)
            const active = category === cat
            const showLabel = !isMobile || active
            // 🔴 Le libellé est calculé ICI, et pas seulement affiché plus bas.
            // En mobile, `showLabel` est faux pour toutes les puces inactives :
            // elles devenaient des boutons de 36 px ne contenant qu'une icône,
            // donc SANS AUCUN nom accessible. axe les classe « button-name,
            // critical » — un lecteur d'écran y annonçait « bouton » cinq fois
            // de suite, sans dire lesquelles. Découvert le 2026-09-12, le jour
            // où le cliquet a11y s'est mis à balayer aussi une largeur mobile :
            // en 1440×900 ces puces portent toujours leur texte, et le défaut
            // était donc invisible depuis qu'il existait.
            // `aria-label` est posé DANS TOUS LES CAS : quand le texte est
            // visible il dit exactement la même chose, ce qui satisfait aussi
            // « Label in Name » (WCAG 2.5.3).
            const libelle = cat === 'all' ? t.catAll : categoryLabel(t, cat)
            return (
              <Button key={cat} variant="ghost"
                onClick={() => setCategory(cat)}
                aria-pressed={active}
                aria-label={libelle}
                className="h-auto shrink-0 whitespace-nowrap rounded-lg border-[1.5px] text-sm font-bold hover:bg-transparent"
                style={{
                  padding: isMobile && !active ? '7px 9px' : '6px 13px',
                  borderColor: active ? cc.color : C.border,
                  background: active ? cc.dim : 'transparent',
                  color: active ? cc.color : C.mid,
                  transition: 'all .2s cubic-bezier(.25,.46,.45,.94)',
                  boxShadow: active ? `0 0 8px ${cc.dim}` : 'none',
                  gap: showLabel ? '5px' : '0',
                }}>
                <CategoryIcon cat={cat} size={isMobile && !showLabel ? 16 : 13} />
                {showLabel && <span>{libelle}</span>}
              </Button>
            )
          })}
        </div>
      </div>

      {/* Trending */}
      {trending.length > 0 && !search && (
        <div style={{ flexShrink: 0, padding: '10px 14px 0', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <LuTrendingUp size={12} color={C.orange} />
            <span style={{ fontSize: '12px', fontWeight: 800, color: C.orange, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t.trending}</span>
          </div>
          <div className="cp-trending" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px' }}>
            {trending.map((post, idx) => (
              <TrendingCard key={post.id} post={post} rank={idx + 1} onClick={() => onOpenPost(post.id)} lang={lang} t={t} darkMode={darkMode} />
            ))}
          </div>
        </div>
      )}

      {/* Sort bar */}
      <div style={{ flexShrink: 0, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', gap: '3px', background: C.surface2, borderRadius: '8px', padding: '3px' }}>
          {['recent', 'popular'].map(s => (
            <Button key={s} variant="ghost"
              onClick={() => setSort(s)}
              role="radio"
              aria-checked={sort === s}
              className="h-auto rounded-md px-3 py-1 text-sm font-bold hover:bg-transparent"
              style={{
                background: sort === s ? C.orange : 'transparent',
                color: sort === s ? (darkMode ? '#000' : '#fff') : C.mid,
                transition: 'all .15s',
              }}>
              {s === 'recent' ? t.feedRecent : t.feedPopular}
            </Button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {posts !== null && (
          <span style={{ fontSize: '13px', color: C.mid }}>
            {posts.length} post{posts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Liste posts */}
      <div className="cp-feed" style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {posts === null ? (
          <LoadingState darkMode={darkMode} />
        ) : posts.length === 0 ? (
          <EmptyState t={t} darkMode={darkMode} action={emptyAction} />
        ) : (
          posts.map((post, idx) => (
            <PostCard key={post.id}
              post={post}
              idx={idx}
              myReaction={reactionsMap.get(post.id)}
              onOpen={() => onOpenPost(post.id)}
              onReact={(emoji) => onReact(post.id, emoji)}
              onEdit={() => onEdit(post)}
              onDelete={() => onDelete(post.id)}
              onReport={() => onReport('community_post', post.id)}
              isOwn={isOwn(post)}
              canLike={canInteract}
              reactDisabledReason={reactDisabledReason}
              canReport={canInteract && !isOwn(post)}
              t={t}
              lang={lang}
              isMobile={isMobile}
              darkMode={darkMode}
              recipeNames={recipeNames}
              onShowRecipe={onShowRecipe}
              onShowProfile={onShowProfile}
            />
          ))
        )}
      </div>
    </div>
  )
}
