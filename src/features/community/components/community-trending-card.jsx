import { LuHeart } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { categoryLabel } from '@shared/lib/i18n/community-i18n'
import { getC, catColor } from './community-theme'
import { CategoryIcon } from './community-category-icon'

// Carte « tendance » de la communauté — extraite de community-page.jsx
// (2026-07-25, audit front §2). Feuille présentationnelle.
export function TrendingCard({ post, rank, onClick, t, darkMode }) {
  const C = getC(darkMode)
  const cc = catColor(post.category, darkMode)
  const rankColors = ['#C8920A', '#808080', '#8B5530']
  return (
    <Button variant="ghost"
      onClick={onClick}
      className="cp-card h-auto w-[160px] shrink-0 flex-col justify-start gap-2 rounded-xl border-[1.5px] p-3 text-left hover:bg-transparent"
      style={{
        '--cat-glow': cc.dim,
        background: C.surface,
        borderColor: `${cc.color}44`,
        boxShadow: `0 1px 4px rgba(0,0,0,${darkMode ? '.3' : '.07'})`,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{
          width: 20, height: 20, borderRadius: '50%',
          background: rankColors[rank - 1] ?? C.mid,
          color: '#fff',
          fontSize: '12px', fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>{rank}</span>
        <span style={{ fontSize: '12px', color: cc.color, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <CategoryIcon cat={post.category} size={10} />
          {categoryLabel(t, post.category)}
        </span>
      </div>
      <p style={{
        margin: 0, fontSize: '14px', fontWeight: 700, color: C.hi,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        lineHeight: 1.4,
      }}>{post.title}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: C.magenta, fontSize: '13px', fontWeight: 600 }}>
        <LuHeart size={11} fill="currentColor" />
        {post.likes_count}
      </div>
    </Button>
  )
}
