import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fixBareBaseRedirect } from './vite-plugin-fix-bare-base-redirect.js'

// v3.169.0 — Phase 0 restructuration : alias paths.
// Migration progressive layer-based → feature-based hybride.
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Base path : GitHub Pages sert sous `/FridgePlus/`, Vercel sous `/`.
// Vercel injecte VERCEL=1 au build → on switche automatiquement.
const isVercel = process.env.VERCEL === '1'
const base = isVercel ? '/' : '/FridgePlus/'

// Bundle analyzer activé via env ANALYZE=1 npm run build → génère
// dist/bundle-stats.html (gitignored) avec la treemap des chunks.
const isAnalyze = process.env.ANALYZE === '1'

export default defineConfig({
  base,
  resolve: {
    alias: {
      '@app':      path.resolve(__dirname, './src/app'),
      '@features': path.resolve(__dirname, './src/features'),
      '@shared':   path.resolve(__dirname, './src/shared'),
      '@routes':   path.resolve(__dirname, './src/routes'),
      // Générateurs du HTML servi au build (pré-rendu du corps des pages).
      '@prerender': path.resolve(__dirname, './src/prerender'),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    // Corrige la 404 dev server quand une navigation client (ex. ?recettes=1
    // sur la route racine) produit une URL sans le slash final du base
    // (`/FridgePlus` au lieu de `/FridgePlus/`). Voir commentaire du module
    // pour le détail de la cause racine. No-op sous Vercel (base=`/`).
    fixBareBaseRedirect(base),
    VitePWA({
      // registerType 'prompt' (retour, 2026-07-09) : le Service Worker
      // attend le clic de l'utilisateur sur <UpdatePrompt> avant de se
      // mettre à jour — pour ne pas perdre une saisie en cours dans un
      // formulaire. Entre le 15 mai et le 9 juillet 2026, le mode était
      // 'autoUpdate' suite à un bug où le toast ne se déclenchait jamais
      // (users bloqués sur un vieux bundle). Cause probable identifiée :
      // ce n'était pas le mode 'prompt' lui-même, mais l'absence de
      // vérification active d'une nouvelle version — une SPA ne déclenche
      // plus aucune navigation après le chargement initial, et c'est la
      // navigation qui fait normalement office de check. <UpdatePrompt>
      // pose maintenant un check actif (périodique + visibilitychange,
      // cf. la conception « pwa-update-prompt » du 2026-07-09)
      // qui comble ce trou indépendamment du mode choisi.
      registerType: 'prompt',
      // `og-image.svg` en est sorti le 2026-10-08 (audit, SEO-11) : c'est la
      // source de `npm run og`, jamais affichée par l'application.
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Fridge+',
        short_name: 'Fridge+',
        description: 'Trouve quoi cuisiner avec ce que tu as dans ton frigo.',
        lang: 'fr',
        theme_color: '#E07820',
        background_color: '#F0E8DC',
        display: 'standalone',
        orientation: 'any',
        // start_url & scope sont préfixés par la base (sinon l'app installée
        // pointe vers / au lieu de /FridgePlus/).
        start_url: base,
        scope: base,
        // `id` fige l'identité de la PWA indépendamment du start_url — requis
        // pour l'empaquetage TWA (Play Store, chantier-stores-google-apple.md).
        id: base,
        categories: ['food', 'lifestyle'],
        icons: [
          { src: `${base}icon-192.png`,           sizes: '192x192', type: 'image/png' },
          { src: `${base}icon-512.png`,           sizes: '512x512', type: 'image/png' },
          { src: `${base}icon-maskable-512.png`,  sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Screenshots : richer install UI de Chrome + prérequis d'empaquetage
        // Play (PWABuilder les exige). Capturés en PROD, frigo rempli, fr.
        // JPEG volontairement (hors du precache Workbox — voir globIgnores).
        // La cohérence déclaration ↔ fichiers ↔ dimensions est verrouillée par
        // src/test/unit/pwa-manifest-screenshots.test.js.
        screenshots: [
          { src: `${base}screenshots/accueil-mobile.jpg`,  sizes: '1080x1920', type: 'image/jpeg', form_factor: 'narrow', label: 'Ton frigo virtuel te dit quoi cuisiner, là, maintenant' },
          { src: `${base}screenshots/recette-mobile.jpg`,  sizes: '1080x1920', type: 'image/jpeg', form_factor: 'narrow', label: 'Une recette faisable à 100 % avec ce que tu as' },
          { src: `${base}screenshots/accueil-desktop.jpg`, sizes: '1920x1080', type: 'image/jpeg', form_factor: 'wide',   label: 'Frigo et garde-manger côte à côte' },
        ],
      },
      workbox: {
        // Workbox precache : tous les assets statiques (JS/CSS/HTML/SVG/PNG)
        // sont mis en cache au premier load → app utilisable hors-ligne dès
        // la 2ᵉ visite.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp}'],
        // Audit repo §8bis (2026-07-22) — allègement du precache initial.
        // Ces 3 chunks (~970 KB) étaient précachés dès la 1re visite pour 100 %
        // des visiteurs alors qu'ils ne servent qu'à une minorité :
        //   - vendor-sentry : chargé UNIQUEMENT après consentement "audience"
        //     (la majorité ne l'active jamais) ;
        //   - admin-panel   : réservé aux admins (< 1 % des visiteurs) ;
        //   - vendor-recharts : graphiques stats admin/profil, à la demande.
        // Exclus du precache → restent chargés en réseau à la demande (chunks
        // lazy déjà séparés). Trade-off assumé : indisponibles hors-ligne.
        globIgnores: [
          '**/vendor-sentry-*.js',
          '**/admin-panel-*.js',
          '**/vendor-recharts-*.js',
          // Screenshots du manifeste : ~270 Ko qui ne servent qu'aux stores et
          // à l'invite d'installation — aucun intérêt hors-ligne. Déjà exclus
          // de fait (jpg absent de globPatterns), gardé EXPLICITE pour que
          // l'ajout futur de jpg au precache ne les embarque pas en silence.
          '**/screenshots/**',
          // Les ~380 emoji hébergés par le site (1,4 Mo) : mis en cache à la
          // demande ci-dessous, pas tous dès la première visite (2026-10-06).
          '**/emoji/**',
          // Le logo de la bienvenue (35 Ko de webp, incompressible) : l'écran ne
          // s'affiche qu'au premier passage, en ligne par définition (audit du
          // 2026-10-04, PERF-11). `scripts/verifier-precache.mjs` refuse son retour.
          '**/fridge-logo-*.webp',
          // Audit du 2026-10-04, SEO-11 — 243 Ko compressés que l'application
          // n'affiche jamais, téléchargés par chaque nouveau visiteur :
          //   - images de partage (`og-image.*`, `og-app-capture.png`) : lues
          //     par les robots des réseaux sociaux ;
          //   - `404.html` : servie par Vercel pour un FICHIER introuvable ;
          //   - icônes de notification : le navigateur les charge à
          //     l'arrivée d'une notification, réseau présent par définition.
          // `scripts/verifier-precache.mjs` refuse leur retour, en CI.
          '**/og-*',
          '**/404.html',
          '**/icons/push-icon-*',
          // SEO-12 (2026-10-08) : l'icône tactile d'iOS et favicon.ico sont
          // demandés par le système ou le navigateur, en ligne ; l'application
          // hors ligne a déjà favicon.svg.
          '**/apple-touch-icon.png',
          '**/favicon.ico',
        ],
        // Bumper la limite (notre bundle JS est ~967kB en raison du contenu
        // i18n × 5 langues + recettes statiques). À retirer quand la BDD
        // aura totalement remplacé les fichiers de seed.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        importScripts: ['push-handler.js'],
        runtimeCaching: [
          // v3.378.0 — Runtime caching Supabase REST RETIRÉ.
          // Précédemment : stratégie `NetworkFirst` qui interceptait toutes
          // les requêtes `/rest/v1/*` (profiles, recipes, etc.). Workbox ne
          // tient pas compte du header `Authorization` dans la cache key
          // par défaut → après un Clear site data + login + hard refresh,
          // l'app pouvait recevoir une réponse cachée vide ou périmée,
          // affichant le profil en `-`. Bug bloquant en prod, fix
          // uniquement par Clear site data complet manuel.
          // Trade-off accepté : pas de cache hors-ligne pour les données
          // dynamiques (les ingrédients/recettes statiques restent dispos
          // via le precache des assets JS qui embarquent les seeds).
          // À réintégrer plus tard avec une config plus fine (matchOptions
          // exclure les requêtes Authenticated) si l'offline complet
          // devient un besoin.
          //
          // Emoji hébergés par le site (public/emoji/) : en cache au premier
          // affichage, disponibles hors ligne ensuite (2026-10-06).
          {
            urlPattern: /\/emoji\/(twemoji|fluent)\/[^/]+\.svg$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'emoji',
              expiration: { maxEntries: 500, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Polices Google Fonts si jamais utilisées (cache long).
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Fallback navigation pour les routes SPA inconnues (en offline).
        // Préfixé par la base pour être cohérent avec ce qui est précaché.
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/^\/api/, /^\/auth/],
      },
      devOptions: {
        // Ne PAS activer le SW en dev — pollue le HMR + cache désynchronisé.
        // Pour tester en dev, lancer `npm run build && npm run preview`.
        enabled: false,
      },
    }),
    // v3.20.3 — Treemap interactive du bundle. Activé sur demande pour
    // ne pas polluer chaque build prod (sortie stats lourde).
    isAnalyze && visualizer({
      filename: 'dist/bundle-stats.html',
      gzipSize: true,
      brotliSize: true,
      open: false,
      template: 'treemap',
    }),
  ].filter(Boolean),
  build: {
    // v3.20.3 — Split manuel des gros vendors pour améliorer le cache
    // navigateur (mise à jour ciblée d'un chunk = pas de re-DL des autres).
    // v3.213.0 — Ajout split recharts (admin/profil seuls) + qrcode
    // (shared-basket-page seul) + react-router (toujours utilisé mais
    // chunk dédié pour cache stable). Audit perf : ces 3 deps étaient
    // dans `vendor` (705 KB) sans raison, alourdissant le bundle init.
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return
          if (id.includes('@supabase'))               return 'vendor-supabase'
          if (id.includes('@sentry'))                 return 'vendor-sentry'
          if (id.includes('@dnd-kit'))                return 'vendor-dnd'
          // ⛔ Plus de règles pour react-icons, fuse.js ni leo-profanity
          // (audit bundle 2026-08-25). Une règle nommée FORÇAIT toutes les
          // icônes des 165 fichiers dans UN chunk présent au boot — y compris
          // celles de l'admin et du profil ; même mécanique pour fuse (voix +
          // ticket + admin) et profanity (écran de 1er login uniquement).
          // Sans règle, Rollup les place PAR CONSOMMATEUR : ce que seule une
          // route lazy utilise part avec elle.
          // ⚠️ Le `return undefined` EXPLICITE est indispensable : sans lui,
          // ces paquets tomberaient dans le catch-all `return 'vendor'` du
          // bas — c'est-à-dire DANS le chunk de boot, l'inverse du but.
          if (id.includes('react-icons') || id.includes('fuse.js') || id.includes('leo-profanity')) return undefined
          // Même raison, audit du 2026-10-04 (PERF-03) : les dépendances de
          // recharts (d3, redux, immer…) n'ont pas « recharts » dans leur
          // chemin, et le fourre-tout du bas les mettait DANS le fichier de
          // démarrage — ≈ 45 Ko compressés pour les graphiques de l'admin et du
          // profil. Idem pour les listes de gros mots que charge leo-profanity
          // (français 76 Ko, russe 8 Ko), qui ne servent qu'au premier pseudo.
          // Placées par consommateur, elles partent avec ce qui s'en sert.
          if (/node_modules\/(victory-vendor|d3-[^/]+|@reduxjs|immer|redux|redux-thunk|react-redux|reselect|decimal\.js-light|es-toolkit|eventemitter3|internmap|tiny-invariant|use-sync-external-store|react-is|french-badwords-list|russian-bad-words)\//.test(id)) return undefined
          // 🔴 CONTRAINTE DURE : `vendor-recharts`, `vendor-sentry` et
          // `admin-panel` sont cités par les globIgnores de Workbox plus haut
          // dans ce fichier — ces trois noms doivent SURVIVRE, sinon
          // l'allègement du precache (§8bis) saute en silence.
          if (id.includes('recharts')) return 'vendor-recharts'
          if (id.includes('qrcode'))                  return 'vendor-qrcode'
          if (id.includes('react-router'))            return 'vendor-router'
          // Tout le reste de node_modules tombe dans le chunk vendor par défaut
          // (React, Vite runtime, etc.) — fortement cacheables, peu de churn.
          return 'vendor'
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
    // Exclure les tests E2E (Playwright) du runner Vitest, ainsi que les
    // worktrees (chantiers isolés dans .worktrees/) — sans quoi lancer les
    // tests depuis le repo principal re-scanne aussi leurs fichiers en
    // double avec leur propre node_modules, provoquant des échecs artefacts
    // sans rapport avec le code réel (trouvé 2026-07-14, merge base-recipe-links).
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', '**/.worktrees/**', '**/worktrees/**'],

    // Couverture — mesurée pour la première fois le 2026-08-28 (audit) : 46 %
    // des lignes. AUCUN seuil n'est posé ici, à dessein : un seuil global
    // pousse à tester ce qui est facile pour faire monter un chiffre, alors
    // que ce qui compte est de savoir OÙ le risque n'est pas couvert. C'est le
    // rôle de `npm run test:risque`, qui croise cette mesure avec les modules
    // qui suppriment des données, écrivent en base, touchent à l'argent ou aux
    // droits. Le chiffre global n'est qu'un intrant.
    //
    // Non branchée sur la CI : la mesure instrumente tout le code et rallonge
    // le job sans rien bloquer de plus que la suite elle-même.
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/test/**', 'src/**/*.test.{js,jsx}', 'src/main.jsx'],
    },
  },
})
