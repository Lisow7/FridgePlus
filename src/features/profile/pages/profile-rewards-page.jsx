import { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { LuAward } from 'react-icons/lu'
import { useAuth } from '@shared/contexts/auth-provider'
import ProfilePageIntro from '@features/profile/components/profile-page-intro'
import ProfileSection from '@features/profile/components/profile-section'
import StreakCard from '@features/profile/components/streak-card'
import BadgesGrid from '@features/profile/components/badges-grid'
import { useCookingLogs } from '@features/profile/hooks/use-cooking-logs'
import ProfileLoadError from '@features/profile/components/profile-load-error'
import { computeNewlyUnlocked, nextReward } from '@shared/lib/recipes/achievements'

// Onglet « Récompenses » — foyer de la gamification (série de cuisine + une
// grille unique de progression : badges ET bannières-récompense fusionnés
// depuis l'unification 2026-07-16, cf. la conception « quests-badges-unification »
// du 2026-07-16). Extrait d'« Activité » (qui garde
// stats + journal) pour rendre la progression identifiable au premier coup d'œil.
const I18N = {
  fr: {
    pageTitle: 'Récompenses',
    pageIntro: 'Ta progression de cuisinier : série en cours, badges et bannières à débloquer.',
    streakTitle:   'Ta série de cuisine',
    streakWeeks:   (n) => n === 1 ? '1 semaine d\'affilée' : `${n} semaines d\'affilée`,
    streakBest:    (n) => `Record : ${n}`,
    streakEmpty:   'Cuisine cette semaine pour démarrer ta série 🔥',
    badgesSectionTitle: 'Progression',
    badgesSectionDesc:  'Tes hauts faits de cuisine et les bannières à débloquer.',
    themeLabels:   { regularity: 'Régularité', volume: 'Volume', variety: 'Variété', world: 'Cuisine du monde' },
    badgeProgress: (v, th) => `${v} / ${th}`,
    badgeUnlockedA11y: 'débloqué',
    badgeLockedA11y:   'verrouillé',
    nextRewardLabel: '⭐ Prochaine récompense',
    empty: 'Cuisine ta première recette pour débloquer ta série et tes premiers badges 🍳',
    celebration: (n) => `🎉 ${n === 1 ? 'Nouvelle bannière débloquée' : `${n} nouvelles bannières débloquées`} ! Va la choisir dans ton profil.`,
  },
  en: {
    pageTitle: 'Rewards',
    pageIntro: 'Your cooking journey: current streak, badges and banners to unlock.',
    streakTitle:   'Your cooking streak',
    streakWeeks:   (n) => n === 1 ? '1 week in a row' : `${n} weeks in a row`,
    streakBest:    (n) => `Best: ${n}`,
    streakEmpty:   'Cook this week to start your streak 🔥',
    badgesSectionTitle: 'Progress',
    badgesSectionDesc:  'Your cooking achievements and banners to unlock.',
    themeLabels:   { regularity: 'Regularity', volume: 'Volume', variety: 'Variety', world: 'World cuisine' },
    badgeProgress: (v, th) => `${v} / ${th}`,
    badgeUnlockedA11y: 'unlocked',
    badgeLockedA11y:   'locked',
    nextRewardLabel: '⭐ Next reward',
    empty: 'Cook your first recipe to unlock your streak and first badges 🍳',
    celebration: (n) => `🎉 ${n === 1 ? 'New banner unlocked' : `${n} new banners unlocked`}! Go pick it in your profile.`,
  },
}

export default function ProfileRewardsPage() {
  const { lang = 'fr', darkMode = false, user, profile } = useOutletContext()
  const t = I18N[lang] ?? I18N.fr
  const { updateProfile } = useAuth()
  const { statsLogs, statsError, reloadCookingLogs, streak, badges } = useCookingLogs(user?.id)

  const unlockedBanners = useMemo(() => profile?.unlocked_banners ?? [], [profile?.unlocked_banners])
  const next = useMemo(() => nextReward(badges, unlockedBanners), [badges, unlockedBanners])

  // Octroi automatique : palier terminé → ajoute sa bannière à unlocked_banners
  // (idempotent, une seule fois par session via le ref).
  //
  // ⚠️ LIMITE CONNUE ET ACCEPTÉE (audit du 2026-08-28, prouvée par mutation).
  // L'éligibilité est calculée ICI, côté client, et écrite directement dans
  // `profiles.unlocked_banners`. N'importe quel compte peut donc s'attribuer
  // toutes les bannières depuis la console du navigateur : le trigger
  // `guard_profiles_privileged_columns` protège le rôle, l'abonnement et le
  // bannissement, mais PAS cette colonne — délibérément, puisque c'est le
  // client qui la remplit (décision documentée dans la migration du 08/08,
  // avec un test de garde-fou qui échouerait si on la protégeait).
  //
  // Enjeu : cosmétique (des récompenses censées se mériter), aucune donnée ni
  // privilège en jeu. Le vrai correctif n'est pas un garde en base — il
  // casserait cette fonctionnalité — mais le DÉPLACEMENT du calcul côté
  // serveur : une RPC `claim_earned_banners()` qui recalcule l'éligibilité
  // depuis les vraies statistiques de cuisine, puis écrit. À faire le jour où
  // les récompenses porteront un enjeu réel (classement, avantage, revente).
  const grantedRef = useRef(false)
  const [justUnlocked, setJustUnlocked] = useState([])
  useEffect(() => {
    if (grantedRef.current || statsLogs === null || !profile) return
    const earned = computeNewlyUnlocked(badges, unlockedBanners)
    if (earned.length > 0) {
      grantedRef.current = true
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setJustUnlocked(earned)
      updateProfile({ unlocked_banners: [...unlockedBanners, ...earned] })
    }
  }, [statsLogs, profile, badges, unlockedBanners, updateProfile])

  // Mise en avant d'un palier ciblé depuis le picker ou l'onboarding (clic
  // bannière verrouillée / CTA « Bien démarrer » → /profile/recompenses?reward=<id>)
  // : on fait clignoter sa carte + scroll (délégué à BadgesGrid via targetId).
  const [searchParams] = useSearchParams()
  const targetReward = searchParams.get('reward')
  const [blinkId, setBlinkId] = useState(null)
  useEffect(() => {
    if (!targetReward) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBlinkId(targetReward)
    // Léger délai : laisse la grille se peindre avant de scroller.
    const scrollTid = setTimeout(() => {
      document.getElementById(`badge-${targetReward}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 200)
    const tid = setTimeout(() => setBlinkId(null), 3000)
    return () => { clearTimeout(scrollTid); clearTimeout(tid) }
  }, [targetReward])

  const textColor  = darkMode ? '#EBE4D8' : '#2d1b00'
  const mutedColor = darkMode ? '#7A90A8' : '#6A4F45'
  const border     = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

  return (
    <>
      <ProfilePageIntro title={t.pageTitle} description={t.pageIntro} darkMode={darkMode} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {justUnlocked.length > 0 && (
          <div role="status" style={{
            padding: '12px 16px', borderRadius: 12,
            background: 'var(--gradient-deep)', color: '#fff',
            fontSize: 14, fontWeight: 700, boxShadow: '0 2px 10px rgba(212,106,16,0.25)',
          }}>
            {t.celebration(justUnlocked.length)}
          </div>
        )}
        {statsLogs !== null && (
          <StreakCard
            streak={streak}
            t={t}
            darkMode={darkMode}
            border={border}
            textColor={textColor}
            mutedColor={mutedColor}
          />
        )}

        {/* Pas chargé : on le dit. En cours : rien. Sans cette garde, les paliers
            s'affichaient TOUS verrouillés — pour quelqu'un qui en a dix. */}
        {statsError ? (
          <ProfileLoadError lang={lang} onRetry={reloadCookingLogs} textColor={textColor} mutedColor={mutedColor} />
        ) : statsLogs === null ? null : badges.length > 0 ? (
          <ProfileSection
            Icon={LuAward}
            title={t.badgesSectionTitle}
            description={t.badgesSectionDesc}
            lang={lang}
            darkMode={darkMode}
          >
            <BadgesGrid
              badges={badges}
              t={t}
              lang={lang}
              darkMode={darkMode}
              border={border}
              textColor={textColor}
              mutedColor={mutedColor}
              unlockedBanners={unlockedBanners}
              targetId={blinkId}
              nextRewardId={next?.id}
            />
          </ProfileSection>
        ) : (
          <p style={{ fontSize: 14, color: mutedColor, lineHeight: 1.6, margin: '4px 2px' }}>{t.empty}</p>
        )}
      </div>
    </>
  )
}
