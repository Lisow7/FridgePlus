import { useWindowWidth } from '@shared/hooks/use-window-width'
import { LuUser, LuHandHeart } from 'react-icons/lu'
import Button from '@shared/ui/button'
import Tooltip from '@shared/ui/tooltip'
import { cn } from '@shared/lib/cn'
import { NotificationsBell } from '@features/notifications'
import PreferencesMenu from './PreferencesMenu'
import UserMenu from './UserMenu'
import GuestMenu from './GuestMenu'
import { HelpGuide } from '@features/onboarding'
import { useSubscription } from '@shared/hooks/use-subscription'
import { useUpgradeModal } from '@shared/contexts/subscription-modal-provider'
import LanguageToggle from '@shared/ui/language-toggle'
import {
  SIGN_IN_LABEL,
  COMMUNITY_LABEL,
} from './constants'

// Bloc d'actions à droite du Header, rendu à toutes les tailles.
//
// Connecté : Guide + Notifs + Communauté (≥640) + FAB(slot) + Avatar(menu).
//   Le panier (premium) vit dans le menu avec un badge « Prochainement ».
//
// Invité : Guide + Communauté + Préférences + « Se connecter » (≥1024) ;
//   burger (GuestMenu) en mobile/tablette (<1024).

// Sprint 8 PR S8.c — IconButton réécrit sur <Button variant="ghost" size="icon">.
// Signature stable côté call-sites. Le badge reste en absolute, géré ici
// pour ne pas alourdir le composant Button générique.
function IconButton({ onClick, title, ariaLabel, badge, badgeColor = '#E53535', children, darkMode, disabled = false }) {
  return (
    <Tooltip text={disabled ? '' : title} darkMode={darkMode}>
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? title}
      className={cn(
        'h-11 w-11 rounded-[11px] relative text-[var(--color-muted)] disabled:opacity-35',
        darkMode ? 'hover:bg-[#1A2A3D]' : 'hover:bg-[#F5ECE0]',
      )}
    >
      {children}
      {!disabled && badge > 0 && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute -top-1 -right-1 min-w-[16px] h-4 rounded-lg px-[3px]',
            'text-white text-[10px] font-bold leading-none',
            'flex items-center justify-center',
            'border-[1.5px] box-border',
          )}
          style={{
            background: badgeColor,
            borderColor: darkMode ? 'rgba(15,25,35,0.94)' : 'rgba(253,246,238,0.96)',
          }}
        >
          {badge}
        </span>
      )}
    </Button>
    </Tooltip>
  )
}

export default function HeaderActions({
  lang = 'fr',
  onLangChange,
  darkMode = false,
  onDarkModeToggle,
  user,
  profile,
  isAdmin = false,
  pendingCount = 0,
  basketCount = 0,
  onShowAuth,
  onShowProfile,
  onShowAdmin,
  onSignOut,
  onShowCommunity,
  onShowSupport,
  onShowCart,
  onShowRecipes,
  onNotificationClick,
  onOpenFridge,
  onVoiceToggle,
  onShowLeftovers,
}) {
  const sep = darkMode ? '#1E2E42' : 'var(--color-border-warm)'
  const windowWidth = useWindowWidth()
  const isDesktop = windowWidth >= 1024
  const isTabletOrDesktop = windowWidth >= 640

  const { hasPremiumAccess } = useSubscription()
  const { openUpgradeModal } = useUpgradeModal()

  const helpGuideProps = {
    lang, darkMode,
    user,
    onShowSupport,
    onShowAuth,
    onShowCommunity,
    onShowRecipes,
    onShowProfile,
    onShowCart,
    onShowUpgrade: openUpgradeModal,
    onOpenFridge,
    onVoiceToggle,
    onShowLeftovers,
  }

  // ─── Cas invité ───────────────────────────────────────────────────
  // Desktop (≥1024) : layout inline complet (Community + Prefs + Se connecter).
  // Mobile/tablette (<1024) : tout regroupé dans <GuestMenu> (burger) pour
  // alléger le header — équivalent guest du <UserMenu> burger loggé.
  if (!user) {
    if (!isDesktop) {
      return (
        <div className="flex items-center gap-1">
          <HelpGuide {...helpGuideProps} />
          <div id="header-fab-slot" style={{ display: 'contents' }} />
          <GuestMenu
            lang={lang}
            darkMode={darkMode}
            onLangChange={onLangChange}
            onDarkModeToggle={onDarkModeToggle}
            onShowAuth={onShowAuth}
          />
        </div>
      )
    }

    return (
      <div className="flex items-center gap-1">
        <HelpGuide {...helpGuideProps} />

        <IconButton
          onClick={onShowCommunity}
          title={COMMUNITY_LABEL[lang] ?? COMMUNITY_LABEL.fr}
          ariaLabel={COMMUNITY_LABEL[lang] ?? COMMUNITY_LABEL.fr}
          darkMode={darkMode}
        >
          {/* LuHandHeart — cohérent avec connecté + GuestMenu burger +
              UserMenu mobile (4 emplacements alignés, cf. spec 2026-07-09). */}
          <LuHandHeart size={20} aria-hidden="true" />
        </IconButton>

        <LanguageToggle lang={lang} onLangChange={onLangChange} darkMode={darkMode} />

        <div aria-hidden="true" style={{ width: '1px', height: '22px', background: sep, margin: '0 6px' }} />

        <PreferencesMenu
          lang={lang}
          onLangChange={onLangChange}
          darkMode={darkMode}
          onDarkModeToggle={onDarkModeToggle}
        />

        {/* v3.384.0 — FAB slot placé AVANT « Se connecter » pour aligner
            la disposition guest sur le pattern connecté (FAB toujours
            avant l'élément d'identité = UserMenu en connecté / Se
            connecter en invité). Les séparateurs autour du FAB sont
            rendus par le FAB lui-même dans son portal content. */}
        <div id="header-fab-slot" style={{ display: 'contents' }} />

        {/* v3.246.0 — Sprint 8 PR S8.b — bouton « Se connecter » migré sur
            le design system Button. Variant secondary + classes custom
            pour conserver le gradient warm distinctif. */}
        <Button
          variant="secondary"
          size="md"
          onClick={() => onShowAuth('login')}
          title={SIGN_IN_LABEL[lang] ?? SIGN_IN_LABEL.fr}
          aria-label={SIGN_IN_LABEL[lang] ?? SIGN_IN_LABEL.fr}
          className="h-auto px-3.5 py-2 text-[13px] gap-[7px] border-[var(--color-warm-600)]/45 bg-gradient-to-br from-[#F7A85E]/15 to-[#D46A10]/10 text-[var(--color-warm-600)] hover:from-[#F7A85E]/25 hover:to-[#D46A10]/18 hover:bg-transparent"
        >
          <LuUser size={16} aria-hidden="true" />
          <span>{SIGN_IN_LABEL[lang] ?? SIGN_IN_LABEL.fr}</span>
        </Button>
      </div>
    )
  }

  // ─── Cas connecté : Guide + Notifs + Communauté + Langue + slot du FAB + UserMenu
  //     (le panier vit dans le menu utilisateur, plus en popover ici) ─────────────
  return (
    <div className="flex items-center gap-1">
      <HelpGuide {...helpGuideProps} />
      <NotificationsBell lang={lang} darkMode={darkMode} onNotificationClick={onNotificationClick} />

      {isTabletOrDesktop && (
        <IconButton
          onClick={onShowCommunity}
          title={COMMUNITY_LABEL[lang] ?? COMMUNITY_LABEL.fr}
          ariaLabel={COMMUNITY_LABEL[lang] ?? COMMUNITY_LABEL.fr}
          darkMode={darkMode}
        >
          <LuHandHeart size={20} aria-hidden="true" />
        </IconButton>
      )}

      {isTabletOrDesktop && (
        <LanguageToggle lang={lang} onLangChange={onLangChange} darkMode={darkMode} />
      )}

      {/* v3.194.0 — Ordre des actions header : FAB avant UserMenu, pour
          que l'icône burger/avatar reste toujours tout à droite (pattern
          UI standard : menu utilisateur en dernier sur la barre).
          v3.384.0 — les séparateurs autour du FAB sont rendus PAR le
          FAB lui-même dans son portal content (cf. fridge-fab.jsx).
          Comme ça si le FAB ne rend pas dans le slot (mobile + frigo
          fermé), aucun séparateur orphelin n'apparait dans le Header. */}
      <div id="header-fab-slot" style={{ display: 'contents' }} />

      <UserMenu
        lang={lang}
        darkMode={darkMode}
        profile={profile}
        isAdmin={isAdmin}
        pendingCount={pendingCount}
        onLangChange={onLangChange}
        onDarkModeToggle={onDarkModeToggle}
        onShowProfile={onShowProfile}
        onShowAdmin={onShowAdmin}
        onShowCommunity={onShowCommunity}
        onShowSupport={onShowSupport}
        basketCount={basketCount}
        hasPremiumAccess={hasPremiumAccess}
        onShowUpgrade={openUpgradeModal}
        onSignOut={onSignOut}
      />

    </div>
  )
}
