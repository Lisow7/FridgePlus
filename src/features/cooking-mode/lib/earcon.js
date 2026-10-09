// src/features/cooking-mode/lib/earcon.js
//
// Earcon « à toi de parler » : deux notes douces ascendantes générées via
// Web Audio (aucun fichier audio à charger). Joué au moment où l'app finit
// de parler et se met à écouter.
//
// Pourquoi : best practice VUI (Alexa / Google Assistant) — en cuisine
// l'utilisateur ne regarde pas l'écran (mains occupées), un signal SONORE
// indique le tour de parole sans support visuel. Cf. recherche bonnes
// pratiques interfaces vocales.

export function playReadyChime() {
  if (typeof window === 'undefined') return
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return
  try {
    const ctx = new Ctx()
    const now = ctx.currentTime
    // mi (660) → la (880) : courte montée = invitation à parler.
    ;[660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = now + i * 0.12
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.2)
    })
    setTimeout(() => { try { ctx.close() } catch { /* no-op */ } }, 600)
  } catch { /* Web Audio indispo → pas de son, pas de crash */ }
}
