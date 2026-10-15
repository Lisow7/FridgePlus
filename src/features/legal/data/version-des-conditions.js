// La version des conditions générales d’utilisation (décision du 2026-10-08 :
// annoncer chaque changement 30 jours avant, comme les CGU le promettent).
//
// La date est écrite au bas des conditions (`getLegalSection(lang, 'terms')`), sur
// la page /legal comme dans son HTML servi. L’empreinte est celle du texte des CGU
// (français et anglais) : si le texte change sans nouvelle date,
// `conditions-versionnees.test.js` rougit et renvoie à la procédure
// (docs/procedure-changement-des-cgu.md).
export const VERSION_DES_CGU = {
  date: '2026-10-10',
  empreinte: '03e26b8ee127f704',
}

const FORMATS = {
  fr: { locale: 'fr-FR', phrase: (d) => `Version du ${d}.` },
  en: { locale: 'en-GB', phrase: (d) => `Version of ${d}.` },
}

/** La ligne « Version du 10 octobre 2026. » dans la langue demandée (anglais par défaut). */
export function noteDeVersion(lang) {
  const { locale, phrase } = FORMATS[lang] ?? FORMATS.en
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${VERSION_DES_CGU.date}T12:00:00Z`))
  return phrase(date)
}
