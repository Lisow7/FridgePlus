import { supabase } from '@shared/lib/supabase/client'
import { purgerLesDonneesLocalesDuCompte } from './purge-locale'
import { detacherCetAppareilAvantDePartir, detacherTousLesAppareilsAvantDePartir } from '@shared/lib/push/cet-appareil'

// Fermer la session sur cet appareil : LE chemin de sortie, pour le menu du compte comme
// pour l'écran banni, « Confirme ton accord », la suppression en cours, la vérification en
// 2 étapes et la suppression de compte (tous passent par le `signOut` du contexte d'auth,
// qui appelle ceci). Cet appareil quitte les notifications du compte et ce que le compte a
// laissé sur l'appareil s'efface, AVANT la fermeture de la session — la ligne push ne
// s'efface qu'avec elle (CPT-15, SEC-13). Le détachement est borné et ne bloque jamais.
//
// La portée (décision du 2026-10-08) : 'local' = cet appareil (« Se déconnecter ») ;
// 'global' = toutes les sessions du compte (« Déconnecter tous mes appareils », suppression
// du compte) — et les notifications de TOUS ses appareils partent avant, tant que la session
// permet de les effacer. Rend `{ error }` : refusée (réseau), la session reste ouverte.
export async function fermerLaSession({ portee = 'local', userId = null } = {}) {
  await detacherCetAppareilAvantDePartir()
  if (portee === 'global' && userId) await detacherTousLesAppareilsAvantDePartir(userId)
  purgerLesDonneesLocalesDuCompte()
  const { error } = (await supabase.auth.signOut({ scope: portee })) ?? {}
  return { error: error ?? null }
}
