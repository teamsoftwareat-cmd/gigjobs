import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { normalizeProjectIdParam, recruiterAPI } from '../api/axios'
import { getTrainingCountdownLabel } from '../utils/dateCountdown'
import { ensureCoreApplicantFields } from '../utils/applicationFormFields'
import { formatProjectFacts } from '../utils/projectFormatting'
import './PublicProjectApplication.css'

const LANGUAGES = [
  ['en', 'English'],
  ['hi', 'हिंदी'],
  ['mr', 'मराठी'],
  ['ta', 'தமிழ்'],
  ['te', 'తెలుగు'],
  ['ml', 'മലയാളം'],
]

const PUBLIC_UI_TEXT = {
  en: {
    chooseLanguage: 'Choose language', loading: 'Loading application form…', retry: 'Try again', projectApplication: 'Project application',
    project: 'Project', jobDetails: 'Job details', whoTitle: 'Who should apply', contactTitle: 'Contact the team', call: 'Call', application: 'Application',
    selectOption: 'Select an option', friendPrompt: 'Applying with a friend? (optional)', pleaseConfirm: 'Please confirm', sending: 'Sending…', submit: 'Submit application',
    genericIntro: 'Applications are open for {name}. Review the job details and submit your application below.',
    openings: '{count} openings available. Apply now.', formIntro: 'Complete the form below to apply.',
    formTitle: 'Apply for this project', share: 'Share with friends on WhatsApp', shareMessage: 'Apply for {name}: ', received: 'Your application has been received, {name}!', contactYou: 'Our team will contact you at {mobile}.',
    footer: 'Recruitment partner for this project', translating: 'Loading reviewed translation…', translationFallback: 'Some text is not translated yet; English is shown for those parts.', networkError: 'We could not send your application. Please try again.', loadError: 'Could not load this application form. Please try again.',
  },
  hi: {
    chooseLanguage: 'भाषा चुनें', loading: 'आवेदन फ़ॉर्म लोड हो रहा है…', retry: 'फिर कोशिश करें', projectApplication: 'प्रोजेक्ट के लिए आवेदन',
    project: 'प्रोजेक्ट', jobDetails: 'काम की जानकारी', whoTitle: 'कौन आवेदन करे', contactTitle: 'टीम से संपर्क करें', call: 'कॉल करें', application: 'आवेदन',
    selectOption: 'विकल्प चुनें', friendPrompt: 'क्या आप दोस्त के साथ आवेदन कर रहे हैं? (वैकल्पिक)', pleaseConfirm: 'कृपया पुष्टि करें', sending: 'भेजा जा रहा है…', submit: 'आवेदन जमा करें',
    genericIntro: '{name} के लिए आवेदन आमंत्रित हैं। काम की जानकारी पढ़कर नीचे आवेदन करें।',
    openings: '{count} रिक्तियां उपलब्ध हैं। अभी आवेदन करें।', formIntro: 'आवेदन करने के लिए नीचे दिया गया फ़ॉर्म भरें।',
    formTitle: 'इस प्रोजेक्ट के लिए आवेदन करें', share: 'दोस्तों को WhatsApp पर भेजें', shareMessage: '{name} के लिए यहाँ आवेदन करें: ', received: '{name}, आपका आवेदन प्राप्त हो गया है!', contactYou: 'हमारी टीम {mobile} पर आपसे संपर्क करेगी।',
    footer: 'इस प्रोजेक्ट के लिए भर्ती साझेदार', translating: 'समीक्षित अनुवाद लोड हो रहा है…', translationFallback: 'कुछ टेक्स्ट का अनुवाद अभी नहीं हुआ है; उन हिस्सों के लिए अंग्रेज़ी दिखाई जाएगी।', requiredField: 'कृपया यह जानकारी भरें।', invalidMobile: '6 से 9 के बीच के अंक से शुरू होने वाला 10 अंकों का मोबाइल नंबर दर्ज करें।', networkError: 'आपका आवेदन भेजा नहीं जा सका। कृपया फिर कोशिश करें।', loadError: 'आवेदन फ़ॉर्म लोड नहीं हो सका। कृपया फिर कोशिश करें।',
  },
  mr: {
    chooseLanguage: 'भाषा निवडा', loading: 'अर्जाचा फॉर्म लोड होत आहे…', retry: 'पुन्हा प्रयत्न करा', projectApplication: 'प्रकल्पासाठी अर्ज',
    project: 'प्रकल्प', jobDetails: 'कामाचा तपशील', whoTitle: 'कोण अर्ज करू शकते', contactTitle: 'संघाशी संपर्क साधा', call: 'कॉल करा', application: 'अर्ज',
    selectOption: 'पर्याय निवडा', friendPrompt: 'मित्रासोबत अर्ज करत आहात? (ऐच्छिक)', pleaseConfirm: 'कृपया पुष्टी करा', sending: 'पाठवत आहे…', submit: 'अर्ज सादर करा',
    genericIntro: '{name} साठी अर्ज सुरू आहेत. कामाचा तपशील पाहून खाली अर्ज करा.', openings: '{count} जागा उपलब्ध आहेत. आत्ताच अर्ज करा.', formIntro: 'अर्ज करण्यासाठी खालील फॉर्म भरा.',
    formTitle: 'या प्रकल्पासाठी अर्ज करा', share: 'मित्रांसोबत WhatsApp वर शेअर करा', shareMessage: '{name} साठी येथे अर्ज करा: ', received: '{name}, तुमचा अर्ज प्राप्त झाला!', contactYou: 'आमची टीम {mobile} वर तुमच्याशी संपर्क साधेल.', footer: 'या प्रकल्पासाठी भरती भागीदार',
    requiredField: 'कृपया ही माहिती भरा.', invalidMobile: '6 ते 9 ने सुरू होणारा 10 अंकी मोबाईल क्रमांक टाका.', translating: 'तपासलेले भाषांतर लोड होत आहे…', translationFallback: 'काही मजकूर अद्याप भाषांतरित केलेला नाही; त्या भागांसाठी इंग्रजी दाखवली जाईल.', networkError: 'तुमचा अर्ज पाठवता आला नाही. कृपया पुन्हा प्रयत्न करा.', loadError: 'अर्जाचा फॉर्म लोड करता आला नाही. कृपया पुन्हा प्रयत्न करा.',
  },
  te: {
    chooseLanguage: 'భాషను ఎంచుకోండి', loading: 'దరఖాస్తు ఫారమ్ లోడ్ అవుతోంది…', retry: 'మళ్లీ ప్రయత్నించండి', projectApplication: 'ప్రాజెక్ట్ దరఖాస్తు',
    project: 'ప్రాజెక్ట్', jobDetails: 'పని వివరాలు', whoTitle: 'ఎవరు దరఖాస్తు చేయవచ్చు', contactTitle: 'బృందాన్ని సంప్రదించండి', call: 'కాల్ చేయండి', application: 'దరఖాస్తు',
    selectOption: 'ఒక ఎంపికను ఎంచుకోండి', friendPrompt: 'స్నేహితుడితో దరఖాస్తు చేస్తున్నారా? (ఐచ్ఛికం)', pleaseConfirm: 'దయచేసి నిర్ధారించండి', sending: 'పంపుతోంది…', submit: 'దరఖాస్తును సమర్పించండి',
    genericIntro: '{name} కోసం దరఖాస్తులు స్వీకరిస్తున్నాము. పని వివరాలను చూసి క్రింద దరఖాస్తు చేయండి.', openings: '{count} ఖాళీలు ఉన్నాయి. ఇప్పుడే దరఖాస్తు చేయండి.', formIntro: 'దరఖాస్తు చేయడానికి క్రింది ఫారమ్‌ను పూరించండి.',
    formTitle: 'ఈ ప్రాజెక్ట్‌కు దరఖాస్తు చేయండి', share: 'స్నేహితులతో WhatsAppలో పంచుకోండి', shareMessage: '{name} కోసం ఇక్కడ దరఖాస్తు చేయండి: ', received: '{name}, మీ దరఖాస్తు అందింది!', contactYou: 'మా బృందం {mobile} నంబర్‌లో మిమ్మల్ని సంప్రదిస్తుంది.', footer: 'ఈ ప్రాజెక్ట్‌కు నియామక భాగస్వామి',
    requiredField: 'దయచేసి ఈ వివరాన్ని నమోదు చేయండి.', invalidMobile: '6 నుండి 9 మధ్య అంకెతో ప్రారంభమయ్యే 10 అంకెల మొబైల్ నంబర్ నమోదు చేయండి.', translating: 'సమీక్షించిన అనువాదం లోడ్ అవుతోంది…', translationFallback: 'కొన్ని వాక్యాలు ఇంకా అనువదించబడలేదు; ఆ భాగాలు ఆంగ్లంలో చూపబడతాయి.', networkError: 'మీ దరఖాస్తును పంపలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.', loadError: 'దరఖాస్తు ఫారమ్‌ను లోడ్ చేయలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.',
  },
  ml: {
    chooseLanguage: 'ഭാഷ തിരഞ്ഞെടുക്കുക', loading: 'അപേക്ഷാ ഫോം ലോഡ് ചെയ്യുന്നു…', retry: 'വീണ്ടും ശ്രമിക്കുക', projectApplication: 'പ്രോജക്റ്റിലേക്കുള്ള അപേക്ഷ',
    project: 'പ്രോജക്റ്റ്', jobDetails: 'ജോലി വിവരങ്ങൾ', whoTitle: 'ആർക്കൊക്കെ അപേക്ഷിക്കാം', contactTitle: 'ടീമുമായി ബന്ധപ്പെടുക', call: 'വിളിക്കുക', application: 'അപേക്ഷ',
    selectOption: 'ഒരു ഓപ്ഷൻ തിരഞ്ഞെടുക്കുക', friendPrompt: 'സുഹൃത്തിനൊപ്പം അപേക്ഷിക്കുകയാണോ? (ഐച്ഛികം)', pleaseConfirm: 'ദയവായി സ്ഥിരീകരിക്കുക', sending: 'അയയ്ക്കുന്നു…', submit: 'അപേക്ഷ സമർപ്പിക്കുക',
    genericIntro: '{name} ലേക്ക് അപേക്ഷകൾ ക്ഷണിക്കുന്നു. ജോലി വിവരങ്ങൾ വായിച്ച് താഴെ അപേക്ഷിക്കുക.', openings: '{count} ഒഴിവുകൾ ലഭ്യമാണ്. ഇപ്പോൾ അപേക്ഷിക്കുക.', formIntro: 'അപേക്ഷിക്കാൻ താഴെയുള്ള ഫോം പൂരിപ്പിക്കുക.',
    formTitle: 'ഈ പ്രോജക്റ്റിലേക്ക് അപേക്ഷിക്കുക', share: 'സുഹൃത്തുക്കളുമായി WhatsApp-ൽ പങ്കിടുക', shareMessage: '{name} ലേക്ക് ഇവിടെ അപേക്ഷിക്കുക: ', received: '{name}, നിങ്ങളുടെ അപേക്ഷ ലഭിച്ചു!', contactYou: 'ഞങ്ങളുടെ ടീം {mobile} ൽ നിങ്ങളെ ബന്ധപ്പെടും.', footer: 'ഈ പ്രോജക്റ്റിന്റെ റിക്രൂട്ട്മെന്റ് പങ്കാളി',
    requiredField: 'ദയവായി ഈ വിവരം നൽകുക.', invalidMobile: '6 മുതൽ 9 വരെയുള്ള അക്കത്തിൽ തുടങ്ങുന്ന 10 അക്ക മൊബൈൽ നമ്പർ നൽകുക.', translating: 'പരിശോധിച്ച വിവർത്തനം ലോഡ് ചെയ്യുന്നു…', translationFallback: 'ചില വാചകങ്ങൾ ഇതുവരെ വിവർത്തനം ചെയ്തിട്ടില്ല; ആ ഭാഗങ്ങൾ ഇംഗ്ലീഷിൽ കാണിക്കും.', networkError: 'നിങ്ങളുടെ അപേക്ഷ അയയ്ക്കാനായില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.', loadError: 'അപേക്ഷാ ഫോം ലോഡ് ചെയ്യാനായില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.',
  },
  ta: {
    chooseLanguage: 'மொழியைத் தேர்ந்தெடுக்கவும்', loading: 'விண்ணப்பப் படிவம் ஏற்றப்படுகிறது…', retry: 'மீண்டும் முயற்சிக்கவும்', projectApplication: 'திட்டத்திற்கான விண்ணப்பம்',
    project: 'திட்டம்', jobDetails: 'வேலை விவரங்கள்', whoTitle: 'யார் விண்ணப்பிக்கலாம்', contactTitle: 'குழுவைத் தொடர்புகொள்ளுங்கள்', call: 'அழைக்க', application: 'விண்ணப்பம்',
    selectOption: 'ஒரு விருப்பத்தைத் தேர்ந்தெடுக்கவும்', friendPrompt: 'நண்பருடன் விண்ணப்பிக்கிறீர்களா? (விருப்பம்)', pleaseConfirm: 'உறுதிப்படுத்தவும்', sending: 'அனுப்பப்படுகிறது…', submit: 'விண்ணப்பத்தைச் சமர்ப்பிக்கவும்',
    genericIntro: '{name} திட்டத்திற்கு விண்ணப்பங்கள் வரவேற்கப்படுகின்றன. வேலை விவரங்களைப் பார்த்து கீழே விண்ணப்பிக்கவும்.',
    openings: '{count} காலியிடங்கள் உள்ளன. இப்போதே விண்ணப்பிக்கவும்.', formIntro: 'விண்ணப்பிக்க கீழே உள்ள படிவத்தை நிரப்பவும்.',
    formTitle: 'இந்தத் திட்டத்திற்கு விண்ணப்பிக்கவும்', share: 'WhatsApp-ல் நண்பர்களுடன் பகிரவும்', shareMessage: '{name} திட்டத்திற்கு இங்கே விண்ணப்பிக்கவும்: ', received: '{name}, உங்கள் விண்ணப்பம் பெறப்பட்டது!', contactYou: 'எங்கள் குழு {mobile} எண்ணில் உங்களைத் தொடர்புகொள்ளும்.',
    footer: 'இந்தத் திட்டத்திற்கான ஆட்சேர்ப்பு பங்குதாரர்', translating: 'சரிபார்க்கப்பட்ட மொழிபெயர்ப்பு ஏற்றப்படுகிறது…', translationFallback: 'சில உரைகள் இன்னும் மொழிபெயர்க்கப்படவில்லை; அந்தப் பகுதிகள் ஆங்கிலத்தில் காட்டப்படும்.', requiredField: 'இந்த விவரத்தை உள்ளிடவும்.', invalidMobile: '6 முதல் 9 வரை தொடங்கும் 10 இலக்க கைபேசி எண்ணை உள்ளிடவும்.', networkError: 'உங்கள் விண்ணப்பத்தை அனுப்ப முடியவில்லை. மீண்டும் முயற்சிக்கவும்.', loadError: 'விண்ணப்பப் படிவத்தை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
  },
}

const getPublicText = (language, key, values = {}) => Object.entries(values).reduce(
  (text, [name, value]) => text.replace(`{${name}}`, String(value)),
  PUBLIC_UI_TEXT[language]?.[key] || PUBLIC_UI_TEXT.en[key] || key,
)

const localizeWeekdays = (value, language) => {
  if (typeof value !== 'string' || language === 'en') return value
  const days = {
    hi: { Sunday: 'रविवार', Monday: 'सोमवार', Tuesday: 'मंगलवार', Wednesday: 'बुधवार', Thursday: 'गुरुवार', Friday: 'शुक्रवार', Saturday: 'शनिवार' },
    ta: { Sunday: 'ஞாயிறு', Monday: 'திங்கள்', Tuesday: 'செவ்வாய்', Wednesday: 'புதன்', Thursday: 'வியாழன்', Friday: 'வெள்ளி', Saturday: 'சனி' },
  }
  return value.split(',').map((day) => days[language]?.[day.trim()] || day.trim()).join(', ')
}

const localizeFacts = (facts, language) => {
  if (!Array.isArray(facts)) return []
  const labels = {
    hi: { Pay: 'वेतन', 'Start date': 'शुरुआत की तारीख', 'End date': 'अंतिम तारीख', Duration: 'अवधि', Role: 'पद', Openings: 'रिक्तियां', Location: 'स्थान', 'Working time': 'काम का समय', 'Working days': 'कार्य दिवस', 'Dress code': 'ड्रेस कोड' },
    ta: { Pay: 'ஊதியம்', 'Start date': 'தொடக்க தேதி', 'End date': 'முடிவு தேதி', Duration: 'காலம்', Role: 'பணி', Openings: 'காலியிடங்கள்', Location: 'இடம்', 'Working time': 'வேலை நேரம்', 'Working days': 'வேலை நாட்கள்', 'Dress code': 'ஆடை விதிமுறை' },
  }
  return facts.map(([label, value]) => [labels[language]?.[label] || label, localizeWeekdays(value, language)])
}

const unwrapForm = (response) => {
  const payload = response?.data?.data ?? response?.data
  return payload?.form_data ?? payload?.form ?? payload
}

const getText = (value, language, fallback = '') => {
  if (typeof value === 'string') return value
  return value?.[language] || value?.en || fallback
}

const getLocaleText = (value, language) => (
  typeof value === 'string' ? value : value?.[language] || value?.en || ''
)

const getFieldText = (field, key, language) => (
  language === 'en'
    ? getText(field.translations?.[key], language) || getText(field[key], language)
    : getLocaleText(field.translations?.[key], language) || getLocaleText(field[key], language)
)

const getFieldLabel = (field, language) => {
  if (language === 'en') return getText(field.translations?.label, language) || getText(field.label, language) || field.name
  return getLocaleText(field.translations?.label, language) || getLocaleText(field.label, language)
}

const getFieldOption = (field, index, language) => {
  const englishOptions = Array.isArray(field.options) ? field.options : String(field.options || '').split('\n').filter(Boolean)
  if (language === 'en') return englishOptions[index] || ''
  const localizedOptions = field.translatedOptions?.[language] || field.translations?.options?.[language]
  return (Array.isArray(localizedOptions) ? localizedOptions[index] : '') || englishOptions[index] || ''
}

const getFieldGroup = (field, customSections = []) => {
  if (customSections.some((section) => section.id === field.group)) return field.group
  const group = String(field.group || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (['confirm', 'confirmation', 'confirmations'].includes(group) || /^confirm(?:ation)?s?[_-]/i.test(field.name || '')) return 'confirmations'
  if (['friend', 'friend_detail', 'friend_details'].includes(group) || /^friend[_-]/i.test(field.name || '')) return 'friend'
  return ''
}

const isWillingToWorkField = (field) => (
  /willing.*work|work.*willing/.test(String(field.name || '').toLowerCase())
  || /are you willing to work at this job/i.test(getFieldLabel(field, 'en'))
)

const groupFields = (fields, customSections = [], savedGroupOrder = []) => {
  const groups = []
  const groupedSections = new Map()

  fields.forEach((field) => {
    const group = getFieldGroup(field, customSections)
    if (!group) {
      groups.push({ group, fields: [field] })
      return
    }

    const section = groupedSections.get(group)
    if (section) section.fields.push(field)
    else {
      const newSection = { group, fields: [field] }
      groupedSections.set(group, newSection)
      groups.push(newSection)
    }
  })

  const sectionOrder = [...savedGroupOrder, '', 'friend', 'confirmations', ...customSections.map((section) => section.id)]
  const sectionRank = new Map(sectionOrder.map((group, index) => [group, index]))
  const normalGroups = []
  const willingFields = []
  groups.forEach((group) => {
    const regularFields = group.fields.filter((field) => !isWillingToWorkField(field))
    if (regularFields.length) normalGroups.push({ ...group, fields: regularFields })
    group.fields.filter(isWillingToWorkField).forEach((field) => willingFields.push(field))
  })
  const ordered = normalGroups
    .map((group, index) => ({ ...group, index }))
    .sort((a, b) => (sectionRank.get(a.group) ?? sectionOrder.length) - (sectionRank.get(b.group) ?? sectionOrder.length) || a.index - b.index)

  willingFields.forEach((field) => ordered.push({ group: '', fields: [field] }))
  return ordered
}

const cleanMobile = (value) => String(value || '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '')
const validMobile = (value) => /^[6-9]\d{9}$/.test(value)
const getPhoneTargets = (value) => {
  let digits = String(value || '').replace(/\D/g, '').replace(/^00/, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  if (!validMobile(digits)) return null
  return { telephone: `+91${digits}`, whatsapp: `91${digits}` }
}

const translateApplicationForm = async (form, language) => {
  const localizedContent = form.content?.[language]
  const content = localizedContent || {}
  const fields = ensureCoreApplicantFields(form.fields || [])
  const sections = Array.isArray(content.builderCustomSections) ? content.builderCustomSections : []
  return { language, content, fields, sections }
}

export default function PublicProjectApplication() {
  const { projectId } = useParams()
  const [form, setForm] = useState(null)
  const [language, setLanguage] = useState('en')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const [translatedForm, setTranslatedForm] = useState(null)

  const loadForm = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await recruiterAPI.getProjectApplicationForm(projectId)
      const loadedForm = unwrapForm(response)
      if (!loadedForm || !Array.isArray(loadedForm.fields)) throw new Error('This application form is not available yet.')
      setForm(loadedForm)
    } catch (loadError) {
      setForm(null)
      setError(loadError?.response?.data?.message || loadError.message || 'Could not load this application form.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadForm()
  }, [projectId])

  useEffect(() => {
    if (!form || language === 'en') {
      setTranslatedForm(null)
      return undefined
    }

    let active = true
    translateApplicationForm(form, language)
      .then((result) => {
        if (!active) return
        setTranslatedForm(result)
      })
      .catch(() => {
        if (active) setTranslatedForm(null)
      })

    return () => { active = false }
  }, [form, language])

  const englishContent = form?.content?.en || {}
  const enabledLanguages = Array.isArray(englishContent.enabledLanguages)
    ? englishContent.enabledLanguages
    : []
  const availableLanguages = LANGUAGES.filter(([code]) => (
    code === 'en' || enabledLanguages.includes(code)
  ))
  useEffect(() => {
    if (!availableLanguages.some(([code]) => code === language)) setLanguage('en')
  }, [form, language])
  const localizedForm = translatedForm?.language === language ? translatedForm : null
  const selectedContent = language === 'en'
    ? englishContent
    : { ...englishContent, ...(localizedForm?.content || {}) }
  const rawContent = selectedContent
  const useLocalizedValue = (key, fallback) => {
    const value = selectedContent[key]
    return value || fallback
  }
  const projectName = rawContent.projectName || rawContent.headline || `Project ${projectId}`
  const generatedIntro = getPublicText(language, 'genericIntro', { name: projectName })
  const rawFacts = selectedContent.facts || (language === 'en' ? englishContent.facts : [])
  const openingCount = String(englishContent.urgent || '').match(/^\d+/)?.[0]
  const companyName = String(englishContent.footer || '').split(' · ')[0]
  const content = {
    ...rawContent,
    brandLine: useLocalizedValue('brandLine', getPublicText(language, 'projectApplication')),
    intro: useLocalizedValue('intro', generatedIntro),
    whoText: useLocalizedValue('whoText', generatedIntro),
    whoTitle: useLocalizedValue('whoTitle', getPublicText(language, 'whoTitle')),
    detailsTitle: useLocalizedValue('detailsTitle', getPublicText(language, 'jobDetails')),
    contactTitle: useLocalizedValue('contactTitle', getPublicText(language, 'contactTitle')),
    call: useLocalizedValue('call', getPublicText(language, 'call')),
    formIntro: useLocalizedValue('formIntro', getPublicText(language, 'formIntro')),
    formTitle: useLocalizedValue('formTitle', getPublicText(language, 'formTitle')),
    share: useLocalizedValue('share', getPublicText(language, 'share')),
    shareMsg: useLocalizedValue('shareMsg', getPublicText(language, 'shareMessage', { name: projectName })),
    checkTitle: useLocalizedValue('checkTitle', getPublicText(language, 'pleaseConfirm')),
    submit: useLocalizedValue('submit', getPublicText(language, 'submit')),
    doneTitle: useLocalizedValue('doneTitle', getPublicText(language, 'received', { name: '{name}' })),
    doneText: useLocalizedValue('doneText', getPublicText(language, 'contactYou', { mobile: '{mobile}' })),
    footer: useLocalizedValue('footer', [companyName, getPublicText(language, 'footer')].filter(Boolean).join(' · ')),
    urgent: useLocalizedValue('urgent', openingCount ? getPublicText(language, 'openings', { count: openingCount }) : ''),
    facts: localizeFacts(formatProjectFacts(rawFacts), language),
    perks: selectedContent.perks || [],
  }
  const trainingCountdown = getTrainingCountdownLabel(content.trainingDate, language, content)
  const fields = ensureCoreApplicantFields(localizedForm?.fields || form?.fields || [])
  const customFieldSections = Array.isArray(content.builderCustomSections) ? content.builderCustomSections : []
  const sections = groupFields(fields, customFieldSections, content.builderFieldGroupOrder || [])
  const formTitle = content.formTitle || (language === 'en' ? form?.title : '') || getPublicText(language, 'application')
  const formIntro = content.formIntro || (language === 'en' ? form?.description : '') || ''
  const headline = useLocalizedValue('headline', projectName)

  const submitApplication = async (event) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const formData = new FormData(formElement)
    const answers = {}

    fields.forEach((field) => {
      const control = formElement.elements.namedItem(field.name)
      if (field.type === 'checkbox') {
        answers[field.name] = Boolean(control?.checked)
      } else {
        const value = formData.get(field.name) || ''
        answers[field.name] = field.type === 'tel' ? cleanMobile(value) : String(value).trim()
      }
    })

    const invalidMobile = fields.find((field) => (
      field.type === 'tel' && answers[field.name] && !validMobile(answers[field.name])
    ))
    if (invalidMobile) {
      const control = formElement.elements.namedItem(invalidMobile.name)
      control.setCustomValidity(getPublicText(language, 'invalidMobile'))
      control.reportValidity()
      control.setCustomValidity('')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const firstNameField = fields.find((field) => field.name === 'first_name')
      const lastNameField = fields.find((field) => field.name === 'last_name')
      const emailField = fields.find((field) => field.type === 'email' || field.name === 'email')
      const mobileField = fields.find((field) => ['mobile', 'phone', 'phone_number'].includes(field.name))
        || fields.find((field) => field.type === 'tel' && !field.name.includes('friend'))
      const firstName = firstNameField ? answers[firstNameField.name] : ''
      const lastName = lastNameField ? answers[lastNameField.name] : ''
      const email = emailField ? answers[emailField.name] : ''
      const mobile = mobileField ? answers[mobileField.name] : ''
      const applicantAnswers = { ...answers, language }
      ;[firstNameField, lastNameField, emailField, mobileField].filter(Boolean).forEach((field) => {
        delete applicantAnswers[field.name]
      })
      await recruiterAPI.submitProjectApplication(projectId, {
        first_name: firstName,
        last_name: lastName,
        email,
        mobile,
        answers: applicantAnswers,
      })
      setSuccess({
        name: [firstName, lastName].filter(Boolean).join(' '),
        mobile,
      })
      formElement.reset()
    } catch (submitError) {
      setError(language === 'en'
        ? submitError?.response?.data?.message || content.errNetwork || getPublicText(language, 'networkError')
        : getPublicText(language, 'networkError'))
    } finally {
      setSubmitting(false)
    }
  }

  const shareUrl = `${window.location.origin}${import.meta.env.BASE_URL}#/apply/${encodeURIComponent(normalizeProjectIdParam(projectId))}`
  const doneTitle = (content.doneTitle || getPublicText(language, 'received', { name: '{name}' })).replace('{name}', success?.name || '')
  const doneText = (content.doneText || getPublicText(language, 'contactYou', { mobile: '{mobile}' })).replace('{mobile}', success?.mobile || '')

  return (
    <div className="public-application-page">
      <header className="public-app-header">
        <a className="public-app-brand" href={`${import.meta.env.BASE_URL}#/`}>
          <span className="public-app-mark">C</span>
          <span><strong>Cynosure Jobs</strong><small>{content.brandLine}</small></span>
        </a>
        <div className="public-app-languages" aria-label={getPublicText(language, 'chooseLanguage')}>
          {availableLanguages.map(([code, label]) => (
            <button key={code} type="button" className={language === code ? 'active' : ''} aria-pressed={language === code} onClick={() => setLanguage(code)}>{label}</button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="public-app-state" role="status">{getPublicText(language, 'loading')}</div>
      ) : error && !form ? (
        <div className="public-app-state public-app-error" role="alert">
          <h1>{formTitle}</h1>
          <p>{language === 'en' ? error : getPublicText(language, 'loadError')}</p>
          <button type="button" className="public-app-button" onClick={loadForm}>{getPublicText(language, 'retry')}</button>
        </div>
      ) : (
        <>
          <section className="public-app-hero">
            <div className="public-app-hero-inner">
              <span className="public-app-eyebrow">{content.eyebrow || getPublicText(language, 'projectApplication')}</span>
              <p className="public-app-project-name">{content.projectName || `${getPublicText(language, 'project')} ${projectId}`}</p>
              <h1>{headline || formTitle}</h1>
              <p className="public-app-intro">{content.intro || formIntro}</p>
              {trainingCountdown && <div className="public-app-date">{trainingCountdown}</div>}
            </div>
          </section>

          <main className="public-app-main">
            <div className="public-app-details">
              {Array.isArray(content.facts) && content.facts.length > 0 && (
                <section className="public-app-section">
                  <h2>{content.detailsTitle || getPublicText(language, 'jobDetails')}</h2>
                  <div className="public-app-facts">
                    {content.facts.map(([label, value], index) => <div key={`fact-${index}`}><small>{label}</small><strong>{value}</strong></div>)}
                  </div>
                </section>
              )}

              {(content.whoTitle || content.whoText || content.perks?.length > 0) && (
                <section className="public-app-section">
                  <h2>{content.whoTitle}</h2>
                  {content.whoText && <p>{content.whoText}</p>}
                  {content.perks?.length > 0 && <ul className="public-app-perks">{content.perks.map((perk, index) => <li key={`perk-${index}`}>{perk}</li>)}</ul>}
                </section>
              )}

              {content.contacts?.length > 0 && (
                <section className="public-app-section">
                  <h2>{content.contactTitle}</h2>
                  <div className="public-app-contacts">
                    {content.contacts.map((contact, index) => (
                      (() => {
                        const phone = contact.phone || contact.mobile || contact.number
                        const targets = getPhoneTargets(phone)
                        return (
                          <div className="public-app-contact" key={`contact-${index}`}>
                            <div><strong>{contact.name}</strong><span>{phone}</span></div>
                            {targets && <div className="public-app-contact-actions">
                              <a href={`tel:${targets.telephone}`}>{content.call || 'Call'}</a>
                              <a href={`https://wa.me/${targets.whatsapp}`} target="_blank" rel="noreferrer">WhatsApp</a>
                            </div>}
                          </div>
                        )
                      })()
                    ))}
                  </div>
                  {content.urgent && <p className="public-app-urgent">{content.urgent}</p>}
                </section>
              )}
              <footer className="public-app-footer">{content.footer}</footer>
            </div>

            <aside className="public-app-form-card" id="apply-form">
              {success ? (
                <div className="public-app-success" role="status">
                  <div className="public-app-success-icon"><FontAwesomeIcon icon={faCheck} /></div>
                  <h2>{doneTitle}</h2>
                  <p>{doneText}</p>
                  {content.share && <a className="public-app-share" href={`https://wa.me/?text=${encodeURIComponent(`${content.shareMsg || ''}${shareUrl}`)}`} target="_blank" rel="noreferrer">{content.share}</a>}
                </div>
              ) : (
                <>
                  <div className="public-app-form-heading">
                    <span>{content.eyebrow || getPublicText(language, 'application')}</span>
                    <h2>{formTitle}</h2>
                    {formIntro && <p>{formIntro}</p>}
                  </div>
                  {error && <div className="public-app-inline-error" role="alert">{error}</div>}
                  <form onSubmit={submitApplication}>
                    {sections.map((section, sectionIndex) => {
                      const sectionFields = section.fields
                      const renderField = (field, index) => {
                        const id = `application-${sectionIndex}-${index}`
                        const label = getFieldLabel(field, language)
                        if (field.type === 'checkbox') {
                          return <label className="public-app-checkbox" key={field.id || field.name}><input id={id} name={field.name} type="checkbox" required={Boolean(field.required)} onInvalid={(event) => event.currentTarget.setCustomValidity(getPublicText(language, 'requiredField'))} onInput={(event) => event.currentTarget.setCustomValidity('')} /><span>{label}{field.required && <b> *</b>}</span></label>
                        }
                        return (
                          <label className="public-app-field" key={field.id || field.name} htmlFor={id}>
                            <span>{label}{field.required && <b> *</b>}</span>
                            {field.type === 'textarea'
                              ? <textarea id={id} name={field.name} required={Boolean(field.required)} placeholder={getFieldText(field, 'placeholder', language)} onInvalid={(event) => event.currentTarget.setCustomValidity(getPublicText(language, 'requiredField'))} onInput={(event) => event.currentTarget.setCustomValidity('')} />
                              : field.type === 'select'
                                ? <select id={id} name={field.name} required={Boolean(field.required)} defaultValue="" onInvalid={(event) => event.currentTarget.setCustomValidity(getPublicText(language, 'requiredField'))} onInput={(event) => event.currentTarget.setCustomValidity('')}><option value="">{getPublicText(language, 'selectOption')}</option>{(Array.isArray(field.options) ? field.options : String(field.options || '').split('\n').filter(Boolean)).map((option, optionIndex) => <option key={option} value={option}>{getFieldOption(field, optionIndex, language)}</option>)}</select>
                                : field.type === 'tel'
                                      ? <div className="public-app-phone"><span>+91</span><input id={id} name={field.name} type="tel" required={Boolean(field.required)} placeholder={getFieldText(field, 'placeholder', language) || '98765 43210'} pattern="[0-9 ()+-]{10,14}" inputMode="tel" onInvalid={(event) => event.currentTarget.setCustomValidity(event.currentTarget.validity.valueMissing ? getPublicText(language, 'requiredField') : getPublicText(language, 'invalidMobile'))} onInput={(event) => event.currentTarget.setCustomValidity('')} /></div>
                                      : <input id={id} name={field.name} type={field.type || 'text'} required={Boolean(field.required)} placeholder={getFieldText(field, 'placeholder', language)} onInvalid={(event) => event.currentTarget.setCustomValidity(getPublicText(language, 'requiredField'))} onInput={(event) => event.currentTarget.setCustomValidity('')} />}
                                    {getFieldText(field, 'hint', language) && <small>{getFieldText(field, 'hint', language)}</small>}
                          </label>
                        )
                      }

                      if (section.group === 'friend') {
                        return <details className="public-app-friend" key={`group-${sectionIndex}`}><summary>{getPublicText(language, 'friendPrompt')}</summary>{sectionFields.map(renderField)}</details>
                      }
                      if (section.group === 'confirmations') {
                        return <fieldset className="public-app-confirmations" key={`group-${sectionIndex}`}><legend>{content.checkTitle || getPublicText(language, 'pleaseConfirm')}</legend>{sectionFields.map(renderField)}</fieldset>
                      }
                      const customSection = customFieldSections.find((item) => item.id === section.group)
                      if (customSection) {
                        return (
                          <section className="public-app-custom-section" key={`group-${sectionIndex}`}>
                            <h3>{getLocaleText(customSection.title, language)}</h3>
                            {sectionFields.map(renderField)}
                          </section>
                        )
                      }
                      return sectionFields.map(renderField)
                    })}
                    <button className="public-app-button public-app-submit" type="submit" disabled={submitting}>{submitting ? getPublicText(language, 'sending') : content.submit || getPublicText(language, 'submit')}</button>
                  </form>
                </>
              )}
            </aside>
          </main>
        </>
      )}
    </div>
  )
}
