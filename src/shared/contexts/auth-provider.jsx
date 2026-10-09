import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@shared/lib/supabase/client'
import { setSentryUser, clearSentryUser, logError } from '@shared/lib/observability/sentry'

const AuthContext = createContext(null)

// Récupère la langue active depuis localStorage ; fallback 'fr'.
// Utilisé pour passer la lang aux Edge Functions de notification.
function getCurrentLang() {
  try { return localStorage.getItem('fridge-lang') ?? 'fr' }
  catch { return 'fr' }
}

// Envoi non bloquant d'une notification email après modification profil
// (pseudo / email / password). En cas d'échec on log mais on n'interrompt
// pas le flux : la modif est déjà appliquée en DB / auth, l'email est
// purement informatif.
async function sendChangeNotification(type, opts = {}) {
  try {
    await supabase.functions?.invoke('send-profile-change-notification', {
      body: {
        type,
        lang: opts.lang ?? getCurrentLang(),
        oldValue: opts.oldValue,
        newValue: opts.newValue,
      },
    })
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[AuthContext] notification', type, 'failed:', err)
  }
}

// `restore_token` exclu délibérément (2026-07-19, suite audit export RGPD) :
// c'est un credential de restauration de compte, jamais lu côté client (grep
// vérifié) — aucune raison de le charger en mémoire navigateur. Contrairement
// à l'export (allow-list stricte), cet état est consommé largement dans toute
// l'app (rôle, abonnement, badges...) donc pas d'allow-list ici : si une
// future colonne sensible est ajoutée à `profiles`, l'exclure explicitement.
async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_id, role, banned, created_at, updated_at, ' +
      'password_changed_at, allergen_prefs, deleted_at, language, last_login_at, ' +
      'consent_terms_accepted_at, consent_privacy_accepted_at, community_muted_until, ' +
      'community_terms_accepted_at, stripe_customer_id, subscription_status, trial_ends_at, ' +
      'subscription_ends_at, subscription_plan, monthly_budget, community_bio, ' +
      'profiling_opted_out, inactive_warned_at, per_trip_budget, special_role, ' +
      'username_confirmed, banner_id, unlocked_banners, country_code, push_preferences, ' +
      'push_last_variant_index, fridge_shape')
    .eq('id', userId)
    .single()
  if (error && import.meta.env.DEV) console.error('[AuthContext] fetchProfile error:', error.message, error.code)
  return data ?? null
}

export function AuthProvider({ children }) {
  const [user,         setUser]         = useState(null)
  const [profile,      setProfile]      = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(false)

  // Référence du précédent user observé pour détecter un changement
  // d'email (event USER_UPDATED de Supabase) et déclencher une notif.
  const prevUserRef = useRef(null)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
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
        // Sprint 11 S11.b — détection switch user (signout puis signin
        // sur un autre compte). On reset le profile à null AVANT le
        // fetch pour éviter d'afficher les infos de l'ancien user
        // pendant la latence réseau (bug visible « infos qui restent
        // à - jusqu'au refresh »).
        const prevUserId = prevUserRef.current?.id
        const isUserSwitch = currentUser && prevUserId && prevUserId !== currentUser.id
        if (isUserSwitch) setProfile(null)
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
            setProfile(p)
            // Rétention « retour » : horodate la dernière OUVERTURE de l'app
            // (login explicite ou reprise de session au boot) — PAS sur
            // TOKEN_REFRESHED (refresh de fond) pour ne pas écrire à chaque
            // rafraîchissement de jeton. Débloque la mesure de rétention + le
            // mail RGPD d'inactivité (sa vue filtre last_login_at IS NOT NULL).
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
              supabase
                .from('profiles')
                .update({ last_login_at: new Date().toISOString() })
                .eq('id', currentUser.id)
                .then(({ error }) => {
                  if (error && import.meta.env.DEV) console.error('[AuthContext] last_login_at:', error.message)
                })
            }
            // Auto-restore d'un compte soft-deleted : si le user revient se
            // connecter pendant la fenêtre de 30 jours, on annule la
            // suppression (deleted_at + restore_token → NULL).
            if (p?.deleted_at) {
              const { error: restoreErr } = await supabase
                .from('profiles')
                .update({ deleted_at: null, restore_token: null })
                .eq('id', currentUser.id)
              if (!restoreErr) {
                setProfile(prev => prev ? { ...prev, deleted_at: null, restore_token: null } : prev)
              } else if (import.meta.env.DEV) {
                console.error('[AuthContext] auto-restore failed:', restoreErr.message)
              }
            }
          }, 0)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  // Filet de sécurité : si user est là mais profile absent (race Strict Mode,
  // Lock Manager Supabase, switch user signout→signin rapide), on recharge
  // avec retry exponentiel.
  //
  // Sprint 11 S11.b — retry 4 fois (200ms, 500ms, 1000ms, 2000ms) avant
  // d'abandonner. Évite le bug « infos profile à - jusqu'au refresh »
  // observé après un switch user (signout puis signin sur autre compte)
  // quand le premier fetchProfile fail silencieusement.
  useEffect(() => {
    if (!user || profile !== null || loading) return
    let cancelled = false
    const delays = [200, 500, 1000, 2000]
    let attempt = 0
    let timeoutId = null

    async function tryFetch() {
      if (cancelled) return
      const p = await fetchProfile(user.id)
      if (cancelled) return
      if (p) {
        setProfile(p)
        return
      }
      attempt += 1
      if (attempt < delays.length) {
        timeoutId = setTimeout(tryFetch, delays[attempt])
      }
    }
    timeoutId = setTimeout(tryFetch, delays[0])

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [user, profile, loading])

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
        if (payload.new) setProfile(prev => prev ? { ...prev, ...payload.new } : payload.new)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user?.id])

  const isAdmin = profile?.role === 'admin'

  // ── Préférences allergènes ────────────────────────────────
  // Invité → localStorage ; connecté → profile.allergen_prefs
  const [allergenPrefs, setAllergenPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fridge-allergen-prefs') ?? '[]') }
    catch { return [] }
  })

  useEffect(() => {
    if (profile) {
      setAllergenPrefs(profile.allergen_prefs ?? [])
    } else if (!loading) {
      try { setAllergenPrefs(JSON.parse(localStorage.getItem('fridge-allergen-prefs') ?? '[]')) }
      catch { setAllergenPrefs([]) }
    }
  }, [profile, loading])

  async function updateAllergenPrefs(prefs) {
    setAllergenPrefs(prefs)
    if (user) return updateProfile({ allergen_prefs: prefs })
    localStorage.setItem('fridge-allergen-prefs', JSON.stringify(prefs))
    return { error: null }
  }

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
  async function signUpWithEmail(email, password, username, lang = 'fr') {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: username.trim(), lang } },
    })
    return { error }
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
      if (typeof fields.username === 'string' && fields.username !== oldUsername) {
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
  // actuel. Lien valide ~24h, même flow que la connexion. C'est désormais
  // la SEULE voie de modification du mot de passe (la voie ancien + nouveau
  // a été retirée pour ne pas avoir 2 chemins concurrents).
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
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'account_soft_deleted',
      target_id: user.id,
      target_type: 'user',
    })
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
    setUser(null)
    setProfile(null)
    return { error: null, retentionDays: json.retentionDays, expiresAt: json.expiresAt }
  }

  // Mémoïsation du value Provider. Avant : 16 valeurs
  // recréées à chaque render → 31+ consommateurs (useAuth) re-render
  // sans raison. Identité référentielle stable tant que l'état auth
  // ne change pas. Les callbacks (signIn, signOut, etc.) sont déjà
  // stables (définis dans le scope component sans deps).
  const value = useMemo(() => ({
    user, profile, loading, isAdmin,
    recoveryMode,
    allergenPrefs, updateAllergenPrefs,
    signInWithEmail, signUpWithEmail, signInWithGoogle, signOut,
    resetPassword, updateProfile, refreshProfile, updateEmail,
    updatePassword, verifyCurrentPassword, requestPasswordResetEmail,
    deleteAccount, restoreAccount, completePasswordReset,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user, profile, loading, isAdmin, recoveryMode, allergenPrefs])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
