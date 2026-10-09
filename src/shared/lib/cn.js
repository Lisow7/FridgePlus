import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Sprint 8 PR S8.a — utility `cn()`.
//
// Merge intelligent de classes Tailwind avec déduplication par groupe
// d'utilités (ex : `bg-red-500 bg-blue-500` → `bg-blue-500`). Pattern
// standard du design system shadcn/ui.
//
// Usage :
//   cn('text-sm', 'font-bold', isActive && 'underline')
//   cn(baseClasses, variantClasses, className) // className user-override
//
// Pourquoi clsx + tailwind-merge :
//   - clsx → permet d'enchaîner strings, objets, ternaires, arrays.
//   - tailwind-merge → résout les conflits Tailwind (la dernière classe
//     dans le merge gagne par groupe : bg-*, p-*, etc.).
//
// Sources : https://github.com/lukeed/clsx, https://github.com/dcastil/tailwind-merge
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
