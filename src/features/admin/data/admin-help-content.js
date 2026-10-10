// Guide admin complet. 14 sections documentées.
// Structure par section :
//   title, icon, badge (groupe), description,
//   sections[]  — { icon, title, body, risk: 'safe'|'caution'|'danger' }
//   workflow[]  — étapes recommandées dans l'ordre
//   tips[]?     — astuces pratiques (orange)
//   warnings[]? — points d'attention (rouge)
//   rgpd        — note RGPD spécifique à l'onglet

export const ADMIN_HELP = {

  // ── ACCUEIL ────────────────────────────────────────────────────────────────

  dashboard: {
    title: 'Tableau de bord',
    icon: '🏠',
    badge: 'Accueil',
    description: 'Point d\'entrée quotidien du panneau admin. Compteurs en temps réel, raccourcis cliquables vers chaque section de modération. Aucune action destructive depuis cet onglet.',
    sections: [
      {
        icon: '📊',
        title: 'KPI cards',
        body: 'Compteurs en temps réel : utilisateurs inscrits, recettes en attente, tickets ouverts, signalements actifs, ingrédients catalogués. Mis à jour à chaque ouverture du panneau admin.',
        risk: 'safe',
      },
      {
        icon: '🎯',
        title: 'Raccourcis de modération',
        body: 'Chaque KPI card est cliquable. Les indicateurs en orange signalent un backlog à traiter. Un clic ouvre directement l\'onglet concerné.',
        risk: 'safe',
      },
      {
        icon: '🔄',
        title: 'Bouton Rafraîchir',
        body: 'Recharge uniquement les KPI sans recharger toute l\'app. Utile en fin de session pour valider l\'impact des actions effectuées.',
        risk: 'safe',
      },
    ],
    workflow: [
      'Ouvrir le panneau admin',
      'Scanner les KPI en orange — ce sont les backlogs à traiter',
      'Cliquer sur la card prioritaire',
      'Traiter les items, puis revenir au dashboard pour vérifier les compteurs',
    ],
    tips: [
      'Commence toujours ta session ici pour avoir une vue d\'ensemble avant de plonger dans un onglet.',
      'Un KPI à zéro = aucune action requise dans cette section.',
    ],
    rgpd: 'Aucune donnée personnelle affichée sur le dashboard. Les compteurs sont agrégés et anonymisés.',
  },

  // ── CONTENU ────────────────────────────────────────────────────────────────

  base: {
    title: 'Recettes officielles',
    icon: '📚',
    badge: 'Contenu',
    description: 'Catalogue des recettes officielles Fridge+ (table `base_recipes`). Source de vérité visible par tous les utilisateurs, dans toutes les langues.',
    sections: [
      {
        icon: '📋',
        title: 'Liste et filtres',
        body: 'Toutes les recettes publiées. Filtres par type, difficulté et temps de préparation. Chaque recette indique son auteur original si issue d\'une promotion communautaire.',
        risk: 'safe',
      },
      {
        icon: '✏️',
        title: 'Éditer une recette',
        body: 'RecipeFormModal permet de modifier titre, description (5 langues), ingrédients, étapes, difficulté, type et photo. Les modifications sont immédiatement visibles de tous les utilisateurs.',
        risk: 'caution',
      },
      {
        icon: '⭐',
        title: 'Recettes promues',
        body: 'Les recettes issues de la communauté ont un original_author_id. À la suppression du compte auteur, ce champ devient NULL → mention "Auteur inconnu" côté user. L\'œuvre reste publiée.',
        risk: 'safe',
      },
      {
        icon: '🗑️',
        title: 'Soft-delete',
        body: 'Cache la recette du catalogue public, mais la conserve en BDD pour audit. Réversible côté BDD. Les favoris et notes existants ne sont pas supprimés.',
        risk: 'caution',
      },
    ],
    workflow: [
      'Filtrer par type / difficulté / temps pour trouver la recette',
      'Cliquer Éditer → vérifier les 5 langues (fr, en, es, de, ja)',
      'Sauvegarder → action tracée dans le journal',
      'Vérifier le rendu depuis l\'app utilisateur',
    ],
    tips: [
      'Pour qu\'une recette soit parfaite, remplis les champs dans les 5 langues avant publication.',
      'Les IDs ingrédients doivent correspondre exactement à la table `ingredients` — vérifie le préfixe de sous-catégorie.',
    ],
    warnings: [
      'Modifier le titre ou les ingrédients d\'une recette très utilisée peut perturber les favoris. Préfère corriger plutôt que renommer radicalement.',
    ],
    rgpd: 'Si un original_author_id est présent, l\'anonymisation automatique à la suppression du compte est gérée par le système. Aucune intervention manuelle requise.',
  },

  recipes: {
    title: 'Recettes communautaires',
    icon: '👥',
    badge: 'Contenu',
    description: 'Modération des recettes soumises par les utilisateurs (table `custom_recipes`). Flux principal pour valider, rejeter ou promouvoir le contenu généré par la communauté.',
    sections: [
      {
        icon: '⏳',
        title: 'File d\'attente',
        body: 'Recettes fraîchement publiées qui attendent validation. Badge rouge sur l\'onglet si backlog > 0. Triées par date de soumission, les plus anciennes en premier.',
        risk: 'safe',
      },
      {
        icon: '✅',
        title: 'Approuver',
        body: 'Rend la recette visible publiquement dans la communauté. Action tracée. Réversible — peut être rejetée ou supprimée ultérieurement.',
        risk: 'caution',
      },
      {
        icon: '❌',
        title: 'Rejeter avec raison',
        body: 'Cache la recette du public. La raison est obligatoire (audit log + notification auteur). Réversible — peut être approuvée si l\'auteur corrige et resoumet.',
        risk: 'caution',
      },
      {
        icon: '⭐',
        title: 'Promouvoir → catalogue officiel',
        body: 'Copie la recette dans base_recipes avec crédits auteur. Devient une recette officielle Fridge+. À réserver aux recettes exceptionnelles validées sur la durée.',
        risk: 'caution',
      },
      {
        icon: '💥',
        title: 'Supprimer définitivement',
        body: 'Hard-delete avec raison obligatoire. Cascade sur likes/étapes/commentaires. Irréversible — à réserver aux contenus gravement abusifs ou illégaux.',
        risk: 'danger',
      },
    ],
    workflow: [
      'Filtrer par "En attente" pour voir le backlog',
      'Lire la recette entière (description, ingrédients, étapes) comme un utilisateur',
      'Approuver si la recette est claire, correcte et originale',
      'Rejeter avec une raison précise si incomplète, spam ou inappropriée',
      'Promouvoir uniquement si la recette est exceptionnelle (rare)',
    ],
    tips: [
      'Critères d\'approbation : recette complète, réaliste, non dupliquée.',
      'Un rejet avec raison précise ("description incomplète", "étapes manquantes") aide l\'auteur à corriger.',
      'Tu peux éditer une recette approuvée depuis l\'onglet Recettes officielles — inutile de la rejeter pour corriger une faute.',
    ],
    warnings: [
      'Ne jamais approuver une recette contenant des allergènes non déclarés — vérifier la section ingrédients.',
      'Le hard-delete est irréversible. Préfère le rejet sauf pour contenu illégal avéré.',
    ],
    rgpd: 'L\'auteur est notifié de l\'approbation/rejet via le système de notifications. Le rejet sans raison peut donner lieu à une contestation — toujours documenter.',
  },

  reviews: {
    title: 'Avis recettes',
    icon: '⭐',
    badge: 'Contenu',
    description: 'Modération des notes (1-5 étoiles) et commentaires sur les recettes. Un avis masqué ne compte plus dans la moyenne affichée.',
    sections: [
      {
        icon: '🔍',
        title: 'Filtres & recherche',
        body: 'Filtre par statut (actif / masqué admin / supprimé auteur / tous) et par note (1 à 5 étoiles). Recherche dans le corps du commentaire, insensible à la casse.',
        risk: 'safe',
      },
      {
        icon: '🚩',
        title: 'Signalements ouverts',
        body: 'Les avis avec des signalements actifs ont une bordure rouge et un badge compteur. Traite-les en priorité — l\'auteur du signalement a une raison précise.',
        risk: 'safe',
      },
      {
        icon: '👁️',
        title: 'Masquer (soft-delete admin)',
        body: 'Retire l\'avis du calcul de la moyenne et du feed public. L\'auteur ne peut pas le restaurer (deleted_by_admin = true). Réversible uniquement par admin via BDD directe. Raison obligatoire.',
        risk: 'caution',
      },
      {
        icon: '💥',
        title: 'Supprimer définitivement',
        body: 'DELETE direct en BDD. Seul l\'audit log en conserve la trace. La moyenne recette est recalculée immédiatement. À réserver aux avis abusifs, spam ou injurieux.',
        risk: 'danger',
      },
    ],
    workflow: [
      'Vérifier en priorité les avis avec badge rouge (signalements actifs)',
      'Lire le commentaire et les raisons de signalement',
      'Masquer si le contenu est discutable mais pas injurieux',
      'Supprimer uniquement pour contenus clairement abusifs',
      'Fermer les tickets correspondants dans l\'onglet Signalements',
    ],
    tips: [
      'Un avis 1 étoile sans commentaire n\'est pas punissable — c\'est un droit de l\'utilisateur.',
      'Pour les récidivistes (même profil, plusieurs avis abusifs), combine masquage + Mute communauté.',
    ],
    warnings: [
      'Le hard-delete recalcule la moyenne en temps réel. Sur une recette avec peu d\'avis, l\'impact est immédiatement visible pour tous.',
    ],
    rgpd: 'L\'auteur n\'est pas notifié automatiquement d\'un masquage admin. Si nécessaire, utilise l\'onglet Support pour le contacter. Toute action est tracée dans le journal.',
  },

  // ── MODÉRATION ─────────────────────────────────────────────────────────────

  community: {
    title: 'Communauté',
    icon: '🗣️',
    badge: 'Modération',
    description: 'Modération des posts et réponses communautaires. Trois niveaux d\'action : masquer le contenu (Soft), supprimer définitivement (Hard), sanctionner l\'auteur (Mute). Chaque décision doit être proportionnée.',
    sections: [
      {
        icon: '👁️',
        title: 'Soft-delete (masquer)',
        body: 'Le post disparaît du feed public mais reste en BDD. L\'auteur ne peut pas le restaurer. Réversible côté admin. Idéal pour les contenus discutables, hors-sujet ou légers. Raison obligatoire.',
        risk: 'caution',
      },
      {
        icon: '💥',
        title: 'Hard-delete (purge définitive)',
        body: 'DELETE en BDD avec cascade : replies, likes et post supprimés. Irréversible. À réserver aux contenus gravement abusifs, illégaux ou spam massif. Raison obligatoire.',
        risk: 'danger',
      },
      {
        icon: '🔇',
        title: 'Mute (sanctionner l\'auteur)',
        body: 'Bloque l\'auteur de poster/commenter pendant 1j / 7j / 30j / permanent. Le contenu existant n\'est pas touché. L\'auteur conserve la lecture. Réversible (durée expirée ou admin lève le mute).',
        risk: 'caution',
      },
      {
        icon: '🚩',
        title: 'Badge signalements',
        body: 'Les posts avec signalements ouverts ont une bordure rouge et un badge compteur. Priorité absolue. Le badge disparaît quand les tickets sont marqués "resolved".',
        risk: 'safe',
      },
    ],
    workflow: [
      'Vérifier les posts avec badge rouge en priorité',
      'Lire le contenu intégral du post + ses réponses',
      'Choisir l\'action proportionnée : Soft pour discutable, Hard pour grave',
      'Pour les récidivistes : ajouter un Mute auteur',
      'Documenter la raison dans le champ obligatoire',
      'Fermer le(s) ticket(s) de signalement correspondant(s)',
    ],
    tips: [
      'Principe de proportionnalité : commence par Soft + Mute 1j avant d\'escalader vers Hard ou Mute permanent.',
      'Un Mute permanent se justifie par un historique répété, pas par un seul incident isolé.',
    ],
    warnings: [
      'Le hard-delete est irréversible. Les utilisateurs peuvent contester — avoir une raison documentée est indispensable.',
      'Muter sans raison documentée peut exposer Fridge+ à des contestations (liberté d\'expression).',
    ],
    rgpd: 'Les actions de modération sont tracées (action, raison, admin_id, cible) sans PII. En cas de demande RGPD de l\'utilisateur, le journal fournit la preuve de traitement légitime.',
  },

  reports: {
    title: 'Signalements',
    icon: '🚩',
    badge: 'Modération',
    description: 'Tickets de signalement de contenu émis par les utilisateurs. Workflow clair : open → in_progress → resolved. Chaque signalement pointe vers une ressource précise (recette, post, commentaire, user…).',
    sections: [
      {
        icon: '📥',
        title: 'Lire un signalement',
        body: 'Chaque ticket contient : type de cible (recipe, user, community_post, review…), ID de la ressource, raison (whitelist : spam, inappropriate, harassment, plagiarism, allergen_error, wrong_info, other) et commentaire libre de l\'auteur.',
        risk: 'safe',
      },
      {
        icon: '🔄',
        title: 'Changer le statut',
        body: 'Marquer "in_progress" pendant le traitement (signal à l\'équipe), "resolved" une fois l\'action de modération effectuée. Prévient les doublons si plusieurs admins sont actifs.',
        risk: 'safe',
      },
      {
        icon: '↗️',
        title: 'Traitement croisé',
        body: 'Un report community_post → aller dans Communauté agir sur le post. Un report review → aller dans Avis recettes. Un report user → aller dans Utilisateurs. Revenir ici pour fermer le ticket.',
        risk: 'safe',
      },
      {
        icon: '📦',
        title: 'Signalements groupés',
        body: 'Plusieurs reports sur la même cible → traiter en bloc. Un seul Soft/Hard/Mute sur le contenu suffit pour fermer tous les tickets. Filtrer par target_id pour voir le regroupement.',
        risk: 'safe',
      },
    ],
    workflow: [
      'Filtrer par statut "open" et trier par date',
      'Lire la raison + le commentaire de l\'utilisateur',
      'Marquer "in_progress", puis naviguer vers l\'onglet correspondant',
      'Appliquer la sanction proportionnée',
      'Revenir ici → marquer "resolved"',
    ],
    tips: [
      'Trie par target_id pour regrouper les signalements sur une même ressource.',
      'Un report "other" avec commentaire vide peut être du spam de signalement — note-le dans le journal.',
    ],
    warnings: [
      'Ne jamais fermer un signalement sans avoir vérifié le contenu cible. Un rapport peut être urgent (harcèlement, contenu illégal).',
    ],
    rgpd: 'Les raisons "harassment" et "inappropriate" peuvent impliquer des données sensibles dans le contenu ciblé. Traite-les avec priorité et discrétion.',
  },

  // ── UTILISATEURS ───────────────────────────────────────────────────────────

  users: {
    title: 'Utilisateurs',
    icon: '👤',
    badge: 'Utilisateurs',
    description: 'Consultation et gestion des comptes. Accès aux données d\'usage, sanctions (ban) et données sensibles soumises à audit RGPD obligatoire.',
    sections: [
      {
        icon: '🔍',
        title: 'Recherche et liste',
        body: 'Recherche par pseudo. Chaque ligne montre le pseudo, les badges Admin, accès spécial et Banni, et la date d\'inscription. L\'e-mail se révèle à la demande (données sensibles, ci-dessous).',
        risk: 'safe',
      },
      {
        icon: '🔒',
        title: 'Données sensibles (email / IP)',
        body: 'La consultation de l\'email ou de l\'IP nécessite de saisir une raison (obligatoire RGPD). Action tracée dans le journal avec ta session admin — visible par toute l\'équipe.',
        risk: 'caution',
      },
      {
        icon: '🚫',
        title: 'Bannir un compte',
        body: 'Une fenêtre demande un motif (une catégorie et des précisions, montrés à la personne) et une durée : 1 jour, 7 jours, 30 jours ou sans fin. La base coupe alors la session dans l\'heure et refuse la reconnexion jusqu\'à l\'échéance — reconnexion refusée, plus rien publié ni écrit au support. D\'ici là, la personne voit l\'écran « Compte suspendu » avec le motif et la date de fin. Son contenu reste en ligne (modère séparément si besoin). Réversible (« Débannir »). Dans l\'onglet Signalements, le bouton vise la personne qui a signalé, pas l\'auteur du contenu.',
        risk: 'caution',
      },
      {
        icon: '♻️',
        title: 'Compte supprimé par son propriétaire',
        body: 'Pendant 30 jours, c\'est la personne qui peut revenir : à sa prochaine connexion, elle choisit de récupérer son compte ou de confirmer la suppression. Passé ce délai, la tâche de nuit l\'anonymise (pseudo « suppr-… », bio, pays, allergènes, budgets et bannière vidés). L\'admin ne restaure pas un compte.',
        risk: 'caution',
      },
    ],
    workflow: [
      'Rechercher l\'utilisateur par son pseudo',
      'Consulter l\'historique (recettes, activité) pour contextualiser la situation',
      'Si données sensibles nécessaires → saisir une raison précise avant de les révéler',
      'Appliquer la sanction proportionnée au motif',
      'Documenter clairement dans la raison (servira en cas de contestation)',
    ],
    tips: [
      'Accès spécial : « Accorder » donne le Premium offert, sans échéance, jusqu\'au retrait (un abonnement Stripe actif est rendu au retrait). « Modifier le rôle ou la note » change sans révoquer ; une note vide l\'efface. Attribution et retrait s\'écrivent au journal.',
      'Avant de bannir, vérifie si une sourdine dans la communauté suffit pour des infractions légères.',
      'La date d\'inscription et le volume d\'activité aident à distinguer un troll d\'un utilisateur ayant fait une erreur.',
    ],
    warnings: [
      'Accéder aux données sensibles sans raison valide est une violation RGPD. Chaque consultation est tracée et horodatée.',
      'Un ban ne supprime pas le contenu. Si le contenu est problématique, traite-le séparément (onglets Communauté ou Avis).',
    ],
    rgpd: 'La consultation d\'email ou d\'IP est du traitement de données personnelles (RGPD Art. 6). La raison saisie justifie la base légale (intérêt légitime). Conservée 12 mois dans le journal.',
  },

  support: {
    title: 'Tickets de support',
    icon: '💬',
    badge: 'Utilisateurs',
    description: 'Conversations directes entre les utilisateurs et l\'équipe admin pour aide, bugs et suggestions. Distinct des "Signalements" qui concernent le contenu.',
    sections: [
      {
        icon: '📋',
        title: 'Liste des tickets',
        body: 'Triée par date de dernière activité. Badge non-lu sur les tickets avec messages utilisateur non lus côté admin. Filtre par type (help / bug / request) et statut.',
        risk: 'safe',
      },
      {
        icon: '💬',
        title: 'Fil de conversation',
        body: 'Thread complet avec messages user et réponses admin dans l\'ordre chronologique. L\'utilisateur reçoit une notification in-app à chaque réponse admin.',
        risk: 'safe',
      },
      {
        icon: '🏷️',
        title: 'Changer le statut',
        body: 'open = nouveau, in_progress = en traitement, closed = résolu. Marque "in_progress" dès que tu ouvres un ticket pour signaler à l\'équipe que tu t\'en occupes.',
        risk: 'safe',
      },
      {
        icon: '📝',
        title: 'Répondre',
        body: 'Réponse visible par l\'utilisateur dans son espace support. Reste précis, courtois, et propose une solution concrète ou un délai si la résolution prend du temps.',
        risk: 'caution',
      },
    ],
    workflow: [
      'Filtrer par badges non-lus en priorité',
      'Lire l\'intégralité du fil (ne pas sauter à la dernière ligne)',
      'Marquer "in_progress" avant de répondre',
      'Répondre avec précision — l\'utilisateur attend une vraie solution',
      'Fermer le ticket une fois résolu',
    ],
    tips: [
      'Un ticket de type "bug" avec étapes de reproduction mérite une réponse prioritaire.',
      'Pour les demandes de features, une réponse courte ("pris en note, pas de date prévue") vaut mieux que le silence.',
      'Si tu dois investiguer, réponds d\'abord pour confirmer la réception.',
    ],
    warnings: [
      'Ne jamais fermer un ticket sans avoir répondu — l\'utilisateur pense qu\'il est ignoré.',
    ],
    rgpd: 'Les tickets peuvent contenir des informations personnelles partagées volontairement. Ne les transmets pas en dehors du thread. Conservés 12 mois.',
  },

  // ── CATALOGUE ──────────────────────────────────────────────────────────────

  ingredients: {
    title: 'Ingrédients',
    icon: '🥕',
    badge: 'Catalogue',
    description: 'Gestion du catalogue complet des ingrédients (table `ingredients`). Chaque ingrédient a des labels i18n, des données nutritionnelles, des allergènes UE, une saisonnalité et des conditionnements grande surface.',
    sections: [
      {
        icon: '📋',
        title: 'Liste et filtres',
        body: 'Filtre par sous-catégorie (frz-, fr-, vg-, gp-, sp-, bk-) et tri par nom, ID ou sous-catégorie. La liste est la vue brute de la table `ingredients`.',
        risk: 'safe',
      },
      {
        icon: '✏️',
        title: 'Modifier un ingrédient',
        body: 'Labels (5 langues), nutrition pour 100g (kcal, protéines, glucides, lipides, fibres), 14 allergènes UE, régimes incompatibles, default_unit, seasonal_months, pack_size.',
        risk: 'caution',
      },
      {
        icon: '➕',
        title: 'Ajouter un ingrédient',
        body: 'Créer un ingrédient avec son ID (respecter le préfixe de sous-catégorie : frz-/fr-/vg-/gp-/sp-/bk-). L\'ID est immuable après création — le choisir avec soin.',
        risk: 'caution',
      },
      {
        icon: '🗑️',
        title: 'Supprimer un ingrédient',
        body: 'Soft-delete avec raison. L\'ingrédient disparaît du sélecteur recette mais reste en BDD. Les recettes existantes ne sont pas cassées.',
        risk: 'caution',
      },
      {
        icon: '🌍',
        title: 'Auto-i18n (stub)',
        body: 'Bouton de traduction automatique via DeepL — désactivé en production (clé DeepL Pro non provisionnée). Sera activé post-launch.',
        risk: 'safe',
      },
    ],
    workflow: [
      'Utiliser l\'onglet Qualité pour identifier les ingrédients incomplets',
      'Filtrer par sous-catégorie et ouvrir l\'ingrédient concerné',
      'Compléter : nutrition + allergènes + pack_size + seasonal_months',
      'Sauvegarder → régénérer les types TypeScript : npm run db:types',
    ],
    tips: [
      'Les préfixes d\'ID (frz-, fr-, vg-…) indiquent l\'emplacement dans le frigo — choisir le bon est critique.',
      'Un ingrédient sans pack_size n\'apparaîtra pas dans l\'estimation du panier.',
      'La saisonnalité (mois 1-12) active le filtre 🌱 dans l\'app utilisateur.',
    ],
    warnings: [
      'L\'ID d\'un ingrédient est utilisé dans les recettes existantes. Le modifier casserait toutes les recettes qui le référencent.',
      'Après toute modification BDD, toujours relancer `npm run db:types` pour garder les types TypeScript en sync.',
    ],
    rgpd: 'Les ingrédients ne contiennent pas de données personnelles. Leur impact RGPD est indirect via les préférences alimentaires (traitées côté profil utilisateur).',
  },

  quality: {
    title: 'Qualité des données',
    icon: '✅',
    badge: 'Catalogue',
    description: 'Vue d\'ensemble des ingrédients et recettes incomplets, détectés par les vues SQL `recipe_health_check` et `ingredient_health_check`. Outil de diagnostic uniquement — aucune action destructive.',
    sections: [
      {
        icon: '⚠️',
        title: 'Recettes signalées',
        body: 'Recettes sans description, sans étapes, sans traductions complètes, ou avec des ingrédients manquants. Chaque ligne indique précisément les champs problématiques.',
        risk: 'safe',
      },
      {
        icon: '🥕',
        title: 'Ingrédients signalés',
        body: 'Ingrédients sans label complet (5 langues), sans données nutritionnelles, sans pack_size ou sans saisonnalité. Drill-down vers le formulaire d\'édition en un clic.',
        risk: 'safe',
      },
      {
        icon: '🔄',
        title: 'Mise à jour en temps réel',
        body: 'Les vues SQL sont recalculées à chaque ouverture de l\'onglet. Pas de cache — ce que tu vois est l\'état actuel de la BDD.',
        risk: 'safe',
      },
    ],
    workflow: [
      'Ouvrir l\'onglet Qualité chaque semaine pour surveiller l\'état du catalogue',
      'Trier par type d\'issue (i18n manquante, nutrition, pack_size…)',
      'Cliquer sur un item → formulaire d\'édition pré-rempli s\'ouvre',
      'Compléter et sauvegarder → l\'item disparaît automatiquement de la liste',
    ],
    tips: [
      'Vise zéro ingrédient "sans nutrition" avant le launch public — la feature V5 en a besoin.',
      'Une session de 20 min par semaine suffit à maintenir un catalogue propre.',
    ],
    rgpd: 'Aucune donnée personnelle dans les vues de qualité. Ce sont exclusivement des champs produit.',
  },

  pricing: {
    title: 'Tarifs',
    icon: '💰',
    badge: 'Catalogue',
    description: 'Consultation et édition des prix estimés par conditionnement grande surface (fichier `pricing/<year>.json`). Workflow d\'édition via export JSON puis commit dans le repo.',
    sections: [
      {
        icon: '📊',
        title: 'Vue d\'ensemble',
        body: 'Liste tous les ingrédients avec leurs packs grande surface, la couverture par langue (FR/EN/ES/DE/JA) et les prix indicatifs. Filtrable par sous-catégorie et recherche texte.',
        risk: 'safe',
      },
      {
        icon: '✏️',
        title: 'Éditer les prix',
        body: 'PricingEditModal permet de modifier le prix par langue × conditionnement. Les modifications sont stockées en mémoire locale (non appliquées) jusqu\'au téléchargement du JSON.',
        risk: 'caution',
      },
      {
        icon: '⬇️',
        title: 'Télécharger pricing.json',
        body: 'Génère le fichier JSON consolidé avec toutes les modifications. L\'admin doit ensuite remplacer `src/shared/static/pricing/<year>.json` dans le repo et commiter.',
        risk: 'caution',
      },
      {
        icon: '↩️',
        title: 'Réinitialiser',
        body: 'Annule toutes les modifications non sauvegardées en mémoire. Le fichier source reste intact. Les modifications locales non téléchargées sont perdues.',
        risk: 'caution',
      },
    ],
    workflow: [
      'Filtrer par sous-catégorie ou rechercher l\'ingrédient à mettre à jour',
      'Cliquer Éditer → modifier les prix par langue × conditionnement',
      'Répéter pour tous les ingrédients à modifier (modifications restent en mémoire)',
      'Cliquer "Télécharger pricing.json" → enregistrer le fichier localement',
      'Remplacer `src/shared/static/pricing/<year>.json` dans le repo',
      'Commit + PR standard → les nouveaux prix sont en prod après merge',
    ],
    tips: [
      'Les prix sont indicatifs en € pour la France, pour l\'estimation du coût panier.',
      'Le JSON téléchargé contient tout le catalogue même si une seule ligne est modifiée. C\'est normal.',
      'Sources recommandées pour les prix : Open Prices (ODbL), drives des grandes enseignes, comparateurs alimentaires en ligne.',
    ],
    warnings: [
      'Ne pas modifier directement le fichier JSON dans le repo sans passer par l\'outil — les validations structurelles pourraient passer au travers.',
    ],
    rgpd: 'Le pricing ne contient aucune donnée personnelle. Les prix sont des données publiques de produits alimentaires.',
  },

  // ── SYSTÈME ────────────────────────────────────────────────────────────────

  journal: {
    title: 'Journal d\'audit',
    icon: '📜',
    badge: 'Système',
    description: 'Trace append-only de toutes les actions admin. Lecture seule, immuable. Conservé 12 mois puis purge automatique via pg_cron. Indispensable en cas de contestation RGPD ou litige.',
    sections: [
      {
        icon: '📋',
        title: 'Actions tracées',
        body: 'Modération des recettes, de la communauté et des avis, bannissements, accès spécial, consultations de données sensibles, modifications du catalogue, notifications envoyées ou retirées, bascules de fonctionnalités, anonymisations et effacements des tâches de nuit (et leurs échecs). Chaque action a un nom, vérifié par un test ; une action inconnue se range sous « Autres ».',
        risk: 'safe',
      },
      {
        icon: '🔍',
        title: 'Filtres',
        body: 'Par catégorie d\'action (Recettes, Utilisateurs, Données, Communauté, Modération, RGPD, Panneau, Autres) et par pseudo de l\'auteur (« contient »), sur tout le journal : le compte et les pages suivent le filtre. Pas de filtre par cible ni par date : pour une action ancienne, parcourir les pages.',
        risk: 'safe',
      },
      {
        icon: '🔒',
        title: 'Append-only (immuable)',
        body: 'Les lignes ne peuvent pas être modifiées ni supprimées (RLS strict en BDD). Garantie d\'intégrité pour tout audit légal. La purge à 12 mois est la seule suppression autorisée, automatique.',
        risk: 'safe',
      },
    ],
    workflow: [
      'Filtrer sur la période ou l\'action concernée',
      'Identifier l\'admin acteur et la cible (IDs)',
      'Lire la raison documentée lors de l\'action',
      'En cas de contestation, utiliser la trace comme preuve documentaire',
    ],
    tips: [
      'La recherche porte sur le pseudo de l\'AUTEUR de l\'action : pour les actions faites sur un compte, ouvre la ligne et lis sa cible.',
      'Si un admin n\'a pas documenté sa raison, le log existe mais est moins exploitable. Encourage à toujours remplir les champs.',
    ],
    rgpd: 'Le journal ne contient pas de PII (pas d\'email, pas d\'IP). Uniquement IDs internes, actions et raisons. Conservé 12 mois conformément à l\'obligation de traçabilité RGPD.',
  },

  notifications: {
    title: 'Notifications',
    icon: '🔔',
    badge: 'Système',
    description: 'Centre de gestion des notifications système. Surveillance des alertes automatiques et envoi de messages broadcast ou ciblés vers les utilisateurs.',
    sections: [
      {
        icon: '📋',
        title: 'Feed des notifications',
        body: 'Toutes les notifications système récentes : nouvelles inscriptions, tickets ouverts, signalements, recettes en attente. Filtre par type. Pagination par 30.',
        risk: 'safe',
      },
      {
        icon: '📣',
        title: 'Annonce broadcast',
        body: 'Message envoyé à TOUS les utilisateurs actifs, visible dans la cloche in-app. Types : Annonce (news) ou Maintenance (alerte temporaire). Expiration paramétrable (7j / 30j / 90j). Seul le titre français est obligatoire (sans anglais, le français s\'affiche à tous). L\'envoi demande une confirmation, et le bandeau dit si l\'envoi sur les téléphones a réussi, échoué ou est désactivé.',
        risk: 'caution',
      },
      {
        icon: '✉️',
        title: 'Message ciblé',
        body: 'Notification envoyée à un seul utilisateur via son UUID. Utile pour notifier de l\'approbation d\'une recette, d\'une modération ou d\'un suivi de support. Part sans confirmation : un seul destinataire, nommé.',
        risk: 'caution',
      },
      {
        icon: '🗑️',
        title: 'Supprimer une notification',
        body: 'Retirer une diffusion la retire de la cloche de TOUS ses destinataires (la base supprime tout le lot) ; retirer une alerte système ne retire que cette ligne. Une confirmation dit lequel des deux. Irréversible.',
        risk: 'danger',
      },
    ],
    workflow: [
      'Scanner le feed pour les alertes non traitées (recettes en attente, signalements)',
      'Pour une annonce : Envoyer → type Annonce → titre français (et anglais si possible) → expiration → confirmer l\'envoi à tous',
      'Pour un message ciblé : type Message ciblé → saisir UUID → rédiger le message',
      'Vérifier l\'aperçu avant envoi — une annonce partie ne se rattrape qu\'en la retirant pour tous',
    ],
    tips: [
      'Remplis aussi l\'anglais : sans lui, le titre français s\'affiche aux comptes en anglais.',
      'Expiration courte (7j) pour les alertes de maintenance, longue (90j) pour les annonces de nouveauté.',
    ],
    warnings: [
      'Un broadcast est envoyé instantanément à TOUS les utilisateurs actifs. Relis 2 fois avant d\'envoyer.',
      'Les UUID des utilisateurs se trouvent dans l\'onglet Utilisateurs (données sensibles) — trace l\'accès avant d\'envoyer un message ciblé.',
    ],
    rgpd: 'Les notifications ne contiennent pas de PII mais sont associées à des user_id. Chaque envoi et chaque retrait s\'écrivent au journal (« Notification envoyée », « Notification retirée »).',
  },

  features: {
    title: 'Fonctionnalités',
    icon: '⚙️',
    badge: 'Système',
    description: 'Interrupteurs de fonctionnalités : ils agissent en production, tout de suite, pour tous les visiteurs, sans redéploiement.',
    sections: [
      {
        icon: '🟢',
        title: 'En production',
        body: 'Les drapeaux qu\'un code lit vraiment : la carte « Bien démarrer » (onboarding_activation), l\'envoi sur les téléphones (push_notifications), la photo du ticket (receipt_scan). Basculer demande une confirmation qui nomme la fonctionnalité et l\'effet.',
        risk: 'danger',
      },
      {
        icon: '⏳',
        title: 'Prévues',
        body: 'Les drapeaux qu\'aucun code ne lit encore : les activer n\'a aucun effet visible, l\'onglet le signale.',
        risk: 'safe',
      },
      {
        icon: '📜',
        title: 'Trace',
        body: 'Chaque bascule s\'écrit au journal (« Fonctionnalité basculée ») par la base elle-même : le compte, la clé et le nouvel état — y compris depuis l\'éditeur SQL.',
        risk: 'safe',
      },
    ],
    workflow: [
      'Vérifier que la fonctionnalité est « En production » (sinon la bascule ne change rien)',
      'Basculer, lire la confirmation, confirmer',
      'Vérifier l\'effet sur le site dans une fenêtre privée ; en cas de souci, rebasculer',
    ],
    warnings: [
      'Couper receipt_scan retire l\'entrée du menu, mais la fonction serveur ne lit pas le drapeau : elle reste appelable.',
    ],
    rgpd: 'Les drapeaux ne contiennent aucune donnée personnelle ; la trace au journal porte l\'identifiant du compte qui a basculé.',
  },
}
