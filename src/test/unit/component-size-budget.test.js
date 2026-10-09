import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

// Garde-fou du §2 de l'audit front : « aucun fichier composant > 500 lignes ».
//
// POURQUOI CE TEST EXISTE — il n'est pas préventif, il est CORRECTIF.
// Le chantier §2 a ramené le décompte de 21 fichiers à 9 en une douzaine de PR.
// Rien ne protégeait ce gain. Mesure du 2026-08-07 :
//   • `shopping-lists-modal.jsx` était à 500 lignes PILE (donc conforme) depuis
//     le 2026-07-18, et est passé à 508 le 2026-08-06 — franchissement invisible,
//     au détour d'un correctif d'accessibilité sans rapport ;
//   • 17 fichiers se trouvent entre 460 et 500 lignes, dont trois à moins de
//     10 lignes du seuil. La moindre correction en fait rebasculer un.
//
// LA FORME : un CLIQUET, pas un couperet. Interdire d'emblée les 9 fichiers
// restants ferait échouer la suite dès aujourd'hui et le test serait désactivé
// dans la semaine. On fige donc l'existant comme dette, et on interdit :
//   1. qu'un NOUVEAU fichier franchisse le seuil ;
//   2. qu'un fichier de la dette GROSSISSE encore ;
//   3. que la dette MENTE (un fichier redescendu sous 500 doit sortir de la liste) ;
//   4. que la dette SURESTIME (un plafond au-dessus de la taille réelle).
//
// La règle (3) est ce qui empêche cette liste de devenir décorative : elle force
// à l'entretenir au moment même où le travail est fait.
//
// La règle (4) a été ajoutée le 2026-08-09, après qu'un cliquet voisin s'est fait
// prendre : `npm run lint` portait `--max-warnings 101` alors que le dépôt était
// descendu à 100 warnings. Le cran de jeu laissait passer une PR qui en ajoutait
// un — prouvé par mutation, le lint sortait exit 0 à 101 warnings. Les plafonds
// de DETTE se desserrent de la même façon : un fichier qui maigrit de 669 à 600
// sans repasser sous le SEUIL garderait un plafond à 669, soit 69 lignes de
// regrossissement offertes en silence. La règle (4) rend exécutable la consigne
// « on ne DESCEND une valeur que pour refléter un travail réel » ci-dessous —
// jusque-là, ce n'était qu'un commentaire, et un commentaire ne bloque rien.

const SEUIL = 500

// Dette figée au 2026-08-07. Valeur = nombre de lignes constaté, qui sert de
// PLAFOND : ces fichiers ont le droit d'exister, pas de grossir.
// ⚠️ On ne DESCEND une valeur que pour refléter un travail réel de réduction ;
// on ne la MONTE jamais — c'est précisément ce que ce garde-fou empêche.
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ AVANT DE DÉCOUPER L'UN DE CES FICHIERS, LIRE CECI.
//
// Le critère du §2 compte les lignes BRUTES (`wc -l`), commentaires et lignes
// vides compris. Mesure du 2026-08-08 (brut / commentaires / code réel) :
//
//   leftovers-modal.jsx        728 /  30 / 668   ← TRAITÉ le 2026-08-09 (→ 480)
//   voice-confirm-panel.jsx    637 /  13 / 591   ← TRAITÉ le 2026-08-09 (→ 463)
//   recipe-detail-body.jsx     622 /  40 / 562   ← vraie cible, mais REFUS
//                                                  documenté dans son en-tête
//   fridge-multi-door.jsx      570 /   3 / 528   ← TRAITÉ le 2026-08-09 (→ 240)
//   base-recipes-section.jsx   550 /   7 / 500   ← code DÉJÀ conforme
//   support-section.jsx        538 /   8 / 497   ← code DÉJÀ conforme
//   recipe-detail-header.jsx   519 /  17 / 487   ← code DÉJÀ conforme
//   shopping-lists-modal.jsx   508 /  55 / 424   ← code DÉJÀ conforme
//   App.jsx                    665 / 146 / 478   ← code DÉJÀ conforme (660 depuis le 2026-10-05)
//
// ⇒ **CINQ des neuf fichiers ne dépassent que par leur DOCUMENTATION.**
// Les découper ne réduirait aucune complexité : soit on déplace du code déjà
// sous le seuil, soit on supprime des commentaires qui expliquent des
// décisions (App.jsx en porte 146, dont l'historique du code splitting et des
// migrations de contexte). Ce serait payer une métrique en détruisant de la
// valeur.
//
// Les quatre premières lignes sont les cibles qui valent le travail. Le seuil
// n'est PAS abaissé ici : changer le critère du §2 relève de la note d'audit,
// pas d'un test. Ce relevé est là pour que personne ne parte découper un faux
// positif — l'erreur coûte une PR entière et une QA visuelle.
const DETTE = {
  // `leftovers-modal.jsx` en est SORTI le 2026-08-09 : 728 → 480 lignes, par
  // extraction de sa vue « création » (leftovers-create-view.jsx). C'est la
  // règle 3 de ce garde-fou qui l'a exigé — elle a fait échouer la suite tant
  // que l'entrée périmée restait ici.
  // `voice-confirm-panel.jsx` en est SORTI le 2026-08-09 : 637 → 463 lignes,
  // par extraction de sa liste d'ingrédients reconnus (voice-matched-list.jsx).
  // 665 → 662 le 2026-10-04 : six lignes de commentaire redondantes sur le
  // bandeau de restauration, réduites à trois. 660 → 659 le 2026-10-08 : le
  // panneau des recettes vide le frigo par le même chemin annulable que le
  // bouton orange (UX-06), ses trois fonctions passées sur une ligne.
  'src/App.jsx': 659,
  // Découpage volontairement REFUSÉ, motif écrit dans l'en-tête du fichier
  // (~50 props à transmettre pour zéro gain au site d'appel). Lire cet en-tête
  // avant de le cibler. 622 → 539 le 2026-10-03 : seul le pied (« J'ai
  // cuisiné ») en est sorti, pour une raison fonctionnelle (mobile).
  'src/features/recipes/components/recipe-detail-body.jsx': 539,
  // `fridge-multi-door.jsx` en est SORTI le 2026-08-09 : 570 → 240 lignes, par
  // extraction de ses intérieurs (fridge-interiors.jsx) et de ses palettes
  // (fridge-door-colors.js), plus la suppression d'un `DoorShelves` mort.
  // 550 → 549 le 2026-10-05 : son chargement est passé par `useReloader` (audit ADM-09).
  // `support-section.jsx` en est SORTI le 2026-10-05 : 538 → 394 lignes, par
  // extraction de sa vue « un ticket » (support-ticket-detail.jsx), qui devait
  // apprendre à dire que les messages n'ont pas pu être lus (audit ADM-08).
  // 519 → 518 le 2026-10-08 : son badge « Verrouillée » perd un nom en double
  // posé sur un <span> sans rôle (lot 9e).
  'src/features/recipes/components/recipe-detail-header.jsx': 518,
  'src/features/cart/components/shopping-lists-modal.jsx': 508,
}

// Le critère du §2 porte sur les COMPOSANTS : on ne compte que les `.jsx`.
// ⚠️ À annoncer, sinon quelqu'un le redécouvrira avec un glob plus large : des
// centaines de lignes ont légitimement été relogées dans des hooks `.js`, qui
// n'entrent donc pas dans ce décompte. Un hook de 420 lignes reste un gros
// fichier — ce test ne le dit pas, et ce n'est pas son rôle.
function fichiersComposants(racine) {
  const out = []
  for (const entree of readdirSync(racine)) {
    const chemin = join(racine, entree)
    if (statSync(chemin).isDirectory()) {
      if (entree === 'test') continue
      out.push(...fichiersComposants(chemin))
    } else if (entree.endsWith('.jsx')) {
      out.push(chemin)
    }
  }
  return out
}

// Même comptage que `wc -l` (nombre de sauts de ligne), pour que les chiffres
// de ce fichier soient comparables à ceux de la commande de suivi du chantier.
function nbLignes(chemin) {
  const contenu = readFileSync(chemin, 'utf8')
  let n = 0
  for (const c of contenu) if (c === '\n') n++
  return n
}

function releve() {
  const racine = resolve(process.cwd(), 'src')
  const map = new Map()
  for (const abs of fichiersComposants(racine)) {
    const rel = abs.slice(resolve(process.cwd()).length + 1).replaceAll('\\', '/')
    map.set(rel, nbLignes(abs))
  }
  return map
}

describe('§2 audit front — budget de taille des composants', () => {
  it('aucun NOUVEAU composant ne franchit les 500 lignes', () => {
    const nouveaux = [...releve()]
      .filter(([f, n]) => n > SEUIL && !(f in DETTE))
      .map(([f, n]) => `${f} (${n} l)`)

    expect(
      nouveaux,
      'Ces composants viennent de franchir le seuil de 500 lignes. Les découper, '
      + 'ou les ajouter sciemment à DETTE en expliquant pourquoi.',
    ).toEqual([])
  })

  it('aucun composant en dette ne grossit davantage', () => {
    const releves = releve()
    const aggraves = Object.entries(DETTE)
      .filter(([f, plafond]) => (releves.get(f) ?? 0) > plafond)
      .map(([f, plafond]) => `${f} : ${releves.get(f)} l > plafond ${plafond}`)

    expect(
      aggraves,
      'Ces fichiers font déjà partie de la dette du §2 et continuent de grossir. '
      + 'Le plafond ne se relève pas : réduire le fichier, ou extraire ailleurs.',
    ).toEqual([])
  })

  it('la dette ne ment pas : aucun fichier listé n\'est en fait conforme', () => {
    const releves = releve()
    const perimes = Object.keys(DETTE)
      .filter(f => !releves.has(f) || releves.get(f) <= SEUIL)
      .map(f => (releves.has(f) ? `${f} (${releves.get(f)} l, conforme)` : `${f} (fichier absent)`))

    expect(
      perimes,
      'Ces entrées de DETTE sont périmées : le fichier est repassé sous le seuil '
      + 'ou a disparu. Le retirer de DETTE — sans quoi la liste redevient '
      + 'décorative et le garde-fou aveugle.',
    ).toEqual([])
  })

  // Sans cette règle, le cliquet garde du jeu : un fichier réduit de 669 à 600
  // lignes conserverait un plafond à 669, et pourrait regrossir de 69 lignes
  // sans que rien ne se déclenche. Le plafond doit coller à la mesure.
  it('la dette ne surestime pas : aucun plafond au-dessus de la taille réelle', () => {
    const releves = releve()
    const desserres = Object.entries(DETTE)
      .filter(([f, plafond]) => releves.has(f) && releves.get(f) < plafond)
      .map(([f, plafond]) => `${f} : ${releves.get(f)} l pour un plafond de ${plafond} (jeu de ${plafond - releves.get(f)} l)`)

    expect(
      desserres,
      'Ces plafonds de DETTE sont plus hauts que les fichiers qu\'ils encadrent. '
      + 'Le jeu ainsi laissé autorise un regrossissement silencieux : abaisser le '
      + 'plafond à la taille mesurée, dans la même PR que la réduction.',
    ).toEqual([])
  })
})
