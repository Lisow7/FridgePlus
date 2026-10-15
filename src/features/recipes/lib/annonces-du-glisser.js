// Les annonces du glisser-déposer des étapes, dans la langue de la personne.
// dnd-kit parle anglais par défaut et nomme les étapes par leur identifiant
// technique (« Picked up draggable item s-k3x… ») : un lecteur d'écran
// francophone n'y comprenait rien (audit du 2026-10-04, A11Y-20).

export const INSTRUCTIONS_DU_GLISSER = {
  fr: { draggable: 'Pour saisir une étape, appuie sur Espace. Déplace-la avec les flèches haut et bas. Appuie de nouveau sur Espace pour la déposer, ou sur Échap pour annuler.' },
  en: { draggable: 'To pick up a step, press the space bar. Move it with the up and down arrow keys. Press space again to drop it, or escape to cancel.' },
}

const TEXTES = {
  fr: {
    saisie:  (n) => `Étape ${n} saisie.`,
    sur:     (n, m) => `Étape ${n} sur la position ${m}.`,
    hors:    (n) => `Étape ${n} hors de la liste.`,
    deposee: (n, m) => `Étape ${n} déposée en position ${m}.`,
    reposee: (n) => `Étape ${n} reposée à sa place.`,
    annule:  (n) => `Déplacement annulé : l’étape ${n} reste à sa place.`,
  },
  en: {
    saisie:  (n) => `Step ${n} picked up.`,
    sur:     (n, m) => `Step ${n} over position ${m}.`,
    hors:    (n) => `Step ${n} is outside the list.`,
    deposee: (n, m) => `Step ${n} dropped at position ${m}.`,
    reposee: (n) => `Step ${n} put back in place.`,
    annule:  (n) => `Move cancelled: step ${n} stays in place.`,
  },
}

// Le numéro affiché d'une étape dans sa liste (1 = la première), ou null.
export function positionDeLEtape(steps, id) {
  const i = steps.findIndex((s) => s.id === id)
  return i < 0 ? null : i + 1
}

// `position(id)` rend le numéro affiché de l'étape (1 = la première), tel que
// la liste le montre au moment du geste.
export function annoncesDuGlisser(lang, position) {
  const t = TEXTES[lang] ?? TEXTES.fr
  const numero = (x) => position(x?.id) ?? '?'
  return {
    onDragStart:  ({ active }) => t.saisie(numero(active)),
    onDragOver:   ({ active, over }) => (over ? t.sur(numero(active), numero(over)) : t.hors(numero(active))),
    onDragEnd:    ({ active, over }) => (over ? t.deposee(numero(active), numero(over)) : t.reposee(numero(active))),
    onDragCancel: ({ active }) => t.annule(numero(active)),
  }
}
