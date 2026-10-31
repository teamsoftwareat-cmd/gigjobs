export const CORE_APPLICANT_FIELDS = [
  { id: 'first-name', name: 'first_name', label: { en: 'First name', hi: 'पहला नाम', mr: 'पहिले नाव', ta: 'முதல் பெயர்', te: 'మొదటి పేరు', ml: 'പേര്' }, type: 'text', required: true, options: [], placeholder: { en: '', hi: '', mr: '', ta: '', te: '', ml: '' }, hint: { en: '', hi: '', mr: '', ta: '', te: '', ml: '' }, group: '' },
  { id: 'last-name', name: 'last_name', label: { en: 'Last name', hi: 'उपनाम', mr: 'आडनाव', ta: 'கடைசி பெயர்', te: 'ఇంటి పేరు', ml: 'കുടുംബപ്പേര്' }, type: 'text', required: true, options: [], placeholder: { en: '', hi: '', mr: '', ta: '', te: '', ml: '' }, hint: { en: '', hi: '', mr: '', ta: '', te: '', ml: '' }, group: '' },
  { id: 'email', name: 'email', label: { en: 'Email', hi: 'ईमेल', mr: 'ईमेल', ta: 'மின்னஞ்சல்', te: 'ఇమెయిల్', ml: 'ഇമെയിൽ' }, type: 'email', required: true, options: [], placeholder: { en: '', hi: '', mr: '', ta: '', te: '', ml: '' }, hint: { en: '', hi: '', mr: '', ta: '', te: '', ml: '' }, group: '' },
  { id: 'mobile', name: 'mobile', label: { en: 'Mobile number', hi: 'मोबाइल नंबर', mr: 'मोबाईल क्रमांक', ta: 'கைபேசி எண்', te: 'మొబైల్ నంబర్', ml: 'മൊബൈൽ നമ്പർ' }, type: 'tel', required: true, options: [], placeholder: { en: '98765 43210', hi: '98765 43210', mr: '98765 43210', ta: '98765 43210', te: '98765 43210', ml: '98765 43210' }, hint: { en: 'We will call or WhatsApp you on this number', hi: 'इसी नंबर पर हम कॉल या WhatsApp करेंगे', mr: 'आम्ही या क्रमांकावर कॉल किंवा WhatsApp करू', ta: 'இந்த எண்ணில் அழைப்பு அல்லது WhatsApp மூலம் தொடர்புகொள்வோம்', te: 'ఈ నంబర్‌కు కాల్ లేదా WhatsApp ద్వారా సంప్రదిస్తాము', ml: 'ഈ നമ്പറിൽ വിളിക്കുകയോ WhatsApp വഴി ബന്ധപ്പെടുകയോ ചെയ്യും' }, group: '' },
]

const CORE_FIELD_NAMES = new Set(CORE_APPLICANT_FIELDS.map((field) => field.name))

export const isCoreApplicantField = (field) => CORE_FIELD_NAMES.has(field?.name)

const normalizeTranslations = (field, fallback) => {
  if (typeof field.label === 'string') {
    return {
      en: field.label,
      hi: field.translations?.label?.hi || fallback.label.hi,
      mr: field.translations?.label?.mr || fallback.label.mr,
      ta: field.translations?.label?.ta || fallback.label.ta,
      te: field.translations?.label?.te || fallback.label.te,
      ml: field.translations?.label?.ml || fallback.label.ml,
    }
  }

  return {
    en: field.label?.en || fallback.label.en,
    hi: field.label?.hi || field.translations?.label?.hi || fallback.label.hi,
    mr: field.label?.mr || field.translations?.label?.mr || fallback.label.mr,
    ta: field.label?.ta || field.translations?.label?.ta || fallback.label.ta,
    te: field.label?.te || field.translations?.label?.te || fallback.label.te,
    ml: field.label?.ml || field.translations?.label?.ml || fallback.label.ml,
  }
}

const normalizeLocalizedText = (value, fallback, translations = {}) => {
  if (typeof value === 'string') return Object.fromEntries(
    ['en', 'hi', 'mr', 'ta', 'te', 'ml'].map((language) => [
      language,
      language === 'en' ? value : translations[language] || (value === fallback.en ? fallback[language] : value),
    ]),
  )
  return {
    en: value?.en || fallback.en,
    hi: value?.hi || translations.hi || fallback.hi,
    mr: value?.mr || translations.mr || fallback.mr,
    ta: value?.ta || translations.ta || fallback.ta,
    te: value?.te || translations.te || fallback.te,
    ml: value?.ml || translations.ml || fallback.ml,
  }
}

export const ensureCoreApplicantFields = (fields = []) => {
  const fieldList = Array.isArray(fields) ? fields : []
  const byName = new Map(fieldList.map((field) => [field.name, field]))
  const normalizeCoreField = (fallback) => {
    const field = byName.get(fallback.name) || {}
    return {
      ...fallback,
      ...field,
      id: field.id || fallback.id,
      name: fallback.name,
      type: fallback.type,
      required: fallback.required,
      group: '',
      options: [],
      label: normalizeTranslations(field, fallback),
      placeholder: normalizeLocalizedText(field.placeholder, fallback.placeholder, field.translations?.placeholder),
      hint: normalizeLocalizedText(field.hint, fallback.hint, field.translations?.hint),
    }
  }
  const coreFields = new Map(CORE_APPLICANT_FIELDS.map((fallback) => [fallback.name, normalizeCoreField(fallback)]))
  const seenCoreFields = new Set()
  const normalizedFields = fieldList.flatMap((field) => {
    if (!isCoreApplicantField(field)) return [field]
    if (seenCoreFields.has(field.name)) return []
    seenCoreFields.add(field.name)
    return [coreFields.get(field.name)]
  })
  const missingCoreFields = CORE_APPLICANT_FIELDS
    .filter((field) => !byName.has(field.name))
    .map((field) => coreFields.get(field.name))

  return [...missingCoreFields, ...normalizedFields]
}
