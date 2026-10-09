import { useEffect } from 'react'

// <JsonLd id data /> — injecte un `<script type="application/ld+json">` dans le
// `<head>` au montage, le retire au démontage.
//
// Généralisation de `recipe-jsonld.jsx`, qui portait le même mécanisme avec un
// identifiant fixe. Il en délègue désormais l'implémentation : deux copies d'un
// helper finissent par diverger, et celle qui diverge est celle qu'on ne
// regarde plus.
//
// `id` DOIT être unique par type de balisage : c'est lui qui permet d'écraser
// puis de nettoyer le bon script. Deux pages qui partagent le même `id` se
// marcheraient dessus.
//
// `data` falsy ⇒ rien n'est injecté, et un script précédemment posé est retiré.
// C'est la garantie qui compte en SPA : une page qui n'a plus de balisage ne
// doit pas hériter de celui de la page d'avant.

export default function JsonLd({ id, data }) {
  useEffect(() => {
    const retirer = () => {
      const el = document.getElementById(id)
      if (el) el.remove()
    }

    if (!data) {
      retirer()
      return retirer
    }

    let script = document.getElementById(id)
    if (!script) {
      script = document.createElement('script')
      script.id = id
      script.type = 'application/ld+json'
      document.head.appendChild(script)
    }
    try {
      script.textContent = JSON.stringify(data)
    } catch {
      // JSON.stringify jette sur un cycle ou un symbole. Un balisage absent est
      // sans conséquence ; faire tomber la page en le construisant, non.
      retirer()
    }

    return retirer
  }, [id, data])

  return null
}
