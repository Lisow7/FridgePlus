import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Décision du 2026-10-08 : le bouton qui confirme nomme l'action — « Vider la
// liste », « Supprimer la publication », « Bloquer », « Désactiver »,
// « Retirer du frigo ». Plus de texte par défaut (« Confirmer ») : chaque
// fenêtre dit le sien, et ce garde-fou y veille.

function fichiers(dossier, liste = []) {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) { if (nom !== 'test') fichiers(chemin, liste) }
    else if (/\.(js|jsx)$/.test(nom) && !/\.test\./.test(nom)) liste.push(chemin)
  }
  return liste
}

// Le bloc d'options de chaque appel `confirm({ … })`, accolades équilibrées.
function appels(texte) {
  const trouves = []
  const motif = /\bconfirm\(\{/g
  let m
  while ((m = motif.exec(texte))) {
    let j = m.index
    let profondeur = 0
    for (; j < texte.length; j++) {
      if (texte[j] === '{') profondeur++
      else if (texte[j] === '}' && --profondeur === 0) break
    }
    trouves.push({ bloc: texte.slice(m.index, j + 1), ligne: texte.slice(0, m.index).split('\n').length })
  }
  return trouves
}

describe('chaque confirmation nomme son action', () => {
  it('aucun appel à confirm() sans confirmLabel', () => {
    const sans = []
    for (const f of fichiers('src')) {
      for (const { bloc, ligne } of appels(readFileSync(f, 'utf8'))) {
        if (!/\bconfirmLabel\s*:/.test(bloc)) sans.push(`${f.split('\\').join('/')}:${ligne}`)
      }
    }
    expect(sans).toEqual([])
  })

  it('la fenêtre de confirmation n’a plus de libellé par défaut', () => {
    const source = readFileSync('src/shared/ui/confirm-dialog/confirm-provider.jsx', 'utf8')
    expect(source).not.toMatch(/confirm:\s*'Confirm(er)?'/)
  })
})
