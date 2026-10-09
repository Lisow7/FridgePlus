import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('@dnd-kit/core', () => ({
  DndContext:      ({ children }) => children,
  closestCenter:   () => ({}),
  PointerSensor:   class {},
  KeyboardSensor:  class {},
  useSensor:       () => ({}),
  useSensors:      (...args) => args,
}))
vi.mock('@dnd-kit/sortable', () => ({
  SortableContext:            ({ children }) => children,
  useSortable:                () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, transform: null, transition: null, isDragging: false }),
  verticalListSortingStrategy: {},
  sortableKeyboardCoordinates: () => {},
  arrayMove:                  (arr, from, to) => { const r = [...arr]; const [x] = r.splice(from, 1); r.splice(to, 0, x); return r },
}))
vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}))

vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: () => ({ user: null }),
}))

vi.mock('@shared/contexts/data-provider', () => ({
  useIngredients: () => ({
    'vg-tomate': [{ id: 'vg-tomate', labels: { fr: 'Tomate', en: 'Tomato', es: 'Tomate', de: 'Tomate', ja: 'トマト' }, emoji: '🍅' }],
    'fr-oeuf':   [{ id: 'fr-oeuf',   labels: { fr: 'Œuf',    en: 'Egg',    es: 'Huevo',  de: 'Ei',     ja: '卵'   }, emoji: '🥚' }],
  }),
  useFridgeLayouts:  () => ({}),
  useCountries:      () => ({}),
  useDietTypes:      () => ({}),
  useAllergenTypes:  () => ({}),
  useIngredientLookup: () => ({
    getLabel: () => null, getIngredient: () => null, getSubCategory: () => null,
    getCanonicalKey: () => null, byId: new Map(),
  }),
  useIngredientsById: () => new Map(),
}))

const mockValidateRecipeText = vi.hoisted(() => vi.fn())
vi.mock('@shared/lib/moderation', () => ({
  validateRecipeText: mockValidateRecipeText,
  containsProfanity:  (s) => ['merde', 'fuck'].some(w => s.toLowerCase().includes(w)),
}))

vi.mock('@features/recipes/lib/custom-recipes', () => ({
  createRecipeId: () => 'custom-test-123',
}))

vi.mock('@shared/hooks/use-voice-recognition', () => ({
  normalize:            (s) => s.toLowerCase(),
  toKatakana:           (s) => s,
  getKuromojiTokenizer: () => null,
  tokenizeJapanese:     (s) => [s],
}))

vi.mock('@shared/ui/emoji', () => ({
  default: ({ char }) => <span data-testid="emoji">{char}</span>,
}))

import RecipeFormModal from '@features/recipes/components/recipe-form-modal'

const defaultProps = {
  initialRecipe: null,
  onSave:  vi.fn(),
  onClose: vi.fn(),
  lang:    'fr',
  darkMode: false,
  hidePublishOption: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockValidateRecipeText.mockReturnValue(null)
})

describe('RecipeFormModal', () => {

  // ─── Rendu ──────────────────────────────────────────────────────────────────
  describe('rendu initial', () => {
    it('affiche le titre "Créer une recette"', () => {
      render(<RecipeFormModal {...defaultProps} />)
      expect(screen.getByText('Créer une recette')).toBeInTheDocument()
    })

    it('affiche le bouton "Enregistrer"', () => {
      render(<RecipeFormModal {...defaultProps} />)
      expect(screen.getByText('Enregistrer')).toBeInTheDocument()
    })

    it('affiche le bouton "Annuler"', () => {
      render(<RecipeFormModal {...defaultProps} />)
      expect(screen.getByText('Annuler')).toBeInTheDocument()
    })

    it('affiche le champ nom de la recette', () => {
      render(<RecipeFormModal {...defaultProps} />)
      expect(screen.getByPlaceholderText(/mon gratin/i)).toBeInTheDocument()
    })

    // TODO v3.120.0 — champ description retiré du formulaire (t.placeholderDescription jamais rendu).
    it.skip('affiche le champ description', () => {
      render(<RecipeFormModal {...defaultProps} />)
      expect(screen.getByPlaceholderText(/recette familiale/i)).toBeInTheDocument()
    })

    it('affiche le titre "Modification" si initialRecipe fourni', () => {
      const recipe = {
        id: 'custom-1', name: 'Tarte', description: 'Bonne', emoji: '🥧',
        time: '30 min', difficulty: 'Facile', type: 'Dessert & Petit-déj',
        servings: 4, country: 'fr', diet: [], ingredients: [], steps: [], isCustom: true,
      }
      render(<RecipeFormModal {...defaultProps} initialRecipe={recipe} />)
      expect(screen.getByText('Modifier la recette')).toBeInTheDocument()
    })
  })

  // ─── Validations au submit ───────────────────────────────────────────────────
  describe('validations — champs obligatoires', () => {
    it('affiche l\'erreur nom si champ vide', async () => {
      const user = userEvent.setup()
      render(<RecipeFormModal {...defaultProps} />)
      await user.click(screen.getByText('Enregistrer'))
      await waitFor(() =>
        expect(screen.getByText('Le nom est obligatoire')).toBeInTheDocument()
      )
    })

    // TODO v3.120.0 — champ description retiré du formulaire, message d'erreur description jamais affiché.
    it.skip('affiche l\'erreur description si champ vide', async () => {
      const user = userEvent.setup()
      render(<RecipeFormModal {...defaultProps} />)
      await user.click(screen.getByText('Enregistrer'))
      await waitFor(() =>
        expect(screen.getByText('La description est obligatoire')).toBeInTheDocument()
      )
    })

    it('affiche l\'erreur icône si aucun emoji sélectionné', async () => {
      const user = userEvent.setup()
      render(<RecipeFormModal {...defaultProps} />)
      await user.click(screen.getByText('Enregistrer'))
      await waitFor(() =>
        expect(screen.getByText("L'icône est obligatoire")).toBeInTheDocument()
      )
    })

    it('affiche l\'erreur ingrédient si aucun ajouté', async () => {
      const user = userEvent.setup()
      render(<RecipeFormModal {...defaultProps} />)
      await user.click(screen.getByText('Enregistrer'))
      await waitFor(() =>
        expect(screen.getByText('Ajoute au moins un ingrédient')).toBeInTheDocument()
      )
    })

    it('affiche l\'erreur étape si aucune ajoutée', async () => {
      const user = userEvent.setup()
      render(<RecipeFormModal {...defaultProps} />)
      await user.click(screen.getByText('Enregistrer'))
      await waitFor(() =>
        expect(screen.getByText('Ajoute au moins une étape')).toBeInTheDocument()
      )
    })

    it('n\'appelle pas onSave si le formulaire est invalide', async () => {
      const onSave = vi.fn()
      const user = userEvent.setup()
      render(<RecipeFormModal {...defaultProps} onSave={onSave} />)
      await user.click(screen.getByText('Enregistrer'))
      await waitFor(() => expect(screen.getByText('Le nom est obligatoire')).toBeInTheDocument())
      expect(onSave).not.toHaveBeenCalled()
    })

    it('l\'erreur de nom disparaît dès la saisie', async () => {
      const user = userEvent.setup()
      render(<RecipeFormModal {...defaultProps} />)
      await user.click(screen.getByText('Enregistrer'))
      await waitFor(() => expect(screen.getByText('Le nom est obligatoire')).toBeInTheDocument())
      await user.type(screen.getByPlaceholderText(/mon gratin/i), 'Ma recette')
      await waitFor(() =>
        expect(screen.queryByText('Le nom est obligatoire')).not.toBeInTheDocument()
      )
    })
  })

  // ─── Profanité ───────────────────────────────────────────────────────────────
  describe('validation — contenu inapproprié', () => {
    it('affiche l\'erreur profanité si validateRecipeText retourne "name"', async () => {
      mockValidateRecipeText.mockReturnValue('name')
      const user = userEvent.setup()
      render(<RecipeFormModal {...defaultProps} />)
      await user.type(screen.getByPlaceholderText(/mon gratin/i), 'merde')
      await user.click(screen.getByText('Enregistrer'))
      await waitFor(() =>
        expect(screen.getByText('Ce champ contient du contenu inapproprié')).toBeInTheDocument()
      )
    })
  })

  // ─── Interactions ────────────────────────────────────────────────────────────
  describe('interactions', () => {
    it('appelle onClose au clic "Annuler" sans modification', async () => {
      const onClose = vi.fn()
      const user = userEvent.setup()
      render(<RecipeFormModal {...defaultProps} onClose={onClose} />)
      await user.click(screen.getByText('Annuler'))
      expect(onClose).toHaveBeenCalledOnce()
    })

    it('ouvre le dialogue de confirmation si le form est dirty au clic Annuler', async () => {
      const user = userEvent.setup()
      render(<RecipeFormModal {...defaultProps} />)
      await user.type(screen.getByPlaceholderText(/mon gratin/i), 'Test')
      await user.click(screen.getByText('Annuler'))
      await waitFor(() =>
        expect(screen.getByText(/abandonner les modifications/i)).toBeInTheDocument()
      )
    })

    it('le bouton "+ Ajouter un ingrédient" ajoute une ligne avec sélecteur', async () => {
      const user = userEvent.setup()
      render(<RecipeFormModal {...defaultProps} />)
      await user.click(screen.getByText(/ajouter un ingrédient/i))
      // La ligne ajoutée affiche le bouton "Sélectionner un ingrédient"
      expect(screen.getByText('Sélectionner un ingrédient')).toBeInTheDocument()
    })

    it('le bouton "+ Ajouter une étape" ajoute une ligne', async () => {
      const user = userEvent.setup()
      render(<RecipeFormModal {...defaultProps} />)
      await user.click(screen.getByText(/ajouter une étape/i))
      expect(screen.getByPlaceholderText(/décris cette étape/i)).toBeInTheDocument()
    })
  })
})
