import { describe, it, expect } from 'vitest'
import { normalizeSearch } from '@shared/lib/matching/normalize-search'
import { normalize as normalizeMatcher } from '@shared/lib/matching/ingredient-text-matcher'

// Ces tests verrouillent deux défauts MESURÉS le 2026-08-07 dans les trois
// copies locales de `normalize()` (inventaire, ticket scanné, confirmation
// vocale). Ils décrivent le comportement attendu par l'utilisateur, pas
// l'implémentation.

describe('normalizeSearch — recherche à l\'écran', () => {
  describe('ligature œ : le clavier ne la produit pas, le catalogue si', () => {
    // Le vrai scénario : le catalogue contient « Bœuf », l'utilisateur tape
    // « boeuf ». NFD ne décompose pas œ — sans remplacement explicite, aucun
    // résultat, alors que huit entrées du catalogue sont concernées.
    it('« Bœuf » se trouve en tapant « boeuf »', () => {
      expect(normalizeSearch('Bœuf')).toContain('boeuf')
    })

    it('« Bœuf haché » se trouve en tapant « boeuf hache »', () => {
      expect(normalizeSearch('Bœuf haché')).toBe('boeuf hache')
    })

    it('la majuscule « Œuf » aussi — l\'ordre des opérations compte', () => {
      expect(normalizeSearch('Œuf')).toBe('oeuf')
    })

    it('la ligature æ est traitée de même', () => {
      expect(normalizeSearch('Ex æquo')).toBe('ex aequo')
    })
  })

  describe('accents français', () => {
    it('« Crème » se trouve en tapant « creme »', () => {
      expect(normalizeSearch('Crème')).toBe('creme')
    })

    it('« Rôti bœuf » cumule accent et ligature', () => {
      expect(normalizeSearch('Rôti bœuf')).toBe('roti boeuf')
    })
  })

  describe('japonais : ne pas confondre des ingrédients distincts', () => {
    // `\p{Diacritic}` (utilisé par les trois copies locales) englobe le dakuten
    // et le prolongateur : « がぎ » devenait « かき ». La recherche répondait
    // toujours, mais des ingrédients différents se confondaient.
    // ⚠️ On compare des SENS, pas des chaînes : `normalize('NFD')` renvoie la
    // forme décomposée, visuellement identique au littéral mais pas égale à sa
    // forme composée. Comparer à `'がぎ'` échouerait pour une raison sans
    // rapport avec ce qui est vérifié ici.
    it('le dakuten distingue toujours がぎ de かき', () => {
      expect(normalizeSearch('がぎ')).not.toBe(normalizeSearch('かき'))
    })

    it('le prolongateur de ソーセージ n\'est pas effacé', () => {
      expect(normalizeSearch('ソーセージ')).toContain('ー')
    })
  })

  describe('robustesse', () => {
    it('accepte null et undefined sans lever', () => {
      expect(normalizeSearch(null)).toBe('')
      expect(normalizeSearch(undefined)).toBe('')
    })
  })

  // Le matcher d'ingrédients (reconnaissance vocale, scan de ticket) est du
  // code critique : ce test prouve que le rebranchement sur ce module n'a rien
  // changé à son comportement, plutôt que de le supposer.
  describe('équivalence avec le normaliseur du matcher d\'ingrédients', () => {
    const echantillon = [
      'Bœuf haché', 'Crème fraîche', 'Œuf', 'Ex æquo', 'Pâtes',
      'がぎ', 'ソーセージ', 'Tomate', '', 'MAJUSCULES ÉCRITES',
    ]
    it.each(echantillon)('rend le même résultat pour « %s »', (valeur) => {
      expect(normalizeSearch(valeur)).toBe(normalizeMatcher(valeur))
    })
  })
})
