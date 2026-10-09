import { LuLock } from 'react-icons/lu'
import ProfileBanner from '@shared/ui/profile-banner'

// Grille de badges (présentational pur), regroupés par thème. Reçoit la sortie
// de computeBadges. Débloqué = couleur ; verrouillé = grisé + progression.
// Le prochain palier de chaque thème (isNextTier) est mis en avant pour éviter
// le « cimetière de badges gris » chez un nouvel utilisateur. Contraste AA même
// grisé. Depuis l'unification badges/quêtes : un palier à `reward.banner`
// affiche une mini-vignette de la bannière (dégradé + hero) À LA PLACE du
// glyphe seul — le hero de la bannière reprend volontairement le même émoji
// que le badge, donc les deux ne coexistent jamais sur une même carte.

const THEME_ORDER = ['regularity', 'volume', 'variety', 'world']

export default function BadgesGrid({
  badges, t, lang, darkMode, border, textColor, mutedColor,
  unlockedBanners = [], targetId = null, nextRewardId = null,
}) {
  const byTheme = {}
  for (const b of badges ?? []) (byTheme[b.theme] ??= []).push(b)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <style>{'@keyframes badge-blink{0%,100%{box-shadow:0 0 0 0 rgba(212,106,16,0)}50%{box-shadow:0 0 0 3px rgba(212,106,16,0.65)}}'}</style>
      {THEME_ORDER.filter((theme) => byTheme[theme]?.length).map((theme) => (
        <div key={theme}>
          <p style={{
            margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: mutedColor,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {t.themeLabels[theme]}
          </p>
          <ul style={{
            listStyle: 'none', padding: 0, margin: 0,
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px',
          }}>
            {byTheme[theme].map((b) => {
              const label = b.label[lang] ?? b.label.fr
              const stateA11y = b.unlocked ? t.badgeUnlockedA11y : t.badgeLockedA11y
              const rewardBanner = b.reward?.banner
              const bannerLocked = rewardBanner ? !unlockedBanners.includes(rewardBanner) : false
              return (
                <li
                  key={b.id}
                  id={`badge-${b.id}`}
                  data-next={b.isNextTier ? 'true' : undefined}
                  aria-label={`${label} — ${stateA11y}`}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: '4px',
                    padding: '10px', borderRadius: '10px',
                    border: b.isNextTier ? '1.5px solid var(--color-warm-500, #E07820)' : `1px solid ${border}`,
                    background: b.unlocked
                      ? (darkMode ? 'rgba(247,168,94,0.10)' : 'rgba(247,168,94,0.12)')
                      : (darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
                    animation: targetId === b.id ? 'badge-blink 0.85s ease 3' : undefined,
                  }}
                >
                  {rewardBanner ? (
                    <div style={{ position: 'relative', width: '100%' }}>
                      <ProfileBanner bannerId={rewardBanner} height={40} radius={8}
                        style={{ filter: b.unlocked ? 'none' : 'grayscale(0.7) brightness(0.7)' }} />
                      {bannerLocked && (
                        <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                          <LuLock size={14} />
                        </span>
                      )}
                    </div>
                  ) : (
                    <span aria-hidden="true" style={{ fontSize: '22px', lineHeight: 1, filter: b.unlocked ? 'none' : 'grayscale(1)' }}>
                      {b.emoji}
                    </span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: b.unlocked ? textColor : mutedColor }}>
                      {label}
                    </span>
                    {b.id === nextRewardId && (
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 20,
                        background: 'var(--gradient-warm)', color: '#fff', letterSpacing: '0.02em',
                      }}>
                        {t.nextRewardLabel}
                      </span>
                    )}
                  </div>
                  {!b.unlocked && (
                    <span style={{ fontSize: '11px', color: mutedColor, fontWeight: 700 }}>
                      {t.badgeProgress(b.progress.value, b.progress.threshold)}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
