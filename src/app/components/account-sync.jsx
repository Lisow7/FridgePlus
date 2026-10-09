import { useAccountLanguageSync } from '@shared/hooks/use-account-language-sync'

// Rien à afficher : ce composant garde d'accord les réglages du compte et ceux
// de l'appareil (aujourd'hui la langue). Il vit à côté de <App />, sous
// AuthProvider et UIProvider, pour ne pas alourdir App.jsx.
export default function AccountSync() {
  useAccountLanguageSync()
  return null
}
