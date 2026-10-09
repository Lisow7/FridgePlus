import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StreakCard from '@features/profile/components/streak-card'

const t = {
  streakTitle: 'Ta série',
  streakWeeks: (n) => `${n} semaine${n > 1 ? 's' : ''}`,
  streakBest: (n) => `Record : ${n}`,
  streakEmpty: 'Cuisine cette semaine pour démarrer ta série',
}
const props = { t, darkMode: false, border: '#000', textColor: '#000', mutedColor: '#666' }

describe('StreakCard', () => {
  it('affiche la série courante + record', () => {
    render(<StreakCard streak={{ current: 3, best: 5 }} {...props} />)
    expect(screen.getByText(/3 semaines/)).toBeInTheDocument()
    expect(screen.getByText(/Record : 5/)).toBeInTheDocument()
  })
  it('état vide encourageant quand current = 0', () => {
    render(<StreakCard streak={{ current: 0, best: 0 }} {...props} />)
    expect(screen.getByText(/démarrer ta série/)).toBeInTheDocument()
  })
})
