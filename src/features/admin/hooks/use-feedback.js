import { useCallback, useEffect, useRef, useState } from 'react'

// Le bandeau de retour d'une section du panneau : `[feedback, showFeedback]`,
// à passer à `<FeedbackBanner feedback={feedback} />`.
//
// Le message s'efface au bout de 3,5 s. Un nouveau message remplace le
// précédent SANS être effacé par le minuteur de celui-ci (les sections
// écrivaient chacune un `setTimeout` nu : un échec affiché juste après un
// succès disparaissait avant d'avoir été lu).
export function useFeedback(dureeMs = 3500) {
  const [feedback, setFeedback] = useState(null)
  const minuteur = useRef(null)
  useEffect(() => () => clearTimeout(minuteur.current), [])
  const showFeedback = useCallback((ok, msg) => {
    clearTimeout(minuteur.current)
    setFeedback({ ok, msg })
    minuteur.current = setTimeout(() => setFeedback(null), dureeMs)
  }, [dureeMs])
  return [feedback, showFeedback]
}
