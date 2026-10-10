// Brouillon persistant du formulaire de création de recette.
// R-02 de l'audit zone création de recette (v0.30).
// cf. la conception « recipe-creation-zone-review » du 2026-06-10
//
// Tout est local au navigateur (localStorage). Aucune donnée sur le réseau.
// → RGPD-neutre par défaut. Pas de mention politique nécessaire.
//
// Un seul brouillon à la fois. La clé est globale (pas par user), mais elle
// s'efface à la déconnexion avec les autres clés locales du compte
// (`@shared/lib/auth/purge-locale`) : sur un navigateur partagé, le compte
// suivant ne se voit pas proposer « Reprendre » le brouillon du précédent
// (SEC-13). Entre deux sessions de la MÊME personne, « Reprendre » ou
// « Repartir de zéro » reste son choix.

export const DRAFT_KEY = 'fridge-recipe-draft'
export const DRAFT_VERSION = 1
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000   // 7 jours

// Détecte le form state initial / vide. Évite de polluer localStorage et de
// faire surgir une banner « brouillon » alors que rien n'a été tapé.
export function isEmptyFormState(form) {
  if (!form) return true
  return !form.name
    && !form.emoji
    && !form.country
    && !form.time
    && !form.difficulty
    && !form.type
    && (form.ingredients?.length ?? 0) === 0
    && (form.steps?.length ?? 0) === 0
}

// Lecture défensive. Retourne { payload, savedAt } ou null.
// Purge automatiquement si version mismatch ou expiration : c'est volontaire,
// on ne veut pas garder des bouts illisibles ad vitam aeternam.
export function loadDraft(now = Date.now()) {
  if (typeof window === 'undefined' || !window.localStorage) return null
  let raw
  try { raw = window.localStorage.getItem(DRAFT_KEY) } catch { return null }
  if (!raw) return null

  let parsed
  try { parsed = JSON.parse(raw) } catch {
    clearDraft()
    return null
  }
  if (!parsed || typeof parsed !== 'object') { clearDraft(); return null }
  if (parsed.version !== DRAFT_VERSION) { clearDraft(); return null }

  const savedAt = Number(parsed.savedAt)
  if (!Number.isFinite(savedAt)) { clearDraft(); return null }
  if (now - savedAt > DRAFT_TTL_MS) { clearDraft(); return null }

  return { payload: parsed.payload, savedAt }
}

// Sauvegarde non bloquante. Si quota dépassé, on swallow silencieusement.
export function saveDraft(payload, now = Date.now()) {
  if (typeof window === 'undefined' || !window.localStorage) return
  if (isEmptyFormState(payload)) return
  const wrapper = { version: DRAFT_VERSION, savedAt: now, payload }
  try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(wrapper)) } catch { /* quota / private mode → tant pis */ }
}

export function clearDraft() {
  if (typeof window === 'undefined' || !window.localStorage) return
  try { window.localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
}

const AGE_I18N = {
  fr: {
    justNow: 'à l’instant',
    minutes: (n) => `il y a ${n} min`,
    hours:   (n) => `il y a ${n} h`,
    days:    (n) => `il y a ${n} j`,
  },
  en: {
    justNow: 'just now',
    minutes: (n) => `${n} min ago`,
    hours:   (n) => `${n} h ago`,
    days:    (n) => `${n} d ago`,
  },
}

// Renvoie un libellé relatif court, localisé. now optionnel = injectable pour tests.
// Renvoie '' si l'entrée est invalide (defensif).
export function formatRelativeAge(savedAt, lang = 'fr', now = Date.now()) {
  if (!Number.isFinite(savedAt)) return ''
  const sec = Math.max(0, Math.round((now - savedAt) / 1000))
  const t = AGE_I18N[lang] ?? AGE_I18N.fr
  if (sec < 60)              return t.justNow
  const min = Math.floor(sec / 60)
  if (min < 60)              return t.minutes(min)
  const hr  = Math.floor(min / 60)
  if (hr < 24)               return t.hours(hr)
  const day = Math.floor(hr / 24)
  return t.days(day)
}
