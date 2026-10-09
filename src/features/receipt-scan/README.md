# Feature `receipt-scan`

> Photographier un ticket de caisse pour proposer d'ajouter ses produits au frigo — **après
> relecture, jamais automatiquement**. (Code lu sur `dev` le 2026-10-05.)

## Le parcours
1. **`components/receipt-consent-screen.jsx`** — écran d'accord avant la photo : ce qui est lu, par
   qui (Google Cloud Vision), ce qui est gardé (seulement les noms d'ingrédients validés ; aucune
   photo conservée), et trois conseils de prise de vue.
2. La photo est compressée (`compressImageToBase64`, `@shared/lib/media/compress-image`) puis envoyée
   à la fonction edge **`scan-receipt`** par `lib/receipt-vision-client.js` (`scanReceiptImage`).
   Le vrai code d'erreur (dont `quota_exceeded`) est lu dans le CORPS de la réponse : le message de
   `FunctionsHttpError` est générique.
3. **`lib/receipt-line-parser.js`** reconstruit les lignes de produits à partir des blocs et des
   positions renvoyés (ni quantité, ni prix, ni conditionnement : décision produit).
4. **`lib/receipt-matcher.js`** (`matchReceiptLabels`) rapproche chaque libellé d'un ingrédient du
   catalogue (`@shared/lib/matching/ingredient-text-matcher`) : trouvés, ambigus, non reconnus.
5. **`components/receipt-review-panel.jsx`** — la relecture : choisir parmi les ambigus, ignorer,
   ajouter à la main, puis « Ajouter au frigo ».

## Où c'est branché
- Orchestration : `src/app/hooks/use-receipt-scan-flow.js` et `src/app/components/receipt-scan-overlays.jsx`.
- `ReceiptReviewPanel` n'est **pas** réexporté par `index.js` : son seul consommateur le charge en
  paresseux, et un réexport statique annulerait ce découpage.
- L'accord « scan de tickets » est une catégorie du bandeau de consentement (`receiptScan`).
