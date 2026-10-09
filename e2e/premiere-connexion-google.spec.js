import { test, expect } from '@playwright/test'
import {
  installSupabaseMocks, assertNoUnmockedCalls, skipOnboardingOverlays,
  signedInAs, profileWrites, mockRpc, rpcCalls,
} from './support/supabase-mock.js'

// Première connexion avec Google — audit du 2026-10-04 (CPT-05, CPT-06, CPT-09).
//
// Un compte Google arrive sans pseudo : la base lui en pose un d'attente
// (`chef_…`, `username_confirmed = false`) et l'application affiche l'écran
// « Choisis ton pseudo » avant toute autre chose. C'est par là que sont passés
// la plupart des comptes. Avant ce lot, cet écran :
//   - ne contrôlait que la longueur du pseudo ;
//   - demandait « est-il libre ? » à une table qu'il ne peut pas lire ;
//   - répondait « Impossible d'enregistrer. Réessaie. » à un pseudo déjà pris ;
//   - faisait cocher « j'ai 16 ans et j'accepte… » sans rien enregistrer.
//
// La base est simulée (un seul projet Supabase, celui de production) : ce test
// couvre l'écran et ce qu'il envoie. Les règles de la base elles-mêmes sont
// prouvées par `supabase/probes/20261004_inscription_sans_impasse.sql`.

const PSEUDO_D_ATTENTE = 'chef_1a2b3c4d'
const DATE_SERVEUR = '2026-10-04T21:38:50+00:00'

async function arriverSansPseudo(page, profile = {}) {
  await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'fr'))
  await skipOnboardingOverlays(page)
  // À INSTALLER EN PREMIER : les mocks de scénario posés ensuite le masquent.
  await installSupabaseMocks(page)
  await signedInAs(page, {
    username: PSEUDO_D_ATTENTE,
    profile: {
      username_confirmed: false,
      consent_terms_accepted_at: null,
      consent_privacy_accepted_at: null,
      ...profile,
    },
  })
}

const champ = (page) => page.getByRole('textbox')
const continuer = (page) => page.getByRole('button', { name: 'Continuer' }).click()
// Les écritures du profil qui portent un pseudo (l'horodatage de connexion en est une autre).
const pseudosEcrits = (page) => profileWrites(page).filter((corps) => 'username' in corps)

test.describe('Première connexion Google : l’écran « Choisis ton pseudo »', () => {
  test('s’impose avant l’app, dit la règle, et ne laisse pas passer sans la case', async ({ page }) => {
    await arriverSansPseudo(page)
    await page.goto('/FridgePlus/')

    await expect(page.getByRole('heading', { name: 'Choisis ton pseudo' })).toBeVisible()
    // L'app n'est pas derrière : pas de frigo tant que le pseudo n'est pas choisi.
    await expect(page.getByRole('button', { name: /Ouvrir le frigo/i })).toHaveCount(0)
    // Le pseudo d'attente n'est jamais montré ni proposé.
    await expect(champ(page)).not.toHaveValue(PSEUDO_D_ATTENTE)
    // La règle est dite avant l'erreur.
    await expect(page.getByText('3 à 20 caractères : lettres sans accent, chiffres, _ et -.')).toBeVisible()

    await continuer(page)
    await expect(page.getByRole('alert')).toContainText(/confirme ton âge/i)
    expect(rpcCalls(page), 'rien ne part sans la case').toEqual([])
    expect(pseudosEcrits(page)).toEqual([])
  })

  // Cet écran s'affiche SANS l'en-tête de l'app : le gabarit des pages de
  // connexion, qui réserve 96 px pour lui, laissait une bande d'une autre
  // couleur en bas de la fenêtre.
  for (const [nom, largeur, hauteur] of [['ordinateur', 1440, 900], ['téléphone', 360, 740]]) {
    test(`occupe toute la fenêtre (${nom})`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: hauteur })
      await arriverSansPseudo(page)
      await page.goto('/FridgePlus/')
      await expect(page.getByRole('heading', { name: 'Choisis ton pseudo' })).toBeVisible()
      const basCouvert = await page.evaluate(() => {
        const element = document.elementFromPoint(8, window.innerHeight - 4)
        return !!element && !['HTML', 'BODY'].includes(element.tagName) && element.id !== 'root'
      })
      expect(basCouvert, 'le fond de l’écran descend jusqu’en bas de la fenêtre').toBe(true)
    })
  }

  test('pseudo hors règle, puis pseudo pris : deux refus qui disent pourquoi, et rien n’est écrit', async ({ page }) => {
    await arriverSansPseudo(page)
    await mockRpc(page, 'username_available', false)
    await mockRpc(page, 'record_signup_consent', DATE_SERVEUR)
    await page.goto('/FridgePlus/')
    await page.getByRole('checkbox').check()

    await champ(page).fill('Zoé')
    await continuer(page)
    await expect(page.getByRole('alert')).toContainText(/lettres sans accent/i)
    expect(rpcCalls(page), 'un pseudo hors règle n’interroge pas la base').toEqual([])

    await champ(page).fill('Admin_42')
    await continuer(page)
    await expect(page.getByRole('alert')).toContainText('Ce pseudo n\'est pas disponible')
    expect(rpcCalls(page).map((appel) => appel.nom)).toEqual(['username_available'])
    expect(rpcCalls(page)[0].args).toEqual({ p_username: 'Admin_42' })
    // Ni preuve d'acceptation, ni pseudo : on n'entre pas.
    expect(pseudosEcrits(page)).toEqual([])
    await expect(page.getByRole('heading', { name: 'Choisis ton pseudo' })).toBeVisible()
  })

  test('pseudo libre : l’acceptation est datée par la base, le pseudo confirmé, et l’app s’ouvre', async ({ page }) => {
    await arriverSansPseudo(page)
    await mockRpc(page, 'username_available', true)
    await mockRpc(page, 'record_signup_consent', DATE_SERVEUR)
    await page.goto('/FridgePlus/')

    await page.getByRole('checkbox').check()
    await champ(page).fill('Jean_42')
    await continuer(page)

    await expect(page.getByRole('heading', { name: 'Choisis ton pseudo' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Ouvrir le frigo/i })).toBeVisible()

    // L'ordre est une règle : le pseudo est vérifié, l'acceptation datée, PUIS le pseudo écrit.
    expect(rpcCalls(page).map((appel) => appel.nom)).toEqual(['username_available', 'record_signup_consent'])
    // Le navigateur n'écrit que le pseudo : la date de la preuve vient de la base.
    expect(pseudosEcrits(page)).toEqual([{ username: 'Jean_42', username_confirmed: true }])
    // Premier choix du pseudo : pas d'e-mail « ton pseudo a été modifié »
    // (l'appel à la fonction d'envoi compterait comme requête inattendue).
    assertNoUnmockedCalls(page)
  })

  test('acceptation déjà datée (inscription par e-mail) : la case n’est pas redemandée', async ({ page }) => {
    await arriverSansPseudo(page, { consent_terms_accepted_at: DATE_SERVEUR, consent_privacy_accepted_at: DATE_SERVEUR })
    await mockRpc(page, 'username_available', true)
    await page.goto('/FridgePlus/')

    await expect(page.getByRole('heading', { name: 'Choisis ton pseudo' })).toBeVisible()
    await expect(page.getByRole('checkbox')).toHaveCount(0)
    await champ(page).fill('Jean_42')
    await continuer(page)

    await expect(page.getByRole('button', { name: /Ouvrir le frigo/i })).toBeVisible()
    expect(rpcCalls(page).map((appel) => appel.nom)).toEqual(['username_available'])
    assertNoUnmockedCalls(page)
  })
})
