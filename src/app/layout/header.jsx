import { useAuth } from '@shared/contexts/auth-provider'
import HeaderLogo from './header/HeaderLogo'
import HeaderActions from './header/HeaderActions'

// Header unifié toutes tailles, 2 variantes : invité / connecté.
//
// Connecté : déclencheur = avatar (toutes tailles) ; le menu s'affiche en
// bottom sheet sur mobile (<640) et en dropdown sur tablette/desktop (≥640)
// via MenuShell. Le panier (premium) vit dans le menu avec un badge
// « Prochainement » — pas dans la barre.
// La communauté est une icône de barre dès la tablette (≥640) ; sur mobile
// elle est dans le menu.
// Le FAB s'insère dans la barre via #header-fab-slot.

export default function Header({
  // i18n + thème
  lang = 'fr',
  onLangChange,
  darkMode = false,
  onDarkModeToggle,

  // Reset accueil (logo cliquable)
  onReset,

  // Auth + actions user
  onShowAuth,
  onShowProfile,
  onShowAdmin,
  onSignOut,

  // Navigation principale
  onShowCommunity,
  onShowSupport,

  // Notifications, panier
  pendingCount = 0,
  supportUnread = 0,
  basket = [],
  basketCount = 0,
  onShowCart,
  onShowCartWithLists,
  onShowRecipes,
  onLoadShoppingList,
  onNotificationClick,

  // Navigation depuis « Explorer les fonctionnalités » (Aide & infos)
  onOpenFridge,
  onVoiceToggle,
  onShowLeftovers,
}) {
  const { user, profile, isAdmin } = useAuth()

  const sharedProps = {
    lang,
    darkMode,
    user,
    profile,
    isAdmin,
    pendingCount,
    supportUnread,
    basket,
    basketCount,
    onLangChange,
    onDarkModeToggle,
    onShowAuth,
    onShowProfile,
    onShowAdmin,
    onShowCommunity,
    onShowSupport,
    onShowCart,
    onShowCartWithLists,
    onShowRecipes,
    onLoadShoppingList,
    onSignOut,
    onNotificationClick,
    onOpenFridge,
    onVoiceToggle,
    onShowLeftovers,
  }

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 px-4 md:px-6 py-5 lg:py-6"
      style={{
        background: darkMode ? 'rgba(15,25,35,0.94)' : 'rgba(253,246,238,0.96)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: darkMode ? '1px solid rgba(26,42,60,0.90)' : '1px solid rgba(212,106,16,0.50)',
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <HeaderLogo lang={lang} onReset={onReset} darkMode={darkMode} />
        <div className="flex items-center gap-2 min-w-0">
          <HeaderActions {...sharedProps} />
        </div>
      </div>
    </header>
  )
}
