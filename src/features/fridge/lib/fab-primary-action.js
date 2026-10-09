// Calcule l'action Ouvrir/Fermer contextuelle du FAB selon l'appareil,
// l'onglet actif (mobile/tablette) et l'état d'ouverture des zones.
// Desktop (frigo + garde-manger côte à côte) : toujours centré sur le frigo.
// Mobile/tablette : suit l'onglet actif. Le garde-manger s'ouvre au tap
// direct sur une section ; le FAB n'offre que la fermeture quand une
// section est ouverte. Renvoie null si aucune action ouvrir/fermer pertinente.
export function getFabPrimaryAction({ isDesktop, activeTab, doorOpen, pantryOpen }) {
  if (isDesktop || activeTab === 'fridge') {
    return doorOpen
      ? { kind: 'close-fridge', labelKey: 'close_fridge' }
      : { kind: 'open-fridge', labelKey: 'open_fridge' }
  }
  // activeTab === 'pantry' (mobile/tablette)
  if (pantryOpen) return { kind: 'close-pantry', labelKey: 'close_pantry' }
  return null
}
