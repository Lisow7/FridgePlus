import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { getLegalSection } from '@features/legal/data/legal-content'

// Audit du 2026-10-04, RGPD-06, RGPD-08, RGPD-09, RGPD-16 : la politique de
// confidentialité oubliait des destinataires réels et promettait des choses
// fausses. Chaque ligne ci-dessous a été vérifiée dans les faits le
// 2026-10-06 (enregistrements MX du domaine, hôtes d'emoji dans le code,
// connexion Google, flux de sauvegarde).

const politique = (lang) => JSON.stringify(getLegalSection(lang, 'privacy'))
const sauvegarde = readFileSync(resolve(process.cwd(), '.github/workflows/backup.yml'), 'utf8')

describe('la politique de confidentialité cite tous les destinataires réels', () => {
  for (const lang of ['fr', 'en']) {
    it(`${lang} : GitHub (sauvegardes), ImprovMX (e-mails du support), Google (connexion)`, () => {
      const texte = politique(lang)
      expect(texte).toMatch(/GitHub Inc\./)
      expect(texte).toMatch(/ImprovMX/)
      expect(texte).toMatch(/Continuer avec Google|Continue with Google/)
    })

    // Décision du 2026-10-06 (« emoji = sur_le_site ») : les emoji sont
    // servis par le site ; Iconify et jsDelivr ne reçoivent plus rien.
    it(`${lang} : Iconify et jsDelivr ne sont plus des destinataires`, () => {
      expect(politique(lang)).not.toMatch(/Iconify|jsDelivr/)
    })

    it(`${lang} : les crédits nomment Twemoji et sa licence (CC-BY 4.0 exige l’attribution)`, () => {
      expect(JSON.stringify(getLegalSection(lang, 'legal'))).toMatch(/Twemoji[^"]*CC-BY 4\.0/)
    })
  }
})

describe('les durées annoncées sont celles que la base applique', () => {
  it('demandes au support : effacées 24 mois après leur résolution (tâche `purge_old_resolved_tickets`), pas « 3 ans »', () => {
    expect(politique('fr')).toMatch(/Demandes au support résolues : effacées 24 mois après leur résolution/)
    expect(politique('en')).toMatch(/Resolved support requests: deleted 24 months after resolution/)
    expect(politique('fr')).not.toMatch(/Tickets support fermés : 3 ans/)
  })
})

// Décision du 2026-10-06 (choix d'Antoine, « purge_usage = oui ») : la
// durée des statistiques d'usage devient vraie. Avant, la politique annonçait
// « 13 mois » pour des « cookies analytiques » qui n'existent pas, et rien
// n'effaçait `product_events`.
describe('statistiques d’usage : la durée dite est celle que la base applique', () => {
  const migrations = readdirSync(resolve(process.cwd(), 'supabase/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(resolve(process.cwd(), 'supabase/migrations', f), 'utf8'))
    .join('\n')

  it('une tâche quotidienne efface les événements de plus de 13 mois', () => {
    expect(migrations).toMatch(/cron\.schedule\('purge_product_events_13_mois', '\d+ \d+ \* \* \*', \$\$DELETE FROM public\.product_events WHERE occurred_at < now\(\) - interval '13 months'\$\$\)/)
  })

  it('la politique le dit, et dit la vraie durée de l’identifiant anonyme (6 mois, comme le choix des cookies)', () => {
    expect(politique('fr')).toMatch(/Statistiques d['’]usage \(si tu y consens\) : effacées 13 mois après leur enregistrement ; l['’]identifiant anonyme qui les relie s['’]efface quand tu retires ton accord, ou au bout de 6 mois/)
    expect(politique('en')).toMatch(/Usage statistics \(if you consent\): deleted 13 months after they are recorded; the anonymous identifier linking them is erased when you withdraw consent, or after 6 months/)
    expect(politique('fr')).not.toMatch(/Cookies analytiques/)
    expect(politique('en')).not.toMatch(/Analytics cookies/)
  })
})

// Décision du 2026-10-07 (choix d'Antoine, « non_confirmes = 30_jours ») : un
// compte jamais confirmé, jamais connecté et sans données s'efface au bout de
// 30 jours — il gardait son pseudo pour toujours, sans durée.
describe('comptes jamais confirmés : la durée dite est celle que la base applique', () => {
  const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261008_comptes_jamais_confirmes.sql'), 'utf8')

  it('une tâche quotidienne efface les comptes jamais confirmés, jamais connectés, de plus de 30 jours', () => {
    expect(migration).toMatch(/cron\.schedule\('effacer_comptes_jamais_confirmes', '\d+ \d+ \* \* \*'/)
    expect(migration).toMatch(/email_confirmed_at IS NULL[\s\S]*last_sign_in_at IS NULL[\s\S]*interval '30 days'/)
  })

  it('la politique le dit', () => {
    expect(politique('fr')).toMatch(/Compte jamais confirmé \(adresse jamais vérifiée, aucune connexion\) : effacé au bout de 30 jours/)
    expect(politique('en')).toMatch(/Never-confirmed account \(address never verified, never signed in\): deleted after 30 days/)
  })
})

describe('le navigateur appelle Open Food Facts : c’est dit', () => {
  for (const lang of ['fr', 'en']) {
    it(`${lang} : Open Prices reçoit le nom du produit, le pays et l’adresse IP`, () => {
      expect(politique(lang)).toMatch(/Open Food Facts[^"]*(adresse IP|IP address)/)
    })
  }
})

describe('les sauvegardes : ce qui est promis est ce qui est fait', () => {
  it('le flux garde les sauvegardes 30 jours — la durée annoncée par la politique et la page de suppression', () => {
    expect(sauvegarde).toMatch(/retention-days: 30\b/)
    expect(politique('fr')).toMatch(/Sauvegardes chiffrées : 30 jours/)
    expect(politique('en')).toMatch(/Encrypted backups: 30 days/)
  })

  it('aucune restauration « régulièrement testée » : elle ne l’a jamais été', () => {
    expect(politique('fr')).not.toMatch(/régulièrement testée/)
    expect(politique('en')).not.toMatch(/regularly tested/)
  })
})
