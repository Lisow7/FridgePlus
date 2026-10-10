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
import { toFormState } from '@features/recipes/lib/recipe-form-state'

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
      expect(screen.getByRole('textbox', { name: /étape 1/i })).toBeInTheDocument()
    })

    // Décision du 2026-10-08 (WCAG 2.5.7) : réordonner sans glisser, et le focus
    // suit l'étape déplacée — au bout de la liste, il passe à l'autre flèche.
    it('↓ descend l’étape d’un rang, et le focus la suit', async () => {
      const user = userEvent.setup()
      render(<RecipeFormModal {...defaultProps} />)
      await user.click(screen.getByText(/ajouter une étape/i))
      await user.type(screen.getByRole('textbox', { name: /étape 1/i }), 'Laver le riz')
      await user.click(screen.getByText(/ajouter une étape/i))
      await user.type(screen.getByRole('textbox', { name: /étape 2/i }), 'Cuire le riz')
      await user.click(screen.getByRole('button', { name: "Descendre l'étape 1" }))
      expect(screen.getByRole('textbox', { name: /étape 1/i })).toHaveValue('Cuire le riz')
      expect(screen.getByRole('textbox', { name: /étape 2/i })).toHaveValue('Laver le riz')
      // Devenue la dernière, elle ne descend plus : le focus est sur « Monter ».
      expect(screen.getByRole('button', { name: "Monter l'étape 2" })).toHaveFocus()
    })
  })

  // ─── Enregistrement refusé ──────────────────────────────────────────────────
  // Hors audit, trouvé le 2026-10-05. Le résultat de l'enregistrement n'était
  // pas lu : une recette refusée par la base (réseau, session expirée) fermait
  // le formulaire ET purgeait le brouillon. Une recette tapée en entier, perdue
  // sans un mot.
  describe('enregistrement refusé', () => {
    const RECETTE = {
      id: 'custom-1', name: 'Tarte fine', emoji: '🥧', time: '30 min', difficulty: 'Facile',
      type: 'Dessert & Petit-déj', servings: 4, country: 'fr', diet: [], allergens: [],
      ingredients: [{ ids: ['vg-tomate'], labels: { fr: 'Tomate' }, required: true, qty: { amount: 2, unit: 'pièce' } }],
      steps: ['Étaler la pâte.'], isCustom: true,
    }
    const PANNE = { message: 'Failed to fetch' }
    const CLE_BROUILLON = 'fridge-recipe-draft'
    const poserUnBrouillon = () => localStorage.setItem(CLE_BROUILLON, JSON.stringify({
      version: 1, savedAt: Date.now(), payload: toFormState(RECETTE),
    }))

    beforeEach(() => { localStorage.clear() })

    it('témoin — enregistrement accepté : le formulaire se ferme', async () => {
      const onSave = vi.fn().mockResolvedValue({ error: null })
      const onClose = vi.fn()
      const user = userEvent.setup()
      render(<RecipeFormModal {...defaultProps} initialRecipe={RECETTE} onSave={onSave} onClose={onClose} />)
      await user.click(screen.getByText('Enregistrer'))
      await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
      expect(onSave).toHaveBeenCalledOnce()
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('refusé : le formulaire reste ouvert, une alerte le dit, et rien de ce qui est tapé n’est perdu', async () => {
      const onSave = vi.fn().mockResolvedValue({ error: PANNE })
      const onClose = vi.fn()
      const user = userEvent.setup()
      render(<RecipeFormModal {...defaultProps} initialRecipe={RECETTE} onSave={onSave} onClose={onClose} />)
      await user.click(screen.getByText('Enregistrer'))
      const alerte = await screen.findByRole('alert')
      expect(alerte).toHaveTextContent(/pas enregistrée/i)
      expect(onClose).not.toHaveBeenCalled()
      expect(screen.getByDisplayValue('Tarte fine')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Étaler la pâte.')).toBeInTheDocument()
    })

    it('refusé : le brouillon est GARDÉ (création)', async () => {
      poserUnBrouillon()
      const onSave = vi.fn().mockResolvedValue({ error: PANNE })
      const user = userEvent.setup()
      render(<RecipeFormModal {...defaultProps} onSave={onSave} />)
      await user.click(screen.getByText('Enregistrer'))
      await screen.findByRole('alert')
      expect(onSave).toHaveBeenCalledOnce()
      expect(localStorage.getItem(CLE_BROUILLON)).not.toBeNull()
    })

    it('témoin — accepté : le brouillon est purgé (création)', async () => {
      poserUnBrouillon()
      const onSave = vi.fn().mockResolvedValue({ error: null })
      const onClose = vi.fn()
      const user = userEvent.setup()
      render(<RecipeFormModal {...defaultProps} onSave={onSave} onClose={onClose} />)
      await user.click(screen.getByText('Enregistrer'))
      await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
      expect(localStorage.getItem(CLE_BROUILLON)).toBeNull()
    })

    it('recette validée par la modération : le dit, au lieu d’un échec sans raison', async () => {
      const verrou = Object.assign(new Error('approved_recipe_locked'), { code: 'approved_recipe_locked' })
      const onSave = vi.fn().mockResolvedValue({ error: verrou })
      const onClose = vi.fn()
      const user = userEvent.setup()
      render(<RecipeFormModal {...defaultProps} initialRecipe={RECETTE} onSave={onSave} onClose={onClose} />)
      await user.click(screen.getByText('Enregistrer'))
      expect(await screen.findByRole('alert')).toHaveTextContent(/validée par la modération/i)
      expect(onClose).not.toHaveBeenCalled()
    })

    it('un enregistrement qui lève : même alerte, formulaire ouvert', async () => {
      const onSave = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
      const onClose = vi.fn()
      const user = userEvent.setup()
      render(<RecipeFormModal {...defaultProps} initialRecipe={RECETTE} onSave={onSave} onClose={onClose} />)
      await user.click(screen.getByText('Enregistrer'))
      expect(await screen.findByRole('alert')).toHaveTextContent(/pas enregistrée/i)
      expect(onClose).not.toHaveBeenCalled()
    })

    it('pendant un nouvel essai, l’alerte de l’essai précédent n’est plus affichée', async () => {
      let trancher
      const onSave = vi.fn()
        .mockResolvedValueOnce({ error: PANNE })
        .mockReturnValueOnce(new Promise((resolve) => { trancher = resolve }))
      const user = userEvent.setup()
      render(<RecipeFormModal {...defaultProps} initialRecipe={RECETTE} onSave={onSave} />)
      await user.click(screen.getByText('Enregistrer'))
      await screen.findByRole('alert')
      await user.click(screen.getByText('Enregistrer'))
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
      expect(screen.queryByRole('alert')).toBeNull()
      trancher({ error: PANNE })
      expect(await screen.findByRole('alert')).toBeInTheDocument()
    })

    it('un nouvel essai qui réussit ferme le formulaire', async () => {
      const onSave = vi.fn().mockResolvedValueOnce({ error: PANNE }).mockResolvedValueOnce({ error: null })
      const onClose = vi.fn()
      const user = userEvent.setup()
      render(<RecipeFormModal {...defaultProps} initialRecipe={RECETTE} onSave={onSave} onClose={onClose} />)
      await user.click(screen.getByText('Enregistrer'))
      await screen.findByRole('alert')
      await user.click(screen.getByText('Enregistrer'))
      await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
      expect(onSave).toHaveBeenCalledTimes(2)
    })
  })
})
