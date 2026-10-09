# Feature `voice`

> Reconnaissance vocale : ajouter des ingrédients au frigo **à la voix**, et piloter le **mode
> cuisine** par commandes vocales. La feature ne contient plus que **2 composants UI** — toute la
> logique (hooks) vit dans `shared/`. (Code lu sur `dev` le 2026-06-23.)

## ⚠️ Particularité : feature « UI-only », hooks déplacés dans `shared/`
Les hooks de reconnaissance ont été **déplacés dans `@shared/hooks/`** (ils sont consommés hors voice :
`recipe-form-*`, `use-voice-flow`) :
- **`@shared/hooks/use-voice-recognition`** — moteur d'ajout d'ingrédients : Web Speech API +
  matching flou (**Fuse.js**) contre le catalogue, normalisation accents/casse, déstemmatisation
  singulier/pluriel, stopwords, alias (`@shared/static/speech-aliases`).
- **`@shared/hooks/use-cooking-voice`** — commandes du mode cuisine : `next` / `prev` / `repeat` /
  `stop` + intent **minuteur** (« minuteur 5 minutes ») via `parse-durations`.

> 🧱 **Façade (`index.js`)** : n'expose que les **composants** de la feature. Les hooks vivent dans
> `@shared/hooks/` et sont importés **directement** depuis shared par leurs consommateurs (pas via
> cette façade, qui n'est d'ailleurs importée nulle part). Les anciens re-exports morts vers un
> `./hooks/` local inexistant ont été retirés.

## Composants (les seuls fichiers de la feature)
- **`components/voice-mini-panel.jsx`** — petit panneau flottant (portal) affiché **pendant l'écoute**
  d'ajout : drapeau langue, sous-titre « Parlez en… », transcript live, nombre d'ingrédients détectés,
  bouton Stop. Responsive (desktop ancré en haut à droite).
- **`components/voice-confirm-panel.jsx`** — panneau de **confirmation** : liste des ingrédients
  reconnus avant ajout au frigo, marquage « déjà dans le frigo », **désambiguïsation** (« lequel
  vouliez-vous ? »), recherche manuelle d'ajout, et garde-fou « abandonner la saisie ? ».

## Périmètre linguistique : FR / EN uniquement
- `LANG_TO_LOCALE = { fr: 'fr-FR', en: 'en-US' }`. **ES/DE retirés** (Sprint 7) et le **runtime
  japonais est désactivé** depuis v3.3.18 : le CDN kuromoji (~3,5 Mo) ne se charge plus. Les exports
  `toKatakana` / `getKuromojiTokenizer` / `tokenizeJapanese` sont conservés en **stubs no-op** pour ne
  pas casser `RecipeFormModal` et les tests qui les importent (branche `lang === 'ja'` inatteignable).

## Orchestration & consentement
- L'enchaînement (start/stop, modale de confirmation, ajout au stock, toast undo) est porté par
  **`src/app/hooks/use-voice-flow.js`**, monté via **`src/app/components/voice-overlays.jsx`**
  (`VoiceMiniPanel` + `VoiceConfirmPanel` en lazy).
- **Consentement vocal indépendant** du bandeau cookies global (`@shared/hooks/use-consent` +
  `@shared/ui/voice-consent-dialog`) : accepter la voix au 1ᵉʳ usage du micro ne masque pas le bandeau.
  Cf. la feature [`legal`](../legal/README.md). Feature **gratuite, sans login**.

## Dépendances & consommateurs
- `@shared/hooks/use-voice-recognition` + `use-cooking-voice` (cœur), `@shared/contexts/data-provider`
  (`useIngredients`), `@shared/hooks/use-window-width`, `@shared/ui/button`, `fuse.js`.
- Composants consommés par `app/components/voice-overlays.jsx` ; hooks consommés par `use-voice-flow.js`,
  `recipes/.../recipe-form-mic-input.jsx`, `recipe-form-modal.jsx`, `recipe-form-sortable-step.jsx`.
- i18n **inline par composant** (fr/en), cf. [ADR 0002](../../../docs/adr/0002-i18n-inline-par-composant.md).
  Vue d'ensemble : `docs/ARCHITECTURE.md`.
