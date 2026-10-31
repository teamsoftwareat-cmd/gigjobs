import { isCoreApplicantField } from './applicationFormFields.js'

const CONTENT_TEXT_KEYS = [
  'brandLine', 'projectName', 'eyebrow', 'headline', 'intro', 'detailsTitle',
  'whoTitle', 'whoText', 'contactTitle', 'call', 'urgent', 'formTitle', 'formIntro',
  'checkTitle', 'submit', 'doneTitle', 'doneText', 'share', 'shareMsg', 'footer',
  'countdown', 'countdownToday', 'countdownTomorrow',
]

const getLocaleText = (value, locale) => (
  typeof value === 'string' ? (locale === 'en' ? value : '') : value?.[locale] || ''
)

const asOptions = (value) => (
  Array.isArray(value) ? value : String(value || '').split('\n').map((item) => item.trim()).filter(Boolean)
)

export const getApplicationTranslationIssues = (contentByLocale, fields = [], locale) => {
  const english = contentByLocale?.en || {}
  const translated = contentByLocale?.[locale] || {}
  const issues = []
  const requireText = (source, value, label, allowUnchanged = false) => {
    if (typeof source !== 'string' || !source.trim()) return
    if (typeof value !== 'string' || !value.trim()) {
      issues.push(label)
      return
    }
    const unchanged = source.trim().toLocaleLowerCase() === value.trim().toLocaleLowerCase()
    const nonlinguistic = /^[\d\s.,₹%()+/-]+$/.test(source.trim())
    if (unchanged && !allowUnchanged && !nonlinguistic) issues.push(label)
  }

  if (translated.translationReviewed !== true) issues.push('review')
  CONTENT_TEXT_KEYS.forEach((key) => requireText(
    english[key],
    translated[key],
    key,
    ['brandLine', 'projectName'].includes(key),
  ))

  ;(english.facts || []).forEach((fact, index) => {
    requireText(fact?.[0], translated.facts?.[index]?.[0], `fact-${index}-label`)
    requireText(fact?.[1], translated.facts?.[index]?.[1], `fact-${index}-value`)
  })
  ;(english.perks || []).forEach((perk, index) => {
    requireText(perk, translated.perks?.[index], `perk-${index}`)
  })

  fields.filter((field) => !isCoreApplicantField(field)).forEach((field) => {
    const fieldLabel = getLocaleText(field.label, 'en') || field.label || ''
    const translatedLabel = getLocaleText(field.label, locale) || field.translations?.label?.[locale] || ''
    requireText(fieldLabel, translatedLabel, `${field.name}-label`)

    ;['placeholder', 'hint'].forEach((key) => {
      const source = getLocaleText(field[key], 'en') || field[key] || ''
      const value = getLocaleText(field[key], locale) || field.translations?.[key]?.[locale] || ''
      requireText(source, value, `${field.name}-${key}`)
    })

    const sourceOptions = asOptions(field.options)
    const localizedOptions = asOptions(field.translatedOptions?.[locale] || field.translations?.options?.[locale])
    sourceOptions.forEach((option, index) => requireText(option, localizedOptions[index], `${field.name}-option-${index}`))
  })

  ;(english.builderCustomSections || []).forEach((section) => {
    const source = getLocaleText(section.title, 'en') || section.title || ''
    const translatedSection = translated.builderCustomSections?.find((item) => item.id === section.id)
    const value = getLocaleText(translatedSection?.title, locale)
    requireText(source, value, `${section.id}-title`)
  })

  return issues
}