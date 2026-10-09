import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const etat = vi.hoisted(() => ({
  refus: new Set(), leve: new Set(), lectures: [],
  // Lignes par table (à défaut : une seule), plafond de lignes par réponse
  // (celui du serveur), la base compte-t-elle, et à partir de quelle ligne une
  // table se met à refuser.
  lignes: {}, plafond: 1000, compte: true, refusApres: {},
}))

// Une « base » minimale, qui se comporte comme PostgREST : elle ne rend jamais
// plus de `plafond` lignes par réponse — sans le dire —, elle sait compter si on
// le lui demande, et elle respecte la plage demandée. Chaque lecture est notée
// avec ses filtres, son ordre et sa plage.
vi.mock('@shared/lib/supabase/client', () => ({
  supabase: {
    from: (table) => {
      const lecture = { table, colonnes: null, filtres: [], ordre: null, plage: null, compte: false }
      etat.lectures.push(lecture)
      const reponse = () => {
        if (etat.leve.has(table)) return Promise.reject(new TypeError('Failed to fetch'))
        if (etat.refus.has(table)) return Promise.resolve({ data: null, error: { message: 'Failed to fetch' } })
        if (table === 'profiles') return Promise.resolve({ data: { username: 'bob' }, error: null })
        let toutes = etat.lignes[table] ?? [{ id: `${table}-1` }]
        const dans = lecture.filtres.find(([genre]) => genre === 'in')
        if (dans) toutes = toutes.filter((ligne) => ligne[dans[1]] === undefined || dans[2].includes(ligne[dans[1]]))
        const [debut, fin] = lecture.plage ?? [0, Infinity]
        if (etat.refusApres[table] !== undefined && debut >= etat.refusApres[table]) {
          return Promise.resolve({ data: null, error: { message: 'Failed to fetch' } })
        }
        const page = toutes.slice(debut, Math.min(fin + 1, debut + etat.plafond))
        return Promise.resolve({ data: page, error: null, count: lecture.compte && etat.compte ? toutes.length : null })
      }
      const requete = {
        select: (colonnes, options) => { lecture.colonnes = colonnes; lecture.compte = options?.count === 'exact'; return requete },
        eq: (colonne, valeur) => { lecture.filtres.push(['eq', colonne, valeur]); return requete },
        in: (colonne, valeurs) => { lecture.filtres.push(['in', colonne, valeurs]); return requete },
        order: (colonne) => { lecture.ordre = colonne; return requete },
        range: (debut, fin) => { lecture.plage = [debut, fin]; return requete },
        maybeSingle: () => reponse(),
        then: (resolu, rejete) => reponse().then(resolu, rejete),
      }
      return requete
    },
  },
}))

import { exportUserData, EXPORTED_DATASETS, NOT_EXPORTED } from '@features/profile/api/data-export'

// Audit du 2026-10-04, CPT-08. L'export ne regardait l'erreur d'AUCUNE requête :
// une lecture refusée laissait un trou dans le fichier, et l'écran annonçait
// « Téléchargement démarré ». Et il manquait le journal de cuisine, les
// dépenses, les messages de la communauté, les avis, les notifications.
describe('export des données — complet ou refusé', () => {
  beforeEach(() => {
    etat.refus.clear(); etat.leve.clear(); etat.lectures.length = 0
    etat.lignes = {}; etat.plafond = 1000; etat.compte = true; etat.refusApres = {}
  })

  it('tout se lit : le fichier porte chaque jeu de données', async () => {
    const resultat = await exportUserData('u1')
    expect(resultat.ok).toBe(true)
    expect(resultat.data.profile).toEqual({ username: 'bob' })
    for (const { key } of EXPORTED_DATASETS) {
      expect(resultat.data, `le fichier doit porter « ${key} »`).toHaveProperty(key)
      expect(Array.isArray(resultat.data[key]), `« ${key} » est une liste`).toBe(true)
      expect(resultat.data[key]).toHaveLength(1)
    }
    expect(resultat.size).toBeGreaterThan(0)
  })

  it.each(['profiles', ...EXPORTED_DATASETS.map((jeu) => jeu.table)])(
    'lecture de « %s » refusée : pas de fichier, et on sait ce qui manque',
    async (table) => {
      etat.refus.add(table)
      const resultat = await exportUserData('u1')
      expect(resultat.ok).toBe(false)
      expect(resultat.data).toBeUndefined()
      expect(resultat.incomplete.length).toBeGreaterThan(0)
    },
  )

  it('une lecture qui lève (réseau coupé) : pas de fichier non plus', async () => {
    etat.leve.add('cooking_logs')
    const resultat = await exportUserData('u1')
    expect(resultat.ok).toBe(false)
    expect(resultat.incomplete).toContain('cooking_logs')
  })

  it('chaque lecture est limitée au compte demandé', async () => {
    await exportUserData('u1')
    for (const lecture of etat.lectures) {
      const [genre, colonne, valeur] = lecture.filtres[0] ?? []
      expect(lecture.filtres, `« ${lecture.table} » doit être filtrée`).toHaveLength(1)
      if (lecture.table === 'support_messages') {
        // Les messages se lisent par ticket : ceux des tickets du compte.
        expect([genre, colonne]).toEqual(['in', 'ticket_id'])
      } else {
        expect(genre).toBe('eq')
        expect(valeur).toBe('u1')
      }
    }
  })

  // PostgREST plafonne chaque réponse (1 000 lignes par défaut chez Supabase)
  // SANS le dire : une lecture unique rendait un fichier tronqué qui avait
  // l'air complet. « Complet ou refusé » doit tenir aussi pour un gros compte.
  describe('un compte qui a plus de lignes que le serveur n’en rend d’un coup', () => {
    const journal = (n) => Array.from({ length: n }, (_, i) => ({ id: `log-${String(i).padStart(5, '0')}` }))

    it('une table de 2 300 lignes est exportée en entier, page après page', async () => {
      etat.lignes.cooking_logs = journal(2300)
      const resultat = await exportUserData('u1')
      expect(resultat.ok).toBe(true)
      expect(resultat.data.cooking_logs).toHaveLength(2300)
      expect(new Set(resultat.data.cooking_logs.map((ligne) => ligne.id)).size).toBe(2300)
    })

    it('le plafond du serveur peut être plus bas que la page demandée : tout est lu quand même', async () => {
      etat.plafond = 250
      etat.lignes.stock_events = journal(1100)
      const resultat = await exportUserData('u1')
      expect(resultat.data.stock_events).toHaveLength(1100)
    })

    it('si la base ne compte pas, on lit jusqu’à ce qu’elle n’ait plus rien à rendre', async () => {
      etat.compte = false
      etat.plafond = 250
      etat.lignes.notifications = journal(600)
      const resultat = await exportUserData('u1')
      expect(resultat.data.notifications).toHaveLength(600)
    })

    it('une page qui échoue en cours de route : pas de fichier', async () => {
      etat.lignes.cooking_logs = journal(2300)
      etat.refusApres.cooking_logs = 1000
      const resultat = await exportUserData('u1')
      expect(resultat.ok).toBe(false)
      expect(resultat.data).toBeUndefined()
      expect(resultat.incomplete).toContain('cooking_logs')
    })

    it('chaque lecture de liste est ordonnée : sans ordre stable, deux pages peuvent se chevaucher ou sauter une ligne', async () => {
      await exportUserData('u1')
      for (const lecture of etat.lectures) {
        if (lecture.table === 'profiles') continue
        expect(lecture.ordre, `« ${lecture.table} » doit être lue dans un ordre stable`).toBeTruthy()
        expect(lecture.plage, `« ${lecture.table} » doit être lue par plage`).not.toBeNull()
      }
    })

    it('les messages du support d’un compte qui a beaucoup de tickets sont tous là (lus par paquets de tickets)', async () => {
      etat.lignes.support_tickets = Array.from({ length: 230 }, (_, i) => ({ id: `ticket-${i}` }))
      etat.lignes.support_messages = etat.lignes.support_tickets.flatMap((ticket) => [
        { id: `${ticket.id}-a`, ticket_id: ticket.id }, { id: `${ticket.id}-b`, ticket_id: ticket.id },
      ])
      const resultat = await exportUserData('u1')
      expect(resultat.data.support_messages).toHaveLength(460)
      // Aucune requête ne porte les 230 identifiants d'un coup (l'adresse serait trop longue).
      const paquets = etat.lectures.filter((l) => l.table === 'support_messages').map((l) => l.filtres[0][2].length)
      expect(Math.max(...paquets)).toBeLessThanOrEqual(100)
    })
  })

  it('aucune lecture ne demande toutes les colonnes', async () => {
    await exportUserData('u1')
    for (const lecture of etat.lectures) {
      expect(lecture.colonnes, lecture.table).toBeTruthy()
      expect(lecture.colonnes.includes('*'), `« ${lecture.table} » : liste explicite de colonnes`).toBe(false)
    }
  })

  it('les jeux ajoutés le 2026-10-04 y sont', () => {
    const cles = EXPORTED_DATASETS.map((jeu) => jeu.table)
    for (const table of ['cooking_logs', 'spending_events', 'community_posts', 'community_replies', 'engagement', 'notifications']) {
      expect(cles, `« ${table} » manquait à l'export`).toContain(table)
    }
  })

  it('le fichier dit ce qu’il ne contient pas, et à qui le demander', async () => {
    const { data } = await exportUserData('u1')
    expect(Object.keys(data.export_metadata.not_included).sort()).toEqual(Object.keys(NOT_EXPORTED).sort())
    expect(data.export_metadata.not_included_note).toMatch(/support@fridgeplus\.app/)
  })
})

// Le garde-fou : toute table de la base qui porte l'identifiant d'un compte est
// soit exportée, soit déclarée absente avec sa raison. Une table personnelle
// ajoutée demain sans passer par ici fait tomber ce test (les types de la base
// sont régénérés après chaque migration).
describe('export des données — aucune table personnelle oubliée', () => {
  const COLONNES_DE_COMPTE = ['user_id', 'recipient_id', 'sender_id']

  function tablesPersonnelles() {
    const lignes = readFileSync(resolve(process.cwd(), 'src/shared/types/database.ts'), 'utf8').split(/\r?\n/)
    const debut = lignes.findIndex((l) => /^ {4}Tables: \{$/.test(l))
    const fin = lignes.findIndex((l) => /^ {4}Functions: \{$/.test(l))
    const trouvees = new Set()
    let table = null
    let dansRow = false
    for (const ligne of lignes.slice(debut + 1, fin)) {
      const nom = ligne.match(/^ {6}(\w+): \{$/)
      if (nom) { table = nom[1]; dansRow = false; continue }
      if (/^ {8}Row: \{$/.test(ligne)) { dansRow = true; continue }
      if (/^ {8}\}$/.test(ligne)) { dansRow = false; continue }
      const colonne = dansRow && ligne.match(/^ {10}(\w+)\??:/)
      if (colonne && COLONNES_DE_COMPTE.includes(colonne[1])) trouvees.add(table)
    }
    return [...trouvees].sort()
  }

  it('les types de la base sont bien lus (sinon ce test serait aveugle)', () => {
    const tables = tablesPersonnelles()
    expect(tables.length).toBeGreaterThan(15)
    expect(tables).toContain('user_stock')
    expect(tables).toContain('notifications')
  })

  it('chaque table qui porte un compte est exportée, ou déclarée absente avec sa raison', () => {
    const couvertes = new Set([
      ...EXPORTED_DATASETS.map((jeu) => jeu.table),
      ...Object.keys(NOT_EXPORTED),
      // Les recettes d'un compte vivent dans `recipes_unified` ; l'export les lit
      // par la vue `custom_recipes`, qui n'en montre que les siennes.
      'recipes_unified',
    ])
    const oubliees = tablesPersonnelles().filter((table) => !couvertes.has(table))
    expect(oubliees, `tables personnelles absentes de l'export : ${oubliees.join(', ')}`).toEqual([])
  })

  // Une colonne qui n'existe pas fait refuser TOUTE la lecture de sa table,
  // donc tout l'export. Les colonnes ont été vérifiées à la main contre la base
  // le 2026-10-05 ; ce test le refait à chaque fois, contre les types.
  function colonnesParRelation() {
    const lignes = readFileSync(resolve(process.cwd(), 'src/shared/types/database.ts'), 'utf8').split(/\r?\n/)
    const debut = lignes.findIndex((l) => /^ {4}Tables: \{$/.test(l))
    const fin = lignes.findIndex((l) => /^ {4}Functions: \{$/.test(l))
    const relations = new Map()
    let relation = null
    let dansRow = false
    for (const ligne of lignes.slice(debut + 1, fin)) {
      const nom = ligne.match(/^ {6}(\w+): \{$/)
      if (nom) { relation = nom[1]; relations.set(relation, new Set()); dansRow = false; continue }
      if (/^ {8}Row: \{$/.test(ligne)) { dansRow = true; continue }
      if (/^ {8}\}$/.test(ligne)) { dansRow = false; continue }
      const colonne = dansRow && ligne.match(/^ {10}(\w+)\??:/)
      if (colonne) relations.get(relation).add(colonne[1])
    }
    return relations
  }

  it('chaque colonne exportée — et celle qui ordonne la lecture — existe dans la base', () => {
    const relations = colonnesParRelation()
    expect(relations.size).toBeGreaterThan(20)
    for (const jeu of EXPORTED_DATASETS) {
      const connues = relations.get(jeu.table)
      expect(connues, `« ${jeu.table} » est inconnue des types de la base`).toBeDefined()
      const demandees = [...jeu.columns.split(',').map((c) => c.trim()), jeu.order ?? 'id', ...(jeu.owner ? [jeu.owner] : [])]
      const absentes = demandees.filter((colonne) => !connues.has(colonne))
      expect(absentes, `« ${jeu.table} » : colonnes absentes de la base`).toEqual([])
    }
  })

  it('une table déclarée absente a une raison écrite', () => {
    for (const [table, raison] of Object.entries(NOT_EXPORTED)) {
      expect(raison.length, table).toBeGreaterThan(15)
    }
  })
})
