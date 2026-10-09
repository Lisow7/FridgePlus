// Ouvre un document HTML autonome dans une fenêtre et déclenche l'impression.
// Motif blob + popup, partagé entre l'impression de liste de courses et la
// fiche technique recette. Le HTML doit contenir lui-même le déclencheur
// d'impression (`<script>window.onload=()=>window.print()</script>`).
export function printHtmlDocument(html, { width = 600, height = 800 } = {}) {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank', `width=${width},height=${height}`)
  if (win) setTimeout(() => URL.revokeObjectURL(url), 15000)
  else URL.revokeObjectURL(url)
}
