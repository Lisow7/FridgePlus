// Applique une action d'administration à une liste d'identifiants, et rend
// compte de ce qui a RÉELLEMENT réussi.
//
// ── Pourquoi ce module existe ────────────────────────────────────────────
// Six actions groupées du panneau d'administration s'écrivaient ainsi :
//
//     await Promise.all(ids.map(id => adminQuelqueChose(id)))
//     showFeedback(`${ids.length} éléments traités.`)
//
// Les résultats étaient jetés. Or toutes ces API rendent `{ error }`, et les
// actions UNITAIRES des mêmes fichiers le vérifient — `reports-section.jsx`
// le fait ligne 196 et l'ignore ligne 210, dans la même fonction importée.
//
// 🔴 Conséquence, mesurée le 2026-08-29 : si des écritures échouent (RLS,
// réseau, ligne disparue), l'interface annonce quand même le succès complet.
// Trois de ces sites retiraient en plus les lignes de l'état local et
// décrémentaient les compteurs sans condition : les éléments disparaissaient
// de la file de modération tout en restant à traiter en base. L'administrateur
// croit avoir modéré ; il n'en est rien, et rien ne le lui dit.
//
// Ce module ne « corrige » pas les échecs — il les rend visibles, ce qui est
// la seule chose honnête à faire ici.

const EN_MEME_TEMPS = 5

// Lance `tache(element, position)` sur chaque élément, jamais plus de `n` à la
// fois : `n` ouvriers prennent tour à tour l'élément suivant de la liste.
function lancerAuPlus(n, liste, tache) {
  let suivant = 0
  const ouvrier = async () => {
    while (suivant < liste.length) {
      const i = suivant++
      await tache(liste[i], i)
    }
  }
  return Promise.all(Array.from({ length: Math.min(n, liste.length) }, ouvrier))
}

/**
 * @param {string[]} ids
 * @param {(id: string) => Promise<{error?: unknown}|void>} action
 * @returns {Promise<{total:number, reussis:number, echecs:number, toutReussi:boolean, premiereErreur:string|null}>}
 */
export async function appliquerEnLot(ids, action) {
  const liste = [...(ids ?? [])]
  if (liste.length === 0) {
    return { total: 0, reussis: 0, echecs: 0, toutReussi: true, premiereErreur: null }
  }

  // Au plus EN_MEME_TEMPS écritures à la fois (audit du 2026-10-04, ADM-23 :
  // une sélection de 80 recettes partait en 80 requêtes simultanées). Chaque
  // résultat est rangé à la position de son identifiant : la « première
  // erreur » reste celle du premier identifiant en échec, quel que soit
  // l'ordre d'arrivée des réponses.
  const resultats = new Array(liste.length)
  await lancerAuPlus(EN_MEME_TEMPS, liste, async (id, i) => {
    try {
      resultats[i] = await action(id)
    } catch (e) {
      // Une action qui LÈVE compte comme un échec au même titre qu'une qui
      // rend `{ error }` : sans ce filet, le lot s'arrêterait et son reste
      // resterait dans un état inconnu.
      resultats[i] = { error: e?.message ?? String(e) }
    }
  })

  // Les API d'administration ne sont pas homogènes : certaines rendent
  // `{ error: 'texte' }`, d'autres `{ error: objetSupabase }`.
  const erreurs = resultats
    .map(r => r?.error)
    .filter(Boolean)
    .map(e => (typeof e === 'string' ? e : e?.message ?? 'erreur inconnue'))

  return {
    total: liste.length,
    reussis: liste.length - erreurs.length,
    echecs: erreurs.length,
    toutReussi: erreurs.length === 0,
    premiereErreur: erreurs[0] ?? null,
  }
}

/**
 * Message honnête à afficher après un lot. Ne masque jamais un échec partiel.
 */
export function messageDeLot({ total, reussis, echecs, premiereErreur }, libelle) {
  if (echecs === 0) return `${total} ${libelle(total)}.`
  if (reussis === 0) return `Échec : aucun des ${total} éléments n'a été traité (${premiereErreur}).`
  return `${reussis} ${libelle(reussis)}, mais ${echecs} en échec (${premiereErreur}).`
}
