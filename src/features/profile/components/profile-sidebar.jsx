import { LuUser, LuActivity, LuSettings, LuShield, LuShieldCheck, LuStar } from 'react-icons/lu'
import AvatarImg from '@shared/ui/avatar-img'
import ProfileBanner from '@shared/ui/profile-banner'
import Button from '@shared/ui/button'
import SpecialRoleBadge from '@shared/ui/special-role-badge'

// Phase 7 launch (refonte Profil) — sidebar verticale gauche pour
// l'écran desktop (≥768px). Contient avatar cliquable + pseudo + badge plan
// (Premium / Essai / Free) + nav verticale 5 onglets avec icônes Lucide.
//
// Sur mobile, le ProfileModal continue d'utiliser ses tabs horizontales
// (refonte responsive globale dans une PR ultérieure).

// Map clé d'onglet → icône (PascalCase Lu*).
// Sprint 11 S11.a — slugs FR de la refonte Profile.
const TAB_ICONS = {
  identite:    LuUser,
  preferences: LuSettings,
  activite:    LuActivity,
  compte:      LuShield,
}

const PLAN_BADGE_LABEL = {
  fr: { premium: 'Premium', trialing: 'Essai', free: 'Gratuit', admin: 'Admin', dayShort: (n) => `${n}j` },
  en: { premium: 'Premium', trialing: 'Trial',  free: 'Free',    admin: 'Admin', dayShort: (n) => `${n}d` },
}

const CHANGE_AVATAR_I18N = { fr: 'Changer mon avatar', en: 'Change my avatar' }

export default function ProfileSidebar({
  // Identité
  avatarId,
  bannerId,
  username,
  onAvatarClick,
  // Plan
  isPremium,
  isTrialing,
  trialDaysLeft,
  isAdmin,             // v3.190.1 — un admin a accès Premium implicite (cf useSubscription)
  specialRole,         // null ou 'tester'|'support'|'influencer'|'partner'
  // Navigation
  tabs,                  // [{ key, label }]
  activeTab,
  onTabChange,
  // i18n / styles
  lang,
  darkMode,
  border,
  textColor,
  mutedColor,
}) {
  const planL = PLAN_BADGE_LABEL[lang] ?? PLAN_BADGE_LABEL.fr
  // Admin > Premium > Trialing > Free. Un admin sans abonnement
  // Stripe a quand même `hasPremiumAccess=true` (bypass dans useSubscription)
  // → on l'affiche distinctement avec son propre badge violet, pas « Gratuit ».
  const planKey = isAdmin
    ? 'admin'
    : isPremium
      ? 'premium'
      : (isTrialing ? 'trialing' : 'free')
  const planLabel = !isAdmin && isTrialing && trialDaysLeft != null
    ? `${planL.trialing} · ${planL.dayShort(trialDaysLeft)}`
    : planL[planKey]

  const planBg = planKey === 'admin'
    ? 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)'
    : planKey === 'premium'
      ? 'var(--gradient-deep)'
      : planKey === 'trialing'
        ? 'linear-gradient(135deg, #93C5FD 0%, #3B82F6 100%)'
        : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')
  const planFg = planKey === 'free' ? mutedColor : '#FFFFFF'

  return (
    // Sprint 11 mini-refonte esthétique :
    // - width 260px → 220px (plus compacte)
    // - alignSelf flex-start + sticky pour ne pas occuper toute la hauteur
    //   et rester accessible au scroll
    // - card avec border-radius + box-shadow (au lieu d'un grand bloc plat)
    // - marginRight pour respirer entre sidebar et contenu
    <aside style={{
      width: '220px',
      flexShrink: 0,
      alignSelf: 'flex-start',
      position: 'sticky',
      top: '96px', // sous le Header
      marginRight: '20px',
      borderRadius: '14px',
      border: `1px solid ${border}`,
      background: darkMode ? '#141F2E' : '#F5EDE0',
      boxShadow: darkMode
        ? '0 4px 12px rgba(0,0,0,0.3)'
        : '0 4px 12px rgba(212,106,16,0.06)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* ─── En-tête : bannière en FOND + avatar/pseudo/badge superposés ─ */}
      <div style={{ position: 'relative', borderBottom: `1px solid ${border}` }}>
        <ProfileBanner bannerId={bannerId} height={140} radius={0} scrim>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'flex-end',
            gap: '7px', padding: '0 14px 12px',
          }}>
            <Button
              variant="ghost"
              type="button"
              onClick={onAvatarClick}
              className="h-auto w-auto rounded-full bg-transparent p-0 hover:bg-transparent"
              style={{ transition: 'transform 0.15s, box-shadow 0.15s', borderRadius: '50%' }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.04)'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.55)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.boxShadow = 'none'
              }}
              aria-label={CHANGE_AVATAR_I18N[lang] ?? CHANGE_AVATAR_I18N.fr}
            >
              <AvatarImg avatarId={avatarId} size={58} style={{ border: '3px solid #fff', background: '#fff' }} />
            </Button>
            <div style={{
              fontSize: '14px', fontWeight: 800, color: '#fff',
              textShadow: '0 1px 3px rgba(0,0,0,0.55)',
              textAlign: 'center', wordBreak: 'break-word', maxWidth: '100%',
              lineHeight: 1.2,
            }}>
              {username || '—'}
            </div>
            {specialRole
              ? <SpecialRoleBadge role={specialRole} lang={lang} />
              : (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '3px 9px', borderRadius: '6px',
                  background: planBg, color: planFg,
                  fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}>
                  {planKey === 'premium' && <LuStar size={10} fill={planFg} />}
                  {planKey === 'admin'   && <LuShieldCheck size={10} />}
                  {planLabel}
                </span>
              )
            }
          </div>
        </ProfileBanner>
      </div>

      {/* ─── Nav verticale ────────────────────────────────────────────── */}
      {/* `role="tablist"` : les boutons ci-dessous portent `role="tab"`, qui
          EXIGE ce parent (aria-required-parent, audit 2026-08-25 — la barre
          mobile de profile-page.jsx l'avait déjà, cette sidebar desktop non). */}
      <nav role="tablist" aria-orientation="vertical" style={{
        padding: '10px 8px 12px',
        display: 'flex', flexDirection: 'column', gap: '6px',
      }}>
        {tabs.map(({ key, label }) => {
          const Icon = TAB_ICONS[key] ?? LuUser
          const isActive = activeTab === key
          return (
            <Button
              key={key}
              variant="ghost"
              type="button"
              onClick={() => onTabChange(key)}
              role="tab"
              aria-selected={isActive}
              className="h-auto w-full justify-start rounded-[10px] px-3 py-2.5 text-left text-[13px] hover:bg-transparent"
              style={{
                gap: '10px',
                background: isActive ? 'var(--gradient-deep)' : 'transparent',
                color: isActive ? '#FFFFFF' : textColor,
                fontWeight: isActive ? 700 : 600,
                boxShadow: isActive ? '0 2px 6px rgba(212,106,16,0.25)' : 'none',
                transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = 'rgba(247,168,94,0.10)'
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = 'transparent'
              }}
            >
              <Icon size={16} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </Button>
          )
        })}
      </nav>
    </aside>
  )
}
