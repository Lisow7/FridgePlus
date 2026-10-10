import { Z_INDEX } from '@shared/lib/z-index'

// Les bandeaux du haut de l'écran (lien reçu par e-mail, profil indisponible,
// session perdue) : même place, même allure.

// Centrage d'un bandeau fixe SANS `transform`. L'ancien `left: 50%` +
// `translateX(-50%)` était écrasé par l'animation d'entrée
// (`menu-slide-down` anime `transform` et le garde) : le bandeau partait du
// milieu de l'écran vers la droite — une colonne de 180 px sur un téléphone.
export const CENTRE_EN_HAUT = {
  position: 'fixed', top: '12px', left: '12px', right: '12px',
  margin: '0 auto', width: 'fit-content', maxWidth: 'min(560px, calc(100vw - 24px))',
}

// Une alerte du haut : fond « danger », texte blanc, ombre portée.
export const ALERTE_DU_HAUT = {
  ...CENTRE_EN_HAUT,
  zIndex: Z_INDEX.TOAST,
  padding: '12px 18px', borderRadius: '12px',
  background: 'var(--color-danger)',
  color: 'white', fontWeight: 700, fontSize: '14px',
  display: 'flex', alignItems: 'center', gap: '10px',
  boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
  animation: 'menu-slide-down 0.25s ease both',
}

// Le bouton d'une alerte du haut (« Réessayer », « Me reconnecter »).
export const BOUTON_DU_HAUT = {
  minHeight: '24px', padding: '4px 10px', borderRadius: '20px',
  border: '1.5px solid rgba(255,255,255,0.7)', background: 'transparent', color: 'white',
  fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
}

// La croix qui ferme un bandeau du haut.
export const CROIX_DU_HAUT = {
  background: 'none', border: 'none', color: 'white', cursor: 'pointer',
  padding: '8px', margin: '-4px -6px -4px 0', display: 'flex', flexShrink: 0, opacity: 0.85,
}
