import { Link } from 'react-router-dom'
import { LuArrowLeft, LuTrash2, LuMail } from 'react-icons/lu'
import ScrollToTopButton from '@shared/ui/scroll-to-top-button'
import { useDocumentTitle } from '@shared/hooks/use-document-title'
import {
  DELAI_EFFACEMENT_JOURS,
  EMAIL_SUPPRESSION,
  CHEMIN_DANS_APP,
  DONNEES,
} from '@features/legal/data/suppression-compte'

// Page publique de suppression de compte — /suppression-compte
//
// ── Pourquoi une page à elle seule ────────────────────────────────────────
// Google exige, pour toute app permettant de créer un compte, une URL web
// PUBLIQUE où demander la suppression du compte et des données. Trois
// conditions, et elles sont littérales : HTTPS, AUCUN mur de connexion, et un
// lien DIRECT vers la page — pas une page d'accueil où l'information est
// enfouie.
// https://support.google.com/googleplay/android-developer/answer/13327111
//
// L'app avait déjà tout ce qu'il faut pour supprimer un compte, mais DERRIÈRE
// la connexion (Profil → Confidentialité). Et `/legal` est bien public, mais
// c'est une longue page réglementaire sans ancre : « enfoui » est exactement le
// motif de refus que Google cite. D'où cette page-ci.
//
// ⚠️ **Volontairement SANS `Guard`**, et pour une raison de fond : un mur
// d'authentification ici RETIRERAIT la seule propriété qui compte. Quelqu'un
// qui a désinstallé l'app, ou perdu l'accès à son compte, doit pouvoir demander
// la suppression. Même raisonnement que `/faq` et `/guide` (cf. le commentaire
// de `routes-config.js`) : la page ne lit aucune donnée utilisateur et
// n'émet aucune requête réseau.
//
// ── Les faits ne sont pas écrits ici ──────────────────────────────────────
// Le délai, l'adresse et le chemin dans l'app viennent de
// `data/suppression-compte.js`, que `/legal` lit aussi. Les recopier aurait
// fabriqué la prochaine divergence — ce dépôt a passé la journée du 2026-09-12
// à réparer un nombre d'étapes écrit à trois endroits et faux à deux d'entre
// eux. `src/test/unit/suppression-compte-coherence.test.js` tient la garde.

const I18N = {
  fr: {
    backHome: 'Retour à l’accueil',
    title: 'Supprimer mon compte Fridge+',
    subtitle: `Tu peux supprimer ton compte et les données qui s’y rattachent à tout moment, toi-même et sans rien demander à personne. Voici comment, et ce qu’il advient exactement de chaque donnée.`,
    dansApp: 'Depuis l’application',
    dansAppIntro: 'C’est le chemin le plus rapide, et il ne demande aucune validation de notre part :',
    dansAppApres: `La suppression est immédiate à l’écran. Côté serveur, tes données personnelles sont anonymisées tout de suite, puis définitivement effacées sous ${DELAI_EFFACEMENT_JOURS} jours — sauvegardes comprises.`,
    parMail: 'Sans l’application',
    parMailIntro: `Si tu as désinstallé Fridge+ ou si tu n’arrives plus à te connecter, écris-nous depuis l’adresse e-mail de ton compte. Nous te répondons et procédons à la suppression sous ${DELAI_EFFACEMENT_JOURS} jours.`,
    parMailObjet: 'Suppression de mon compte Fridge+',
    parMailCorps: 'Bonjour,\n\nJe demande la suppression de mon compte Fridge+ et des données associées.\n\nMerci.',
    parMailBouton: 'Écrire à ' + EMAIL_SUPPRESSION,
    parMailNote: 'Nous demandons que la demande vienne de l’adresse du compte : c’est la seule façon de vérifier que c’est bien toi, sans te réclamer de pièce d’identité.',
    effacees: 'Ce qui est effacé',
    anonymisees: 'Ce qui reste en ligne, mais sans toi',
    conservees: `Ce qui est conservé au-delà de ${DELAI_EFFACEMENT_JOURS} jours`,
    exportTitre: 'Avant de partir : récupérer tes données',
    exportTexte: 'Le même onglet « Confidentialité » propose « Exporter mes données » : tu reçois un fichier contenant tout ce qui te concerne — compte, recettes, favoris, frigo, panier, journal, tickets. C’est irréversible ensuite.',
    legalLien: 'Le détail complet figure dans notre politique de confidentialité',
  },
  en: {
    backHome: 'Back to home',
    title: 'Delete my Fridge+ account',
    subtitle: 'You can delete your account and the data attached to it at any time, by yourself, without asking anyone. Here is how, and exactly what happens to each piece of data.',
    dansApp: 'From the app',
    dansAppIntro: 'This is the fastest route, and it needs no approval from us:',
    dansAppApres: `Deletion is immediate on screen. On the server, your personal data is anonymised straight away, then permanently erased within ${DELAI_EFFACEMENT_JOURS} days — backups included.`,
    parMail: 'Without the app',
    parMailIntro: `If you have uninstalled Fridge+ or can no longer sign in, write to us from your account’s email address. We reply and carry out the deletion within ${DELAI_EFFACEMENT_JOURS} days.`,
    parMailObjet: 'Deletion of my Fridge+ account',
    parMailCorps: 'Hello,\n\nI am requesting the deletion of my Fridge+ account and the associated data.\n\nThank you.',
    parMailBouton: 'Email ' + EMAIL_SUPPRESSION,
    parMailNote: 'We ask that the request comes from the account’s address: it is the only way to check it is really you, without asking you for an ID document.',
    effacees: 'What is erased',
    anonymisees: 'What stays online, but without you',
    conservees: `What is kept beyond ${DELAI_EFFACEMENT_JOURS} days`,
    exportTitre: 'Before you go: get your data back',
    exportTexte: 'The same “Privacy” tab offers “Export my data”: you get a file with everything about you — account, recipes, favourites, fridge, cart, log, tickets. After deletion it is gone.',
    legalLien: 'The full detail is in our privacy policy',
  },
}

/** Une liste titrée. Trois fois le même bloc : une fonction, pas trois copies. */
function Bloc({ titre, items, muted, cardBg, cardBorder, cardShadow, id }) {
  return (
    <section aria-labelledby={id} style={{ marginBottom: 22 }}>
      <h3 id={id} style={{ fontSize: 16, fontWeight: 750, margin: '0 0 9px', letterSpacing: '-0.01em' }}>
        {titre}
      </h3>
      <ul style={{
        margin: 0, padding: '14px 18px 14px 34px', listStyle: 'disc',
        background: cardBg, border: `1px solid ${cardBorder}`, boxShadow: cardShadow,
        borderRadius: 14, fontSize: 14, lineHeight: 1.6, color: muted,
      }}>
        {items.map((texte, i) => <li key={i} style={{ marginTop: i ? 7 : 0 }}>{texte}</li>)}
      </ul>
    </section>
  )
}

export default function AccountDeletionPage({ lang = 'fr', darkMode = false }) {
  const t = I18N[lang] ?? I18N.fr
  const d = DONNEES[lang] ?? DONNEES.fr
  const chemin = CHEMIN_DANS_APP[lang] ?? CHEMIN_DANS_APP.fr
  useDocumentTitle(`${t.title} — Fridge+`)

  const fg         = darkMode ? '#E8EDF2' : 'var(--color-charcoal)'
  const muted      = darkMode ? 'rgba(232,237,242,0.68)' : 'rgba(45,45,45,0.68)'
  const cardBg     = darkMode ? '#1A2535' : '#FFFFFF'
  const cardBorder = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(224,120,32,0.16)'
  const cardShadow = darkMode
    ? '0 2px 10px rgba(0,0,0,0.35), 0 8px 28px rgba(0,0,0,0.22)'
    : '0 1px 3px rgba(224,120,32,0.06), 0 6px 20px rgba(224,120,32,0.07)'

  // `mailto` pré-rempli : sujet ET corps. Une demande qui arrive déjà rédigée
  // évite l'aller-retour « précisez votre demande », donc raccourcit le délai
  // réel pour la personne qui l'écrit.
  const mailto = `mailto:${EMAIL_SUPPRESSION}`
    + `?subject=${encodeURIComponent(t.parMailObjet)}`
    + `&body=${encodeURIComponent(t.parMailCorps)}`

  return (
    <div role="article" style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px 64px', color: fg }}>
      <Link
        to="/"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 20,
          fontSize: 13.5, fontWeight: 700, color: muted, textDecoration: 'none',
        }}
      >
        <LuArrowLeft size={16} aria-hidden="true" />
        {t.backHome}
      </Link>

      <header style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, display: 'flex', alignItems: 'center', gap: 11 }}>
          <LuTrash2 size={26} aria-hidden="true" />
          {t.title}
        </h1>
        <p style={{ marginTop: 8, fontSize: 15, lineHeight: 1.55, color: muted, maxWidth: '60ch' }}>
          {t.subtitle}
        </p>
      </header>

      <section aria-labelledby="sup-app" style={{ marginBottom: 28 }}>
        <h2 id="sup-app" style={{ fontSize: 19, fontWeight: 750, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
          {t.dansApp}
        </h2>
        <p style={{ margin: '0 0 10px', fontSize: 14.5, lineHeight: 1.6, color: muted }}>{t.dansAppIntro}</p>
        <p style={{
          margin: '0 0 10px', padding: '13px 17px', borderRadius: 14,
          background: cardBg, border: `1px solid ${cardBorder}`, boxShadow: cardShadow,
          fontSize: 14.5, fontWeight: 700, lineHeight: 1.5,
        }}>{chemin}</p>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: muted }}>{t.dansAppApres}</p>
      </section>

      <section aria-labelledby="sup-mail" style={{ marginBottom: 30 }}>
        <h2 id="sup-mail" style={{ fontSize: 19, fontWeight: 750, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
          {t.parMail}
        </h2>
        <p style={{ margin: '0 0 12px', fontSize: 14.5, lineHeight: 1.6, color: muted }}>{t.parMailIntro}</p>
        {/* ⚠️ `#B85000` EN DUR, et pas `var(--color-warm-600)`. La variable
            s'éclaircit en thème sombre, et le blanc dessus tombe sous le 4,5:1 —
            attrapé par le cliquet axe le 2026-09-12 : « color-contrast (serious) »
            sur ce bouton précis, en sombre uniquement. Même précédent que le
            bouton principal de l'écran de bienvenue, qui fige déjà cette teinte. */}
        <a
          href={mailto}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 9, padding: '12px 20px',
            borderRadius: 14, background: '#B85000', color: '#FFFFFF',
            fontSize: 14.5, fontWeight: 750, textDecoration: 'none',
          }}
        >
          <LuMail size={17} aria-hidden="true" />
          {t.parMailBouton}
        </a>
        <p style={{ margin: '11px 0 0', fontSize: 13, lineHeight: 1.6, color: muted, maxWidth: '62ch' }}>
          {t.parMailNote}
        </p>
      </section>

      <Bloc id="sup-effacees"    titre={t.effacees}    items={d.effacees}    {...{ muted, cardBg, cardBorder, cardShadow }} />
      <Bloc id="sup-anonymisees" titre={t.anonymisees} items={d.anonymisees} {...{ muted, cardBg, cardBorder, cardShadow }} />
      <Bloc id="sup-conservees"  titre={t.conservees}  items={d.conservees}  {...{ muted, cardBg, cardBorder, cardShadow }} />

      <section aria-labelledby="sup-export" style={{ marginBottom: 26 }}>
        <h2 id="sup-export" style={{ fontSize: 19, fontWeight: 750, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
          {t.exportTitre}
        </h2>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: muted, maxWidth: '64ch' }}>{t.exportTexte}</p>
      </section>

      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>
        <Link to="/legal" style={{ color: 'var(--link-accent)', fontWeight: 700, textDecoration: 'none' }}>
          {t.legalLien} →
        </Link>
      </p>

      <ScrollToTopButton />
    </div>
  )
}
