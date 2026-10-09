import { useState } from 'react'

// Les valeurs d'un formulaire ont-elles changé depuis son ouverture ?
// L'état initial se fige au premier rendu (état paresseux : aucune référence
// lue pendant le rendu). Sert à ne pas perdre une saisie en quittant le
// formulaire (audit du 2026-10-04, ADM-18) — voir `useFermetureGardee`.
export function useModifie(valeurs) {
  const [initiales] = useState(() => JSON.stringify(valeurs))
  return JSON.stringify(valeurs) !== initiales
}
