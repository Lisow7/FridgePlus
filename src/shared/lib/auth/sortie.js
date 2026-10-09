import { supabase } from '@shared/lib/supabase/client'
import { purgerLesDonneesLocalesDuCompte } from './purge-locale'
import { detacherCetAppareilAvantDePartir } from '@shared/lib/push/cet-appareil'

// Fermer la session sur cet appareil : LE chemin de sortie, pour le menu du compte comme
// pour l'écran banni, « Confirme ton accord », la suppression en cours, la vérification en
// 2 étapes et la suppression de compte (tous passent par le `signOut` du contexte d'auth,
// qui appelle ceci). Cet appareil quitte les notifications du compte et ce que le compte a
// laissé sur l'appareil s'efface, AVANT la fermeture de la session — la ligne push ne
// s'efface qu'avec elle (CPT-15, SEC-13). Le détachement est borné et ne bloque jamais.
export async function fermerLaSession() {
  await detacherCetAppareilAvantDePartir()
  purgerLesDonneesLocalesDuCompte()
  await supabase.auth.signOut()
}
