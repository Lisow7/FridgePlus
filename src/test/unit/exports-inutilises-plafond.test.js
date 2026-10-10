import { describe, it, expect } from 'vitest'
import { compterKnip, verdict } from '../../../scripts/verifier-les-exports-inutilises.mjs'

// Audit du 2026-10-04, ARCH-14 (3) — knip connaît le code mort (exports sans
// importeur, fichiers que rien n'importe, dépendances non déclarées), mais
// rien ne le lisait en CI : le compte montait sans qu'on le voie. Même cliquet
// que le lint : au cran exact, « périmé » s'il baisse sans qu'on l'écrive.

const rapport = {
  files: [],
  issues: [
    { file: 'a.js', files: [{ name: 'a.js' }], exports: [], unlisted: [], dependencies: [] },
    { file: 'b.js', files: [], exports: [{ name: 'x' }, { name: 'y' }], unlisted: [{ name: 'npm' }], dependencies: [] },
    { file: 'c.js', files: [], exports: [{ name: 'z' }], unlisted: [], dependencies: [{ name: 'lodash' }] },
  ],
}

describe('cliquet des exports inutilisés', () => {
  it('compte chaque catégorie du rapport JSON de knip', () => {
    expect(compterKnip(rapport)).toEqual({ files: 1, exports: 3, unlisted: 1, dependencies: 1 })
  })

  it('au cran exact : vert ; au-dessus : rouge ; au-dessous : « périmé »', () => {
    const plafonds = { files: 1, exports: 3, unlisted: 1, dependencies: 1 }
    expect(verdict(compterKnip(rapport), plafonds)).toEqual([])
    expect(verdict(compterKnip(rapport), { ...plafonds, exports: 2 })).toEqual([expect.stringMatching(/exports.*3.*plafond.*2/)])
    expect(verdict(compterKnip(rapport), { ...plafonds, exports: 4 })).toEqual([expect.stringMatching(/périmé.*exports.*3.*4/i)])
  })

  it('une catégorie absente du package.json vaut 0 : la première trouvaille est rouge', () => {
    expect(verdict(compterKnip(rapport), { files: 1, exports: 3, unlisted: 1 })).toEqual([expect.stringMatching(/dependencies.*1.*plafond.*0/)])
  })
})
