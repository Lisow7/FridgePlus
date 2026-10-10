import { formatDate, formatDateTime } from '@shared/lib/format-date'

// Les dates des tableaux de l'admin : rien quand la valeur manque, sinon la
// date — ou la date et l'heure — dans la langue de l'écran. Huit sections
// recopiaient chacune cette ligne sous le nom `fmtDate` (audit du
// 2026-10-04, ADM-27).
export const fmtDate     = (str, lang = 'fr') => (str ? formatDate(str, lang) : '')
export const fmtDateTime = (str, lang = 'fr') => (str ? formatDateTime(str, lang) : '')
