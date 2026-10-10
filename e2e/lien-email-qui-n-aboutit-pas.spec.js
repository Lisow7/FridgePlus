import { test, expect } from '@playwright/test'
import { installSupabaseMocks, assertNoUnmockedCalls, skipOnboardingOverlays } from './support/supabase-mock.js'

// Audit du 2026-10-04 (CPT-03). Un lien reçu par e-mail — confirmation
// d'inscription, mot de passe oublié — ramène sur le site. S'il est expiré,
// déjà utilisé, ou ouvert dans un autre navigateur que celui de la demande, la
// bibliothèque d'authentification n'ouvre aucune session ET ne dit rien :
// la personne arrivait sur l'accueil, déconnectée, sans un mot.
//
// Ces tests jouent les deux adresses de retour telles que le service les
// fabrique, dans un navigateur qui n'a rien demandé (aucune clé PKCE en
// mémoire) : c'est exactement le cas « lien ouvert ailleurs ».

const EXPIRE = '?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
  + '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'

async function preparer(page, { sansAccueil = true } = {}) {
  await page.addInitScript(() => window.localStorage.setItem('fridge-lang', 'fr'))
  if (sansAccueil) await skipOnboardingOverlays(page)
  await installSupabaseMocks(page)
}

test.describe('Lien e-mail qui n’aboutit pas', () => {
  test('lien expiré ou déjà utilisé : un bandeau le dit, et dit quoi faire', async ({ page }) => {
    await preparer(page)
    await page.goto(`/FridgePlus/${EXPIRE}`)

    const bandeau = page.getByRole('alert').filter({ hasText: 'Ce lien a expiré ou a déjà servi' })
    await expect(bandeau).toBeVisible()
    await expect(bandeau).toContainText('Demande-en un nouveau depuis « Se connecter »')
    // L'adresse est nettoyée : un rechargement ne rejoue pas le message.
    await expect(page).toHaveURL(/\/FridgePlus\/$/)
    await page.reload()
    await expect(page.getByRole('button', { name: /Ouvrir le frigo/i })).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: 'Ce lien a expiré' })).toHaveCount(0)
    assertNoUnmockedCalls(page)
  })

  test('lien ouvert dans un autre navigateur : un bandeau le dit, et reste le temps d’être lu', async ({ page }) => {
    await preparer(page)
    await page.goto('/FridgePlus/?code=6f1c2b7e-0000-4000-8000-000000000000')

    const bandeau = page.getByRole('alert').filter({ hasText: 'Ce lien n’a pas pu te connecter dans ce navigateur' })
    await expect(bandeau).toBeVisible()
    await expect(bandeau).toContainText('Connecte-toi avec ton mot de passe')
    await expect(bandeau).toContainText('refais la demande depuis cet appareil')
    await expect(page).toHaveURL(/\/FridgePlus\/$/)
    // Il ne se ferme pas tout seul (le bandeau de restauration, lui, part après 8 s).
    await page.waitForTimeout(9000)
    await expect(bandeau).toBeVisible()
    // Il se ferme à la croix.
    await bandeau.getByRole('button', { name: 'Fermer' }).click()
    await expect(bandeau).toHaveCount(0)
    assertNoUnmockedCalls(page)
  })

  // Le cas réel de « l'autre navigateur » : une première visite, donc avec
  // l'écran de bienvenue et le bandeau cookies par-dessus l'accueil.
  for (const [nom, largeur, hauteur] of [['ordinateur', 1440, 900], ['téléphone', 360, 640]]) {
    test(`première visite sur ${nom} : le bandeau reste lisible, rien ne le recouvre`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: hauteur })
      await preparer(page, { sansAccueil: false })
      await page.goto('/FridgePlus/?code=6f1c2b7e-0000-4000-8000-000000000000')

      const bandeau = page.getByRole('alert').filter({ hasText: 'Ce lien n’a pas pu te connecter dans ce navigateur' })
      await expect(bandeau).toBeVisible()
      const etat = await bandeau.evaluate((el) => {
        const r = el.getBoundingClientRect()
        const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return {
          dansLaFenetre: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
          auDessus: el.contains(dessus),
          ecartAuCentre: Math.abs((r.left + r.right) / 2 - window.innerWidth / 2),
          largeur: r.width,
          largeurFenetre: window.innerWidth,
        }
      })
      expect(etat.dansLaFenetre, 'le bandeau tient dans la fenêtre').toBe(true)
      expect(etat.auDessus, 'rien ne recouvre le bandeau').toBe(true)
      // Centré, et large : l'animation d'entrée écrasait le centrage, le bandeau
      // partait du milieu de l'écran — une colonne de 180 px sur un téléphone.
      expect(etat.ecartAuCentre, 'le bandeau est centré').toBeLessThanOrEqual(1)
      expect(etat.largeur, 'le bandeau prend la largeur disponible').toBeGreaterThanOrEqual(Math.min(520, etat.largeurFenetre - 32))
    })
  }
})
