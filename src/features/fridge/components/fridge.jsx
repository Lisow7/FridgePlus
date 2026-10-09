import FridgeStandard from './fridge-standard'
import FridgeSideBySide from './fridge-side-by-side'
import FridgeMultiDoor from './fridge-multi-door'

export default function Fridge({ layout, lang, onSubcategoryClick, stock = new Set(), onDoorChange, doorCloseSignal, doorOpenSignal, darkMode, leftovers = [], expiredLeftoversCount = 0, noAutoScale = false }) {
  const props = { layout, lang, onSubcategoryClick, stock, onDoorChange, doorCloseSignal, doorOpenSignal, darkMode, leftovers, expiredLeftoversCount, noAutoScale }
  if (layout.type === 'side-by-side') return <FridgeSideBySide {...props} />
  if (layout.type === 'multi-door')   return <FridgeMultiDoor  {...props} />
  return <FridgeStandard {...props} />
}
