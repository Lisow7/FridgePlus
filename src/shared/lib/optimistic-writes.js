// Écritures « l'écran d'abord » : ce que la base contient après un refus.
//
// L'écran change tout de suite ; l'écriture part ; si la base la refuse,
// l'écran doit revenir à ce que la base CONTIENT. Pour un geste isolé, c'est
// l'état d'avant le geste. Pour deux écritures du même élément qui se croisent
// — un double-clic suffit —, non : l'état d'avant le second geste est celui que
// le premier venait d'afficher, et que la base a peut-être refusé aussi.
// Remettre cet état-là, c'est afficher un aliment que la base n'a jamais eu.
//
// La règle, élément par élément :
//   - tant qu'une de ses écritures est en vol, on ne conclut pas ;
//   - quand la dernière a répondu : si le DERNIER GESTE a été accepté, l'écran
//     dit déjà vrai. Sinon, ce que la base contient est le résultat de la
//     dernière écriture ACCEPTÉE (dans l'ordre d'envoi), ou, s'il n'y en a
//     aucune, l'état d'avant la série.
//
// On suppose que la base applique les écritures d'un même élément dans l'ordre
// où elles sont parties — c'est le cas tant qu'elles ne se doublent pas en
// route ; rien côté client ne permet d'en savoir plus.
//
//   const series = createWriteSeries()
//   const ecriture = series.ouvrir(id, etatAvant, etatApres)   // au geste
//   const aRemettre = series.fermer(ecriture, refusee)         // à la réponse
//   // `null` : rien à faire. Sinon `{ id, etat, voulu }` : l'écran doit
//   // afficher `etat` ; `voulu` est ce que le dernier geste demandait — s'ils
//   // diffèrent, la personne n'a pas obtenu ce qu'elle voulait : le lui dire.
//
// Les états sont opaques : un booléen (favori ou non), un objet (la fraîcheur
// d'un aliment) ou `null` (absent).
export function createWriteSeries() {
  const series = new Map()
  let compteur = 0
  return {
    ouvrir(id, avant, apres) {
      let serie = series.get(id)
      if (!serie) {
        serie = { enVol: 0, base: avant, acceptee: null, dernier: null }
        series.set(id, serie)
      }
      const ecriture = { id, jeton: ++compteur, apres, refusee: false, serie }
      serie.enVol += 1
      serie.dernier = ecriture
      return ecriture
    },
    fermer(ecriture, refusee) {
      const { serie } = ecriture
      serie.enVol -= 1
      ecriture.refusee = !!refusee
      if (!refusee && ecriture.jeton > (serie.acceptee?.jeton ?? 0)) serie.acceptee = ecriture
      if (serie.enVol > 0) return null
      // Série close : la suivante repartira de son propre état d'avant.
      if (series.get(ecriture.id) === serie) series.delete(ecriture.id)
      if (!serie.dernier.refusee) return null
      return {
        id: ecriture.id,
        etat: serie.acceptee ? serie.acceptee.apres : serie.base,
        voulu: serie.dernier.apres,
      }
    },
  }
}
