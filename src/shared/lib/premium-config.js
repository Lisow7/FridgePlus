// Pilote l'activation du premium. false = mode « Launch Free » : aucun parcours
// d'achat, features premium teasées « Prochainement ».
//
// Réactiver le premium = passer VITE_PREMIUM_ENABLED=true dans les env vars
// Vercel + redéployer. Aucun revert de code. Variable build-time (inlinée par
// Vite, statiquement remplacée → le code mort est tree-shaké).
//
// hasPremiumAccess (useSubscription) n'est PAS affecté : admins/comped gardent
// l'accès pour tester les features en interne.
export const PREMIUM_ENABLED = import.meta.env.VITE_PREMIUM_ENABLED === 'true'
