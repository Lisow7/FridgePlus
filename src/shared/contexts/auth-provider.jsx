import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@shared/lib/supabase/client'
import { setSentryUser, clearSentryUser, logError } from '@shared/lib/observability/sentry'
// Sortis de ce fichier (il franchissait 500 lignes) : la lecture du profil,
// l'e-mail « ton profil a changé », le retour d'un lien e-mail (2026-10-04),
// les préférences allergènes (2026-10-05).
import { fetchProfile, colonnesDuProfil } from '@shared/lib/auth/fetch-profile'
import { sendChangeNotification } from '@shared/lib/auth/profile-change-notification'
import { useAuthLinkProblem } from '@shared/hooks/use-auth-link-problem'
import { useAllergenPrefs } from '@shared/hooks/use-allergen-prefs'
import { useProfilDeSecours } from '@shared/hooks/use-profil-de-secours'
import { etatMfa, MFA_AUCUN } from '@shared/lib/auth/mfa-requis'

const AuthContext = createContext(null)

// `last_login_at` : une fois par session de navigateur (audit du 2026-10-04,
// PERF-08). Un retour d'onglet ou un rechargement ne réécrivent pas le profil.
// La clé garde l'identifiant du compte : un autre compte dans le même onglet
// est horodaté à son tour.
const CLE_CONNEXION_NOTEE = 'fridge-last-login-ecrit'
function connexionDejaNotee(userId) {
  try { return sessionStorage.getItem(CLE_CONNEXION_NOTEE) === userId } catch { return false }
}
function noterLaConnexion(userId) {
  try { sessionStorage.setItem(CLE_CONNEXION_NOTEE, userId) } catch { /* stockage indisponible : on réécrira, sans gravité */ }
}

export function AuthProvider({ children }) {
  const [user,         setUser]         = useState(null)
  const [profile,      setProfile]      = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [mfa,          setMfa]          = useState(MFA_AUCUN) // code de double authentification dû ? (CPT-01)
  const [compteDesactive, setCompteDesactive] = useState(null) // { effaceLe } après une suppression (CPT-04)

  // Filet de sécurité du profil (relectures, « profil indisponible »,
  // `profileLoading`) : cf. shared/hooks/use-profil-de-secours.js (PREM-06, CPT-12).
  const { profileLoading, profilIndisponible, relancerLeProfil, setProfilIndisponible } =
    useProfilDeSecours({ user, profile, loading, setProfile })

  // Lien e-mail (ou retour de Google) qui n'aboutit pas : 'expired' | 'failed'
  // | 'no-session' | null. Cf. shared/hooks/use-auth-link-problem.js.
  const [authLinkProblem, clearAuthLinkProblem] = useAuthLinkProblem()

  // Référence du précédent user observé pour détecter un changement
  // d'email (event USER_UPDATED de Supabase) et déclencher une notif.
  const prevUserRef = useRef(null)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setMfa(etatMfa(session)) // le lien « mot de passe oublié » ne passe plus sans le code (CPT-02)
          setRecoveryMode(true)
          setLoading(false)
          return
        }
        // Détection d'un changement d'email confirmé : Supabase fire
        // USER_UPDATED après que le user a cliqué le lien de vérif et
        // que le nouvel email est appliqué en DB.
        if (event === 'USER_UPDATED' && session?.user?.email) {
          const prevEmail = prevUserRef.current?.email
          const newEmail  = session.user.email
          if (prevEmail && newEmail !== prevEmail) {
            sendChangeNotification('email', { oldValue: prevEmail, newValue: newEmail })
          }
        }
        const currentUser = session?.user ?? null
        // Retour sur l'onglet (audit du 2026-10-04, PERF-08) : supabase-js
        // réémet SIGNED_IN avec la MÊME session dès que l'onglet redevient
        // visible. Même compte, inchangé : rien à relire ni à réécrire — et
        // surtout pas un nouvel objet `user`, qui re-rendait toute l'app.
        const precedent = prevUserRef.current
        if (event === 'SIGNED_IN' && currentUser && precedent
          && precedent.id === currentUser.id && precedent.updated_at === currentUser.updated_at) {
          return
        }
        // Sprint 11 S11.b — détection switch user (signout puis signin
        // sur un autre compte). On reset le profile à null AVANT le
        // fetch pour éviter d'afficher les infos de l'ancien user
        // pendant la latence réseau (bug visible « infos qui restent
        // à - jusqu'au refresh »).
        const prevUserId = prevUserRef.current?.id
        const isUserSwitch = currentUser && prevUserId && prevUserId !== currentUser.id
        if (isUserSwitch) setProfile(null)
        if (isUserSwitch || !currentUser) setProfilIndisponible(false)
        setMfa(etatMfa(session)) // même rendu que l'utilisateur : jamais une image sans porte
        setUser(currentUser)
        prevUserRef.current = currentUser
        // Attacher l'id Supabase à Sentry (no-op si Sentry pas
        // initialisé) pour corréler crashes à un compte. Aucun email ni
        // username transmis — RGPD-friendly.
        if (currentUser) setSentryUser(currentUser.id)
        else clearSentryUser()
        if (currentUser) {
          // ⚠️ DEADLOCK supabase-js : ne JAMAIS `await` un appel supabase
          // directement dans le callback onAuthStateChange. Le callback
          // s'exécute pendant que le verrou auth (navigator LockManager) est
          // tenu ; `fetchProfile` appelle `getSession()` qui veut le même
          // verrou → interblocage. Symptôme : `updateUser` (reset de mot de
          // passe) ne se résout jamais → spinner « Mise à jour… » infini
          // (le serveur a pourtant répondu 200). On DIFFÈRE donc le chargement
          // du profil hors du callback (setTimeout 0) : le callback retourne,
          // le verrou se libère, puis le fetch s'exécute normalement.
          // Depuis le 2026-09-11 le client ne tient plus AUCUN verrou
          // (supabase-js ≥ 2.107, cf. shared/lib/supabase/client.js) : cet
          // interblocage-là n'existe plus par construction. Le report est
          // conservé — il ne coûte rien, et le paquet signale un cas résiduel
          // (`refreshSession` appelé depuis un handler TOKEN_REFRESHED).
          setTimeout(async () => {
            const p = await fetchProfile(currentUser.id)
            // Réponse tardive d'un compte qui n'est plus celui de la session
            // (A puis B, ou déconnexion entre-temps) : jetée (audit CPT-12).
            if (prevUserRef.current?.id !== currentUser.id) return
            setProfile(p)
            if (p) setProfilIndisponible(false)
            // Rétention « retour » : horodate la dernière OUVERTURE de l'app
            // (login explicite ou reprise de session au boot) — PAS sur
            // TOKEN_REFRESHED (refresh de fond) pour ne pas écrire à chaque
            // rafraîchissement de jeton. Débloque la mesure de rétention + le
            // mail RGPD d'inactivité (sa vue filtre last_login_at IS NOT NULL).
            if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && !connexionDejaNotee(currentUser.id)) {
              noterLaConnexion(currentUser.id)
              supabase
                .from('profiles')
                .update({ last_login_at: new Date().toISOString() })
                .eq('id', currentUser.id)
                .then(({ error }) => {
                  if (error && import.meta.env.DEV) console.error('[AuthContext] last_login_at:', error.message)
                })
            }
            // Plus d'annulation automatique d'une suppression (audit du
            // 2026-10-04, BDD-04) : elle s'exécutait à CHAQUE événement — un
            // rechargement, un retour d'onglet, un jeton rafraîchi — et la purge
            // à 30 jours ne trouvait plus rien. L'écran « en cours de
            // suppression » propose le choix ; seul son bouton annule.
          }, 0)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )
    return () => subscription.unsubscribe()
    // `setProfilIndisponible` vient du hook de secours : un setter d'état, stable.
  }, [setProfilIndisponible])

  // Realtime : détecte le ban/déban en temps réel sans rechargement
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`profile-watch-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user.id}`,
      }, (payload) => {
        // Seulement les colonnes que fetchProfile lit : la ligne ENTIÈRE arrive
        // ici, `restore_token` compris, exclu exprès à la lecture (audit CPT-12).
        if (payload.new) {
          const sur = colonnesDuProfil(payload.new)
          setProfile(prev => prev ? { ...prev, ...sur } : sur)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user?.id])

  const isAdmin = profile?.role === 'admin' && !mfa.requis

  // Préférences allergènes — invité → localStorage ; connecté →
  // profile.allergen_prefs. Cf. shared/hooks/use-allergen-prefs.js.
  const allergenes = useAllergenPrefs({ user, profile, loading, updateProfile, setProfile })

  async function signInWithEmail(email, password) {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) return { error }
      // Note : l'auto-restore d'un compte soft-deleted est désormais
      // géré dans onAuthStateChange (cf. plus haut). Cela réduit la
      // latence du signin et évite que la modale auth reste bloquée
      // si le profil met du temps à arriver. Le user state se met à
      // jour via le subscriber, ce qui déclenche la fermeture
      // automatique de la modale.
      return { error: null }
    } catch (err) {
      if (import.meta.env.DEV) console.error('[AuthContext] signInWithEmail error:', err)
      return { error: { message: err?.message ?? 'unknown' } }
    }
  }

  // Login/inscription via Google (OAuth). Redirige le navigateur vers Google
  // puis revient sur l'app (?code=…) ; supabase-js échange le code (PKCE) et
  // émet SIGNED_IN. Scopes minimaux (email profile) = minimisation RGPD.
  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin, scopes: 'email profile' },
    })
    return { error }
  }

  // Restaure un compte via le lien email (utilise restore-account
  // edge function qui ne demande pas d'auth — le user n'est pas connecté).
  async function restoreAccount(token) {
    try {
      const { data, error } = await supabase.functions.invoke('restore-account', {
        body: { token },
      })
      if (error) {
        let body = null
        try { body = await error.context?.json?.() } catch { /* ignore */ }
        return { error: { code: body?.error ?? 'restore_failed', message: error.message } }
      }
      return { data, error: null }
    } catch (err) {
      return { error: { code: 'network_error', message: err?.message ?? 'unknown' } }
    }
  }

  // `lang` est stocké dans user_metadata (options.data.lang) → les templates
  // d'emails Supabase Auth peuvent brancher dessus ({{ if eq .Data.lang "en" }})
  // pour envoyer confirmation / reset dans la langue de l'utilisateur (#6).
  //
  // `consentAccepted` : la case « j'ai 16 ans et j'accepte… » du formulaire.
  // Transmise, elle est DATÉE par le déclencheur `handle_new_user`, à l'heure
  // du serveur. Jusqu'au 2026-10-04 elle ne faisait qu'autoriser le bouton et
  // aucune preuve n'était enregistrée (audit CPT-06).
  async function signUpWithEmail(email, password, username, lang = 'fr', { consentAccepted = false } = {}) {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { username: username.trim(), lang, ...(consentAccepted ? { consent_accepted: true } : {}) },
      },
    })
    return { error }
  }

  // Renvoie l'e-mail de confirmation d'inscription : e-mail perdu, lien expiré
  // ou ouvert dans un autre navigateur. Le service refuse plus d'une demande
  // par minute et par adresse (l'erreur est rendue telle quelle).
  async function resendSignupEmail(email) {
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() })
      return { error: error ?? null }
    } catch (err) {
      return { error: { message: err?.message ?? 'unknown' } }
    }
  }

  // Date l'acceptation des conditions pour un compte qui n'a pas pu la donner à
  // l'inscription (parcours Google : c'est l'écran « Choisis ton pseudo » qui
  // porte la case). La date est posée par la base, une seule fois ; le
  // navigateur ne l'écrit jamais lui-même.
  async function recordSignupConsent() {
    try {
      const { data, error } = await supabase.rpc('record_signup_consent')
      if (error) return { error }
      if (data) {
        setProfile(p => (p ? {
          ...p,
          consent_terms_accepted_at: p.consent_terms_accepted_at ?? data,
          consent_privacy_accepted_at: p.consent_privacy_accepted_at ?? data,
        } : p))
      }
      return { error: null }
    } catch (err) {
      return { error: { message: err?.message ?? 'unknown' } }
    }
  }

  async function signOut() {
    setUser(null)
    setProfile(null)
    await supabase.auth.signOut()
  }

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    return { error }
  }

  // Recharge le profil depuis Supabase et met à jour le state local.
  // Utilisé après les opérations Edge Function qui modifient les
  // champs de profile sans passer par updateProfile (ex: confirm-password-change
  // qui set password_changed_at côté serveur).
  async function refreshProfile() {
    if (!user?.id) return
    const p = await fetchProfile(user.id)
    if (p) setProfile(p)
  }

  async function updateProfile(fields) {
    // Capture l'ancien pseudo AVANT update pour la notif si nécessaire.
    const oldUsername = profile?.username
    // Premier choix du pseudo (le pseudo d'attente d'un compte Google est
    // remplacé) : ce n'est pas un changement à signaler. Sans cette garde,
    // toute nouvelle inscription Google recevait l'alerte « pseudo modifié ».
    const firstChoice = profile?.username_confirmed === false
    const { error } = await supabase
      .from('profiles')
      .update(fields)
      .eq('id', user.id)
    if (error && import.meta.env.DEV) {
      console.error('[AuthContext] updateProfile error:', error.message, error.code, error.details, 'fields:', fields)
    }
    if (!error) {
      setProfile(p => ({ ...p, ...fields }))
      // Si le pseudo a changé, envoie une notif email (non bloquant).
      if (typeof fields.username === 'string' && fields.username !== oldUsername && !firstChoice) {
        sendChangeNotification('pseudo', { oldValue: oldUsername, newValue: fields.username })
      }
    }
    return { error }
  }

  async function updateEmail(newEmail) {
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
      if (error && import.meta.env.DEV) {
        console.error('[AuthContext] updateEmail error:', error.code, error.message, error.status)
      }
      return { error }
    } catch (err) {
      // Filet de sécurité : si supabase-js lève une exception (réseau,
      // CORS, état auth corrompu…), on retourne un objet error standard
      // pour que le caller n'ait pas à gérer le throw — sinon son
      // setLoading(false) est skippé et l'UI reste bloquée.
      if (import.meta.env.DEV) console.error('[AuthContext] updateEmail threw:', err)
      return { error: { code: 'network_error', message: err?.message ?? 'unknown' } }
    }
  }

  async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error }
  }

  // Vérifie que le mot de passe actuel est correct, sans modifier la session.
  // Utilisé en pré-check avant un changement de mdp depuis le profil.
  // signInWithPassword crée une nouvelle session côté client mais reste
  // associé au même user (pas de logout) ; suffit pour valider l'identité.
  async function verifyCurrentPassword(password) {
    if (!user?.email) return { ok: false }
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    })
    return { ok: !error }
  }

  // Demande à Supabase l'envoi d'un email "mot de passe oublié" pour le user
  // actuel. Lien valable une heure, une seule fois (c'est ce que dit l'e-mail ;
  // ce commentaire a affirmé « ~24h » jusqu'au 2026-10-04), même flow que la
  // connexion. C'est désormais la SEULE voie de modification du mot de passe
  // (la voie ancien + nouveau a été retirée pour ne pas avoir 2 chemins
  // concurrents).
  async function requestPasswordResetEmail() {
    if (!user?.email) return { error: { message: 'Not authenticated' } }
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/?recovery=1`,
    })
    return { error }
  }

  async function completePasswordReset(newPassword) {
    const { data: updateData, error } = await supabase.auth.updateUser({ password: newPassword })
    if (!error) {
      // Trace la modif dans profiles pour l'affichage « Dernière
      // modification » de Mon profil → Identité. Non bloquant.
      const uid = updateData?.user?.id ?? user?.id
      if (uid) {
        const { error: stampErr } = await supabase
          .from('profiles')
          .update({ password_changed_at: new Date().toISOString() })
          .eq('id', uid)
        if (stampErr && import.meta.env.DEV) console.warn('[AuthContext] password_changed_at stamp failed:', stampErr.message)
      }
      // Envoi de la notification email AVANT signOut pour conserver la
      // session active pour l'appel à l'Edge Function.
      await sendChangeNotification('password', {})
      setRecoveryMode(false)
      await supabase.auth.signOut()
    }
    return { error }
  }

  async function deleteAccount(lang = 'fr') {
    if (!user) return { error: { message: 'Not authenticated' } }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { error: { message: 'No active session' } }
    // Soft-delete via Edge Function : marque deleted_at = now() +
    // restore_token, sign out toutes les sessions, envoie un email de
    // confirmation avec lien d'annulation valide 30 jours.
    //
    // try/catch autour du fetch : avant, une erreur réseau
    // (offline, DNS, timeout, CORS) bubble en exception non gérée et
    // l'user voyait juste un crash. Maintenant : message d'erreur
    // explicite + remontée Sentry pour qu'on diagnostique en prod.
    let res
    try {
      res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ lang }),
        }
      )
    } catch (err) {
      logError(err, { tag: 'auth.deleteAccount.fetch', userId: user.id })
      return { error: { message: 'Erreur réseau : suppression compte impossible. Réessaie dans quelques secondes.' } }
    }
    let json
    try {
      json = await res.json()
    } catch (err) {
      logError(err, { tag: 'auth.deleteAccount.parse', status: res.status, userId: user.id })
      return { error: { message: 'Réponse serveur invalide. Contacte le support si le problème persiste.' } }
    }
    if (!res.ok) {
      logError(new Error(json.error ?? `HTTP ${res.status}`), { tag: 'auth.deleteAccount.serverError', status: res.status, userId: user.id })
      return { error: { message: json.error ?? 'Erreur suppression compte' } }
    }
    // La trace APRÈS le succès (elle existait même quand la suppression
    // échouait), puis une VRAIE déconnexion : portée « global », elle révoque
    // toutes les sessions du compte, autres appareils compris (BDD-04, CPT-04).
    await supabase.from('activity_logs').insert({ user_id: user.id, action: 'account_soft_deleted', target_id: user.id, target_type: 'user' })
    setCompteDesactive({ effaceLe: json.expiresAt })
    await supabase.auth.signOut()
    return { error: null, retentionDays: json.retentionDays, expiresAt: json.expiresAt }
  }

  // Le bouton « Annuler la suppression » de l'écran « en cours de
  // suppression » : le SEUL geste qui annule, depuis l'app (BDD-04).
  async function annulerLaSuppression() {
    if (!user) return { error: { message: 'Not authenticated' } }
    const { error } = await supabase.from('profiles').update({ deleted_at: null, restore_token: null }).eq('id', user.id)
    if (!error) setProfile((prev) => (prev ? { ...prev, deleted_at: null, restore_token: null } : prev))
    return { error }
  }

  // Mémoïsation du value Provider. Avant : 16 valeurs
  // recréées à chaque render → 31+ consommateurs (useAuth) re-render
  // sans raison. Identité référentielle stable tant que l'état auth
  // ne change pas. Les callbacks (signIn, signOut, etc.) sont déjà
  // stables (définis dans le scope component sans deps).
  const value = useMemo(() => ({
    user, profile, loading, profileLoading, profilIndisponible, relancerLeProfil,
    isAdmin, mfaRequired: mfa.requis, mfaFactorId: mfa.facteurId,
    recoveryMode,
    authLinkProblem, clearAuthLinkProblem,
    ...allergenes,
    signInWithEmail, signUpWithEmail, resendSignupEmail, recordSignupConsent, signInWithGoogle, signOut,
    resetPassword, updateProfile, refreshProfile, updateEmail,
    updatePassword, verifyCurrentPassword, requestPasswordResetEmail,
    deleteAccount, restoreAccount, completePasswordReset, annulerLaSuppression,
    compteDesactive, oublierCompteDesactive: () => setCompteDesactive(null),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user, profile, loading, profileLoading, profilIndisponible, relancerLeProfil, isAdmin, mfa, recoveryMode, authLinkProblem, allergenes, compteDesactive])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
