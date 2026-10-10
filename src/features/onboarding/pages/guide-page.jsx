import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LuArrowLeft, LuCompass, LuRocket } from 'react-icons/lu'
import { TOUR_STEPS_I18N } from '@features/onboarding/i18n/tour-steps-i18n'
import { TourIcon } from '@features/onboarding/lib/tour-icon'
import FabGlyph from '@shared/ui/fab-glyph'
import { useAuth } from '@shared/contexts/auth-provider'
import { useSubscription } from '@shared/hooks/use-subscription'
import { useDocumentTitle } from '@shared/hooks/use-document-title'
import Button from '@shared/ui/button'
import ScrollToTopButton from '@shared/ui/scroll-to-top-button'
import ContentPageCta from '@shared/ui/content-page-cta'
import { getContentCta } from '@shared/lib/i18n/content-cta-i18n'
import TourWizard from '@features/onboarding/components/tour-wizard'

// Page Guide — /guide
//
// ── Pourquoi une page, alors que la visite guidée existe déjà ─────────────
// `TourWizard` est une visite INTERACTIVE : elle se joue par-dessus l'app, et
// son contenu n'existe que le temps de la modale. Conséquence : il est
// invisible pour un moteur de recherche, et introuvable pour qui veut juste
// « lire comment ça marche » sans lancer un parcours.
//
// Cette page rend le MÊME contenu (`TOUR_STEPS_I18N`, source unique — rien
// n'est réécrit ici) sous forme lisible et indexable, et propose de lancer la
// visite interactive pour qui préfère être guidé dans l'app.
//
// ⚠️ Les étapes finales (`final_guest` / `final_free` / `final_premium`) sont
// volontairement EXCLUES : elles dépendent du profil de l'utilisateur et se
// terminent par une action (créer un compte, découvrir le premium). Les rendre
// sur une page publique afficherait un discours qui ne correspond à personne.
//
// Langues : `TOUR_STEPS_I18N` ne porte que fr + en (règle fr-sinon-en du
// projet). On applique la même cascade que `getSteps()` dans tour-wizard.

// Les quatre étapes communes, puis la finale DU LECTEUR (invité → compte ;
// connecté → communauté ; premium → « Bonne cuisine ! »), comme dans la visite.
// Une finale fixe tiendrait un discours qui ne correspond à personne ; sans
// finale, la page s'arrêtait avant « Aller plus loin » (jusqu'au 2026-09-11).
const ETAPES_COMMUNES = ['fab', 'fridge', 'check', 'recipes']
const FINALE_PAR_PROFIL = { guest: 'final_guest', free: 'final_free', premium: 'final_premium' }
// Icône d'en-tête par étape — les mêmes que le menu du bouton orange.
const ICONE_ETAPE = { fab: 'fab', fridge: 'door', check: 'inventory', recipes: 'recipes' }

const I18N = {
  fr: {
    title: 'Comment ça marche',
    subtitle: 'Fridge+ en cinq étapes : ce que tu as dans ton frigo devient ce que tu vas cuisiner.',
    backHome: 'Retour à l’accueil',
    launch: 'Lancer la visite guidée dans l’app',
    launchHint: '≈ 2 min · tu peux l’arrêter à tout moment',
    stepLabel: (n) => `Étape ${n}`,
    tipsTitle: 'À retenir',
  },
  en: {
    title: 'How it works',
    subtitle: 'Fridge+ in five steps: what sits in your fridge becomes what you cook.',
    backHome: 'Back to home',
    launch: 'Start the guided tour in the app',
    launchHint: '≈ 2 min · you can stop anytime',
    stepLabel: (n) => `Step ${n}`,
    tipsTitle: 'Good to know',
  },
}

export default function GuidePage({ lang = 'fr', darkMode = false }) {
  const navigate = useNavigate()
  const [tourOuvert, setTourOuvert] = useState(false)
  const { user } = useAuth()
  const { hasPremiumAccess } = useSubscription()
  const profil = !user ? 'guest' : hasPremiumAccess ? 'premium' : 'free'
  const etapesPubliques = [...ETAPES_COMMUNES, FINALE_PAR_PROFIL[profil]]
  const t     = I18N[lang] ?? I18N.en
  const steps = TOUR_STEPS_I18N[lang] ?? TOUR_STEPS_I18N.en

  // Le HTML servi est pré-rendu en français ; ici on aligne l'onglet sur la
  // langue affichée. Le canonical et les `og:*`, eux, ne bougent pas.
  useDocumentTitle(`${t.title} — Fridge+`)

  const fg         = darkMode ? '#E8EDF2' : 'var(--color-charcoal)'
  // L alpha du versant CLAIR passe de 0.66 a 0.68. Composite sur le creme
  // `#f5f0e8`, 0.66 rendait `#716f6d` = 4,41:1 — sous le 4,5:1 exige, de 0,09.
  // 0.68 rend 4,68:1. L ecart est invisible a l oeil nu ; le versant sombre
  // passait deja et ne bouge pas.
  const muted      = darkMode ? 'rgba(232,237,242,0.68)' : 'rgba(45,45,45,0.68)'
  const cardBg     = darkMode ? '#1A2535' : '#FFFFFF'
  const cardBorder = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(224,120,32,0.16)'
  const cardShadow = darkMode
    ? '0 2px 10px rgba(0,0,0,0.35), 0 8px 28px rgba(0,0,0,0.22)'
    : '0 1px 3px rgba(224,120,32,0.06), 0 6px 20px rgba(224,120,32,0.07)'

  // La visite interactive se monte ICI, en surcouche de la page — même patron
  // que `welcome-screen.jsx`. C'est volontairement différent d'un renvoi vers
  // l'accueil : il n'existe aucun paramètre d'URL qui déclenche la visite, et en
  // inventer un pour ce seul bouton ajouterait un chemin d'entrée à maintenir.
  //
  // Ses CTA finaux mènent ailleurs dans l'app — on les traduit en navigation.
  // `showUpgrade` n'est PAS branché : le premium est en pause, et cette étape
  // n'est de toute façon servie qu'aux comptes déjà premium.
  const actionsDeLaVisite = {
    showAuth:      () => navigate('/login'),
    showRegister:  () => navigate('/signup'),
    showRecipes:   () => navigate('/?recettes=1'),
    showCommunity: () => navigate('/community'),
    showProfile:   () => navigate('/profile'),
  }

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
        <h1 style={{
          fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', margin: 0,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <LuCompass size={26} aria-hidden="true" style={{ color: 'var(--color-warm-600)', flexShrink: 0 }} />
          {t.title}
        </h1>
        <p style={{ marginTop: 8, fontSize: 15, lineHeight: 1.55, color: muted, maxWidth: '60ch' }}>
          {t.subtitle}
        </p>
      </header>

      <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {etapesPubliques.map((cle, i) => {
          const etape = steps[cle]
          if (!etape) return null
          return (
            <li
              key={cle}
              id={`etape-${i + 1}`}
              style={{
                background: cardBg, border: `1px solid ${cardBorder}`, boxShadow: cardShadow,
                borderRadius: 14, padding: '18px 20px',
              }}
            >
              <div style={{
                fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'var(--color-warm-600)', marginBottom: 6,
              }}>
                {t.stepLabel(i + 1)}
              </div>
              {ICONE_ETAPE[cle] && (
                <div style={{ display: 'flex', color: 'var(--color-warm-600)', marginBottom: 8 }}>
                  {cle === 'fab' ? <FabGlyph size={28} /> : <TourIcon id={ICONE_ETAPE[cle]} size={28} />}
                </div>
              )}
              <h2 style={{ fontSize: 19, fontWeight: 750, margin: 0, letterSpacing: '-0.01em' }}>
                {etape.title}
              </h2>
              {etape.subtitle && (
                <div style={{
                  fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em',
                  color: muted, marginTop: 3,
                }}>
                  {etape.subtitle}
                </div>
              )}
              {etape.desc && (
                <p style={{ margin: '10px 0 0', fontSize: 14.5, lineHeight: 1.6, color: fg }}>
                  {etape.desc}
                </p>
              )}

              {Array.isArray(etape.options) && etape.options.length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {etape.options.map((o, k) => (
                    <li key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span aria-hidden="true" style={{ fontSize: 17, lineHeight: 1.3, display: 'flex', color: 'var(--color-warm-600)', marginTop: 2 }}>{o.icon ? <TourIcon id={o.icon} size={17} /> : o.i}</span>
                      <span style={{ fontSize: 14, lineHeight: 1.55 }}>
                        <strong style={{ fontWeight: 700 }}>{o.t}</strong>
                        {o.d && <span style={{ color: muted }}> — {o.d}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {Array.isArray(etape.tips) && etape.tips.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{
                    fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: muted, marginBottom: 6,
                  }}>
                    {t.tipsTitle}
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {etape.tips.map((tip, k) => (
                      <li key={k} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                        <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1.4, display: 'flex', color: 'var(--color-warm-600)', marginTop: 2 }}>{tip.icon ? <TourIcon id={tip.icon} size={15} /> : tip.i}</span>
                        <span style={{ fontSize: 13.5, lineHeight: 1.55, color: muted }}>{tip.t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          )
        })}
      </ol>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
        <Button
          onClick={() => setTourOuvert(true)}
          className="h-auto rounded-2xl px-5 py-3 text-sm font-bold"
          style={{ gap: 9 }}
        >
          <LuRocket size={17} aria-hidden="true" />
          {t.launch}
        </Button>
        <span style={{ fontSize: 12, color: muted }}>{t.launchHint}</span>
      </div>

      {tourOuvert && (
        <TourWizard
          lang={lang}
          user={user}
          isPremium={hasPremiumAccess}
          onClose={() => setTourOuvert(false)}
          onAction={actionsDeLaVisite}
        />
      )}

      {/* Le lien vers `/faq` manquait : `/faq` renvoyait ici, l'inverse
          n'existait pas. Un maillage à sens unique laisse la moitié des
          lecteurs dans un cul-de-sac. */}
      <ContentPageCta
        lang={lang}
        darkMode={darkMode}
        secondaryTo="/faq"
        secondaryLabel={getContentCta(lang).faqLink}
      />

      <ScrollToTopButton lang={lang} />
    </div>
  )
}
