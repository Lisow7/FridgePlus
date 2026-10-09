# Scripts utilitaires Fridge+

Référence des scripts Node disponibles dans ce dossier. Tous sont en ESM (`.mjs`)
et lancés via `npm run <name>`. Lecture seule sauf indication contraire.

## 🛒 Pricing — workflow d'enrichissement

Les **packs grande surface** (référence grande surface FR 2025-2026) vivent dans
`src/shared/static/pricing/<year>.json` (depuis v3.30.0 — Phase D). Ce fichier est la
source de vérité pour les prix au panier ; `src/shared/static/pack-sizes.js` reste
autoritaire pour la **structure** (sizes/units) en fallback.

### Vue d'ensemble du pipeline

```
┌─ pricing:audit ──────► docs/pricing-coverage.md (rapport priorisé)
│                              │
│                              ▼
│  Identifier les sous-cats les plus exposées
│                              │
│                              ▼
│  Créer un batch : scripts/data/pricing-batch-N-<year>.mjs
│                              │
│                              ▼
└─ pricing:apply ──────► src/shared/static/pricing/<year>.json (merged)
                               │
                               ▼
                          re-run pricing:audit pour vérifier
```

### Commandes

| Commande | Effet | Quand |
|---|---|---|
| `npm run pricing:audit` | Génère `docs/pricing-coverage.md` (read-only) | À chaque démarrage / fin de session |
| `npm run pricing:gen [-- --year YYYY]` | Génère `pricing/<year>.json` depuis `packSizes.js` | Initialisation d'une nouvelle année |
| `npm run pricing:apply -- --batch <path>` | Merge un batch d'enrichissement dans `pricing/<year>.json` | Pour chaque PR de la Phase E |
| `npm run pricing:remove -- --ids id1,id2,...` | Supprime des entrées de `pricing/<year>.json` | Post-fusion d'ingrédients (cf. v3.43.0) |

### Deux workflows — choisir selon le contexte

| Workflow | Quand l'utiliser | Outils |
|---|---|---|
| **A — CLI batch** (Phase E) | Ajouter ou modifier **plein** d'ingrédients d'un coup (lots de 30-50). Utile pour les passages d'enrichissement par sous-cat. | `npm run pricing:apply` + fichier `scripts/data/pricing-batch-N-2026.mjs` |
| **B — UI admin** (Phase H) | Modifier **quelques** prix ponctuels (ex: une marque qui a augmenté son prix), revue annuelle ciblée, ajustements visuels après audit. | Onglet « Pricing » du panel admin (v3.46+) |

Les deux workflows convergent vers le même fichier `src/shared/static/pricing/<year>.json`. Combinables — l'un n'exclut pas l'autre.

### Workflow A — ajouter un lot par CLI

1. **`npm run pricing:audit`** — identifier les sous-catégories les plus exposées (top 5)
2. Pour chaque sous-cat ciblée, lister les ingrédients via `docs/pricing-coverage.md`
3. Créer `scripts/data/pricing-batch-N-2026.mjs` avec les ajouts (5 langues × 2-3 packs par ingrédient)
4. **`npm run pricing:apply -- --batch scripts/data/pricing-batch-N-2026.mjs`**
5. **`npm run pricing:audit`** pour confirmer la nouvelle couverture
6. Bumper la version, créer entrée changelog, commit + PR

### Workflow B — modifier des prix via l'UI admin

1. Se connecter en admin → Panel → onglet **Pricing**
2. Filtrer par sous-cat ou rechercher un ingrédient
3. Cliquer **Éditer** sur la ligne → modale d'édition par lang × pack
4. Modifier les prix (validation `> 0` automatique), cliquer **Enregistrer**
5. Le footer affiche `X modifications non sauvegardées` — répéter pour d'autres ingrédients si besoin
6. Cliquer **Télécharger pricing.json** → fichier `pricing-2026.json` téléchargé
7. Remplacer `src/shared/static/pricing/2026.json` dans le repo par le fichier téléchargé
8. Commit + PR (titre suggéré : `chore(vX.Y.Z): pricing manuel — <quoi modifié>`)

Composants impliqués :
- `src/components/admin/sections/PricingSection.jsx` — table + filtres + footer
- `src/components/admin/sections/PricingEditModal.jsx` — modale d'édition
- `src/lib/pricingExport.js` — helpers `mergePricingEdits` / `formatPricingForDownload` (testés via `src/test/unit/pricingExport.test.js`)

### Format d'un batch

```js
// scripts/data/pricing-batch-N-2026.mjs
export const PRICING_BATCH_N = {
  'gp-mon-ingredient': {
    fr: [
      { size: 500, unit: 'g', price: 2.50 },
      { size: 1, unit: 'kg', price: 4.50 },
    ],
    en: [{ size: 500, unit: 'g', price: 2.40 }],
    es: [{ size: 500, unit: 'g', price: 2.20 }],
    de: [{ size: 500, unit: 'g', price: 2.50 }],
    ja: [{ size: 500, unit: 'g', price: 580 }],
  },
}
```

Conventions :
- **Sizes** : grammes/cl pour les liquides, `pcs` pour les ingrédients à la
  pièce (œufs, fruits, etc.). Voir mémoire `project_basket_supermarket_units_only`.
- **Prix par lang** : EUR pour FR/ES/DE, GBP pour EN, JPY pour JA.
- **Au moins 1 entrée par langue**, idéalement 2-3 (mini/standard/familial).
- Idempotent : relancer `pricing:apply` avec le même batch écrase
  proprement les valeurs existantes (pas de duplication).

### Action annuelle (Janvier YYYY+1)

```bash
# 1. Archive l'année écoulée
git mv src/shared/static/pricing/2026.json src/shared/static/pricing/archive/2026.json

# 2. Génère le squelette 2027 depuis packSizes.js (qui conserve les valeurs historiques)
npm run pricing:gen -- --year 2027

# 3-bis. (NOUVEAU v3.120.0) Applique l'inflation Eurostat HICP automatiquement
npm run pricing:inflate -- --from 2026 --to 2027        # dry-run d'abord
npm run pricing:inflate -- --from 2026 --to 2027 --write  # génère scripts/data/pricing-update-2027-jan.mjs
npm run pricing:apply -- --batch scripts/data/pricing-update-2027-jan.mjs

# 4. Édite manuellement les prix qui ont changé (hors catégories HICP)
# ou applique des batches d'update supplémentaires

# 5. Vérifie la couverture
npm run pricing:audit
```

**Étape 3-bis — Inflation Eurostat HICP (CC-BY 4.0)**

| Commande | Effet |
|---|---|
| `npm run pricing:inflate -- --from YYYY --to YYYY+1` | Dry-run : rapport stdout (X prix ajustés, +Y% moyenne) |
| `npm run pricing:inflate -- --from YYYY --to YYYY+1 --write` | Génère `scripts/data/pricing-update-YYYY+1-jan.mjs` |

Catégories couvertes : Pain/céréales (CP0111), Viandes (CP0112), Poissons (CP0113), Lait/fromage/œufs (CP0114), Fruits (CP0116), Légumes (CP0117).

Ingrédients non catégorisés (épices, condiments, boissons) : **non modifiés** — à réviser manuellement si nécessaire.

Mapping source → catégorie : `scripts/data/eurostat-mapping.json`.
Tests unitaires : `src/test/unit/inflationPricing.test.js`.

### Métriques cibles

| Métrique | Excellent | Acceptable | À traiter |
|---|---:|---:|---:|
| Couverture corrigée (% sur produits achetables) | ≥ 90 % | 70-90 % | < 70 % |
| Moy de packs par ingrédient (FR) | ≥ 2 | 1.5-2 | < 1.5 |
| Sous-cats à 0 % couverture | 0 | 1-2 | ≥ 3 |

État au merge de la PR v3.44.0 : **93.5 %** corrigée FR, **2.01 packs/ingrédient FR**, **0 sous-cat à 0 %**. Toutes au-dessus du seuil "excellent".

## 🥬 Ingrédients — audit doublons

| Commande | Effet |
|---|---|
| `node scripts/audit-ingredient-duplicates.mjs` | Détecte les doublons singulier/pluriel + labels FR identiques |
| `node scripts/apply-ingredient-disambiguation.mjs` | Disambiguïse les labels (ex: « Carottes (surgelées) ») |

Workflow : audit → revue manuelle des paires détectées → fusion via éditions
ciblées dans `ingredients.js` + `nutrition.js` + migration SQL si BDD.

## 🛠️ Autres

| Commande | Effet | Doc |
|---|---|---|
| `npm run db:types` | Régénère `src/shared/types/database.ts` depuis Supabase | Cf. `gen-db-types.mjs` |
| `npm run migrate` | Push `src/shared/static/*.js (legacy)` vers Supabase (UPSERT idempotent) | Cf. `migrate-to-db.mjs` |
| `npm run og` | Génère l'image Open Graph | Cf. `generate-og.mjs` |
| `npm run pwa-icons` | Génère les icônes PWA | Cf. `generate-pwa-icons.mjs` |

## Conventions

- **ESM uniquement** (`.mjs`)
- **Imports dynamiques** : sur Windows, utiliser `pathToFileURL()` pour les imports d'absolute paths (cf. `generate-pricing-json.mjs`)
- **Idempotents** par défaut (relancer ne casse rien)
- **Read-only par défaut** : si un script modifie le filesystem, le mentionner explicitement dans son header JSDoc
- **Batches numérotés** : `scripts/data/pricing-batch-N-<year>.mjs` — N incrémental, ne jamais réutiliser un numéro
