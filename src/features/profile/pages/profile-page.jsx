import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { LuUser, LuSettings, LuActivity, LuShield, LuWallet, LuTrophy } from 'react-icons/lu'
import { useAuth } from '@shared/contexts/auth-provider'
import { useSubscription } from '@shared/hooks/use-subscription'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import ProfileSidebar from '@features/profile/components/profile-sidebar'
import AvatarPickerModal from '@features/profile/components/avatar-picker-modal'
import { useDocumentTitle } from '@shared/hooks/use-document-title'
import { titreDeRoute } from '@routes/route-title'

// Sprint 11 — page Profile (ex-ProfileModal).
//
// 4 onglets refondus (cf. spec la conception « profile-ux-reorg » du 2026-05-15) :
//   - /profile/identite    (Profil — identité publique)
//   - /profile/preferences (Préférences — réglages perso)
//   - /profile/activite    (Activité — données dérivées)
//   - /profile/compte      (Compte & sécurité — technique + RGPD)
//
// Layout responsive :
//   - Desktop/tablette (≥640px) : sidebar verticale persistante à gauche
//   - Mobile (<640px)           : barre horizontale scrollable d'onglets
//                                  au-dessus du contenu (sidebar masquée
//                                  pour gagner de la place)
//
// <Outlet /> rend la sous-page active. Chaque sous-page gère son propre
// h1 + intro via <ProfilePageIntro> (focus a11y au mount).

// v3.412 — onglet « Mes dépenses » ajouté (Premium-gated, séparé d'Activité).
const TABS = [
  { key: 'identite',    path: '/profile/identite',    labelKey: 'tabProfil',   Icon: LuUser },
  { key: 'preferences', path: '/profile/preferences', labelKey: 'tabPrefs',    Icon: LuSettings },
  { key: 'activite',    path: '/profile/activite',    labelKey: 'tabActivity', Icon: LuActivity },
  { key: 'recompenses', path: '/profile/recompenses', labelKey: 'tabRewards',  Icon: LuTrophy },
  { key: 'depenses',    path: '/profile/depenses',    labelKey: 'tabSpending', Icon: LuWallet, premium: true },
  { key: 'compte',      path: '/profile/compte',      labelKey: 'tabAccount',  Icon: LuShield },
]

const I18N = {
  fr: {
    tabProfil:   'Profil',
    tabPrefs:    'Préférences',
    tabActivity: 'Activité',
    tabRewards:  'Récompenses',
    tabSpending: 'Mes dépenses',
    tabAccount:  'Compte & sécurité',
    nav:         'Navigation profil',
  },
  en: {
    tabProfil:   'Profile',
    tabPrefs:    'Preferences',
    tabActivity: 'Activity',
    tabRewards:  'Rewards',
    tabSpending: 'My spending',
    tabAccount:  'Account & security',
    nav:         'Profile navigation',
  },
}

export default function ProfilePage({ lang = 'fr', darkMode = false }) {
  const t = I18N[lang] ?? I18N.fr
  const navigate = useNavigate()
  const location = useLocation()
  // Le titre survit à la redirection /profile → /profile/identite grâce au
  // garde de useSeoMeta (cf. laPagePoseSonTitre). Sans lui, l'effet du PARENT
  // reposait le générique APRÈS celui de la page, et gagnait toujours.
  useDocumentTitle(titreDeRoute('/profile', lang))
  const { user, profile, isAdmin } = useAuth()
  const { isPremium, isTrialing, trialDaysLeft, specialRole } = useSubscription()
  const windowWidth = useWindowWidth()
  const isMobile = windowWidth < 640
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)

  // Active key déduite du path actuel
  const segments = location.pathname.replace(/^\/profile\/?/, '').split('/')
  const activeKey = segments[0] || 'identite'

  const tabsForSidebar = TABS.map((tab) => ({ key: tab.key, label: t[tab.labelKey] }))

  const textColor  = darkMode ? '#EBE4D8' : '#2d1b00'
  const mutedColor = darkMode ? '#7A90A8' : '#6A4F45'
  const border     = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

  return (
    <div style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      minHeight: 'calc(100dvh - 96px)',
      maxWidth: '1200px',
      margin: '0 auto',
    }}>
      {!isMobile && (
        <ProfileSidebar
          avatarId={profile?.avatar_id}
          bannerId={profile?.banner_id}
          username={profile?.username}
          onAvatarClick={() => setAvatarModalOpen(true)}
          isPremium={isPremium}
          isTrialing={isTrialing}
          trialDaysLeft={trialDaysLeft}
          isAdmin={isAdmin}
          specialRole={specialRole}
          tabs={tabsForSidebar}
          activeTab={activeKey}
          onTabChange={(key) => {
            const tab = TABS.find((t2) => t2.key === key)
            if (tab) navigate(tab.path)
          }}
          lang={lang}
          darkMode={darkMode}
          border={border}
          textColor={textColor}
          mutedColor={mutedColor}
        />
      )}

      {/* ─── Mobile : barre horizontale d'onglets ───────────────────── */}
      {isMobile && (
        <nav
          role="tablist"
          aria-label={t.nav}
          style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            padding: '12px 12px 8px',
            borderBottom: `1px solid ${border}`,
            background: darkMode ? '#141F2E' : '#F5EDE0',
            // Cacher la scrollbar tout en gardant le scroll
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
            // Affordance de scroll (bug UX audit 2026-07-17) : sans indice
            // visuel, rien ne suggère que "Mes dépenses"/"Compte & sécurité"
            // (derniers onglets) existent hors écran — fondu au bord droit.
            maskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
          }}
        >
          {TABS.map((tab) => {
            const isActive = activeKey === tab.key
            const Icon = tab.Icon
            return (
              <button
                key={tab.key}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => navigate(tab.path)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexShrink: 0,
                  padding: '9px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid',
                  borderColor: isActive ? 'var(--color-warm-600)' : border,
                  background: isActive
                    ? 'var(--gradient-deep)'
                    : 'transparent',
                  color: isActive ? '#FFFFFF' : textColor,
                  fontSize: '13px',
                  fontWeight: isActive ? 700 : 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                }}
              >
                <Icon size={15} />
                <span style={{ whiteSpace: 'nowrap' }}>{t[tab.labelKey]}</span>
              </button>
            )
          })}
        </nav>
      )}

      {/* <div> et non <main> : le shell fournit déjà le repère main (A11Y-14). */}
      <div style={{
        flex: 1,
        padding: isMobile ? '12px' : '24px 32px',
        overflowY: 'auto',
      }}>
        <Outlet context={{
          lang,
          darkMode,
          avatarModalOpen,
          setAvatarModalOpen,
          user,
          profile,
          isAdmin,
        }} />
      </div>

      {avatarModalOpen && (
        <AvatarPickerModal
          currentAvatarId={profile?.avatar_id}
          onClose={() => setAvatarModalOpen(false)}
          lang={lang}
          darkMode={darkMode}
        />
      )}
    </div>
  )
}
