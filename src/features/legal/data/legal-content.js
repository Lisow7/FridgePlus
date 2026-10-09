import { PREMIUM_ENABLED } from '@shared/lib/premium-config'

// Contenu juridique structuré pour la page /legal.
//
// Format des blocs (rendus par LegalPage.jsx → renderBlock) :
//   - { type: 'p',        text: '…' }                    → paragraphe simple
//   - { type: 'list',     items: ['…', '…'] }            → liste à puces
//   - { type: 'h3',       text: '…' }                    → sous-titre niveau 3
//   - { type: 'citation', source: '…', text: '…' }       → encart citation de loi
//   - { type: 'note',     text: '…' }                    → encart note en orange
//
// Disclaimer général : ce contenu est une rédaction de référence basée
// sur les modèles publics (CNIL, RGPD, LCEN). Il sera relu par un
// professionnel du droit avant le lancement public officiel.
//
// Stratégie i18n : FR et EN complets (audience principale + universel),
// les autres langues (ES/DE/JA) reprennent EN par fallback avec une note
// indiquant qu'une traduction localisée arrive plus tard. Cohérent avec
// la phase pré-launch où l'on évite les frais de traduction juridique
// professionnelle tant que le contenu n'est pas figé.

const CONTACT_EMAIL = 'support@fridgeplus.app'

// Réponse à « le service est-il gratuit ? » — elle DÉPEND de l'état réel du
// premium, elle ne peut pas être écrite une fois pour toutes.
//
// Tant que `PREMIUM_ENABLED` est faux (mode « Launch Free »), aucun parcours
// d'achat n'existe : annoncer un abonnement « disponible » est simplement faux.
// Le défaut est devenu visible le 2026-08-19 en réunissant les deux FAQ sur
// `/faq` — la prise en main y dit « pour l'instant, tout est gratuit » trois
// centimètres au-dessus. Deux réponses de la même page se contredisaient.
//
// Même raison, même mécanique que le masquage de la section CGV dans
// `legal-page.jsx` : le drapeau est build-time, Vite inline la branche morte.
const GRATUIT_FR = PREMIUM_ENABLED
  ? 'Fridge+ propose un socle entièrement gratuit : gestion du frigo, découverte et filtrage de recettes, création de recettes, communauté. Une offre premium optionnelle (panier avancé, mode cuisine vocal, analyse des dépenses) est disponible sous forme d\'abonnement mensuel ou annuel. Dans les deux cas : aucune pub, aucune revente de données.'
  : 'Oui, entièrement. Gestion du frigo, découverte et filtrage de recettes, création de recettes, communauté : tout est accessible sans payer. Une offre premium (panier avancé, mode cuisine vocal, analyse des dépenses) est prévue, mais elle n\'est pas activée à ce jour — il n\'existe aucun moyen de payer quoi que ce soit sur Fridge+. Dans tous les cas : aucune pub, aucune revente de données.'

const GRATUIT_EN = PREMIUM_ENABLED
  ? 'Fridge+ has a fully free core: fridge management, recipe discovery and filtering, recipe creation, community. An optional premium subscription (advanced cart, voice cooking mode, spending analytics) is available on a monthly or annual basis. In both cases: no ads, no data resale.'
  : 'Yes, entirely. Fridge management, recipe discovery and filtering, recipe creation, community: everything is available at no cost. A premium tier (advanced cart, voice cooking mode, spending analytics) is planned but is not switched on yet — there is currently no way to pay for anything on Fridge+. Either way: no ads, no data resale.'

// ─── FR ─────────────────────────────────────────────────────────────────

const FR = {
  legal: {
    intro: 'Le service Fridge+ est actuellement en version pré-launch (phase de test fermée). Le statut juridique de l\'éditeur (auto-entrepreneur) est en cours de formalisation et sera finalisé avant le lancement public officiel. Les présentes mentions seront mises à jour à ce moment-là.',
    blocks: [
      { type: 'h3', text: 'Éditeur' },
      { type: 'p', text: 'Le service Fridge+ est édité à titre personnel par le porteur du projet, en France, en tant que personne physique non professionnelle. L\'identité complète et l\'adresse postale ne sont pas publiées sur ce site pour des raisons de protection de la vie privée — elles sont conservées par les hébergeurs et fournies aux autorités compétentes sur demande judiciaire, conformément à la loi.' },
      { type: 'p', text: 'Pour toute demande légale, RGPD, ou simple contact :' },
      { type: 'list', items: [`Adresse e-mail : ${CONTACT_EMAIL}`] },
      { type: 'citation', source: 'LCEN — Loi n°2004-575 du 21 juin 2004, Article 6 III-1', text: 'Les personnes physiques éditant à titre non professionnel un service de communication au public en ligne peuvent ne tenir à la disposition du public, pour préserver leur anonymat, que le nom, la dénomination ou la raison sociale et l\'adresse de leur hébergeur, sous réserve de lui avoir communiqué les éléments d\'identification personnelle.' },

      { type: 'h3', text: 'Directeur de la publication' },
      { type: 'p', text: 'Le porteur du projet, identifié ci-dessus.' },

      { type: 'h3', text: 'Hébergement web' },
      { type: 'p', text: 'L\'application web Fridge+ est hébergée par :' },
      { type: 'list', items: [
        'Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis',
        'Site web : https://vercel.com',
      ]},

      { type: 'h3', text: 'Hébergement des données utilisateur' },
      { type: 'p', text: 'Les données utilisateur (compte, recettes personnelles, communauté, panier, journal de cuisine) sont stockées par :' },
      { type: 'list', items: [
        'Supabase Inc., 970 Toa Payoh North #07-04, Singapore 318992',
        'Région d\'hébergement des données : Union européenne',
        'Site web : https://supabase.com',
      ]},

      { type: 'h3', text: 'Autres prestataires techniques' },
      { type: 'list', items: [
        'Resend (envoi d\'e-mails transactionnels) — Resend Inc., États-Unis',
        'Sentry (monitoring des erreurs applicatives) — Functional Software, Inc., États-Unis',
        'GitHub Pages (hébergement vitrine) — GitHub, Inc., États-Unis',
        'OpenAI, L.L.C. (États-Unis) — génération d\'images d\'illustration (modèle gpt-image-1, hors ligne, sans donnée personnelle), suggestions de substituts d\'ingrédients et modération automatique des contenus communautaires (modèle gpt-4o-mini). Données transmises lors de la modération : le texte public soumis par l\'utilisateur (recette, commentaire) ; aucune donnée n\'est utilisée pour entraîner les modèles. Site web : https://openai.com',
        'Google LLC / Apple Inc. — destinataires de l\'audio de la reconnaissance vocale, via l\'API Web Speech du navigateur (Google pour Chrome/Edge, Apple pour Safari), aux seules fins de transcription. Concerne l\'ajout d\'ingrédients par la voix (micro frigo, gratuit) ET les commandes vocales du mode cuisine (premium). La lecture vocale des étapes (synthèse vocale du navigateur) peut également utiliser une voix fournie par l\'éditeur du navigateur. Fridge+ ne conserve ni l\'audio, ni le texte transcrit. Traitement soumis à ton consentement (cf. Politique de confidentialité).',
        'Google LLC (Google Cloud Vision) — destinataire de la photo lors du scan d\'un ticket de caisse (reconnaissance de texte), aux seules fins d\'identifier les noms de produits. Concerne l\'ajout d\'ingrédients par photo de ticket (frigo, gratuit). Fridge+ ne conserve ni l\'image, ni le texte brut détecté — seuls les noms d\'ingrédients que tu valides sont ajoutés à ton frigo. Traitement soumis à ton consentement.',
        'Service push de ton navigateur (Google, Mozilla ou Apple selon le navigateur utilisé) — relais technique des notifications push (relance en cas d\'inactivité, annonces importantes, péremption des restes), activées ensemble via un seul réglage. Le contenu est chiffré de bout en bout : ce service ne peut pas le lire, mais reçoit l\'identifiant technique de ton abonnement (nécessaire à l\'acheminement). Traitement soumis à ton consentement (cf. Politique de confidentialité).',
      ]},
      { type: 'note', text: 'Le mode cuisine maintient l\'écran allumé (API Wake Lock du navigateur) pour rester lisible mains-libres pendant la préparation. Cette fonction n\'utilise ni ne collecte aucune donnée personnelle.' },
      { type: 'note', text: 'Les transferts de données vers les États-Unis sont encadrés par les Clauses Contractuelles Types (CCT) de la Commission européenne, conformément au Règlement (UE) 2016/679 (RGPD), Article 46.' },

      { type: 'h3', text: 'Sources de données' },
      { type: 'p', text: 'Les prix indicatifs affichés dans la fonctionnalité Panier sont calculés à partir de données publiques :' },
      { type: 'list', items: [
        'Eurostat HICP (Indices des prix à la consommation harmonisés) — Commission européenne. Données utilisées pour les indices d\'inflation alimentaire annuels par catégorie (France). Licence : Creative Commons Attribution 4.0 International (CC-BY 4.0). Source : https://ec.europa.eu/eurostat/web/hicp/data/database',
        'Open Prices (Open Food Facts) — base de données collaborative de prix alimentaires. Licence : Open Database License (ODbL) 1.0. Toute donnée dérivée affichée dans le panier reste sous cette licence. Source : https://prices.openfoodfacts.org',
        'Open Food Facts — base de données collaborative produits alimentaires (libellés, marques, allergènes, valeurs nutritionnelles). Licence base de données : ODbL 1.0 ; licence contenu : Creative Commons Attribution-ShareAlike 3.0 (CC-BY-SA 3.0). Source : https://world.openfoodfacts.org',
        'CIQUAL 2020 (ANSES, Agence nationale de sécurité sanitaire de l\'alimentation) — table de composition nutritionnelle des aliments. Données utilisées pour les valeurs nutritionnelles indicatives. Licence Ouverte / Open Licence 2.0 (Etalab). Source : https://ciqual.anses.fr',
        'USDA FoodData Central (Département de l\'Agriculture des États-Unis) — données nutritionnelles complémentaires. Domaine public (œuvre du gouvernement fédéral américain). Source : https://fdc.nal.usda.gov',
        'Relevés de prix de référence grande surface FR 2025-2026 — estimations internes basées sur les conventions grandes surfaces françaises.',
      ]},
      { type: 'note', text: 'Les prix affichés dans le panier sont des estimations indicatives. Ils ne constituent pas une offre commerciale et peuvent varier selon les enseignes, les régions et les périodes.' },

      { type: 'h3', text: 'Propriété intellectuelle' },
      { type: 'p', text: 'Le nom Fridge+, le logo, l\'identité visuelle et le code source non publié sont la propriété exclusive du porteur du projet. Toute reproduction, même partielle, sans autorisation écrite préalable est interdite (Code de la propriété intellectuelle, Article L.122-4).' },
      { type: 'p', text: 'Les recettes publiées par les utilisateurs dans la communauté restent leur propriété ; en les soumettant à la publication, ils accordent à l\'éditeur une licence non-exclusive, gratuite et mondiale pour les afficher dans le service.' },

      { type: 'h3', text: 'Ressources visuelles et open source' },
      { type: 'p', text: 'Fridge+ utilise des ressources tierces sous licence libre :' },
      { type: 'list', items: [
        'Microsoft Fluent Emoji — jeu d\'émojis et d\'icônes 3D utilisé dans l\'interface. © Microsoft. Licence MIT. Source : https://github.com/microsoft/fluentui-emoji',
      ]},
    ],
  },

  terms: {
    intro: 'Les présentes Conditions Générales d\'Utilisation (CGU) régissent l\'usage du service Fridge+ (ci-après « le Service »). En créant un compte ou en utilisant le Service, l\'utilisateur (« vous ») accepte sans réserve ces conditions.',
    blocks: [
      { type: 'h3', text: 'Description du service' },
      { type: 'p', text: 'Fridge+ est une application web gratuite qui aide à gérer le contenu de son frigo, à découvrir des recettes adaptées aux ingrédients disponibles, et à partager des recettes avec une communauté de cuisiniers amateurs. Le Service est accessible sans inscription pour les fonctions de base (gestion du frigo, consultation des recettes) ; un compte est nécessaire pour les fonctions avancées (favoris persistants, panier de courses, communauté).' },

      { type: 'h3', text: 'Conditions d\'accès' },
      { type: 'list', items: [
        'Âge minimum : 16 ans (conformément à l\'article 8 du RGPD pour le consentement seul). Les mineurs entre 13 et 15 ans peuvent utiliser le Service avec l\'autorisation explicite du titulaire de l\'autorité parentale.',
        'Disposer d\'une adresse e-mail valide pour la création d\'un compte.',
        'Accepter les présentes CGU et la Politique de confidentialité.',
      ]},

      { type: 'h3', text: 'Compte utilisateur' },
      { type: 'p', text: 'Chaque utilisateur est responsable de la confidentialité de son mot de passe et de toutes les actions effectuées depuis son compte. En cas de soupçon d\'utilisation frauduleuse, l\'utilisateur doit changer immédiatement son mot de passe et contacter l\'éditeur. L\'éditeur ne pourra être tenu responsable des dommages liés à l\'utilisation d\'un compte par un tiers ayant obtenu les identifiants.' },

      { type: 'h3', text: 'Contenu publié par les utilisateurs' },
      { type: 'p', text: 'Les utilisateurs peuvent publier des recettes dans la communauté Fridge+. En soumettant un contenu, l\'utilisateur garantit en être l\'auteur (ou disposer des droits de publication) et accorde à l\'éditeur une licence non-exclusive, gratuite et mondiale pour afficher, modérer et conserver ce contenu dans le cadre du Service.' },
      { type: 'p', text: 'Les recettes publiées sont soumises à une modération a priori : l\'éditeur valide ou refuse chaque proposition avant qu\'elle apparaisse publiquement. En cas de refus, l\'utilisateur reçoit une notification avec le motif.' },

      { type: 'h3', text: 'Contenu interdit' },
      { type: 'p', text: 'Sont strictement interdits :' },
      { type: 'list', items: [
        'Tout contenu illégal au regard de la loi française',
        'Les propos injurieux, diffamatoires, racistes, sexistes, homophobes ou discriminatoires',
        'Le harcèlement, les menaces, l\'incitation à la violence',
        'Les contenus à caractère pornographique ou choquant',
        'La promotion commerciale non sollicitée (spam)',
        'L\'usurpation d\'identité',
        'Toute violation de droits d\'auteur',
      ]},
      { type: 'citation', source: 'Règlement (UE) 2022/2065 (Digital Services Act) — Article 14', text: 'Les fournisseurs de services intermédiaires fournissent un mécanisme permettant à toute personne ou entité de signaler la présence d\'éléments spécifiques considérés comme des contenus illicites.' },
      { type: 'p', text: 'Le mécanisme de signalement est intégré dans le Service via le système de tickets support : tout utilisateur peut signaler un contenu en ouvrant un ticket de type « Signalement ».' },

      { type: 'h3', text: 'Usages interdits du Service' },
      { type: 'p', text: 'Outre les contenus interdits ci-dessus, sont strictement interdits sans autorisation écrite préalable de l\'éditeur :' },
      { type: 'list', items: [
        'L\'extraction, la copie ou la réutilisation systématique ou substantielle du contenu et des bases de données du Service (recettes de base, ingrédients, prix, données nutritionnelles), par tout moyen automatisé ou non (scraping, crawling, aspiration).',
        'Toute réutilisation à des fins commerciales du Service, de son contenu, de sa marque, de son identité visuelle ou de son code.',
        'La reproduction, l\'adaptation, la traduction ou le plagiat de tout ou partie du Service.',
        'L\'ingénierie inverse (reverse-engineering), la décompilation ou le contournement des mesures techniques de protection, sauf dans les limites impératives autorisées par la loi.',
        'L\'utilisation du Service pour développer un produit ou service concurrent.',
      ]},
      { type: 'citation', source: 'Code de la propriété intellectuelle — Article L.342-1 (droit du producteur de bases de données)', text: 'Le producteur de bases de données a le droit d\'interdire l\'extraction et la réutilisation de la totalité ou d\'une partie qualitativement ou quantitativement substantielle du contenu d\'une base de données.' },
      { type: 'p', text: 'La marque « Fridge+ », le logo, l\'identité visuelle, le code source et les recettes de base sont la propriété exclusive de l\'éditeur (cf. Mentions légales). Toute violation engage la responsabilité de son auteur.' },

      { type: 'h3', text: 'Modération et sanctions' },
      { type: 'p', text: 'En cas de violation des présentes CGU, l\'éditeur se réserve le droit, sans préavis et de manière proportionnée :' },
      { type: 'list', items: [
        'De masquer ou supprimer le contenu litigieux',
        'De mettre l\'utilisateur en sourdine temporaire de la communauté',
        'De suspendre ou supprimer le compte en cas de récidive ou de violation grave',
      ]},
      { type: 'p', text: 'Toutes les actions de modération sont enregistrées dans un journal d\'audit pour assurer la traçabilité.' },

      { type: 'h3', text: 'Limitation de responsabilité' },
      { type: 'p', text: 'Fridge+ est fourni « en l\'état », à titre informatif. Les recettes publiées (y compris celles intégrées par défaut) sont des suggestions culinaires : l\'éditeur ne garantit ni l\'absence d\'allergènes, ni l\'exactitude nutritionnelle, ni l\'adéquation à un régime médical particulier. Il appartient à l\'utilisateur de vérifier les ingrédients selon ses contraintes personnelles (allergies, intolérances, pathologies).' },
      { type: 'p', text: 'Les prix affichés dans le panier sont des estimations indicatives issues de données publiques (cf. Mentions légales) ; ils ne constituent pas une offre commerciale et peuvent varier selon les enseignes, régions et périodes. L\'éditeur ne saurait être tenu responsable d\'une décision d\'achat fondée sur ces seules estimations.' },
      { type: 'p', text: 'L\'éditeur s\'efforce d\'assurer la disponibilité du Service mais ne peut garantir un accès ininterrompu (maintenance, panne d\'hébergeur, cas de force majeure).' },

      { type: 'h3', text: 'Modification des CGU' },
      { type: 'p', text: 'Les présentes CGU peuvent être modifiées à tout moment. En cas de modification substantielle, les utilisateurs connectés sont informés au moins 30 jours avant l\'entrée en vigueur, par notification dans l\'application et/ou par e-mail. La poursuite de l\'utilisation du Service après cette période vaut acceptation des nouvelles CGU.' },

      { type: 'h3', text: 'Droit applicable et juridiction' },
      { type: 'p', text: 'Les présentes CGU sont régies par le droit français. En cas de litige, les parties s\'efforceront de trouver une solution amiable. À défaut, les tribunaux français seront seuls compétents.' },

      { type: 'note', text: 'Les présentes CGU s\'appliquent à l\'ensemble du Service, incluant le socle gratuit et l\'offre premium. Les modalités spécifiques à l\'abonnement premium (tarifs, droit de rétractation, remboursement, médiation) sont détaillées dans les Conditions Générales de Vente (CGV).' },
    ],
  },

  cgv: {
    intro: 'Les présentes Conditions Générales de Vente (CGV) régissent la souscription à l\'offre premium Fridge+ (ci-après « le Service Premium »). Tout achat d\'abonnement implique l\'acceptation sans réserve des présentes CGV.',
    blocks: [
      { type: 'h3', text: 'Identification de l\'éditeur' },
      { type: 'list', items: [
        'Raison sociale : [À COMPLÉTER AVANT LAUNCH — statut auto-entrepreneur en cours de formalisation]',
        'SIRET : [À COMPLÉTER AVANT LAUNCH]',
        'Adresse : [À COMPLÉTER AVANT LAUNCH]',
        `Contact : ${CONTACT_EMAIL}`,
      ]},
      { type: 'note', text: 'L\'identité complète de l\'éditeur (raison sociale, SIRET, adresse) sera publiée avant le lancement public officiel et la mise en service du paiement en ligne.' },

      { type: 'h3', text: 'Description de l\'offre premium' },
      { type: 'p', text: 'L\'abonnement Fridge+ Premium débloque les fonctionnalités suivantes :' },
      { type: 'list', items: [
        'Panier de courses avancé : export, partage, coûts estimés par recette et par semaine',
        'Mode cuisine vocal avancé : commandes vocales étendues, reconnaissance multi-ingrédients',
        'Analyse des dépenses alimentaires : historique, tendances, budget mensuel',
        'Fonctions anti-gaspillage : alertes DLC, suggestions d\'utilisation des restes',
      ]},
      { type: 'p', text: 'Fonctionnalités gratuites maintenues pour tous les utilisateurs, premium ou non :' },
      { type: 'list', items: [
        'Gestion du frigo (stock d\'ingrédients)',
        'Découverte et filtrage des recettes',
        'Création et partage de recettes dans la communauté',
        'Support tickets',
      ]},

      { type: 'h3', text: 'Tarifs' },
      { type: 'citation', source: 'Code de la consommation — Article L111-1', text: 'Avant que le consommateur ne soit lié par un contrat à titre onéreux, le professionnel lui communique, de manière lisible et compréhensible : les caractéristiques essentielles du bien ou du service et le prix TTC.' },
      { type: 'list', items: [
        'Formule mensuelle : 4,99 € TTC / mois (TVA 20 % incluse)',
        'Formule annuelle : 34,99 € TTC / an (soit environ 2,92 € / mois — économie de 30 %)',
        'Période d\'essai : 7 jours gratuits avec enregistrement de coordonnées bancaires, annulable avant le terme sans facturation',
      ]},

      { type: 'h3', text: 'Modalités de paiement' },
      { type: 'p', text: 'Le paiement s\'effectue par carte bancaire (Visa, Mastercard, CB) via la solution sécurisée Stripe. La transaction est chiffrée (TLS) et conforme aux normes PCI-DSS. Aucune donnée de carte bancaire n\'est transmise à ou stockée par Fridge+ — Stripe est responsable de traitement pour ces données (cf. Politique de confidentialité).' },

      { type: 'h3', text: 'Durée et renouvellement' },
      { type: 'p', text: 'L\'abonnement est souscrit pour une durée d\'un mois ou d\'un an selon la formule choisie. Il est renouvelé tacitement à chaque échéance par prélèvement automatique.' },
      { type: 'citation', source: 'Code de la consommation — Article L215-1 (Loi Chatel)', text: 'Le professionnel prestataire de services informe le consommateur par écrit, au plus tôt trois mois et au plus tard un mois avant le terme de la période autorisant le rejet de la reconduction, de la possibilité de ne pas reconduire le contrat qu\'il a conclu avec une clause de reconduction tacite.' },
      { type: 'p', text: 'Conformément à cet article, un e-mail de rappel est envoyé au moins 30 jours avant chaque renouvellement annuel.' },

      { type: 'h3', text: 'Droit de rétractation' },
      { type: 'citation', source: 'Code de la consommation — Article L221-18', text: 'Le consommateur dispose d\'un délai de quatorze jours pour exercer son droit de rétractation d\'un contrat conclu à distance, sans avoir à motiver sa décision ni à supporter d\'autres coûts que ceux prévus aux articles L221-23 à L221-25.' },
      { type: 'p', text: 'Vous disposez de 14 jours à compter de la souscription pour vous rétracter, sans justification. Pour l\'exercer : contactez le support in-app ou l\'adresse e-mail ci-dessus.' },
      { type: 'note', text: 'Exception accès immédiat (Art. L221-28 2°) : si vous demandez expressément l\'accès immédiat au Service Premium avant l\'expiration du délai de rétractation, vous reconnaissez perdre ce droit dès l\'activation. Cette renonciation fait l\'objet d\'une case à cocher explicite lors de la souscription — elle n\'est jamais pré-cochée.' },

      { type: 'h3', text: 'Résiliation' },
      { type: 'p', text: 'Vous pouvez résilier votre abonnement à tout moment depuis votre profil → Abonnement → Annuler mon abonnement. La résiliation prend effet à la fin de la période en cours. Aucun remboursement au prorata n\'est accordé au-delà du délai de rétractation de 14 jours.' },

      { type: 'h3', text: 'Remboursements' },
      { type: 'list', items: [
        'Dans les 14 jours suivant la souscription, si vous n\'avez pas demandé l\'accès immédiat : remboursement intégral, sans frais.',
        'Au-delà de 14 jours : aucun remboursement, sauf cas exceptionnel apprécié souverainement par l\'éditeur.',
        'Période d\'essai : aucune facturation si annulation avant le terme des 7 jours.',
      ]},

      { type: 'h3', text: 'Médiation de la consommation' },
      { type: 'citation', source: 'Code de la consommation — Article L612-1', text: 'Tout professionnel vendeur de biens ou prestataire de services a l\'obligation de proposer à tout consommateur, en vue de la résolution amiable de tout litige, un dispositif de médiation de la consommation.' },
      { type: 'p', text: 'En cas de litige relatif à votre abonnement non résolu par notre support, vous pouvez recourir gratuitement à la médiation de la consommation. L\'éditeur désignera son médiateur agréé avant l\'ouverture du paiement.' },
      { type: 'note', text: '[À COMPLÉTER AVANT LAUNCH — Coordonnées du médiateur de la consommation désigné]. Liste des médiateurs agréés : https://www.economie.gouv.fr/mediation-conso' },

      { type: 'h3', text: 'Droit applicable et juridiction' },
      { type: 'p', text: 'Les présentes CGV sont régies par le droit français. En cas de litige non résolu par la médiation, le tribunal compétent sera celui du domicile du consommateur (ou à défaut, le Tribunal de Commerce de [Ville — À COMPLÉTER AVANT LAUNCH]).' },
      { type: 'note', text: 'Date d\'entrée en vigueur : ces conditions seront finalisées et datées avant la mise en service du paiement.' },
    ],
  },

  privacy: {
    intro: 'Cette politique décrit comment Fridge+ collecte, utilise et protège tes données personnelles. Elle est rédigée conformément au Règlement (UE) 2016/679 (RGPD) et à la Loi Informatique et Libertés (n°78-17 du 6 janvier 1978 modifiée).',
    blocks: [
      { type: 'h3', text: 'Responsable du traitement' },
      { type: 'p', text: `Le responsable du traitement des données personnelles est l'éditeur du Service (cf. section Mentions légales). En l'absence de Délégué à la Protection des Données (DPO) — non obligatoire pour ce niveau de traitement — toute demande RGPD peut être adressée à : ${CONTACT_EMAIL}.` },

      { type: 'h3', text: 'Données collectées' },
      { type: 'p', text: 'Selon ton usage du Service, les données suivantes peuvent être collectées :' },
      { type: 'list', items: [
        'Données de compte : adresse e-mail, mot de passe (haché avec bcrypt, jamais stocké en clair), pseudonyme, avatar (image au choix parmi une bibliothèque)',
        'Données fonctionnelles : ingrédients dans ton frigo, recettes favorites, recettes personnelles que tu crées, panier de courses, restes alimentaires, journal de cuisine',
        'Préférences : langue, mode clair/sombre, préférences allergènes',
        'Données de communauté : posts, réponses, signalements (si tu participes)',
        'Données de support : tickets que tu ouvres, historique des échanges avec l\'équipe',
        'Données techniques : adresse IP, type de navigateur, système d\'exploitation (logs de sécurité, conservés 12 mois)',
      ]},

      { type: 'h3', text: 'Finalités et bases légales' },
      { type: 'citation', source: 'RGPD — Article 6.1', text: 'Le traitement n\'est licite que si, et dans la mesure où, au moins une des conditions suivantes est remplie [base légale a) à f)].' },
      { type: 'list', items: [
        'Authentification et gestion du compte → exécution du contrat (Art. 6.1.b)',
        'Stockage de tes recettes, favoris, frigo, panier → exécution du contrat',
        'Traitement des paiements et gestion des abonnements premium (Stripe) → exécution du contrat (Art. 6.1.b)',
        'Modération de la communauté et tickets support → exécution du contrat + intérêt légitime de l\'éditeur (Art. 6.1.f)',
        'Notifications applicatives (réponses support, validation de recettes) → exécution du contrat',
        'Notifications push natives (relance inactivité, annonces importantes, péremption des restes) → consentement (Art. 6.1.a), un seul opt-in couvrant les 3 usages (pas de granularité par catégorie à ce stade)',
        'Cookies essentiels (authentification, préférences linguistiques) → intérêt légitime, non soumis au consentement',
        'Logs de sécurité, prévention de fraude → intérêt légitime',
        'E-mails transactionnels (confirmation, réinitialisation de mot de passe, renouvellement abonnement) → exécution du contrat',
      ]},
      { type: 'note', text: 'Aucune donnée n\'est utilisée à des fins de profilage publicitaire. Aucun cookie analytics tiers (Google Analytics, Meta Pixel, etc.) n\'est posé sans ton consentement explicite.' },

      { type: 'h3', text: 'Sous-traitants (RGPD Article 28)' },
      { type: 'p', text: 'Pour fonctionner, Fridge+ s\'appuie sur les sous-traitants suivants, dans le cadre d\'accords de traitement de données (DPA) lorsqu\'applicable :' },
      { type: 'list', items: [
        'Supabase Inc. (Singapour, données hébergées en Union européenne) : authentification, base de données, fonctions edge',
        'Vercel Inc. (États-Unis) : hébergement de l\'application web',
        'Resend Inc. (États-Unis) : envoi des e-mails transactionnels',
        'Sentry / Functional Software, Inc. (États-Unis) : monitoring des erreurs applicatives',
        'Stripe, Inc. (États-Unis) : traitement des paiements de l\'abonnement premium — e-mail, montant, devise, pays. Les données de carte bancaire sont traitées et stockées par Stripe en tant que responsable de traitement ; elles ne sont jamais transmises à Fridge+.',
        'OpenAI, L.L.C. (États-Unis) : suggestions de substituts d\'ingrédients et modération automatique des contenus communautaires. Le texte public soumis est transmis pour analyse ; aucune donnée n\'entraîne les modèles. Accord de traitement de données (DPA) avec ce sous-traitant pas encore en place.',
        'Google LLC / Apple Inc. (États-Unis) : transcription de la reconnaissance vocale (micro frigo gratuit + commandes du mode cuisine) et synthèse vocale (lecture des étapes), via l\'API Web Speech du navigateur, sur consentement. Aucun audio ni texte conservé par Fridge+.',
        'Google LLC (Google Cloud Vision, USA) : reconnaissance de texte sur une photo de ticket de caisse, sur consentement. Aucune image ni texte brut conservé par Fridge+.',
        'Google LLC / Mozilla Foundation / Apple Inc. (selon le navigateur utilisé) : relais technique des notifications push (contenu chiffré de bout en bout, illisible par ces services), sur consentement. Statut exact de sous-traitant Art. 28 non tranché à ce jour (pas de contrat/DPA direct, le navigateur agissant pour le compte de l\'utilisateur) — point à confirmer avec le juriste.',
      ]},
      { type: 'p', text: 'Les transferts hors Union européenne sont encadrés par les Clauses Contractuelles Types adoptées par la Commission européenne (RGPD Article 46.2.c).' },

      { type: 'h3', text: 'Durées de conservation' },
      { type: 'list', items: [
        'Compte actif : conservé tant que le compte n\'est pas supprimé',
        'Compte inactif (sans connexion pendant 3 ans) : un e-mail de relance est envoyé ; sans réponse sous 30 jours, le compte est anonymisé puis supprimé',
        'Compte supprimé : anonymisation immédiate des recettes communauté publiées (l\'auteur devient « Utilisateur supprimé ») ; suppression définitive des données personnelles sous 30 jours',
        'Données de facturation (historique transactions, statut abonnement) : 10 ans conformément à l\'Article L123-22 du Code de commerce (obligation comptable — prime sur le droit à l\'effacement RGPD Art. 17.3.b)',
        'Tickets support fermés : 3 ans après la dernière interaction',
        'Logs de sécurité (IP, user-agent) : 12 mois',
        'Sauvegardes chiffrées : 30 jours',
        'Cookies analytiques (si tu donnes ton consentement) : 13 mois maximum, conformément à la recommandation CNIL',
      ]},

      { type: 'h3', text: 'Tes droits (RGPD Articles 15 à 22)' },
      { type: 'p', text: 'Tu disposes des droits suivants sur tes données personnelles :' },
      { type: 'list', items: [
        'Droit d\'accès : obtenir une copie de toutes les données te concernant (export disponible depuis ton profil)',
        'Droit de rectification : corriger toute donnée inexacte ou incomplète',
        'Droit à l\'effacement (« droit à l\'oubli ») : supprimer ton compte et toutes les données associées',
        'Droit à la limitation du traitement',
        'Droit d\'opposition au traitement basé sur l\'intérêt légitime',
        'Droit à la portabilité : recevoir tes données dans un format structuré (JSON), pour les transférer à un autre service',
        'Droit de retirer ton consentement à tout moment (cookies non essentiels)',
        'Droit de définir des directives sur le sort de tes données après ton décès',
      ]},
      { type: 'p', text: `Pour exercer ces droits, contacte ${CONTACT_EMAIL}. Une réponse te sera apportée sous 1 mois maximum (RGPD Article 12.3).` },
      { type: 'p', text: 'Si tu estimes que tes droits ne sont pas respectés, tu peux introduire une réclamation auprès de l\'autorité de contrôle compétente. En France, la procédure de réclamation se fait directement en ligne sur le site de la Commission Nationale de l\'Informatique et des Libertés : www.cnil.fr.' },

      { type: 'h3', text: 'Mesures de sécurité' },
      { type: 'p', text: 'Les mesures techniques et organisationnelles suivantes sont mises en œuvre pour protéger tes données :' },
      { type: 'list', items: [
        'Chiffrement des communications en transit (TLS/HTTPS) sur l\'ensemble du Service ; sauvegardes chiffrées au repos',
        'Mots de passe protégés par un algorithme de hachage reconnu par l\'industrie (jamais stockés en clair)',
        'Politiques de contrôle d\'accès strictes au niveau de la base de données : un utilisateur ne peut accéder qu\'à ses propres données',
        'Double authentification disponible pour les comptes à privilèges',
        'Journal d\'audit immuable des actions sensibles (modération, suppression de comptes)',
        'Sauvegardes chiffrées avec procédure de restauration régulièrement testée',
        'Surveillance continue des erreurs applicatives par un prestataire spécialisé',
        'Politiques de moindre privilège, segmentation des environnements (production / pré-production)',
      ]},
      { type: 'note', text: 'Conformément aux recommandations de la CNIL et de l\'ANSSI, certains détails techniques d\'implémentation (algorithmes précis, versions, architecture interne, régions exactes) ne sont volontairement pas publiés ici afin de ne pas faciliter le travail d\'éventuels attaquants. Ils sont documentés en interne et communiqués aux autorités compétentes (CNIL, ANSSI, services judiciaires) sur demande légale ou en cas d\'incident de sécurité (RGPD Article 33 — notification de violation sous 72 heures).' },

      { type: 'h3', text: 'Cookies' },
      { type: 'p', text: 'Le Service utilise un nombre minimal de cookies. Les détails par catégorie sont disponibles dans la modale « Cookies » accessible depuis le pied de page :' },
      { type: 'list', items: [
        'Cookies strictement nécessaires (authentification, préférences linguistiques, panier de session) : posés sans consentement, conformément à la directive ePrivacy et à la délibération CNIL 2020-091',
        'Aucun cookie de mesure d\'audience ou publicitaire n\'est posé sans consentement explicite.',
      ]},
    ],
  },

  faq: {
    intro: 'Réponses aux questions les plus fréquentes sur Fridge+. Si ta question n\'apparaît pas ici, contacte le support depuis ton compte ou écris à ' + CONTACT_EMAIL + '.',
    blocks: [
      { type: 'h3', text: 'Le service est-il gratuit ?' },
      { type: 'p', text: GRATUIT_FR },

      { type: 'h3', text: 'Pourquoi me demander un e-mail pour créer un compte ?' },
      { type: 'p', text: 'L\'e-mail sert à : (1) sécuriser ton compte (réinitialisation de mot de passe), (2) t\'envoyer les notifications importantes (réponses support, validation de recettes), (3) confirmer l\'inscription. Il n\'est jamais partagé avec des tiers à des fins commerciales.' },

      { type: 'h3', text: 'Comment supprimer mon compte ?' },
      { type: 'p', text: 'Va dans ton profil → onglet « Confidentialité » → bouton « Supprimer mon compte ». Une confirmation t\'est demandée. La suppression est immédiate côté UI. Côté serveur, les données personnelles sont anonymisées tout de suite, puis définitivement effacées sous 30 jours (sauvegardes incluses).' },

      { type: 'h3', text: 'Comment exporter mes données ?' },
      { type: 'p', text: 'Profil → onglet « Confidentialité » → bouton « Exporter mes données ». Tu reçois un fichier JSON contenant tout ce qui te concerne : compte, recettes, favoris, frigo, panier, journal, tickets support. Conforme au droit à la portabilité (RGPD Art. 20).' },

      { type: 'h3', text: 'Mes recettes sont-elles publiques par défaut ?' },
      { type: 'p', text: 'Non. Les recettes que tu crées sont privées par défaut. Si tu coches « Publier en ligne » lors de la création, ta recette est soumise à la modération avant publication dans la communauté.' },

      { type: 'h3', text: 'Que se passe-t-il quand je supprime un compte qui a publié des recettes ?' },
      { type: 'p', text: 'Tes recettes publiées dans la communauté restent visibles (elles sont utiles aux autres utilisateurs), mais leur auteur devient « Utilisateur supprimé ». Tes recettes privées et tes favoris sont supprimés. Aucune donnée personnelle (e-mail, pseudo, IP) n\'est conservée.' },

      { type: 'h3', text: 'Comment activer la double authentification ?' },
      { type: 'p', text: 'La double authentification (TOTP) est actuellement disponible pour les comptes administrateurs depuis le profil → Sécurité. Elle sera étendue à tous les comptes dans une future mise à jour.' },

      { type: 'h3', text: 'Comment signaler un contenu inapproprié dans la communauté ?' },
      { type: 'p', text: 'Sur tout post ou réponse, un bouton « Signaler » ouvre un ticket de type Signalement vers l\'admin. Conforme au Digital Services Act (DSA, Art. 14). Le contenu est revu sous 48h en moyenne.' },

      { type: 'h3', text: 'Le service est-il accessible aux mineurs ?' },
      { type: 'p', text: 'L\'âge minimum est 16 ans (RGPD France). Les 13-15 ans peuvent utiliser le service avec l\'autorisation explicite d\'un parent (art. 8 RGPD). En dessous de 13 ans, le service n\'est pas autorisé.' },

      { type: 'h3', text: 'Comment contacter l\'équipe ?' },
      { type: 'p', text: `Le plus rapide : ouvrir un ticket de support depuis ton compte (icône en haut à droite). Sinon : ${CONTACT_EMAIL}.` },
    ],
  },
}

// ─── EN ─────────────────────────────────────────────────────────────────

const EN = {
  legal: {
    intro: 'The Fridge+ service is currently in pre-launch (private testing phase). The publisher\'s legal status (auto-entrepreneur in France) is being formalized and will be finalized before the official public launch. This page will be updated at that time.',
    blocks: [
      { type: 'h3', text: 'Publisher' },
      { type: 'p', text: 'Fridge+ is published on a personal basis by the project owner, based in France, as a non-professional natural person. The full identity and postal address are not published on this site for privacy reasons — they are kept by the hosting providers and disclosed to authorities upon judicial request, in accordance with French law.' },
      { type: 'p', text: 'For any legal, GDPR or general inquiry:' },
      { type: 'list', items: [`E-mail: ${CONTACT_EMAIL}`] },
      { type: 'citation', source: 'French LCEN — Law n°2004-575 of June 21, 2004, Article 6 III-1', text: 'Natural persons who edit a non-professional online communication service may, in order to preserve their anonymity, only make available to the public the name, designation or corporate name and address of their hosting provider, provided that they have communicated personal identification details to said hosting provider.' },

      { type: 'h3', text: 'Publication director' },
      { type: 'p', text: 'The project owner identified above.' },

      { type: 'h3', text: 'Web hosting' },
      { type: 'p', text: 'The Fridge+ web application is hosted by:' },
      { type: 'list', items: [
        'Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, USA',
        'Website: https://vercel.com',
      ]},

      { type: 'h3', text: 'User data hosting' },
      { type: 'p', text: 'User data (account, personal recipes, community, cart, cooking journal) is stored by:' },
      { type: 'list', items: [
        'Supabase Inc., 970 Toa Payoh North #07-04, Singapore 318992',
        'Data hosting region: European Union',
        'Website: https://supabase.com',
      ]},

      { type: 'h3', text: 'Other technical providers' },
      { type: 'list', items: [
        'Resend (transactional emails) — Resend Inc., USA',
        'Sentry (application error monitoring) — Functional Software, Inc., USA',
        'GitHub Pages (showcase hosting) — GitHub, Inc., USA',
        'OpenAI, L.L.C. (USA) — illustration image generation (gpt-image-1 model, offline, no personal data), ingredient substitute suggestions and automatic moderation of community content (gpt-4o-mini model). Data sent during moderation: the public text submitted by the user (recipe, comment); no data is used to train the models. Website: https://openai.com',
        'Google LLC / Apple Inc. — recipients of voice recognition audio, via the browser Web Speech API (Google for Chrome/Edge, Apple for Safari), solely for transcription. Covers adding ingredients by voice (fridge mic, free) AND cooking mode voice commands (premium). Reading steps aloud (browser speech synthesis) may also use a voice provided by the browser vendor. Fridge+ keeps neither audio nor transcribed text. Processing subject to your consent (see Privacy Policy).',
        'Google LLC (Google Cloud Vision) — recipient of the photo when scanning a receipt (text recognition), solely to identify product names. Covers adding ingredients via receipt photo (fridge, free). Fridge+ keeps neither the image nor the raw detected text — only the ingredient names you confirm are added to your fridge. Processing subject to your consent.',
        'Your browser\'s push service (Google, Mozilla, or Apple depending on the browser used) — technical relay for push notifications (inactivity reminders, important announcements, leftover expiry alerts), enabled together via a single setting. The content is end-to-end encrypted: this service cannot read it, but receives the technical identifier of your subscription (needed for delivery). Processing subject to your consent (see Privacy Policy).',
      ]},
      { type: 'note', text: 'Cooking mode keeps the screen on (browser Wake Lock API) to stay readable hands-free while cooking. This feature uses and collects no personal data.' },
      { type: 'note', text: 'Data transfers to the United States are governed by the Standard Contractual Clauses (SCCs) of the European Commission, in accordance with Regulation (EU) 2016/679 (GDPR), Article 46.' },

      { type: 'h3', text: 'Data Sources' },
      { type: 'p', text: 'Indicative prices displayed in the Basket feature are calculated from public data:' },
      { type: 'list', items: [
        'Eurostat HICP (Harmonised Index of Consumer Prices) — European Commission. Used for annual food inflation indices by category (France). License: Creative Commons Attribution 4.0 International (CC-BY 4.0). Source: https://ec.europa.eu/eurostat/web/hicp/data/database',
        'Open Prices (Open Food Facts) — community-sourced food price database. License: Open Database License (ODbL) 1.0. Any derived data displayed in the basket remains under this license. Source: https://prices.openfoodfacts.org',
        'Open Food Facts — community food product database (labels, brands, allergens, nutrition values). Database license: ODbL 1.0; content license: Creative Commons Attribution-ShareAlike 3.0 (CC-BY-SA 3.0). Source: https://world.openfoodfacts.org',
        'CIQUAL 2020 (ANSES, French food safety agency) — food nutritional composition table. Used for indicative nutrition values. Open Licence 2.0 (Etalab). Source: https://ciqual.anses.fr',
        'USDA FoodData Central (U.S. Department of Agriculture) — complementary nutrition data. Public domain (U.S. federal government work). Source: https://fdc.nal.usda.gov',
        'French supermarket reference prices 2025-2026 — internal estimates based on French supermarket conventions.',
      ]},
      { type: 'note', text: 'Prices shown in the basket are indicative estimates. They do not constitute a commercial offer and may vary by retailer, region, and period.' },

      { type: 'h3', text: 'Intellectual property' },
      { type: 'p', text: 'The name Fridge+, the logo, the visual identity and the unpublished source code are the exclusive property of the project owner. Any reproduction, even partial, without prior written authorization is forbidden (French Intellectual Property Code, Article L.122-4).' },
      { type: 'p', text: 'Recipes published by users in the community remain their property; by submitting them for publication, they grant the publisher a non-exclusive, free, worldwide license to display them in the Service.' },

      { type: 'h3', text: 'Visual assets and open source' },
      { type: 'p', text: 'Fridge+ uses third-party resources under open licenses:' },
      { type: 'list', items: [
        'Microsoft Fluent Emoji — set of 3D emojis/icons used in the interface. © Microsoft. MIT License. Source: https://github.com/microsoft/fluentui-emoji',
      ]},
    ],
  },

  terms: {
    intro: 'These Terms of Service (ToS) govern the use of the Fridge+ service (hereinafter "the Service"). By creating an account or using the Service, the user ("you") accepts these terms unconditionally.',
    blocks: [
      { type: 'h3', text: 'Service description' },
      { type: 'p', text: 'Fridge+ is a free web application that helps you manage your fridge content, discover recipes adapted to available ingredients, and share recipes with a community of amateur cooks. The Service is accessible without registration for basic features (fridge management, recipe browsing); an account is required for advanced features (persistent favorites, shopping cart, community).' },

      { type: 'h3', text: 'Access conditions' },
      { type: 'list', items: [
        'Minimum age: 16 (in accordance with GDPR Article 8 for stand-alone consent). Minors aged 13–15 may use the Service with the explicit authorization of the parental authority holder.',
        'Have a valid email address for account creation.',
        'Accept these ToS and the Privacy Policy.',
      ]},

      { type: 'h3', text: 'User account' },
      { type: 'p', text: 'Each user is responsible for the confidentiality of their password and all actions taken from their account. In case of suspected fraudulent use, the user must immediately change their password and contact the publisher.' },

      { type: 'h3', text: 'User-generated content' },
      { type: 'p', text: 'Users may publish recipes in the Fridge+ community. By submitting content, the user warrants that they are the author (or hold publication rights) and grants the publisher a non-exclusive, free, worldwide license to display, moderate and store this content within the Service.' },
      { type: 'p', text: 'Published recipes are subject to a priori moderation: the publisher approves or rejects each submission before it appears publicly. In case of rejection, the user receives a notification with the reason.' },

      { type: 'h3', text: 'Prohibited content' },
      { type: 'p', text: 'The following are strictly prohibited:' },
      { type: 'list', items: [
        'Any content unlawful under French law',
        'Insulting, defamatory, racist, sexist, homophobic or discriminatory speech',
        'Harassment, threats, incitement to violence',
        'Pornographic or shocking content',
        'Unsolicited commercial promotion (spam)',
        'Identity theft',
        'Copyright infringement',
      ]},
      { type: 'citation', source: 'Regulation (EU) 2022/2065 (Digital Services Act) — Article 14', text: 'Providers of intermediary services shall provide a mechanism enabling any person or entity to notify the presence of specific items considered to be illegal content.' },
      { type: 'p', text: 'The reporting mechanism is integrated into the Service via the support ticket system: any user can report content by opening a ticket of type "Report".' },

      { type: 'h3', text: 'Prohibited uses of the Service' },
      { type: 'p', text: 'In addition to the prohibited content above, the following are strictly prohibited without the publisher\'s prior written authorization:' },
      { type: 'list', items: [
        'Systematic or substantial extraction, copying or reuse of the Service\'s content and databases (base recipes, ingredients, prices, nutrition data), by any automated or manual means (scraping, crawling, harvesting).',
        'Any commercial reuse of the Service, its content, brand, visual identity or code.',
        'Reproduction, adaptation, translation or plagiarism of all or part of the Service.',
        'Reverse-engineering, decompilation or circumvention of technical protection measures, except within the mandatory limits permitted by law.',
        'Using the Service to build a competing product or service.',
      ]},
      { type: 'citation', source: 'French Intellectual Property Code — Article L.342-1 (database producer right)', text: 'The database producer has the right to prohibit the extraction and reuse of all or a qualitatively or quantitatively substantial part of the database content.' },
      { type: 'p', text: 'The "Fridge+" brand, logo, visual identity, source code and base recipes are the exclusive property of the publisher (see Legal Notice). Any violation engages the liability of its author.' },

      { type: 'h3', text: 'Moderation and sanctions' },
      { type: 'p', text: 'In case of violation of these ToS, the publisher reserves the right, without prior notice and in a proportionate manner:' },
      { type: 'list', items: [
        'To hide or delete the disputed content',
        'To temporarily mute the user from the community',
        'To suspend or delete the account in case of repeat or serious violation',
      ]},

      { type: 'h3', text: 'Limitation of liability' },
      { type: 'p', text: 'Fridge+ is provided "as is", for informational purposes. Published recipes (including default ones) are culinary suggestions: the publisher does not guarantee the absence of allergens, the nutritional accuracy, or the suitability for any particular medical diet. It is the user\'s responsibility to verify ingredients according to their personal constraints (allergies, intolerances, conditions).' },
      { type: 'p', text: 'Prices shown in the cart are indicative estimates derived from public data (see Legal Notice); they are not a commercial offer and may vary by retailer, region and period. The publisher cannot be held liable for a purchase decision based solely on these estimates.' },

      { type: 'h3', text: 'ToS modifications' },
      { type: 'p', text: 'These ToS may be modified at any time. In case of substantial modification, signed-in users are informed at least 30 days in advance, by in-app notification and/or email. Continued use of the Service after this period constitutes acceptance of the new ToS.' },

      { type: 'h3', text: 'Applicable law and jurisdiction' },
      { type: 'p', text: 'These ToS are governed by French law. In case of dispute, the parties shall endeavor to find an amicable solution. Failing that, the French courts shall have exclusive jurisdiction.' },
      { type: 'note', text: 'These ToS apply to the entire Service, including free and premium features. Specific terms for the premium subscription (pricing, withdrawal rights, refunds, mediation) are detailed in the Terms of Sale (ToS-Sale).' },
    ],
  },

  cgv: {
    intro: 'These Terms of Sale govern subscriptions to the Fridge+ premium offering (the "Premium Service"). Any subscription purchase implies unconditional acceptance of these terms. Note: Fridge+ is governed by French law — the French version of these Terms of Sale is the binding legal reference.',
    blocks: [
      { type: 'h3', text: 'Publisher identification' },
      { type: 'list', items: [
        'Legal name: [TO BE COMPLETED BEFORE LAUNCH — Auto-entrepreneur status being formalized]',
        'Registration number (SIRET): [TO BE COMPLETED BEFORE LAUNCH]',
        'Address: [TO BE COMPLETED BEFORE LAUNCH]',
        `Contact: ${CONTACT_EMAIL}`,
      ]},
      { type: 'note', text: 'The publisher\'s full identity (legal name, SIRET, address) will be published before the official public launch and activation of online payment.' },

      { type: 'h3', text: 'Premium service description' },
      { type: 'p', text: 'A Fridge+ Premium subscription unlocks the following features:' },
      { type: 'list', items: [
        'Advanced shopping cart: export, sharing, cost estimates per recipe and per week',
        'Advanced voice cooking mode: extended voice commands, multi-ingredient recognition',
        'Food spending analytics: history, trends, monthly budget',
        'Anti-waste features: expiry alerts, leftover usage suggestions',
      ]},
      { type: 'p', text: 'Features remaining free for all users:' },
      { type: 'list', items: [
        'Fridge management (ingredient stock)',
        'Recipe discovery and filtering',
        'Recipe creation and community sharing',
        'Support tickets',
      ]},

      { type: 'h3', text: 'Pricing' },
      { type: 'list', items: [
        'Monthly plan: €4.99 incl. VAT / month (20 % VAT included)',
        'Annual plan: €34.99 incl. VAT / year (≈ €2.92 / month — 30 % savings)',
        'Free trial: 7 days free with payment details required, cancelable before the trial ends without charge',
      ]},

      { type: 'h3', text: 'Payment' },
      { type: 'p', text: 'Payments are processed by card (Visa, Mastercard) via Stripe (TLS-encrypted, PCI-DSS compliant). No card data is transmitted to or stored by Fridge+ — Stripe is the data controller for payment data (see Privacy Policy).' },

      { type: 'h3', text: 'Duration and renewal' },
      { type: 'p', text: 'Your subscription renews automatically at the end of each period (monthly or annual). You will receive a reminder email at least 30 days before each annual renewal, in accordance with French consumer law (Art. L215-1).' },

      { type: 'h3', text: 'Right of withdrawal' },
      { type: 'p', text: 'Under French consumer law (Art. L221-18), you have 14 days from your subscription date to withdraw without giving any reason. To withdraw, contact support in the app or by email.' },
      { type: 'note', text: 'Immediate access exception (Art. L221-28 2°): if you explicitly request immediate access to the Premium Service before the 14-day withdrawal period expires, you acknowledge losing this right as of activation. This waiver requires an explicit checkbox at checkout — it is never pre-checked.' },

      { type: 'h3', text: 'Cancellation' },
      { type: 'p', text: 'Cancel anytime from your profile → Subscription → Cancel my subscription. Cancellation takes effect at the end of the current billing period. No pro-rata refund is granted beyond the 14-day withdrawal period.' },

      { type: 'h3', text: 'Refunds' },
      { type: 'list', items: [
        'Within 14 days of subscription, if you did not request immediate access: full refund, no fees.',
        'Beyond 14 days: no refund, except in exceptional cases at the publisher\'s sole discretion.',
        'Free trial: no charge if canceled before the 7-day trial ends.',
      ]},

      { type: 'h3', text: 'Consumer mediation' },
      { type: 'p', text: 'Under French law (Art. L612-1), if a dispute cannot be resolved through our support, you may use a free consumer mediation service. The designated mediator will be listed here before payments are activated.' },
      { type: 'note', text: '[TO BE COMPLETED BEFORE LAUNCH — Designated consumer mediator details]. Approved mediators list: https://www.economie.gouv.fr/mediation-conso' },

      { type: 'h3', text: 'Governing law and jurisdiction' },
      { type: 'p', text: 'These Terms of Sale are governed by French law. Disputes not resolved through mediation shall be subject to French court jurisdiction.' },
      { type: 'note', text: 'Effective date: these terms will be finalized and dated before payment is activated.' },
    ],
  },

  privacy: {
    intro: 'This policy describes how Fridge+ collects, uses and protects your personal data. It is drafted in accordance with Regulation (EU) 2016/679 (GDPR) and the French Data Protection Act (n°78-17 of January 6, 1978, as amended).',
    blocks: [
      { type: 'h3', text: 'Data controller' },
      { type: 'p', text: `The data controller is the publisher of the Service (see Legal Notice section). In the absence of a designated Data Protection Officer (DPO) — not mandatory at this scale — any GDPR request can be sent to: ${CONTACT_EMAIL}.` },

      { type: 'h3', text: 'Data collected' },
      { type: 'p', text: 'Depending on your use of the Service, the following data may be collected:' },
      { type: 'list', items: [
        'Account data: email address, password (hashed with bcrypt, never stored in plain text), username, avatar (image from a library)',
        'Functional data: ingredients in your fridge, favorite recipes, personal recipes you create, shopping cart, leftovers, cooking journal',
        'Preferences: language, light/dark mode, allergen preferences',
        'Community data: posts, replies, reports (if you participate)',
        'Support data: tickets you open, history of exchanges with the team',
        'Technical data: IP address, browser type, operating system (security logs, kept for 12 months)',
      ]},

      { type: 'h3', text: 'Purposes and legal bases' },
      { type: 'citation', source: 'GDPR — Article 6.1', text: 'Processing shall be lawful only if and to the extent that at least one of the following [legal bases a) to f)] applies.' },
      { type: 'list', items: [
        'Authentication and account management → contract performance (Art. 6.1.b)',
        'Storage of your recipes, favorites, fridge, cart → contract performance',
        'Payment processing and premium subscription management (Stripe) → contract performance (Art. 6.1.b)',
        'Community moderation and support tickets → contract performance + publisher\'s legitimate interest (Art. 6.1.f)',
        'In-app notifications → contract performance',
        'Native push notifications (inactivity reminders, important announcements, leftover expiry alerts) → consent (Art. 6.1.a), a single opt-in covering all 3 uses (no per-category granularity at this stage)',
        'Essential cookies (authentication, language preferences) → legitimate interest, no consent required',
        'Security logs, fraud prevention → legitimate interest',
        'Transactional emails (confirmation, password reset, subscription renewal) → contract performance',
      ]},
      { type: 'note', text: 'No data is used for advertising profiling. No third-party analytics cookies (Google Analytics, Meta Pixel, etc.) are placed without your explicit consent.' },

      { type: 'h3', text: 'Data processors (GDPR Article 28)' },
      { type: 'p', text: 'Fridge+ relies on the following processors, under Data Processing Agreements (DPAs) where applicable:' },
      { type: 'list', items: [
        'Supabase Inc. (Singapore, data hosted in European Union): authentication, database, edge functions',
        'Vercel Inc. (USA): web application hosting',
        'Resend Inc. (USA): transactional email delivery',
        'Sentry / Functional Software, Inc. (USA): application error monitoring',
        'Stripe, Inc. (USA): premium subscription payment processing — email, amount, currency, country. Card data is processed and stored by Stripe as data controller; it is never transmitted to Fridge+.',
        'OpenAI, L.L.C. (USA): ingredient substitute suggestions and automatic moderation of community content. The submitted public text is sent for analysis; no data trains the models. Data Processing Agreement (DPA) with this processor not yet in place.',
        'Google LLC / Apple Inc. (USA): voice recognition transcription (free fridge mic + cooking mode commands) and speech synthesis (reading steps aloud), via the browser Web Speech API, upon consent. No audio or text retained by Fridge+.',
        'Google LLC (Google Cloud Vision, USA): text recognition on a receipt photo, upon consent. No image or raw text retained by Fridge+.',
        'Google LLC / Mozilla Foundation / Apple Inc. (depending on the browser used): technical relay of push notifications (end-to-end encrypted content, unreadable by these services), upon consent. Exact GDPR Art. 28 processor status not yet settled (no direct contract/DPA, the browser acting on the user\'s behalf) — point to confirm with legal counsel.',
      ]},
      { type: 'p', text: 'Transfers outside the European Union are governed by the Standard Contractual Clauses adopted by the European Commission (GDPR Article 46.2.c).' },

      { type: 'h3', text: 'Retention periods' },
      { type: 'list', items: [
        'Active account: kept until the account is deleted',
        'Inactive account (no login for 3 years): a reminder email is sent; without response within 30 days, the account is anonymized and deleted',
        'Deleted account: immediate anonymization of community recipes (the author becomes "Deleted user"); definitive deletion of personal data within 30 days',
        'Billing data (transaction history, subscription status): 10 years in accordance with Article L123-22 of the French Commercial Code (accounting obligation — overrides GDPR right to erasure Art. 17.3.b)',
        'Closed support tickets: 3 years after last interaction',
        'Security logs (IP, user-agent): 12 months',
        'Encrypted backups: 30 days',
        'Analytics cookies (if you consent): 13 months maximum, in line with the French CNIL recommendation',
      ]},

      { type: 'h3', text: 'Your rights (GDPR Articles 15–22)' },
      { type: 'p', text: 'You have the following rights regarding your personal data:' },
      { type: 'list', items: [
        'Right of access: obtain a copy of all your data (export available from your profile)',
        'Right to rectification: correct any inaccurate or incomplete data',
        'Right to erasure ("right to be forgotten"): delete your account and all associated data',
        'Right to restriction of processing',
        'Right to object to processing based on legitimate interest',
        'Right to data portability: receive your data in a structured format (JSON), to transfer it to another service',
        'Right to withdraw your consent at any time (non-essential cookies)',
        'Right to define directives on the fate of your data after your death',
      ]},
      { type: 'p', text: `To exercise these rights, contact ${CONTACT_EMAIL}. A response will be provided within a maximum of 1 month (GDPR Article 12.3).` },
      { type: 'p', text: 'If you believe your rights are not respected, you can file a complaint with the competent supervisory authority. In France, the complaint procedure is handled directly online on the website of the French data protection authority (CNIL): www.cnil.fr. Users in other EU countries can contact their local data protection authority.' },

      { type: 'h3', text: 'Security measures' },
      { type: 'p', text: 'The following technical and organizational measures protect your data:' },
      { type: 'list', items: [
        'Encryption in transit (TLS/HTTPS) across the entire Service; backups encrypted at rest',
        'Passwords protected by an industry-recognized hashing algorithm (never stored in plain text)',
        'Strict access control policies at the database level: a user can only access their own data',
        'Two-factor authentication available for privileged accounts',
        'Immutable audit log of sensitive actions (moderation, account deletion)',
        'Encrypted backups with regularly tested restoration procedure',
        'Continuous application error monitoring by a specialized provider',
        'Least-privilege policies, environment segmentation (production / pre-production)',
      ]},
      { type: 'note', text: 'In line with French CNIL and ANSSI recommendations, certain technical implementation details (specific algorithms, versions, internal architecture, exact regions) are intentionally not published here so as not to facilitate the work of potential attackers. They are documented internally and communicated to competent authorities (CNIL, ANSSI, judicial services) upon legal request or in case of a security incident (GDPR Article 33 — breach notification within 72 hours).' },

      { type: 'h3', text: 'Cookies' },
      { type: 'p', text: 'The Service uses a minimal number of cookies. Per-category details are available in the "Cookies" modal accessible from the footer:' },
      { type: 'list', items: [
        'Strictly necessary cookies (authentication, language preferences, session cart): set without consent, in compliance with the ePrivacy Directive',
        'No audience measurement or advertising cookie is set without explicit consent.',
      ]},
    ],
  },

  faq: {
    intro: 'Answers to the most frequent questions about Fridge+. If your question is not listed, contact support from your account or write to ' + CONTACT_EMAIL + '.',
    blocks: [
      { type: 'h3', text: 'Is the service free?' },
      { type: 'p', text: GRATUIT_EN },

      { type: 'h3', text: 'Why ask for an email to create an account?' },
      { type: 'p', text: 'The email is used to: (1) secure your account (password reset), (2) send important notifications (support replies, recipe approvals), (3) confirm registration. It is never shared with third parties for commercial purposes.' },

      { type: 'h3', text: 'How do I delete my account?' },
      { type: 'p', text: 'Go to your profile → "Privacy" tab → "Delete my account" button. A confirmation is requested. Deletion is immediate on the UI side. On the server side, personal data is anonymized immediately, then permanently deleted within 30 days (backups included).' },

      { type: 'h3', text: 'How do I export my data?' },
      { type: 'p', text: 'Profile → "Privacy" tab → "Export my data" button. You receive a JSON file containing everything that concerns you: account, recipes, favorites, fridge, cart, journal, support tickets. Compliant with the right to data portability (GDPR Art. 20).' },

      { type: 'h3', text: 'Are my recipes public by default?' },
      { type: 'p', text: 'No. Recipes you create are private by default. If you check "Publish online" when creating a recipe, your recipe is submitted for moderation before publication in the community.' },

      { type: 'h3', text: 'What happens when I delete an account that has published recipes?' },
      { type: 'p', text: 'Your recipes published in the community remain visible (they are useful to other users), but their author becomes "Deleted user". Your private recipes and favorites are deleted. No personal data (email, username, IP) is retained.' },

      { type: 'h3', text: 'How do I enable two-factor authentication?' },
      { type: 'p', text: 'Two-factor authentication (TOTP) is currently available for administrator accounts from profile → Security. It will be extended to all accounts in a future update.' },

      { type: 'h3', text: 'How do I report inappropriate content in the community?' },
      { type: 'p', text: 'On any post or reply, a "Report" button opens a Report-type ticket to the admin. Compliant with the Digital Services Act (DSA, Art. 14). Content is reviewed within 48 hours on average.' },

      { type: 'h3', text: 'Is the service accessible to minors?' },
      { type: 'p', text: 'The minimum age is 16 (French GDPR transposition). Ages 13–15 may use the service with a parent\'s explicit authorization (GDPR Art. 8). Below 13, the service is not authorized.' },

      { type: 'h3', text: 'How do I contact the team?' },
      { type: 'p', text: `Quickest: open a support ticket from your account (icon at the top right). Otherwise: ${CONTACT_EMAIL}.` },
    ],
  },
}

// ─── i18n fallback ──────────────────────────────────────────────────────
//
// ES, DE et JA reprennent EN par fallback en attendant une traduction
// localisée par un traducteur juridique professionnel. Cette stratégie
// est cohérente avec la phase pré-launch et est documentée explicitement
// dans le bandeau de la page Legal (cf. LegalPage.jsx).

const TRANSLATION_NOTE_FALLBACK_TO_EN = {
}

export const LEGAL_CONTENT = { fr: FR, en: EN, es: EN, de: EN, ja: EN }

export function getLegalSection(lang, sectionKey) {
  const data = LEGAL_CONTENT[lang] ?? LEGAL_CONTENT.en
  return data?.[sectionKey] ?? null
}

export function getTranslationFallbackNote(lang) {
  return TRANSLATION_NOTE_FALLBACK_TO_EN[lang] ?? null
}
