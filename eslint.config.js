import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import importPlugin from 'eslint-plugin-import'
import reactPlugin from 'eslint-plugin-react'
import { defineConfig, globalIgnores } from 'eslint/config'

// Sprint 9 (S9.a) — zones d'isolation features.
// Source : Bulletproof React (alan2207/bulletproof-react).
// Flux unidirectionnel : shared → features → app. Pas de cross-feature.
const FEATURES = [
  'admin', 'auth', 'cart', 'changelog', 'community', 'fridge', 'legal',
  'notifications', 'onboarding', 'premium', 'profile', 'pwa', 'recipes',
  'support', 'voice',
]

// Exceptions admin → autres features : admin a légitimement besoin
// d'importer les API/composants des features qu'elle modère
// (support, community, notifications). Ces couplages sont architecturaux
// et documentés (cf. Sprint 9 S9.a.5).
const ADMIN_BRIDGES = ['support', 'community', 'notifications', 'recipes']

// Pour chaque feature, interdire l'import depuis toutes les autres features.
const featureZones = FEATURES.map(target => ({
  target: `./src/features/${target}`,
  from: FEATURES
    .filter(f => f !== target)
    // Exception : admin peut importer support/community/notifications
    .filter(f => !(target === 'admin' && ADMIN_BRIDGES.includes(f)))
    .map(f => `./src/features/${f}`),
}))

export default defineConfig([
  globalIgnores([
    'dist',
    'analyze_ingredients.*',
    'extract_report.*',
  ]),
  {
    files: ['**/*.{js,jsx,mjs}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: { import: importPlugin, react: reactPlugin },
    settings: {
      'import/resolver': {
        alias: {
          map: [
            ['@app',      './src/app'],
            ['@features', './src/features'],
            ['@shared',   './src/shared'],
            ['@routes',   './src/routes'],
          ],
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
        node: { extensions: ['.js', '.jsx'] },
      },
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // `react/jsx-uses-vars` marque comme UTILISÉ tout identifiant employé dans
      // du JSX. Sans lui, ESLint ne voit pas que `<Suspense>` utilise `Suspense`
      // — d'où le `varsIgnorePattern: '^[A-Z_]'` qui régnait ici et rendait
      // INVISIBLE toute constante MAJUSCULE morte. C'est exactement ce qui a
      // laissé passer `SIZE_RECIPE`, déclaré et jamais lu (2026-08-15).
      // Mesuré : sans cette règle, resserrer le motif produisait 1368 faux
      // positifs dans 349 fichiers ; avec elle, il n'en reste que de vrais.
      // Seule cette règle du plugin est activée — aucun preset, donc aucun bruit
      // supplémentaire.
      'react/jsx-uses-vars': 'error',
      'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-useless-escape': 'off',
      // Sprint 9 — règles React strictes downgrade en `warn`. Volume élevé
      // de violations existantes (pre-S9 tech debt). À nettoyer dans les
      // sous-PRs Sprint 9 ; pour l'instant on les voit mais on ne bloque
      // pas le pre-commit lint-staged sur des modifs de fichiers touchés.
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/static-components': 'warn',
      // Les contexts exportent Provider + useXxx — pattern volontaire qui
      // bloque le HMR de la fonction useXxx mais reste acceptable (rechargement
      // page complet sur changement de hook contexte = rare en dev).
      'react-refresh/only-export-components': 'warn',
      // Sprint 9 S9.a.6 — règle passée en `error` strict après résolution
      // des 105 violations initiales (sous-PRs S9.a.1 → S9.a.5c). Architecture
      // conforme Bulletproof React : flux unidirectionnel shared → features → app.
      'import/no-restricted-paths': ['error', {
        zones: [
          // shared/ ne peut pas dépendre de features/ ni app/
          {
            target: './src/shared',
            from: ['./src/features', './src/app'],
            message: 'shared/ doit rester pur — pas d\'import depuis features/ ou app/.',
          },
          // features/ ne peut pas dépendre de app/
          {
            target: './src/features',
            from: './src/app',
            message: 'features/ ne doit pas importer depuis app/ (flux unidirectionnel).',
          },
          // cross-feature interdit
          ...featureZones.map(z => ({
            ...z,
            message: 'Cross-feature import interdit — passe par shared/ ou compose au niveau app/.',
          })),
        ],
      }],
    },
  },
  // Surcharge spécifique aux fichiers de test : globals vitest + node
  {
    files: ['src/test/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },
  // Configs Node (vite, playwright, scripts, Vercel API routes) : utilisent
  // process.env, __dirname… Désactive le resolver d'imports (ESM-only modules
  // type rollup-plugin-visualizer cassent eslint-import-resolver-alias).
  //
  // 2026-08-06 : `e2e/**` ajouté. Les specs Playwright s'exécutent dans le
  // runner Node, pas dans le navigateur — `playwright.config.js` était déjà
  // traité comme tel, mais les specs qu'il pilote ne l'étaient pas.
  {
    // `src/scripts/**` : des scripts Node qui vivent sous `src/`. Ils
    // n'apparaissaient pas ici tant que les `.mjs` échappaient aux règles ;
    // les couvrir a révélé qu'ils n'avaient pas non plus les globals Node.
    files: ['vite.config.js', 'playwright.config.js', 'e2e/**/*.{js,mjs}', 'scripts/**/*.{js,mjs,py}', 'src/scripts/**/*.{js,mjs}', 'api/**/*.{js,mjs}'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'import/no-restricted-paths': 'off',
    },
  },
])
