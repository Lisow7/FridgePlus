// La réponse d'erreur d'une fonction edge : un code stable pour le client, la
// cause au journal du serveur seulement (audit du 2026-10-04, BDD-18 (1) (2),
// SEC-09). Avant, les messages Postgres, les corps OpenAI ou Resend partaient
// tels quels dans `detail` — et, pour les tâches planifiées, restaient
// quelques heures lisibles dans `net._http_response`.
//
// `publics` : des champs sans secret que le client sait lire (le `status`
// d'OpenAI, le `max` d'une longueur). Jamais un message d'erreur.
export function reponseErreur(
  code: string,
  status: number,
  headers: Record<string, string>,
  cause?: unknown,
  label = 'edge',
  publics: Record<string, unknown> = {},
): Response {
  if (cause !== undefined) {
    const message = (cause as { message?: unknown })?.message ?? cause
    console.error(`[${label}] ${code}: ${String(message).slice(0, 500)}`)
  }
  return new Response(JSON.stringify({ error: code, ...publics }), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}
