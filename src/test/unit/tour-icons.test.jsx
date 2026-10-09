// Le guide et la visite désignent les actions du menu avec LES MÊMES icônes
// que lui — un lecteur qui voit une caméra dans le guide retrouve une caméra
// dans le menu. Le registre est la seule source de cette correspondance.
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { LuDoorOpen, LuSearch, LuMic, LuCamera, LuClipboardList, LuCookingPot, LuChefHat } from 'react-icons/lu'
import { TOUR_ICONS } from '@features/onboarding/lib/tour-icons'
import { TourIcon } from '@features/onboarding/lib/tour-icon'

describe('icônes des étapes du guide', () => {
  it('reprend, action par action, les icônes du menu du bouton orange', () => {
    expect(TOUR_ICONS).toEqual({
      door: LuDoorOpen, search: LuSearch, mic: LuMic, camera: LuCamera,
      inventory: LuClipboardList, leftovers: LuCookingPot, recipes: LuChefHat,
    })
  })

  it('rend un svg décoratif, le glyphe pour « fab », rien pour un id inconnu', () => {
    const { container, rerender } = render(<TourIcon id="camera" />)
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    rerender(<TourIcon id="fab" size={28} />)
    expect(container.querySelector('[data-fab-glyph]')).not.toBeNull()
    rerender(<TourIcon id="inconnu" />)
    expect(container.firstChild).toBeNull()
  })
})
