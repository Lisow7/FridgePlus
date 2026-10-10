import { describe, it, expect } from 'vitest'
import { champCsv, versCsv } from '@features/admin/lib/csv'

// Audit du 2026-10-04, SEC-08 : l'export CSV du panneau Qualité écrivait les
// champs tels quels — une virgule cassait la colonne, et une cellule qui
// commence par =, +, - ou @ devient une FORMULE à l'ouverture dans un tableur
// (exfiltration ou exécution côté admin : « injection CSV »). Chaque champ est
// désormais entre guillemets, les guillemets doublés, et une formule neutralisée.

describe('champCsv — un champ sûr', () => {
  it('entoure de guillemets et double ceux du texte', () => {
    expect(champCsv('tomate, cerise')).toBe('"tomate, cerise"')
    expect(champCsv('dit « ok »')).toBe('"dit « ok »"')
    expect(champCsv('5" de haut')).toBe('"5"" de haut"')
  })

  it('neutralise ce qu’un tableur lirait comme une formule', () => {
    expect(champCsv('=1+1')).toBe('"\'=1+1"')
    expect(champCsv('+33 6')).toBe('"\'+33 6"')
    expect(champCsv('-5')).toBe('"\'-5"')
    expect(champCsv('@nom')).toBe('"\'@nom"')
    expect(champCsv('\t=HYPERLINK("x")')).toBe('"\'\t=HYPERLINK(""x"")"')
  })

  it('un nombre ou un vide passent sans surprise', () => {
    expect(champCsv(42)).toBe('"42"')
    expect(champCsv(null)).toBe('""')
    expect(champCsv(undefined)).toBe('""')
  })
})

describe('versCsv — des lignes', () => {
  it('une ligne par tableau, des champs sûrs, des retours à la ligne CRLF', () => {
    expect(versCsv([['id', 'nom'], ['a-1', '=cmd'], ['b,2', 'pomme']])).toBe('"id","nom"\r\n"a-1","\'=cmd"\r\n"b,2","pomme"')
  })
})
