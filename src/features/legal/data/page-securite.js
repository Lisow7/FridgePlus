import { SUPPORT_EMAIL } from '@shared/lib/contact'

// Le contenu de la page publique « Sécurité » (/securite), en UN seul endroit.
//
// Décision du 2026-10-08 : une page publique que security.txt désigne, avec le
// contenu de SECURITY.md en français et en anglais — comment signaler une
// faille, ce qu’on s’engage à faire. La page vivante (`pages/security-page.jsx`)
// et le HTML servi (`src/prerender/corps-statique.js`) lisent ce module ;
// `pages-accessibilite-et-securite.test.jsx` le confronte à SECURITY.md
// (adresse, délais, recours) et à security.txt.
//
// Volontairement absents : la section CSP de SECURITY.md (technique, elle
// s’adresse à qui lit le dépôt) et la récompense « Premium à vie » (ADR 0006 :
// un visiteur ne rencontre aucune promesse Premium).

/** Le recours quand une faille grave reste sans réponse (SECURITY.md, « Contact escalation »). */
export const AVIS_PRIVE_GITHUB = 'https://github.com/Lisow7/FridgePlus/security/advisories/new'

const ECRIRE = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('[SECURITY] ')}`

export const PAGE_SECURITE = {
  fr: {
    titre: 'Sécurité',
    intro: 'Tu as trouvé une faille dans Fridge+ ? Merci de nous la signaler avant d’en parler publiquement. Voici comment faire, et ce que nous nous engageons à faire de notre côté.',
    sections: [
      {
        id: 'securite-signaler',
        titre: 'Signaler une faille',
        paragraphes: [
          'N’ouvre pas de ticket public sur GitHub : écris-nous par e-mail, avec en objet « [SECURITY] » suivi d’un court résumé.',
          'Si tu préfères chiffrer ton message, demande-nous notre clé PGP dans un premier e-mail sans détail sensible.',
        ],
        lien: { href: ECRIRE, texte: `Écrire à ${SUPPORT_EMAIL}` },
      },
      {
        id: 'securite-joindre',
        titre: 'Ce qu’il faut joindre',
        liste: [
          'Une description claire du problème et de son impact',
          'Les étapes pour le reproduire : adresse, requête, données envoyées, captures d’écran',
          'La version concernée, affichée en bas de chaque page',
          'Ton estimation de la gravité, si tu en as une',
          'Ton nom ou ton pseudo, si tu veux être remercié publiquement',
        ],
      },
      {
        id: 'securite-engagements',
        titre: 'Ce que nous nous engageons à faire',
        liste: [
          'Accuser réception sous 48 h',
          'Te donner une première évaluation sous 7 jours : la gravité, de P0 à P3, et la date de correction prévue',
          'Corriger en production sous 24 h une faille exploitée ou qui expose des données (P0), sous 7 jours une faille grave et exploitable (P1), sous 30 jours une faille d’impact moyen (P2), et au plus tôt une faille d’impact faible (P3)',
          'Convenir avec toi de la date de publication, en général une semaine après le correctif, le temps que l’app installée se mette à jour',
        ],
      },
      {
        id: 'securite-perimetre',
        titre: 'Ce qui est concerné',
        liste: [
          'L’application en production, sur fridgeplus.app : seule la version en ligne est suivie, et les correctifs y sont déployés directement',
          'Le comportement du serveur (règles d’accès aux données, fonctions) déclenché depuis l’application',
        ],
      },
      {
        id: 'securite-hors-perimetre',
        titre: 'Ce qui ne l’est pas',
        liste: [
          'Le « self-XSS », qui demande à la victime de coller elle-même du code dans la console de son navigateur',
          'L’absence d’en-têtes de sécurité que notre politique de sécurité du contenu couvre déjà',
          'Le spam et l’hameçonnage reçus par notre support',
          'Les recommandations de bonnes pratiques sans impact démontré',
          'Le déni de service qui repose sur un fort volume de trafic',
          'Les failles déjà publiques de bibliothèques tierces, sans exploitation propre à Fridge+ : à signaler à leurs auteurs',
          'Ce qui demande un accès physique à l’appareil, et l’ingénierie sociale envers les utilisateurs ou l’équipe',
          'Les services que nous utilisons sans les exploiter (Supabase, Vercel, Stripe, Resend, Sentry) : à signaler directement à chacun',
        ],
      },
      {
        id: 'securite-bonne-foi',
        titre: 'Recherche de bonne foi',
        paragraphes: [
          'Si tu suis cette politique de bonne foi, nous n’engagerons pas de poursuites et ne saisirons pas les autorités pour l’accès nécessaire à ta démonstration, et nous travaillerons avec toi à corriger le problème. Pour rester dans ce cadre :',
        ],
        liste: [
          'Arrête-toi dès que tu rencontres des données d’utilisateurs, et préviens-nous ; n’en garde que le strict nécessaire à la démonstration',
          'N’accède qu’à un compte que tu as créé toi-même pour tes essais',
          'Ne modifie et ne détruis aucune donnée',
          'Pas d’outil automatique au-delà de quelques centaines de requêtes par minute sur la production',
          'Ne publie rien avant la date convenue ensemble',
        ],
      },
      {
        id: 'securite-remerciements',
        titre: 'Remerciements',
        paragraphes: [
          'Nous n’avons pas de programme de récompense rémunérée : Fridge+ est un projet indépendant, financé par son auteur. Si tu le souhaites, ton nom figure dans les notes de la version qui corrige la faille, avec nos remerciements.',
        ],
      },
      {
        id: 'securite-sans-reponse',
        titre: 'Sans réponse ?',
        paragraphes: [
          'Si une faille grave reste sans réponse 48 h après ton e-mail, ouvre un avis de sécurité privé sur le dépôt GitHub du projet : il nous parvient directement et reste privé jusqu’à la publication du correctif.',
        ],
        lien: { href: AVIS_PRIVE_GITHUB, texte: 'Ouvrir un avis de sécurité privé sur GitHub' },
      },
    ],
    miseAJour: 'Page mise à jour le 10 octobre 2026. La même politique se lit en anglais dans le fichier SECURITY.md du dépôt, et les outils la trouvent par /.well-known/security.txt.',
  },
  en: {
    titre: 'Security',
    intro: 'Found a vulnerability in Fridge+? Please report it to us before talking about it publicly. Here is how, and what we commit to on our side.',
    sections: [
      {
        id: 'securite-signaler',
        titre: 'Report a vulnerability',
        paragraphes: [
          'Please do not open a public GitHub issue: email us instead, with “[SECURITY]” followed by a short summary as the subject.',
          'If you would rather encrypt your message, ask for our PGP key in a first email with no sensitive detail.',
        ],
        lien: { href: ECRIRE, texte: `Email ${SUPPORT_EMAIL}` },
      },
      {
        id: 'securite-joindre',
        titre: 'What to include',
        liste: [
          'A clear description of the issue and its impact',
          'Steps to reproduce it: URL, request, payload, screenshots',
          'The affected version, shown at the bottom of every page',
          'Your assessment of the severity, if you have one',
          'Your name or handle, if you would like to be credited publicly',
        ],
      },
      {
        id: 'securite-engagements',
        titre: 'What we commit to',
        liste: [
          'Acknowledge your report within 48 hours',
          'Give you an initial assessment within 7 days: the severity, from P0 to P3, and the expected fix date',
          'Fix in production within 24 hours an actively exploited issue or a data exposure (P0), within 7 days a high-impact exploitable issue (P1), within 30 days a medium-impact issue (P2), and on a best-effort basis a low-impact issue (P3)',
          'Agree with you on a disclosure date, usually a week after the fix, so that the installed app has time to update',
        ],
      },
      {
        id: 'securite-perimetre',
        titre: 'In scope',
        liste: [
          'The production app at fridgeplus.app: only the live version is supported, and fixes ship to it directly',
          'Server behaviour (data access rules, functions) triggered from the app',
        ],
      },
      {
        id: 'securite-hors-perimetre',
        titre: 'Out of scope',
        liste: [
          'Self-XSS that requires victims to paste code into their own browser console',
          'Missing security headers that our content security policy already covers',
          'Spam and phishing sent to our support inbox',
          'Best-practice recommendations with no demonstrated impact',
          'Denial of service relying on a large volume of traffic',
          'Already public vulnerabilities in third-party libraries with no Fridge+-specific exploitation path: please report them upstream',
          'Anything requiring physical access to a device, and social engineering of users or staff',
          'Services we use but do not operate (Supabase, Vercel, Stripe, Resend, Sentry): please report to each of them directly',
        ],
      },
      {
        id: 'securite-bonne-foi',
        titre: 'Good-faith research',
        paragraphes: [
          'If you make a good-faith effort to follow this policy, we will not take legal action against you or ask law enforcement to investigate you for the access needed to demonstrate the issue, and we will work with you to fix it. To stay within this policy:',
        ],
        liste: [
          'Stop as soon as you encounter user data, and tell us; keep only what is strictly needed for the demonstration',
          'Only access an account you created yourself for testing',
          'Do not modify or destroy any data',
          'No automated tools above a few hundred requests per minute against production',
          'Do not publish anything before the date we agree on',
        ],
      },
      {
        id: 'securite-remerciements',
        titre: 'Acknowledgments',
        paragraphes: [
          'We do not run a paid bounty programme: Fridge+ is an independent project, funded by its author. If you wish, your name appears in the release notes of the version that fixes the issue, with our thanks.',
        ],
      },
      {
        id: 'securite-sans-reponse',
        titre: 'No reply?',
        paragraphes: [
          'If a serious issue is still unanswered 48 hours after your email, open a private security advisory on the project’s GitHub repository: it reaches us directly and stays private until the fix is published.',
        ],
        lien: { href: AVIS_PRIVE_GITHUB, texte: 'Open a private security advisory on GitHub' },
      },
    ],
    miseAJour: 'Page updated on 10 October 2026. The same policy is in the SECURITY.md file of the repository, and tools find it through /.well-known/security.txt.',
  },
}
