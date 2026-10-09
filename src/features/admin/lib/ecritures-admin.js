// Les écritures du panneau d'administration disent vrai sur leur issue.
// Audit du 2026-10-04 : ADM-02 (résultats jetés), ADM-26 (0 ligne touchée
// présentée comme un succès), ADM-08 (« Accès refusé » pour toute erreur).

/**
 * Une suppression « avec annulation » (bandeau de 10 s) dont on VÉRIFIE l'issue.
 *
 * Avant : `onConfirm: async () => { await adminX(id); retirer() }` — le résultat
 * jeté, la ligne retirée même quand la base refusait. Ici : la ligne est masquée
 * tout de suite ; « Annuler » la rend ; à l'échéance la suppression part —
 * réussie, la ligne quitte la liste ; refusée (ou levée), elle revient et
 * l'échec est dit.
 *
 * @param {(o: { label: string, onConfirm: Function, onUndo: Function }) => void} trigger — `useUndo().trigger`
 * @param {object} o
 * @param {string} o.label — le libellé du bandeau d'annulation
 * @param {string} o.id — l'élément masqué
 * @param {Function} o.setMasques — le setter du `Set` des éléments masqués
 * @param {() => Promise<{ error?: unknown }>} o.supprimer
 * @param {() => void} o.retirer — retire l'élément de la liste, une fois supprimé
 * @param {(erreur: unknown) => void} o.siEchec
 */
export function supprimerAvecAnnulation(trigger, { label, id, setMasques, supprimer, retirer, siEchec }) {
  const montrer = () => setMasques((prev) => { const s = new Set(prev); s.delete(id); return s })
  setMasques((prev) => new Set(prev).add(id))
  trigger({
    label,
    onUndo: montrer,
    onConfirm: async () => {
      let erreur
      try { erreur = (await supprimer())?.error } catch (e) { erreur = e ?? new Error('unknown') }
      if (erreur) { montrer(); siEchec(erreur); return }
      retirer()
    },
  })
}

/**
 * Ce qu'on dit à l'admin quand une écriture échoue.
 *
 * « Accès refusé » est réservé au vrai refus de droits (42501) : deux écrans le
 * disaient pour N'IMPORTE quelle erreur, coupure réseau comprise (ADM-08).
 * @param {unknown} error — `{ code, message }`, un texte, ou rien
 * @param {'fr'|'en'} [lang]
 */
export function messageErreurAdmin(error, lang = 'fr') {
  const fr = lang === 'fr'
  if (error?.code === 'no_rows_affected') {
    return fr
      ? 'Rien n\'a été modifié : l\'élément n\'existe plus, ou les droits ne le permettent pas.'
      : 'Nothing was changed: the item no longer exists, or permissions do not allow it.'
  }
  if (error?.code === '42501') return fr ? 'Accès refusé par la base.' : 'Access denied by the database.'
  const detail = typeof error === 'string' ? error : error?.message
  return (fr ? 'Échec : ' : 'Failed: ') + (detail || (fr ? 'erreur inconnue' : 'unknown error'))
}
