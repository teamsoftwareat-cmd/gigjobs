import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faCopy, faEye, faGripVertical, faPlus, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons'
import { recruiterAPI } from '../../api/axios'
import { useAlert } from '../../context/AlertContext'
import { getTrainingCountdownLabel } from '../../utils/dateCountdown'
import { formatProjectFacts, formatWorkingDays } from '../../utils/projectFormatting'
import { CORE_APPLICANT_FIELDS, ensureCoreApplicantFields, isCoreApplicantField } from '../../utils/applicationFormFields'
import { generateApplicationFormFromDescription } from '../../utils/describeApplicationForm'
import { getApplicationTranslationIssues } from '../../utils/applicationFormTranslation'
import './ProjectFormBuilder.css'

const DEFAULT_FIELDS = [
  ...CORE_APPLICANT_FIELDS,
  { id: 'area', name: 'area', label: { en: 'Your area in Jalandhar (optional)', hi: 'जालंधर में आपका इलाका (वैकल्पिक)', ta: 'ஜலந்தரில் உங்கள் பகுதி (விருப்பத்தேர்வு)' }, type: 'text', required: false, options: '', placeholder: { en: 'e.g. Model Town', hi: 'जैसे मॉडल टाउन', ta: 'எ.கா. மாடல் டவுன்' }, hint: { en: '', hi: '', ta: '' }, group: '' },
  { id: 'friend-name', name: 'friend_name', label: { en: "Friend's name", hi: 'दोस्त का नाम', ta: 'நண்பரின் பெயர்' }, type: 'text', required: false, options: '', placeholder: { en: '', hi: '', ta: '' }, hint: { en: '', hi: '', ta: '' }, group: 'friend' },
  { id: 'friend-mobile', name: 'friend_mobile', label: { en: "Friend's mobile number", hi: 'दोस्त का मोबाइल नंबर', ta: 'நண்பரின் கைபேசி எண்' }, type: 'tel', required: false, options: '', placeholder: { en: '98765 43210', hi: '98765 43210', ta: '98765 43210' }, hint: { en: '', hi: '', ta: '' }, group: 'friend' },
  { id: 'confirm-project', name: 'confirm_project', label: { en: 'This is a temporary government project at PAP Ground, Jalandhar', hi: 'यह PAP ग्राउंड, जालंधर में एक अस्थायी सरकारी प्रोजेक्ट है', ta: 'இது ஜலந்தர் PAP மைதானத்தில் நடைபெறும் தற்காலிக அரசு திட்டம்' }, type: 'checkbox', required: true, options: '', placeholder: '', hint: '', group: 'confirmations' },
  { id: 'confirm-duration', name: 'confirm_duration', label: { en: 'The work is for 20 days only', hi: 'काम सिर्फ़ 20 दिनों का है', ta: 'இந்த வேலை 20 நாட்களுக்கு மட்டுமே' }, type: 'checkbox', required: true, options: '', placeholder: '', hint: '', group: 'confirmations' },
  { id: 'confirm-time', name: 'confirm_reporting_time', label: { en: 'I will report by 5:00 AM. Work starts at 5:30 AM and breakfast is given at the ground', hi: 'मुझे सुबह 5:00 बजे तक पहुँचना है। काम 5:30 बजे शुरू होगा और नाश्ता ग्राउंड पर मिलेगा', ta: 'காலை 5:00 மணிக்குள் வருவேன். வேலை 5:30 மணிக்குத் தொடங்கும்; மைதானத்தில் காலை உணவு வழங்கப்படும்' }, type: 'checkbox', required: true, options: '', placeholder: '', hint: '', group: 'confirmations' },
  { id: 'confirm-pay', name: 'confirm_pay', label: { en: 'The pay is ₹500 per day', hi: 'वेतन ₹500 प्रति दिन है', ta: 'ஒரு நாளுக்கான ஊதியம் ₹500' }, type: 'checkbox', required: true, options: '', placeholder: '', hint: '', group: 'confirmations' },
  { id: 'confirm-training', name: 'confirm_training', label: { en: 'Training is given at the venue on 9 October', hi: 'ट्रेनिंग 9 अक्टूबर को वेन्यू पर दी जाएगी', ta: 'அக்டோபர் 9 அன்று பணியிடத்தில் பயிற்சி வழங்கப்படும்' }, type: 'checkbox', required: true, options: '', placeholder: '', hint: '', group: 'confirmations' },
]

const BUILDER_SECTIONS = ['jobIntroduction', 'jobDetails', 'whoShouldApply', 'contactTeam', 'application']
const FIELD_GROUPS = ['', 'friend', 'confirmations']
const APPLICATION_LANGUAGES = [
  ['hi', 'Hindi', 'हिंदी'],
  ['mr', 'Marathi', 'मराठी'],
  ['ta', 'Tamil', 'தமிழ்'],
  ['te', 'Telugu', 'తెలుగు'],
  ['ml', 'Malayalam', 'മലയാളം'],
]
const DEFAULT_ENABLED_LANGUAGES = []

const getBuilderFieldGroup = (field, customSections = []) => FIELD_GROUPS.includes(field.group)
  || customSections.some((section) => section.id === field.group)
  ? field.group
  : ''

const createSectionFieldDraft = (index = 1) => ({
  label: `New field ${index}`,
  type: 'text',
  required: false,
  placeholder: '',
  hint: '',
  options: '',
})
const isWillingToWorkField = (field) => (
  /willing.*work|work.*willing/.test(String(field.name || '').toLowerCase())
  || /are you willing to work at this job/i.test(
    typeof field.label === 'string' ? field.label : field.label?.en || '',
  )
)
const keepWillingToWorkLast = (fields) => {
  const index = fields.findIndex(isWillingToWorkField)
  if (index < 0 || index === fields.length - 1) return fields
  const ordered = [...fields]
  ordered.push(ordered.splice(index, 1)[0])
  return ordered
}

const DEFAULT_CONTENT = {
  en: {
    previewForm: 'Preview form', backToProjects: 'Back to projects', closeFormPreview: 'Close form preview', applicantPointAria: 'Applicant point {number}', dragToReorder: 'Drag to reorder',
    brandLine: 'Short-term hiring',
    projectName: 'PET Exam - PAP Ground Jalandhar',
    trainingDate: '2026-10-09',
    eyebrow: 'Government project · Jalandhar',
    headline: 'Earn ₹10,000 in 20 days at the PET Exam',
    intro: 'We need Registration Executives at PAP Ground, Jalandhar (PAP Chowk). No experience needed. We train you on site.',
    countdown: 'Training starts in {n} days',
    countdownToday: 'Training is today',
    countdownTomorrow: 'Training starts tomorrow',
    detailsTitle: 'Job details',
    facts: [['Pay', '₹500 / day'], ['Duration', '20 working days'], ['Role', 'Registration Executive'], ['Report at', '5:00 AM'], ['Breakfast', 'Free, at the ground'], ['Training', '9 Oct, 11:00 AM, PAP Chowk']],
    whoTitle: 'Who should apply',
    whoText: 'Students, freshers and anyone looking for short-term work.',
    perks: ['Short-term government project', 'Training given before you start', 'Bring your friends and work together'],
    contactTitle: 'Questions? Talk to our team',
    contacts: [{ name: 'Uma', phone: '9500050489' }, { name: 'Rizwana', phone: '9080467247' }, { name: 'Radhika', phone: '9171066609' }],
    call: 'Call',
    urgent: 'Limited openings. Apply early.',
    formTitle: 'Reserve your spot',
    formIntro: 'Takes under a minute. Our team will call you with joining details before training day.',
    checkTitle: 'Please confirm you understand',
    submit: 'Reserve my spot',
    doneTitle: "You're on the list, {name}!",
    doneText: 'Our team will call you on {mobile} before training on 9 October. Keep your phone on.',
    share: 'Share with friends on WhatsApp',
    shareMsg: 'Short-term job at the PET Exam, PAP Ground Jalandhar. ₹500/day for 20 days, breakfast given, training provided. Apply here: ',
    fab: 'Apply now',
    footer: 'Cynosure Corporate Solutions · Recruitment partner for this project',
    errFirst: 'Please enter your first name',
    errMobile: 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9',
    errChecks: 'Please tick all five points to continue',
    errNetwork: 'Could not send. Check your internet and try again, or call us on the numbers given.',
  },
  hi: {
    previewForm: 'फ़ॉर्म का पूर्वावलोकन', backToProjects: 'प्रोजेक्ट पर वापस जाएँ', closeFormPreview: 'फ़ॉर्म का पूर्वावलोकन बंद करें', applicantPointAria: 'आवेदक के लिए बिंदु {number}', dragToReorder: 'क्रम बदलने के लिए खींचें',
    brandLine: 'अल्पकालिक भर्ती',
    projectName: 'PET परीक्षा - PAP ग्राउंड जालंधर',
    trainingDate: '2026-10-09',
    eyebrow: 'सरकारी प्रोजेक्ट · जालंधर',
    headline: 'PET परीक्षा में 20 दिन काम करें, कमाएँ ₹10,000',
    intro: 'PAP ग्राउंड, जालंधर (PAP चौक) पर रजिस्ट्रेशन एग्ज़िक्यूटिव चाहिए। अनुभव ज़रूरी नहीं। ट्रेनिंग वहीं दी जाएगी।',
    countdown: 'ट्रेनिंग {n} दिन में शुरू',
    countdownToday: 'ट्रेनिंग आज है',
    countdownTomorrow: 'ट्रेनिंग कल से शुरू',
    detailsTitle: 'काम की जानकारी',
    facts: [['वेतन', '₹500 / दिन'], ['अवधि', '20 कार्य दिवस'], ['पद', 'रजिस्ट्रेशन एग्ज़िक्यूटिव'], ['रिपोर्टिंग', 'सुबह 5:00 बजे'], ['नाश्ता', 'मुफ़्त, ग्राउंड पर'], ['ट्रेनिंग', '9 अक्टूबर, सुबह 11:00, PAP चौक']],
    whoTitle: 'कौन आवेदन करे',
    whoText: 'छात्र, फ्रेशर्स और कम समय का काम ढूँढ रहे सभी लोग।',
    perks: ['अल्पकालिक सरकारी प्रोजेक्ट', 'काम शुरू होने से पहले ट्रेनिंग', 'दोस्तों को साथ लाएँ और साथ काम करें'],
    contactTitle: 'कोई सवाल? हमारी टीम से बात करें',
    contacts: [{ name: 'Uma', phone: '9500050489' }, { name: 'Rizwana', phone: '9080467247' }, { name: 'Radhika', phone: '9171066609' }],
    call: 'कॉल',
    urgent: 'सीटें सीमित हैं। जल्दी आवेदन करें।',
    formTitle: 'अपनी जगह पक्की करें',
    formIntro: 'एक मिनट से कम लगेगा। ट्रेनिंग से पहले हमारी टीम कॉल करके पूरी जानकारी देगी।',
    checkTitle: 'कृपया पुष्टि करें कि आप समझ गए हैं',
    submit: 'मेरी जगह पक्की करें',
    doneTitle: '{name}, आपका नाम लिस्ट में जुड़ गया!',
    doneText: '9 अक्टूबर की ट्रेनिंग से पहले हमारी टीम {mobile} पर कॉल करेगी। फ़ोन चालू रखें।',
    share: 'दोस्तों को WhatsApp पर भेजें',
    shareMsg: 'PET परीक्षा, PAP ग्राउंड जालंधर में अल्पकालिक नौकरी। ₹500/दिन, 20 दिन, नाश्ता और ट्रेनिंग मिलेगी। यहाँ आवेदन करें: ',
    fab: 'अभी आवेदन करें',
    footer: 'Cynosure Corporate Solutions · इस प्रोजेक्ट के लिए भर्ती पार्टनर',
    errFirst: 'कृपया अपना पहला नाम लिखें',
    errMobile: '6, 7, 8 या 9 से शुरू होने वाला 10 अंकों का मोबाइल नंबर लिखें',
    errChecks: 'आगे बढ़ने के लिए पाँचों बिंदुओं पर टिक करें',
    errNetwork: 'भेजा नहीं जा सका। इंटरनेट चेक करके फिर कोशिश करें, या दिए गए नंबर पर कॉल करें।',
  },
  ta: {
    previewForm: 'படிவ முன்னோட்டம்', backToProjects: 'திட்டங்களுக்குத் திரும்பவும்', closeFormPreview: 'படிவ முன்னோட்டத்தை மூடவும்', applicantPointAria: 'விண்ணப்பதாரர் குறிப்பு {number}', dragToReorder: 'வரிசையை மாற்ற இழுக்கவும்',
    brandLine: 'குறுகியகால வேலைவாய்ப்பு',
    projectName: 'PET தேர்வு - PAP மைதானம், ஜலந்தர்',
    trainingDate: '2026-10-09',
    eyebrow: 'அரசுத் திட்டம் · ஜலந்தர்',
    headline: 'PET தேர்வில் 20 நாட்கள் பணியாற்றி ₹10,000 சம்பாதிக்கவும்',
    intro: 'ஜலந்தர் PAP மைதானத்தில் (PAP சௌக்) பதிவு நிர்வாகிகள் தேவை. முன் அனுபவம் தேவையில்லை. பணியிடத்திலேயே பயிற்சி வழங்கப்படும்.',
    countdown: 'பயிற்சி இன்னும் {n} நாட்களில் தொடங்கும்',
    countdownToday: 'பயிற்சி இன்று',
    countdownTomorrow: 'பயிற்சி நாளை தொடங்கும்',
    detailsTitle: 'வேலை விவரங்கள்',
    facts: [['ஊதியம்', '₹500 / நாள்'], ['காலம்', '20 வேலை நாட்கள்'], ['பணி', 'பதிவு நிர்வாகி'], ['வருகை நேரம்', 'காலை 5:00'], ['காலை உணவு', 'மைதானத்தில் இலவசம்'], ['பயிற்சி', 'அக். 9, காலை 11:00, PAP சௌக்']],
    whoTitle: 'யார் விண்ணப்பிக்கலாம்',
    whoText: 'மாணவர்கள், புதியவர்கள் மற்றும் குறுகியகால வேலை தேடுபவர்கள் விண்ணப்பிக்கலாம்.',
    perks: ['குறுகியகால அரசுத் திட்டம்', 'வேலை தொடங்கும் முன் பயிற்சி', 'நண்பர்களுடன் சேர்ந்து வேலை செய்யலாம்'],
    contactTitle: 'கேள்விகளுக்கு எங்கள் குழுவைத் தொடர்புகொள்ளுங்கள்',
    contacts: [{ name: 'Uma', phone: '9500050489' }, { name: 'Rizwana', phone: '9080467247' }, { name: 'Radhika', phone: '9171066609' }],
    call: 'அழைக்க',
    urgent: 'காலியிடங்கள் குறைவு. விரைவில் விண்ணப்பிக்கவும்.',
    formTitle: 'உங்கள் இடத்தை உறுதிசெய்யுங்கள்',
    formIntro: 'ஒரு நிமிடத்திற்கும் குறைவாகும். பயிற்சி நாளுக்கு முன் சேரும் விவரங்களுடன் எங்கள் குழு உங்களை அழைக்கும்.',
    checkTitle: 'கீழே உள்ளவற்றை உறுதிப்படுத்தவும்',
    submit: 'என் இடத்தை உறுதிசெய்',
    doneTitle: '{name}, உங்கள் பெயர் பட்டியலில் சேர்க்கப்பட்டது!',
    doneText: 'அக்டோபர் 9 பயிற்சிக்கு முன் எங்கள் குழு {mobile} எண்ணில் அழைக்கும். உங்கள் தொலைபேசியை இயக்கத்தில் வைத்திருங்கள்.',
    share: 'WhatsApp-ல் நண்பர்களுடன் பகிரவும்',
    shareMsg: 'ஜலந்தர் PAP மைதானத்தில் PET தேர்வுக்கான குறுகியகால வேலை. ₹500/நாள், 20 நாட்கள், காலை உணவும் பயிற்சியும் வழங்கப்படும். இங்கே விண்ணப்பிக்கவும்: ',
    fab: 'இப்போது விண்ணப்பிக்கவும்',
    footer: 'Cynosure Corporate Solutions · இந்தத் திட்டத்திற்கான ஆட்சேர்ப்பு பங்குதாரர்',
    errFirst: 'உங்கள் முதல் பெயரை உள்ளிடவும்',
    errMobile: '6, 7, 8 அல்லது 9-ல் தொடங்கும் 10 இலக்க கைபேசி எண்ணை உள்ளிடவும்',
    errChecks: 'தொடர ஐந்து உறுதிப்படுத்தல்களையும் தேர்ந்தெடுக்கவும்',
    errNetwork: 'அனுப்ப முடியவில்லை. இணையத்தைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும் அல்லது வழங்கப்பட்ட எண்ணை அழைக்கவும்.',
  },
}

const EMPTY_CONTENT = Object.fromEntries(Object.entries(DEFAULT_CONTENT).map(([locale, values]) => [
  locale,
  Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Array.isArray(value) ? [] : ''])),
]))

const createSavedContent = (savedContent = {}) => Object.fromEntries(
  [...new Set([...Object.keys(EMPTY_CONTENT), ...Object.keys(savedContent)])].map((locale) => [
    locale,
    { ...(EMPTY_CONTENT[locale] || EMPTY_CONTENT.en), ...(savedContent[locale] || {}) },
  ]),
)

const FIELD_TYPES = [
  ['text', 'shortText'],
  ['tel', 'mobileNumber'],
  ['email', 'email'],
  ['number', 'number'],
  ['date', 'date'],
  ['textarea', 'longText'],
  ['select', 'dropdown'],
  ['checkbox', 'checkbox'],
]

const BUILDER_TEXT = {
  en: {
    builderHeading: 'Application page', builderDescription: 'Customize the job details, applicant guidance, and application fields.', pageLanguage: 'Page language',
    jobIntroduction: 'Job introduction', brandLine: 'Brand line', projectName: 'Project name', trainingDate: 'Training date', eyebrow: 'Eyebrow', headline: 'Headline', introduction: 'Introduction',
    jobDetails: 'Job details', addDetail: 'Add detail', sectionHeading: 'Section heading', detailLabel: 'Detail label', detailValue: 'Detail value', detailLabelPlaceholder: 'Label (e.g. Pay)', detailValuePlaceholder: 'Value (e.g. ₹500 / day)', removeJobDetail: 'Remove job detail', noJobDetails: 'No job details. Add the details applicants should see.',
    whoShouldApply: 'Who should apply', addPoint: 'Add point', description: 'Description', applicantPoint: 'Applicant point', removeApplicantPoint: 'Remove applicant point', noApplicantPoints: 'No applicant points added.',
    contactTeam: 'Contact team', addContact: 'Add contact', urgencyNote: 'Urgency note', contactName: 'Contact name', name: 'Name', phoneNumber: 'Phone number', removeContact: 'Remove contact', noContacts: 'No contacts added.',
    applicationFormText: 'Application form text', formTitle: 'Form title', formIntroduction: 'Form introduction', confirmationHeading: 'Confirmation heading', submitButton: 'Submit button', successHeading: 'Success heading', successMessage: 'Success message', whatsAppShareButton: 'WhatsApp share button', whatsAppShareMessage: 'WhatsApp share message', callButton: 'Call button', footer: 'Footer',
    applicantDetails: 'Applicant details', standardFieldsNote: 'These standard fields are always included on the application.', fixedField: 'Fixed field', label: 'Label', placeholder: 'Placeholder', hint: 'Hint', required: 'Required', optional: 'Optional',
    additionalQuestions: 'Application fields', additionalQuestionsNote: 'Set each field or section position below to reorder it. Move fields between sections using the section selector.', addField: 'Add field', moveFieldUp: 'Move field up', moveFieldDown: 'Move field down', moveUp: 'Move up', moveDown: 'Move down', duplicateField: 'Duplicate field', removeField: 'Remove field', removeLabel: 'Remove', position: 'Position', addSection: 'Add section', sectionName: 'Section name', newSectionName: 'New section', removeSection: 'Remove section', lastQuestion: 'Last question', createSection: 'Create section', cancel: 'Cancel', addSectionField: 'Add field', customSectionDescription: 'Create a section and configure its custom application fields.', sectionNameRequired: 'Enter a name for this section.', sectionFieldRequired: 'Add at least one field with a label.', fieldOptions: 'Options (one per line)', fieldRequiredToggle: 'Required field',
    formBuilderTab: 'Form Builder', describeFormTab: 'Describe Form', languages: 'Languages', translationReview: 'I reviewed this translation for accuracy and completeness. Names, brands, numbers, and locations may remain unchanged.', translationIncompleteCount: '{count} text items still need a translation.', describeFormTitle: 'Describe your form', describeFormHelp: 'Paste a description with section headings and list the fields under each heading. Field types and required status are inferred from the wording.', describeFormPlaceholder: 'Example:\nPersonal details:\n- Age (required, number)\n- Preferred work location (optional)\nAvailability:\n- Available start date\n- Available shifts (options: Morning, Evening)', createFormFromDescription: 'Create', describeFormEmpty: 'Enter a form description first.', describeFormNoFields: 'No application fields were identified. Add section headings and list the fields under each heading.', describeFormSuccess: 'Form generated. Review it in Preview before saving.', describeFormInfo: 'Generated fields are editable. Standard applicant name, email, and mobile fields remain included.',
    type: 'Type', group: 'Group', noGroup: 'No group', friendDetails: 'Friend details', confirmations: 'Confirmations', optionsPerLine: 'Options, one per line', requiredField: 'Required field', requiredFieldHelp: 'Applicants must answer this question to submit', noFields: 'No fields added. Use “Add field” to start.',
    fixedDetails: 'fixed details', additionalQuestionsCount: 'additional questions', saveForm: 'Save form', saving: 'Saving…', preview: 'Preview', closePreview: 'Close preview', project: 'Project', trainingDateNotSet: 'Training date not set', trainingDatePassed: 'Training date has passed', selectTrainingDate: 'Select a training date to preview the countdown',
    friendPrompt: 'Applying with a friend? Add them here (optional)', untitledField: 'Untitled field', selectOption: 'Select an option', loadingSavedForm: 'Loading saved form…', applicationForm: 'Application Form',
    removeItemConfirm: 'Remove this {item} from the application page?', removeItemTitle: 'Remove {item}', remove: 'Remove', jobDetail: 'job detail', applicantPointSingular: 'applicant point', contact: 'contact', item: 'item',
    itemRemoved: '{item} removed.', itemAdded: '{item} added.', newQuestionAdded: 'A new question was added to the application.', removeQuestionConfirm: 'Remove “{label}” from the application?', questionRemoved: 'The question was removed from the application.', questionCopyAdded: 'A copy of the question was added.',
    formSaved: 'Form saved for this project.', formSavedNotice: 'Your application form was saved successfully.', formSaveFailed: 'The form could not be saved.', formSaveTryAgain: 'The form could not be saved. Please try again.', noSavedForm: 'No saved form was loaded. You can configure a new form and save it here.',
    fieldTypes: { shortText: 'Short text', mobileNumber: 'Mobile number', email: 'Email', number: 'Number', date: 'Date', longText: 'Long text', dropdown: 'Dropdown', checkbox: 'Checkbox' },
  },
  hi: {
    builderHeading: 'आवेदन पेज', builderDescription: 'नौकरी की जानकारी, आवेदकों के लिए निर्देश और आवेदन फ़ील्ड संपादित करें।', pageLanguage: 'पेज की भाषा',
    jobIntroduction: 'नौकरी का परिचय', brandLine: 'ब्रांड लाइन', projectName: 'प्रोजेक्ट का नाम', trainingDate: 'प्रशिक्षण की तारीख', eyebrow: 'ऊपरी शीर्षक', headline: 'मुख्य शीर्षक', introduction: 'परिचय',
    jobDetails: 'नौकरी की जानकारी', addDetail: 'जानकारी जोड़ें', sectionHeading: 'सेक्शन का शीर्षक', detailLabel: 'जानकारी का नाम', detailValue: 'जानकारी', detailLabelPlaceholder: 'नाम (जैसे वेतन)', detailValuePlaceholder: 'जानकारी (जैसे ₹500 / दिन)', removeJobDetail: 'नौकरी की जानकारी हटाएँ', noJobDetails: 'नौकरी की जानकारी नहीं है। आवेदकों के लिए जानकारी जोड़ें।',
    whoShouldApply: 'कौन आवेदन करे', addPoint: 'बिंदु जोड़ें', description: 'विवरण', applicantPoint: 'आवेदक के लिए बिंदु', removeApplicantPoint: 'आवेदक का बिंदु हटाएँ', noApplicantPoints: 'आवेदक के लिए कोई बिंदु नहीं जोड़ा गया।',
    contactTeam: 'संपर्क टीम', addContact: 'संपर्क जोड़ें', urgencyNote: 'आवेदन संबंधी सूचना', contactName: 'संपर्क का नाम', name: 'नाम', phoneNumber: 'फ़ोन नंबर', removeContact: 'संपर्क हटाएँ', noContacts: 'कोई संपर्क नहीं जोड़ा गया।',
    applicationFormText: 'आवेदन फ़ॉर्म का टेक्स्ट', formTitle: 'फ़ॉर्म का शीर्षक', formIntroduction: 'फ़ॉर्म का परिचय', confirmationHeading: 'पुष्टि का शीर्षक', submitButton: 'सबमिट बटन', successHeading: 'सफलता का शीर्षक', successMessage: 'सफलता का संदेश', whatsAppShareButton: 'WhatsApp साझा करने का बटन', whatsAppShareMessage: 'WhatsApp साझा करने का संदेश', callButton: 'कॉल बटन', footer: 'फ़ुटर',
    applicantDetails: 'आवेदक की जानकारी', standardFieldsNote: 'ये सामान्य फ़ील्ड आवेदन में हमेशा शामिल रहते हैं।', fixedField: 'स्थिर फ़ील्ड', label: 'लेबल', placeholder: 'प्लेसहोल्डर', hint: 'संकेत', required: 'ज़रूरी', optional: 'वैकल्पिक',
    additionalQuestions: 'आवेदन फ़ील्ड', additionalQuestionsNote: 'क्रम बदलने के लिए हर फ़ील्ड या सेक्शन की स्थिति चुनें। सेक्शन चयन से फ़ील्ड दूसरे सेक्शन में ले जाएँ।', addField: 'फ़ील्ड जोड़ें', moveFieldUp: 'फ़ील्ड ऊपर ले जाएँ', moveFieldDown: 'फ़ील्ड नीचे ले जाएँ', moveUp: 'ऊपर ले जाएँ', moveDown: 'नीचे ले जाएँ', duplicateField: 'फ़ील्ड की कॉपी बनाएँ', removeField: 'फ़ील्ड हटाएँ', removeLabel: 'हटाएँ', position: 'क्रम', addSection: 'सेक्शन जोड़ें', sectionName: 'सेक्शन का नाम', newSectionName: 'नया सेक्शन', removeSection: 'सेक्शन हटाएँ', lastQuestion: 'आख़िरी सवाल',
    type: 'प्रकार', group: 'समूह', noGroup: 'कोई समूह नहीं', friendDetails: 'दोस्त की जानकारी', confirmations: 'पुष्टियाँ', optionsPerLine: 'विकल्प, हर पंक्ति में एक', requiredField: 'अनिवार्य फ़ील्ड', requiredFieldHelp: 'सबमिट करने के लिए आवेदक को इस सवाल का जवाब देना होगा', noFields: 'कोई फ़ील्ड नहीं है। शुरू करने के लिए “फ़ील्ड जोड़ें” चुनें।',
    fixedDetails: 'स्थिर जानकारी', additionalQuestionsCount: 'अतिरिक्त सवाल', saveForm: 'फ़ॉर्म सहेजें', saving: 'सहेजा जा रहा है…', preview: 'पूर्वावलोकन', closePreview: 'पूर्वावलोकन बंद करें', project: 'प्रोजेक्ट', trainingDateNotSet: 'प्रशिक्षण की तारीख तय नहीं है', trainingDatePassed: 'प्रशिक्षण की तारीख बीत चुकी है', selectTrainingDate: 'उलटी गिनती देखने के लिए प्रशिक्षण की तारीख चुनें',
    friendPrompt: 'क्या आप दोस्त के साथ आवेदन कर रहे हैं? उनकी जानकारी यहाँ जोड़ें (वैकल्पिक)', untitledField: 'बिना शीर्षक वाला फ़ील्ड', selectOption: 'एक विकल्प चुनें', loadingSavedForm: 'सहेजा गया फ़ॉर्म लोड हो रहा है…', applicationForm: 'आवेदन फ़ॉर्म',
    removeItemConfirm: 'क्या आवेदन पेज से यह {item} हटाना है?', removeItemTitle: '{item} हटाएँ', remove: 'हटाएँ', jobDetail: 'नौकरी की जानकारी', applicantPointSingular: 'आवेदक का बिंदु', contact: 'संपर्क', item: 'आइटम',
    itemRemoved: '{item} हटा दिया गया।', itemAdded: '{item} जोड़ दिया गया।', newQuestionAdded: 'आवेदन में नया सवाल जोड़ दिया गया।', removeQuestionConfirm: 'क्या आवेदन से “{label}” हटाना है?', questionRemoved: 'सवाल आवेदन से हटा दिया गया।', questionCopyAdded: 'सवाल की कॉपी जोड़ दी गई।',
    formSaved: 'इस प्रोजेक्ट का फ़ॉर्म सहेजा गया।', formSavedNotice: 'आपका आवेदन फ़ॉर्म सफलतापूर्वक सहेजा गया।', formSaveFailed: 'फ़ॉर्म सहेजा नहीं जा सका।', formSaveTryAgain: 'फ़ॉर्म सहेजा नहीं जा सका। कृपया फिर कोशिश करें।', noSavedForm: 'कोई सहेजा हुआ फ़ॉर्म लोड नहीं हुआ। यहाँ नया फ़ॉर्म बनाकर सहेजें।',
    fieldTypes: { shortText: 'छोटा टेक्स्ट', mobileNumber: 'मोबाइल नंबर', email: 'ईमेल', number: 'संख्या', date: 'तारीख', longText: 'लंबा टेक्स्ट', dropdown: 'ड्रॉपडाउन', checkbox: 'चेकबॉक्स' },
  },
  ta: {
    builderHeading: 'விண்ணப்பப் பக்கம்', builderDescription: 'வேலை விவரங்கள், விண்ணப்பதாரர் வழிகாட்டுதல் மற்றும் விண்ணப்பப் புலங்களை மாற்றவும்.', pageLanguage: 'பக்க மொழி',
    jobIntroduction: 'வேலை அறிமுகம்', brandLine: 'பிராண்ட் வரி', projectName: 'திட்டத்தின் பெயர்', trainingDate: 'பயிற்சி தேதி', eyebrow: 'மேல் தலைப்பு', headline: 'முக்கிய தலைப்பு', introduction: 'அறிமுகம்',
    jobDetails: 'வேலை விவரங்கள்', addDetail: 'விவரத்தைச் சேர்க்க', sectionHeading: 'பிரிவுத் தலைப்பு', detailLabel: 'விவரப் பெயர்', detailValue: 'விவரம்', detailLabelPlaceholder: 'பெயர் (எ.கா. ஊதியம்)', detailValuePlaceholder: 'விவரம் (எ.கா. ₹500 / நாள்)', removeJobDetail: 'வேலை விவரத்தை நீக்க', noJobDetails: 'வேலை விவரங்கள் இல்லை. விண்ணப்பதாரர்கள் பார்க்க வேண்டிய விவரங்களைச் சேர்க்கவும்.',
    whoShouldApply: 'யார் விண்ணப்பிக்கலாம்', addPoint: 'குறிப்பைச் சேர்க்க', description: 'விளக்கம்', applicantPoint: 'விண்ணப்பதாரர் குறிப்பு', removeApplicantPoint: 'விண்ணப்பதாரர் குறிப்பை நீக்க', noApplicantPoints: 'விண்ணப்பதாரர் குறிப்புகள் எதுவும் சேர்க்கப்படவில்லை.',
    contactTeam: 'தொடர்புக் குழு', addContact: 'தொடர்பைச் சேர்க்க', urgencyNote: 'அவசரக் குறிப்பு', contactName: 'தொடர்புப் பெயர்', name: 'பெயர்', phoneNumber: 'தொலைபேசி எண்', removeContact: 'தொடர்பை நீக்க', noContacts: 'தொடர்புகள் எதுவும் சேர்க்கப்படவில்லை.',
    applicationFormText: 'விண்ணப்பப் படிவ உரை', formTitle: 'படிவத் தலைப்பு', formIntroduction: 'படிவ அறிமுகம்', confirmationHeading: 'உறுதிப்படுத்தல் தலைப்பு', submitButton: 'சமர்ப்பிக்கும் பொத்தான்', successHeading: 'வெற்றி தலைப்பு', successMessage: 'வெற்றி செய்தி', whatsAppShareButton: 'WhatsApp பகிர்வு பொத்தான்', whatsAppShareMessage: 'WhatsApp பகிர்வு செய்தி', callButton: 'அழைப்பு பொத்தான்', footer: 'அடிப்பகுதி',
    applicantDetails: 'விண்ணப்பதாரர் விவரங்கள்', standardFieldsNote: 'இந்த வழக்கமான புலங்கள் விண்ணப்பத்தில் எப்போதும் இடம்பெறும்.', fixedField: 'நிலையான புலம்', label: 'லேபிள்', placeholder: 'இடம்காட்டி', hint: 'குறிப்பு', required: 'கட்டாயம்', optional: 'விருப்பம்',
    additionalQuestions: 'விண்ணப்பப் புலங்கள்', additionalQuestionsNote: 'வரிசையை மாற்ற ஒவ்வொரு புலம் அல்லது பிரிவின் இடத்தையும் தேர்ந்தெடுக்கவும். பிரிவு தேர்வைப் பயன்படுத்தி புலங்களை நகர்த்தவும்.', addField: 'புலத்தைச் சேர்க்க', moveFieldUp: 'புலத்தை மேலே நகர்த்த', moveFieldDown: 'புலத்தை கீழே நகர்த்த', moveUp: 'மேலே நகர்த்த', moveDown: 'கீழே நகர்த்த', duplicateField: 'புலத்தை நகலெடுக்க', removeField: 'புலத்தை நீக்க', removeLabel: 'நீக்கு', position: 'இடம்', addSection: 'பிரிவைச் சேர்க்கவும்', sectionName: 'பிரிவு பெயர்', newSectionName: 'புதிய பிரிவு', removeSection: 'பிரிவை அகற்றவும்', lastQuestion: 'கடைசி கேள்வி',
    type: 'வகை', group: 'குழு', noGroup: 'குழு இல்லை', friendDetails: 'நண்பர் விவரங்கள்', confirmations: 'உறுதிப்படுத்தல்கள்', optionsPerLine: 'விருப்பங்கள், ஒவ்வொரு வரியிலும் ஒன்று', requiredField: 'கட்டாயப் புலம்', requiredFieldHelp: 'சமர்ப்பிக்க விண்ணப்பதாரர் இந்தக் கேள்விக்குப் பதிலளிக்க வேண்டும்', noFields: 'புலங்கள் எதுவும் சேர்க்கப்படவில்லை. தொடங்க “புலத்தைச் சேர்க்க” என்பதைத் தேர்ந்தெடுக்கவும்.',
    fixedDetails: 'நிலையான விவரங்கள்', additionalQuestionsCount: 'கூடுதல் கேள்விகள்', saveForm: 'படிவத்தைச் சேமிக்க', saving: 'சேமிக்கப்படுகிறது…', preview: 'முன்னோட்டம்', closePreview: 'முன்னோட்டத்தை மூட', project: 'திட்டம்', trainingDateNotSet: 'பயிற்சி தேதி அமைக்கப்படவில்லை', trainingDatePassed: 'பயிற்சி தேதி கடந்துவிட்டது', selectTrainingDate: 'கவுண்ட்டவுனைக் காண பயிற்சி தேதியைத் தேர்ந்தெடுக்கவும்',
    friendPrompt: 'நண்பருடன் விண்ணப்பிக்கிறீர்களா? அவர்களின் விவரங்களை இங்கே சேர்க்கவும் (விருப்பம்)', untitledField: 'தலைப்பில்லா புலம்', selectOption: 'ஒரு விருப்பத்தைத் தேர்ந்தெடுக்கவும்', loadingSavedForm: 'சேமித்த படிவம் ஏற்றப்படுகிறது…', applicationForm: 'விண்ணப்பப் படிவம்',
    removeItemConfirm: 'விண்ணப்பப் பக்கத்திலிருந்து இந்த {item}-ஐ நீக்கவா?', removeItemTitle: '{item}-ஐ நீக்கவும்', remove: 'நீக்கு', jobDetail: 'வேலை விவரம்', applicantPointSingular: 'விண்ணப்பதாரர் குறிப்பு', contact: 'தொடர்பு', item: 'உருப்படி',
    itemRemoved: '{item} நீக்கப்பட்டது.', itemAdded: '{item} சேர்க்கப்பட்டது.', newQuestionAdded: 'விண்ணப்பத்தில் புதிய கேள்வி சேர்க்கப்பட்டது.', removeQuestionConfirm: 'விண்ணப்பத்திலிருந்து “{label}”-ஐ நீக்கவா?', questionRemoved: 'கேள்வி விண்ணப்பத்திலிருந்து நீக்கப்பட்டது.', questionCopyAdded: 'கேள்வியின் நகல் சேர்க்கப்பட்டது.',
    formSaved: 'இந்தத் திட்டத்திற்கான படிவம் சேமிக்கப்பட்டது.', formSavedNotice: 'உங்கள் விண்ணப்பப் படிவம் வெற்றிகரமாகச் சேமிக்கப்பட்டது.', formSaveFailed: 'படிவத்தைச் சேமிக்க முடியவில்லை.', formSaveTryAgain: 'படிவத்தைச் சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.', noSavedForm: 'சேமித்த படிவம் ஏற்றப்படவில்லை. இங்கே புதிய படிவத்தை அமைத்துச் சேமிக்கலாம்.',
    fieldTypes: { shortText: 'சிறு உரை', mobileNumber: 'கைபேசி எண்', email: 'மின்னஞ்சல்', number: 'எண்', date: 'தேதி', longText: 'நீண்ட உரை', dropdown: 'கீழிறங்குப் பட்டியல்', checkbox: 'தேர்வுப்பெட்டி' },
  },
}

const getFormFromResponse = (response) => {
  const payload = response?.data?.data ?? response?.data
  return payload?.form_data ?? payload?.form ?? payload
}

const getLocalized = (value, language) => typeof value === 'string' ? value : value?.[language] || value?.en || ''
const getLocaleValue = (value, language) => typeof value === 'string' ? value : value?.[language] || value?.en || ''
const normalizeFieldLocales = (value, translations = {}) => {
  const englishValue = typeof value === 'string' ? value : value?.en || translations.en || ''
  return Object.fromEntries([
    ['en', englishValue],
    ...APPLICATION_LANGUAGES.map(([code]) => [code, value?.[code] || translations[code] || englishValue]),
  ])
}
const getLocaleOptions = (field, language) => {
  const options = field.translatedOptions?.[language] ?? field.translations?.options?.[language]
  if (Array.isArray(options) && options.length) return options.join('\n')
  if (options) return options
  return Array.isArray(field.options) ? field.options.join('\n') : field.options || ''
}

const formatProjectDate = (value, language = 'en') => {
  if (!value) return ''
  const datePart = String(value).split('T')[0]
  const date = new Date(`${datePart}T00:00:00`)
  const locales = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', ta: 'ta-IN', te: 'te-IN', ml: 'ml-IN' }
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString(locales[language] || 'en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const getLocalizedProjectValue = (project, key, language) => {
  const value = project?.[key]
  const translations = project?.translations?.[key] || project?.[`${key}Translations`] || {}
  const languageKey = language === 'hi' ? 'Hindi' : language === 'ta' ? 'Tamil' : ''
  const localizedValue = (typeof value === 'object' && !Array.isArray(value) ? value[language] : '')
    || translations[language]
    || project?.[`${key}_${language}`]
    || (languageKey ? project?.[`${key}${languageKey}`] : '')
  if (localizedValue) return localizedValue
  if (Array.isArray(value)) {
    return language === 'en'
      ? value
      : value.map((item) => (item && typeof item === 'object' ? item[language] : '')).filter(Boolean)
  }
  return language === 'en' && typeof value === 'string' ? value : ''
}

const localizeWorkingDays = (value, language) => {
  const days = formatWorkingDays(value)
  if (language === 'en' || !days) return days
  const translations = {
    hi: { Sunday: 'रविवार', Monday: 'सोमवार', Tuesday: 'मंगलवार', Wednesday: 'बुधवार', Thursday: 'गुरुवार', Friday: 'शुक्रवार', Saturday: 'शनिवार' },
    mr: { Sunday: 'रविवार', Monday: 'सोमवार', Tuesday: 'मंगळवार', Wednesday: 'बुधवार', Thursday: 'गुरुवार', Friday: 'शुक्रवार', Saturday: 'शनिवार' },
    ta: { Sunday: 'ஞாயிறு', Monday: 'திங்கள்', Tuesday: 'செவ்வாய்', Wednesday: 'புதன்', Thursday: 'வியாழன்', Friday: 'வெள்ளி', Saturday: 'சனி' },
    te: { Sunday: 'ఆదివారం', Monday: 'సోమవారం', Tuesday: 'మంగళవారం', Wednesday: 'బుధవారం', Thursday: 'గురువారం', Friday: 'శుక్రవారం', Saturday: 'శనివారం' },
    ml: { Sunday: 'ഞായറാഴ്ച', Monday: 'തിങ്കളാഴ്ച', Tuesday: 'ചൊവ്വാഴ്ച', Wednesday: 'ബുധനാഴ്ച', Thursday: 'വ്യാഴാഴ്ച', Friday: 'വെള്ളിയാഴ്ച', Saturday: 'ശനിയാഴ്ച' },
  }
  return days.split(',').map((day) => translations[language]?.[day.trim()] || day.trim()).join(', ')
}

const mapProjectToContent = (project) => {
  const name = project.projectName || project.name || project.title || ''
  const location = project.location || project.address || project.projectLocations?.map((item) => item.address).filter(Boolean).join(', ') || ''
  const salary = project.salary != null && project.salary !== ''
    ? String(project.salary).includes('₹') ? String(project.salary) : `₹${project.salary}`
    : ''
  const duration = project.duration || project.projectDuration || project.durationDays || ''
  const workTime = [project.startTime, project.endTime].filter(Boolean).join(' – ')
  const dressCode = project.dressCode || ''
  const labels = {
    en: { pay: 'Pay', start: 'Start date', end: 'End date', duration: 'Duration', role: 'Role', candidates: 'Openings', location: 'Location', time: 'Working time', days: 'Working days', dress: 'Dress code' },
    hi: { pay: 'वेतन', start: 'शुरुआत की तारीख', end: 'अंतिम तारीख', duration: 'अवधि', role: 'पद', candidates: 'रिक्तियां', location: 'स्थान', time: 'काम का समय', days: 'कार्य दिवस', dress: 'ड्रेस कोड' },
    mr: { pay: 'वेतन', start: 'सुरुवातीची तारीख', end: 'शेवटची तारीख', duration: 'कालावधी', role: 'पद', candidates: 'रिक्त पदे', location: 'ठिकाण', time: 'कामाची वेळ', days: 'कामाचे दिवस', dress: 'पोशाख नियम' },
    ta: { pay: 'ஊதியம்', start: 'தொடக்க தேதி', end: 'முடிவு தேதி', duration: 'காலம்', role: 'பணி', candidates: 'காலியிடங்கள்', location: 'இடம்', time: 'வேலை நேரம்', days: 'வேலை நாட்கள்', dress: 'ஆடை விதிமுறை' },
    te: { pay: 'జీతం', start: 'ప్రారంభ తేదీ', end: 'ముగింపు తేదీ', duration: 'వ్యవధి', role: 'పని', candidates: 'ఖాళీలు', location: 'స్థలం', time: 'పని సమయం', days: 'పని రోజులు', dress: 'దుస్తుల నియమం' },
    ml: { pay: 'ശമ്പളം', start: 'ആരംഭ തീയതി', end: 'അവസാന തീയതി', duration: 'കാലാവധി', role: 'ജോലി', candidates: 'ഒഴിവുകൾ', location: 'സ്ഥലം', time: 'ജോലി സമയം', days: 'ജോലി ദിവസങ്ങൾ', dress: 'വസ്ത്രധാരണ നിയമം' },
  }
  const projectFacts = Object.entries(labels).map(([language, names]) => {
    const startDate = formatProjectDate(project.startDate, language)
    const endDate = formatProjectDate(project.endDate, language)
    const designationValue = getLocalizedProjectValue(project, 'designation', language)
      || getLocalizedProjectValue(project, 'designations', language)
    const roles = Array.isArray(designationValue)
      ? designationValue.map(String).filter(Boolean)
      : String(designationValue || '').split(',').map((item) => item.trim()).filter(Boolean)
    const about = getLocalizedProjectValue(project, 'about', language).trim()
    const jobDescription = getLocalizedProjectValue(project, 'jobDescription', language).trim()
    const roleText = roles.length ? roles.join(', ') : name
    const generatedIntro = {
      en: `Applications are open for ${roleText || 'this project'}${location ? ` in ${location}` : ''}. Review the job details and submit your application below.`,
      hi: `${location ? `${location} में ` : ''}${roleText || 'इस प्रोजेक्ट'} के लिए आवेदन आमंत्रित हैं। काम की जानकारी पढ़कर नीचे आवेदन करें।`,
      mr: `${location ? `${location} येथे ` : ''}${roleText || 'या प्रकल्पा'}साठी अर्ज मागवले आहेत. कामाचा तपशील पाहून खाली अर्ज करा.`,
      ta: `${location ? `${location} பகுதியில் ` : ''}${roleText || 'இந்தத் திட்டத்திற்கு'} விண்ணப்பங்கள் வரவேற்கப்படுகின்றன. வேலை விவரங்களைப் பார்த்து கீழே விண்ணப்பிக்கவும்.`,
      te: `${location ? `${location}లో ` : ''}${roleText || 'ఈ ప్రాజెక్ట్'} కోసం దరఖాస్తులు స్వీకరిస్తున్నాము. పని వివరాలను పరిశీలించి క్రింద దరఖాస్తు చేయండి.`,
      ml: `${location ? `${location}ൽ ` : ''}${roleText || 'ഈ പ്രോജക്റ്റിലേക്ക്'} അപേക്ഷകൾ ക്ഷണിക്കുന്നു. ജോലി വിവരങ്ങൾ പരിശോധിച്ച് താഴെ അപേക്ഷിക്കുക.`,
    }[language]
    const projectBenefits = project.benefits || project.perks || []
    const perks = Array.isArray(projectBenefits)
      ? projectBenefits.map((benefit) => {
        if (benefit && typeof benefit === 'object') return benefit[language] || (language === 'en' ? benefit.en : '') || ''
        return language === 'en' ? String(benefit) : ''
      }).filter(Boolean)
      : []
    const urgentText = {
      en: `${project.requiredCandidates} openings available. Apply now.`,
      hi: `${project.requiredCandidates} रिक्तियां उपलब्ध हैं। अभी आवेदन करें।`,
      mr: `${project.requiredCandidates} रिक्त पदे उपलब्ध आहेत. आत्ताच अर्ज करा.`,
      ta: `${project.requiredCandidates} காலியிடங்கள் உள்ளன. இப்போதே விண்ணப்பிக்கவும்.`,
      te: `${project.requiredCandidates} ఖాళీలు ఉన్నాయి. ఇప్పుడే దరఖాస్తు చేయండి.`,
      ml: `${project.requiredCandidates} ഒഴിവുകൾ ലഭ്യമാണ്. ഇപ്പോൾ അപേക്ഷിക്കുക.`,
    }[language]

    return {
      language,
      intro: about || generatedIntro,
      whoText: jobDescription || about || generatedIntro,
      perks,
      urgent: project.requiredCandidates ? urgentText : '',
      facts: [
      ...(salary ? [[names.pay, salary]] : []),
      ...(startDate ? [[names.start, startDate]] : []),
      ...(endDate ? [[names.end, endDate]] : []),
      ...(duration ? [[names.duration, String(duration)]] : []),
      ...(roles.length ? [[names.role, roles.join(', ')]] : []),
      ...(project.requiredCandidates ? [[names.candidates, String(project.requiredCandidates)]] : []),
      ...(location ? [[names.location, location]] : []),
      ...(workTime ? [[names.time, workTime]] : []),
      ...(project.workingDays ? [[names.days, localizeWorkingDays(project.workingDays, language)]] : []),
      ...(dressCode ? [[names.dress, String(dressCode)]] : []),
      ],
    }
  })
  const mobile = project.mobile || project.phone || ''
  const contacts = mobile ? [{ name: project.clientName || 'Project team', phone: String(mobile).replace(/\D/g, '') }] : []
  const projectKind = project.projectKind || project.kind || project.projectType || project.type || ''

  return Object.fromEntries(projectFacts.map(({ language, facts, intro, whoText, perks, urgent }) => [language, {
    ...DEFAULT_CONTENT[language],
    ...(name ? {
      projectName: name,
      headline: name,
    } : {}),
    intro,
    whoText,
    eyebrow: [projectKind, project.clientName].filter(Boolean).join(' · ') || DEFAULT_CONTENT[language].eyebrow,
    trainingDate: project.trainingDate ? String(project.trainingDate).split('T')[0] : '',
    facts,
    perks,
    contacts,
    urgent,
  }]))
}

const mergeProjectAndSavedContent = (projectContent, savedContent = {}) => Object.fromEntries(
  [...new Set(['en', ...APPLICATION_LANGUAGES.map(([code]) => code), ...Object.keys(savedContent)])].map((language) => {
    const defaults = DEFAULT_CONTENT[language] || {}
    const localizedProjectContent = projectContent[language] || projectContent.en
    const saved = savedContent[language] || {}
    const merged = { ...localizedProjectContent, ...saved }
    Object.entries(saved).forEach(([key, value]) => {
      const matchesEnglish = language !== 'en'
        && JSON.stringify(value) === JSON.stringify(savedContent.en?.[key])
      if ((defaults[key] !== undefined && JSON.stringify(value) === JSON.stringify(defaults[key])) || matchesEnglish) {
        merged[key] = localizedProjectContent[key]
      }
      if (key === 'facts' && language !== 'en' && Array.isArray(value)) {
        const workingDaysLabel = language === 'hi' ? 'कार्य दिवस' : 'வேலை நாட்கள்'
        merged.facts = value.map(([label, factValue]) => (
          label === workingDaysLabel ? [label, localizeWorkingDays(factValue, language)] : [label, factValue]
        ))
      }
    })
    return [language, merged]
  })
)

const alignLocalizedListStructure = (contentByLocale) => {
  const locales = [...new Set(['en', ...APPLICATION_LANGUAGES.map(([code]) => code), ...Object.keys(contentByLocale)])]
  const getItems = (locale, key) => (
    Array.isArray(contentByLocale[locale]?.[key]) ? contentByLocale[locale][key] : []
  )
  const lengths = Object.fromEntries(['facts', 'perks', 'contacts'].map((key) => [
    key,
    Math.max(0, ...locales.map((locale) => getItems(locale, key).length)),
  ]))

  return Object.fromEntries(locales.map((locale) => {
    const localized = contentByLocale[locale] || {}
    const getLocalizedFact = (index) => {
      const sourceFact = getItems('en', 'facts')[index] || ['', '']
      const localizedFact = getItems(locale, 'facts')[index]
      if (!Array.isArray(localizedFact)) return sourceFact
      return localizedFact.map((part, partIndex) => part || sourceFact[partIndex] || '')
    }
    const getLocalizedPerk = (index) => (
      getItems(locale, 'perks')[index] || getItems('en', 'perks')[index] || ''
    )
    const getLocalizedContact = (index) => {
      const sourceContact = getItems('en', 'contacts')[index] || {}
      const localizedContact = getItems(locale, 'contacts')[index] || {}
      return {
        name: localizedContact.name || sourceContact.name || '',
        phone: localizedContact.phone || sourceContact.phone || '',
      }
    }
    return [locale, {
      ...localized,
      facts: Array.from({ length: lengths.facts }, (_, index) => getLocalizedFact(index)),
      perks: Array.from({ length: lengths.perks }, (_, index) => getLocalizedPerk(index)),
      contacts: Array.from({ length: lengths.contacts }, (_, index) => getLocalizedContact(index)),
    }]
  }))
}

const mapProjectToFields = (fields, project) => {
  const name = project.projectName || project.name || project.title || 'this project'
  const location = project.location || project.address || project.projectLocations?.map((item) => item.address).filter(Boolean).join(', ')
  const salary = project.salary ? (String(project.salary).includes('₹') ? project.salary : `₹${project.salary}`) : ''
  const duration = project.duration || project.projectDuration || project.durationDays || ''
  const projectDates = Object.fromEntries(['en', 'hi', 'mr', 'ta', 'te', 'ml'].map((locale) => [locale, {
    start: formatProjectDate(project.startDate, locale),
    end: formatProjectDate(project.endDate, locale),
    training: formatProjectDate(project.trainingDate, locale),
  }]))
  const { start: startDate, end: endDate, training: trainingDate } = projectDates.en
  const workTime = [project.startTime, project.endTime].filter(Boolean).join(' – ')
  const labelByName = {
    confirm_project: {
      en: `This application is for ${name}${location ? ` at ${location}` : ''}`,
      hi: `यह आवेदन ${name}${location ? ` (${location})` : ''} के लिए है`,
      mr: `हा अर्ज ${name}${location ? ` (${location})` : ''} या प्रकल्पासाठी आहे`,
      ta: `இந்த விண்ணப்பம் ${name}${location ? ` (${location})` : ''} திட்டத்திற்கானது`,
      te: `ఈ దరఖాస్తు ${name}${location ? ` (${location})` : ''} ప్రాజెక్ట్ కోసం`,
      ml: `ഈ അപേക്ഷ ${name}${location ? ` (${location})` : ''} പ്രോജക്റ്റിനാണ്`,
    },
    confirm_duration: {
      en: duration ? `The project duration is ${duration}` : startDate || endDate ? `The project dates are ${startDate || 'to be confirmed'} to ${endDate || 'to be confirmed'}` : 'I have reviewed the project dates shown above',
      hi: duration ? `प्रोजेक्ट की अवधि ${duration} है` : startDate || endDate ? `प्रोजेक्ट की तारीख ${projectDates.hi.start || 'निर्धारित होगी'} से ${projectDates.hi.end || 'निर्धारित होगी'} तक है` : 'मैंने ऊपर दी गई प्रोजेक्ट तारीखें पढ़ ली हैं',
      mr: duration ? `प्रकल्पाचा कालावधी ${duration} आहे` : startDate || endDate ? `प्रकल्पाच्या तारखा ${projectDates.mr.start || 'निश्चित होईल'} ते ${projectDates.mr.end || 'निश्चित होईल'} आहेत` : 'मी वर दिलेल्या प्रकल्पाच्या तारखा वाचल्या आहेत',
      ta: duration ? `இந்தத் திட்டத்தின் காலம் ${duration}` : startDate || endDate ? `திட்டத் தேதிகள் ${projectDates.ta.start || 'உறுதிசெய்யப்படும்'} முதல் ${projectDates.ta.end || 'உறுதிசெய்யப்படும்'} வரை` : 'மேலே உள்ள திட்டத் தேதிகளைப் பார்த்துவிட்டேன்',
      te: duration ? `ప్రాజెక్ట్ వ్యవధి ${duration}` : startDate || endDate ? `ప్రాజెక్ట్ తేదీలు ${projectDates.te.start || 'నిర్ధారించబడుతుంది'} నుండి ${projectDates.te.end || 'నిర్ధారించబడుతుంది'} వరకు` : 'పైన చూపిన ప్రాజెక్ట్ తేదీలను పరిశీలించాను',
      ml: duration ? `പ്രോജക്റ്റിന്റെ കാലാവധി ${duration}` : startDate || endDate ? `പ്രോജക്റ്റ് തീയതികൾ ${projectDates.ml.start || 'സ്ഥിരീകരിക്കേണ്ടതാണ്'} മുതൽ ${projectDates.ml.end || 'സ്ഥിരീകരിക്കേണ്ടതാണ്'} വരെയാണ്` : 'മുകളിൽ നൽകിയ പ്രോജക്റ്റ് തീയതികൾ ഞാൻ പരിശോധിച്ചു',
    },
    confirm_reporting_time: {
      en: workTime ? `I can work during ${workTime}` : 'I understand the project work schedule will be shared by the team',
      hi: workTime ? `मैं ${workTime} के दौरान काम कर सकता/सकती हूँ` : 'मैं समझता/समझती हूँ कि टीम काम का समय बताएगी',
      mr: workTime ? `मी ${workTime} या वेळेत काम करू शकतो/शकते` : 'कामाचे वेळापत्रक टीम कळवेल हे मला समजले आहे',
      ta: workTime ? `${workTime} நேரத்தில் என்னால் பணியாற்ற முடியும்` : 'வேலை நேரத்தை குழு தெரிவிக்கும் என்பதைப் புரிந்துகொள்கிறேன்',
      te: workTime ? `${workTime} సమయంలో నేను పని చేయగలను` : 'పని షెడ్యూల్‌ను బృందం తెలియజేస్తుందని నాకు తెలుసు',
      ml: workTime ? `${workTime} സമയത്ത് എനിക്ക് ജോലി ചെയ്യാൻ കഴിയും` : 'ജോലി സമയക്രമം ടീം അറിയിക്കുമെന്ന് ഞാൻ മനസ്സിലാക്കുന്നു',
    },
    confirm_pay: {
      en: salary ? `I understand the pay is ${salary}` : 'I have reviewed the pay details shown above',
      hi: salary ? `मैं समझता/समझती हूँ कि वेतन ${salary} है` : 'मैंने ऊपर दी गई वेतन जानकारी पढ़ ली है',
      mr: salary ? `वेतन ${salary} आहे हे मला समजले आहे` : 'मी वर दिलेल्या वेतनाची माहिती वाचली आहे',
      ta: salary ? `ஊதியம் ${salary} என்பதைப் புரிந்துகொள்கிறேன்` : 'மேலே உள்ள ஊதிய விவரங்களைப் பார்த்துவிட்டேன்',
      te: salary ? `జీతం ${salary} అని నాకు తెలుసు` : 'పైన ఉన్న జీతం వివరాలను పరిశీలించాను',
      ml: salary ? `ശമ്പളം ${salary} ആണെന്ന് ഞാൻ മനസ്സിലാക്കുന്നു` : 'മുകളിൽ നൽകിയ ശമ്പളവിവരങ്ങൾ ഞാൻ പരിശോധിച്ചു',
    },
    confirm_training: {
      en: trainingDate ? `Training is scheduled for ${trainingDate}` : '',
      hi: trainingDate ? `प्रशिक्षण ${trainingDate} को निर्धारित है` : '',
      mr: trainingDate ? `प्रशिक्षण ${projectDates.mr.training} रोजी नियोजित आहे` : '',
      ta: trainingDate ? `பயிற்சி ${trainingDate} அன்று நடைபெறும்` : '',
      te: trainingDate ? `శిక్షణ ${projectDates.te.training} తేదీన నిర్వహించబడుతుంది` : '',
      ml: trainingDate ? `പരിശീലനം ${projectDates.ml.training} ന് നിശ്ചയിച്ചിരിക്കുന്നു` : '',
    },
  }

  const mappedFields = fields.flatMap((field) => {
    const translatedLabel = labelByName[field.name]
    if (!translatedLabel) return [field]
    const defaultField = DEFAULT_FIELDS.find((item) => item.name === field.name)
    const currentEnglishLabel = typeof field.label === 'string' ? field.label : field.label?.en
    const defaultEnglishLabel = defaultField?.label?.en
    const isUntouchedTemplate = currentEnglishLabel === defaultEnglishLabel || !currentEnglishLabel
    if (field.name === 'confirm_training' && !trainingDate && isUntouchedTemplate) return []
    if (!isUntouchedTemplate) return [field]
    return [{ ...field, label: translatedLabel }]
  })

  return keepWillingToWorkLast(ensureCoreApplicantFields(mappedFields))
}

export default function ProjectFormBuilder() {
  const { projectId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { confirm: showConfirm } = useAlert()
  const [language, setLanguage] = useState('en')
  const [editorTab, setEditorTab] = useState('build')
  const [enabledLanguages, setEnabledLanguages] = useState(DEFAULT_ENABLED_LANGUAGES)
  const [formDescription, setFormDescription] = useState('')
  const [descriptionError, setDescriptionError] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [content, setContent] = useState(DEFAULT_CONTENT)
  const [fields, setFields] = useState(DEFAULT_FIELDS)
  const [sectionOrder, setSectionOrder] = useState(BUILDER_SECTIONS)
  const [customFieldSections, setCustomFieldSections] = useState([])
  const [sectionComposer, setSectionComposer] = useState(null)
  const [fieldGroupOrder, setFieldGroupOrder] = useState(FIELD_GROUPS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('error')

  useEffect(() => {
    let active = true
    setEditorTab('build')
    setLanguage('en')
    setEnabledLanguages(DEFAULT_ENABLED_LANGUAGES)
    setFormDescription('')
    setDescriptionError('')
    setSectionOrder(BUILDER_SECTIONS)
    setCustomFieldSections([])
    setFieldGroupOrder(FIELD_GROUPS)
    const selectedProject = location.state?.project

    const loadProjectData = async () => {
      setLoading(true)
      const [projectResult, formResult] = await Promise.allSettled([
        recruiterAPI.getProject(projectId),
        recruiterAPI.getProjectApplicationForm(projectId),
      ])
      if (!active) return

      const form = formResult.status === 'fulfilled' ? getFormFromResponse(formResult.value) : null
      const hasSavedFormData = Boolean(form && (
        Array.isArray(form.fields)
        || (form.content && typeof form.content === 'object' && Object.keys(form.content).length > 0)
        || form.title
        || form.description != null
      ))

      const responseData = projectResult.status === 'fulfilled'
        ? projectResult.value?.data?.data ?? projectResult.value?.data
        : null
      const project = responseData?.project ?? responseData ?? selectedProject
      if (project) {
        if (!hasSavedFormData) {
          setContent(mapProjectToContent(project))
          setFields(mapProjectToFields(DEFAULT_FIELDS, project))
        }
      }

      if (formResult.status === 'fulfilled') {
        if (form?.content && typeof form.content === 'object' && Object.keys(form.content).length > 0) {
          const storedLanguages = form.content.en?.enabledLanguages
          setEnabledLanguages(Array.isArray(storedLanguages)
            ? APPLICATION_LANGUAGES.map(([code]) => code).filter((code) => storedLanguages.includes(code))
            : [])
          const storedSectionOrder = form.content.en?.builderSectionOrder
          if (Array.isArray(storedSectionOrder)) {
            const validSectionOrder = [...new Set(storedSectionOrder.filter((section) => BUILDER_SECTIONS.includes(section)))]
            setSectionOrder([...validSectionOrder, ...BUILDER_SECTIONS.filter((section) => !validSectionOrder.includes(section))])
          }
          const storedCustomSections = Array.isArray(form.content.en?.builderCustomSections)
            ? form.content.en.builderCustomSections.filter((section) => section?.id && section?.title)
            : []
          setCustomFieldSections(storedCustomSections)
          const defaultGroupOrder = [...FIELD_GROUPS, ...storedCustomSections.map((section) => section.id)]
          const storedGroupOrder = form.content.en?.builderFieldGroupOrder
          if (Array.isArray(storedGroupOrder)) {
            const validGroupOrder = [...new Set(storedGroupOrder.filter((group) => defaultGroupOrder.includes(group)))]
            setFieldGroupOrder([...validGroupOrder, ...defaultGroupOrder.filter((group) => !validGroupOrder.includes(group))])
          } else setFieldGroupOrder(defaultGroupOrder)
          const savedContent = Object.fromEntries(Object.entries(form.content).map(([locale, localeContent]) => [
            locale,
            { ...localeContent, facts: formatProjectFacts(localeContent?.facts) },
          ]))
          setContent(alignLocalizedListStructure(createSavedContent(savedContent)))
        }
        else if (hasSavedFormData) setContent(alignLocalizedListStructure(createSavedContent({
          en: { formTitle: form.title || '', formIntro: form.description ?? '' },
        })))
        if (Array.isArray(form?.fields)) setFields(keepWillingToWorkLast(ensureCoreApplicantFields(form.fields.map((field, index) => ({
          ...field,
          id: field.id || `field-${index + 1}`,
          label: normalizeFieldLocales(field.label, field.translations?.label),
          options: Array.isArray(field.options) ? field.options.join('\n') : field.options || '',
          translatedOptions: field.translatedOptions || field.translations?.options || {},
          placeholder: normalizeFieldLocales(field.placeholder, field.translations?.placeholder),
          hint: normalizeFieldLocales(field.hint, field.translations?.hint),
          group: field.group || '',
        })))))
        else if (hasSavedFormData) setFields(ensureCoreApplicantFields([]))
      } else {
        setMessage(BUILDER_TEXT.en.noSavedForm)
        setMessageType('warning')
      }
      setLoading(false)
    }

    loadProjectData()
    return () => { active = false }
  }, [projectId, location.state])

  useEffect(() => {
    if (!previewOpen) return undefined
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setPreviewOpen(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [previewOpen])

  const updateField = (fieldId, changes) => {
    setFields((current) => current.map((field) => field.id === fieldId ? { ...field, ...changes } : field))
    setContent((current) => Object.fromEntries(Object.entries(current).map(([locale, localeContent]) => [
      locale,
      locale === 'en' || !enabledLanguages.includes(locale)
        ? localeContent
        : { ...localeContent, translationReviewed: false },
    ])))
  }

  const notify = (type, message) => {
    window.dispatchEvent(new CustomEvent('apiMessage', {
      detail: {
        type,
        icon: type === 'error' ? '❌' : '✅',
        message,
        duration: 3000,
      },
    }))
  }

  const updateContent = (key, value) => {
    setContent((current) => {
      const next = { ...current, [language]: { ...(current[language] || current.en), [key]: value } }
      if (language === 'en' && key === 'facts' && Array.isArray(value)) {
        Object.keys(next).filter((locale) => locale !== 'en').forEach((locale) => {
          const previousLocalizedFacts = current[locale]?.facts || []
          const previousEnglishFacts = current.en?.facts || []
          next[locale] = {
            ...next[locale],
            facts: value.map((fact, index) => {
              const nextFact = Array.isArray(fact) ? fact : ['', '']
              const localizedFact = previousLocalizedFacts[index] || ['', '']
              const previousEnglishFact = previousEnglishFacts[index] || ['', '']
              return nextFact.map((part, partIndex) => (
                !localizedFact[partIndex] || localizedFact[partIndex] === previousEnglishFact[partIndex]
                  ? part
                  : localizedFact[partIndex]
              ))
            }),
          }
        })
      }

      return Object.fromEntries(Object.entries(next).map(([locale, localeContent]) => [
        locale,
        language === 'en' && enabledLanguages.includes(locale)
          ? { ...localeContent, translationReviewed: false }
          : locale === language && locale !== 'en'
            ? { ...localeContent, translationReviewed: false }
            : localeContent,
      ]))
    })
  }

  const toggleEnabledLanguage = (code, enabled) => {
    setEnabledLanguages((current) => enabled
      ? [...current, code]
      : current.filter((languageCode) => languageCode !== code))
    if (!enabled && language === code) setLanguage('en')
  }

  const copy = content[language] || content.en
  const t = (key, values = {}) => {
    const translation = BUILDER_TEXT.en.fieldTypes?.[key]
      ?? BUILDER_TEXT.en[key]
      ?? key
    return Object.entries(values).reduce(
      (text, [name, value]) => text.replace(`{${name}}`, String(value)),
      translation,
    )
  }
  const customSectionLabel = (section) => getLocalized(section.title, language) || t('newSectionName')
  const orderedFieldGroups = [...fieldGroupOrder, ...customFieldSections.map((section) => section.id)]
    .filter((group, index, groups) => groups.indexOf(group) === index)
  const previewFieldGroups = orderedFieldGroups
    .map((group) => ({
      group,
      fields: fields.filter((field) => getBuilderFieldGroup(field, customFieldSections) === group && !isWillingToWorkField(field)),
    }))
    .filter((group) => group.fields.length > 0)
  const willingToWorkFields = fields.filter(isWillingToWorkField)
  const fieldGroupPosition = (group) => orderedFieldGroups.indexOf(group) + 1
  const updateFieldGroupPosition = (group, position) => {
    setFieldGroupOrder((current) => {
      const currentGroups = [...new Set([...current, ...customFieldSections.map((section) => section.id)])]
      const next = currentGroups.filter((item) => item !== group)
      next.splice(Math.max(0, Math.min(position - 1, next.length)), 0, group)
      return next
    })
  }
  const sectionProps = (section) => ({
    style: { order: 2 + sectionOrder.indexOf(section) },
  })
  const sectionPosition = (section) => (
    <label className="form-builder-position-control" onClick={(event) => event.stopPropagation()}>
      <span>{t('position')}</span>
      <select
        className="form-control"
        aria-label={`${t('position')}: ${t(section)}`}
        value={sectionOrder.indexOf(section) + 1}
        onChange={(event) => {
          const targetIndex = Number(event.target.value) - 1
          setSectionOrder((current) => {
            const previousIndex = current.indexOf(section)
            const next = [...current]
            next.splice(previousIndex, 1)
            next.splice(targetIndex, 0, section)
            return next
          })
        }}
      >
        {sectionOrder.map((_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}
      </select>
    </label>
  )
  const trainingCountdown = getTrainingCountdownLabel(copy.trainingDate, language, copy)
  const translationIssues = language === 'en'
    ? []
    : getApplicationTranslationIssues(content, fields, language).filter((issue) => issue !== 'review')
  const coreFields = fields.filter(isCoreApplicantField)
  const optionalFields = fields.filter((field) => !isCoreApplicantField(field))
  const updateFieldLabel = (fieldId, value) => setFields((current) => current.map((field) => field.id === fieldId
    ? { ...field, label: { ...(typeof field.label === 'object' ? field.label : { en: field.label, hi: field.label }), [language]: value } }
    : field))

  const updateFieldText = (fieldId, key, value) => setFields((current) => current.map((field) => field.id === fieldId
    ? { ...field, [key]: { ...(typeof field[key] === 'object' ? field[key] : { en: field[key] || '', hi: field[key] || '', ta: field[key] || '' }), [language]: value } }
    : field))

  const invalidateTranslationReview = () => setContent((current) => Object.fromEntries(Object.entries(current).map(([locale, localeContent]) => [
    locale,
    (language === 'en' ? enabledLanguages.includes(locale) : locale === language)
      ? { ...localeContent, translationReviewed: false }
      : localeContent,
  ])))

  const editFieldLabel = (fieldId, value) => {
    updateFieldLabel(fieldId, value)
    invalidateTranslationReview()
  }

  const editFieldText = (fieldId, key, value) => {
    updateFieldText(fieldId, key, value)
    invalidateTranslationReview()
  }

  const updateFieldOptions = (fieldId, value) => updateField(fieldId, language === 'en'
    ? { options: value }
    : { translatedOptions: { ...(fields.find((field) => field.id === fieldId)?.translatedOptions || {}), [language]: value } })

  const updateAllLocalesList = (key, updateItems) => {
    setContent((current) => Object.fromEntries(Object.entries(current).map(([locale, localeContent]) => [
      locale,
      {
        ...localeContent,
        [key]: updateItems(Array.isArray(localeContent[key]) ? localeContent[key] : []),
        ...(enabledLanguages.includes(locale) ? { translationReviewed: false } : {}),
      },
    ])))
  }

  const updateListItem = (key, index, value, part) => {
    const items = [...(copy[key] || [])]
    items[index] = part ? { ...items[index], [part]: value } : value
    updateContent(key, items)
  }

  const removeListItem = async (key, index) => {
    const itemType = { facts: t('jobDetail'), perks: t('applicantPointSingular'), contacts: t('contact') }[key] || t('item')
    const confirmed = await showConfirm(t('removeItemConfirm', { item: itemType }), t('removeItemTitle', { item: itemType }), { okLabel: t('remove') })
    if (!confirmed) return
    updateAllLocalesList(key, (items) => items.filter((_, itemIndex) => itemIndex !== index))
    notify('success', t('itemRemoved', { item: itemType }))
  }

  const addListItem = (key) => {
    const newItem = key === 'contacts' ? { name: '', phone: '' } : key === 'facts' ? ['', ''] : ''
    updateAllLocalesList(key, (items) => [...items, newItem])
    const itemType = { facts: t('jobDetail'), perks: t('applicantPointSingular'), contacts: t('contact') }[key] || t('item')
    notify('success', t('itemAdded', { item: itemType }))
  }

  const removeField = async (field) => {
    if (isCoreApplicantField(field)) return
    const label = getLocalized(field.label, language) || 'this question'
    const confirmed = await showConfirm(t('removeQuestionConfirm', { label }), t('removeField'), { okLabel: t('remove') })
    if (!confirmed) return
    setFields((current) => current.filter((item) => item.id !== field.id))
    notify('success', t('questionRemoved'))
  }

  const duplicateField = (field) => {
    if (isCoreApplicantField(field)) return
    const id = globalThis.crypto?.randomUUID?.() || `field-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setFields((current) => {
      const index = current.findIndex((item) => item.id === field.id)
      const duplicate = { ...field, id, name: `field_${Date.now()}` }
      return [...current.slice(0, index + 1), duplicate, ...current.slice(index + 1)]
    })
    notify('success', t('questionCopyAdded'))
  }

  const moveFieldToPosition = (fieldId, targetGroup, position) => {
    setFields((current) => {
      const fromIndex = current.findIndex((field) => field.id === fieldId)
      if (fromIndex < 0) return current
      const field = current[fromIndex]
      if (isWillingToWorkField(field) || (isCoreApplicantField(field) && targetGroup)) return current
      if (!orderedFieldGroups.includes(targetGroup)) return current
      const next = [...current]
      next.splice(fromIndex, 1)
      const movedField = { ...field, group: targetGroup }
      const targetIndexes = next
        .map((item, index) => getBuilderFieldGroup(item, customFieldSections) === targetGroup ? index : -1)
        .filter((index) => index >= 0)
      const boundedPosition = Math.max(1, Math.min(position, targetIndexes.length + 1))
      let insertionIndex = targetIndexes[boundedPosition - 1]
      if (insertionIndex === undefined && targetIndexes.length) insertionIndex = targetIndexes[targetIndexes.length - 1] + 1
      if (insertionIndex === undefined && targetGroup === 'friend') {
        const firstConfirmation = next.findIndex((item) => getBuilderFieldGroup(item, customFieldSections) === 'confirmations')
        insertionIndex = firstConfirmation < 0 ? next.length : firstConfirmation
      } else if (insertionIndex === undefined && targetGroup === '') {
        const firstGroupedField = next.findIndex((item) => getBuilderFieldGroup(item, customFieldSections) !== '')
        insertionIndex = firstGroupedField < 0 ? next.length : firstGroupedField
      } else if (insertionIndex === undefined) insertionIndex = next.length
      next.splice(insertionIndex, 0, movedField)
      return keepWillingToWorkLast(next)
    })
  }

  const reorderFacts = (fromIndex, toIndex) => {
    updateAllLocalesList('facts', (currentFacts) => {
      const facts = [...currentFacts]
      if (fromIndex < facts.length && toIndex <= facts.length) {
        facts.splice(toIndex, 0, facts.splice(fromIndex, 1)[0])
      }
      return facts
    })
  }

  const handleFieldDrop = (event, field, targetGroup, targetPosition) => {
    event.preventDefault()
    const transfer = event.dataTransfer.getData('text/plain')
    if (!transfer.startsWith('field:')) return
    const draggedFieldId = transfer.slice('field:'.length)
    if (draggedFieldId === field.id) return
    const draggedField = fields.find((item) => item.id === draggedFieldId)
    if (!draggedField || getBuilderFieldGroup(draggedField, customFieldSections) !== targetGroup) return

    const bounds = event.currentTarget.getBoundingClientRect()
    const afterTarget = event.clientY > bounds.top + bounds.height / 2
    const sourcePosition = fields
      .filter((item) => getBuilderFieldGroup(item, customFieldSections) === targetGroup && !isWillingToWorkField(item))
      .findIndex((item) => item.id === draggedFieldId) + 1
    const position = targetPosition + (afterTarget ? 1 : 0) - (sourcePosition < targetPosition ? 1 : 0)
    moveFieldToPosition(draggedFieldId, targetGroup, position)
  }

  const handleFactDrop = (event, targetIndex) => {
    event.preventDefault()
    const transfer = event.dataTransfer.getData('text/plain')
    if (!transfer.startsWith('fact:')) return
    const fromIndex = Number(transfer.slice('fact:'.length))
    if (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex === targetIndex) return

    const bounds = event.currentTarget.getBoundingClientRect()
    const afterTarget = event.clientY > bounds.top + bounds.height / 2
    const insertionIndex = targetIndex + (afterTarget ? 1 : 0) - (fromIndex < targetIndex ? 1 : 0)
    reorderFacts(fromIndex, insertionIndex)
  }

  const reorderFieldGroup = (group, position) => {
    if (group === '') return
    setFieldGroupOrder((current) => {
      const next = current.filter((item) => item !== group)
      next.splice(Math.max(0, Math.min(position - 1, next.length)), 0, group)
      return next
    })
  }

  const updateCustomSectionTitle = (sectionId, value) => {
    setCustomFieldSections((current) => current.map((section) => section.id === sectionId
      ? { ...section, title: { ...(typeof section.title === 'string' ? { en: section.title } : section.title), [language]: value } }
      : section))
    invalidateTranslationReview()
  }

  const removeCustomFieldSection = async (section) => {
    const confirmed = await showConfirm(t('removeItemConfirm', { item: customSectionLabel(section) }), t('removeSection'), { okLabel: t('remove') })
    if (!confirmed) return
    setFields((current) => keepWillingToWorkLast(current.map((field) => field.group === section.id ? { ...field, group: '' } : field)))
    setCustomFieldSections((current) => current.filter((item) => item.id !== section.id))
    setFieldGroupOrder((current) => current.filter((group) => group !== section.id))
  }

  const updateSectionDraft = (key, value) => {
    setSectionComposer((current) => current ? { ...current, [key]: value, error: '' } : current)
  }

  const updateSectionFieldDraft = (index, key, value) => {
    setSectionComposer((current) => current ? {
      ...current,
      error: '',
      fields: current.fields.map((field, fieldIndex) => fieldIndex === index ? { ...field, [key]: value } : field),
    } : current)
  }

  const createCustomFieldSection = () => {
    const sectionTitle = sectionComposer?.title.trim()
    if (!sectionTitle) {
      setSectionComposer((current) => current ? { ...current, error: t('sectionNameRequired') } : current)
      return
    }

    const draftFields = sectionComposer.fields.filter((field) => field.label.trim())
    if (!draftFields.length) {
      setSectionComposer((current) => current ? { ...current, error: t('sectionFieldRequired') } : current)
      return
    }

    const id = `custom-section-${globalThis.crypto?.randomUUID?.() || Date.now()}`
    const sectionTitleTranslations = { en: sectionTitle, hi: '', mr: '', ta: '', te: '', ml: '' }
    const newFields = draftFields.map((draft, index) => {
      const fieldId = globalThis.crypto?.randomUUID?.() || `field-${Date.now()}-${index}`
      const label = draft.label.trim()
      return {
        id: fieldId,
        name: `field_${fieldId.replace(/[^a-zA-Z0-9]/g, '_')}`,
        label: normalizeFieldLocales(label),
        type: draft.type,
        required: draft.required,
        options: draft.options,
        translatedOptions: {},
        placeholder: normalizeFieldLocales(draft.placeholder),
        hint: normalizeFieldLocales(draft.hint),
        group: id,
      }
    })

    setCustomFieldSections((current) => [...current, { id, title: sectionTitleTranslations }])
    setFieldGroupOrder((current) => [...current, id])
    setFields((current) => {
      const next = [...current]
      const willingIndex = next.findIndex(isWillingToWorkField)
      next.splice(willingIndex < 0 ? next.length : willingIndex, 0, ...newFields)
      return next
    })
    setSectionComposer(null)
    notify('success', t('itemAdded', { item: sectionTitle }))
  }

  const addField = (group = '') => {
    const id = globalThis.crypto?.randomUUID?.() || `field-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setFields((current) => {
      const questionNumber = current.filter((field) => !isCoreApplicantField(field)).length + 1
      const field = {
        id,
        name: `field_${id.replace(/[^a-zA-Z0-9]/g, '_')}`,
        label: normalizeFieldLocales(`New question ${questionNumber}`),
        type: 'text',
        required: false,
        options: '',
        translatedOptions: {},
        placeholder: normalizeFieldLocales(''),
        hint: normalizeFieldLocales(''),
        group,
      }
      const next = [...current]
      const willingIndex = next.findIndex(isWillingToWorkField)
      next.splice(willingIndex < 0 ? next.length : willingIndex, 0, field)
      return next
    })
    notify('success', t('newQuestionAdded'))
  }

  const addFieldSection = () => {
    setSectionComposer({
      title: '',
      fields: [createSectionFieldDraft()],
      error: '',
    })
  }

  const createFormFromDescription = () => {
    const generated = generateApplicationFormFromDescription(formDescription)
    if (generated.error) {
      setDescriptionError(generated.error)
      return
    }

    const preservedFields = fields.filter((field) => isCoreApplicantField(field) || isWillingToWorkField(field))
    setFields(keepWillingToWorkLast([...preservedFields, ...generated.fields]))
    setLanguage('en')
    setCustomFieldSections(generated.sections)
    setFieldGroupOrder([...FIELD_GROUPS, ...generated.sections.map((section) => section.id)])
    if (generated.title) {
      setContent((current) => ({ ...current, en: { ...current.en, formTitle: generated.title } }))
    }
    setDescriptionError('')
    setPreviewOpen(true)
    notify('success', t('describeFormSuccess'))
  }

  const saveForm = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const incompleteLanguages = enabledLanguages.filter((locale) => (
        getApplicationTranslationIssues(content, fields, locale).length > 0
      ))
      const englishContent = { ...content.en }
      delete englishContent.countdown
      delete englishContent.countdownToday
      delete englishContent.countdownTomorrow
      englishContent.builderSectionOrder = sectionOrder
      englishContent.builderCustomSections = customFieldSections
      englishContent.builderFieldGroupOrder = orderedFieldGroups
      englishContent.enabledLanguages = enabledLanguages
      const savedContent = Object.fromEntries(['en', ...enabledLanguages].map((locale) => {
        const localeContent = locale === 'en' ? englishContent : { ...(content[locale] || content.en) }
        delete localeContent.countdown
        delete localeContent.countdownToday
        delete localeContent.countdownTomorrow
        if (locale === 'en') {
          localeContent.builderSectionOrder = sectionOrder
          localeContent.builderCustomSections = customFieldSections
          localeContent.builderFieldGroupOrder = orderedFieldGroups
          localeContent.enabledLanguages = enabledLanguages
        }
        return [locale, localeContent]
      }))
      const response = await recruiterAPI.saveProjectApplicationForm(projectId, {
        content: savedContent,
        title: content.en.formTitle.trim(),
        description: content.en.formIntro.trim(),
        fields: fields.map((field) => ({
          ...field,
          name: field.name.trim(),
          label: (typeof field.label === 'string' ? field.label : field.label.en).trim(),
          placeholder: getLocalized(field.placeholder, 'en'),
          hint: getLocalized(field.hint, 'en'),
          translations: {
            label: Object.fromEntries(APPLICATION_LANGUAGES.map(([code]) => [code, getLocaleValue(field.label, code)])),
            placeholder: Object.fromEntries(APPLICATION_LANGUAGES.map(([code]) => [code, getLocaleValue(field.placeholder, code)])),
            hint: Object.fromEntries(APPLICATION_LANGUAGES.map(([code]) => [code, getLocaleValue(field.hint, code)])),
            options: Object.fromEntries(APPLICATION_LANGUAGES.map(([code]) => [code, String(getLocaleOptions(field, code)).split('\n').map((option) => option.trim()).filter(Boolean)])),
          },
          translatedOptions: Object.fromEntries(APPLICATION_LANGUAGES.map(([code]) => [code, String(getLocaleOptions(field, code)).split('\n').map((option) => option.trim()).filter(Boolean)])),
          options: field.type === 'select'
            ? String(field.options || '').split('\n').map((option) => option.trim()).filter(Boolean)
            : [],
        })),
      })
      if (response?.data?.success === false) throw new Error(response.data.message || 'The form could not be saved.')
      if (incompleteLanguages.length) {
        const languageNames = incompleteLanguages.map((locale) => (
          APPLICATION_LANGUAGES.find(([code]) => code === locale)?.[1] || locale
        ))
        setMessage(`Form saved. Complete and review these translations before they appear to applicants: ${languageNames.join(', ')}.`)
        setMessageType('warning')
      } else {
        setMessage(t('formSaved'))
        setMessageType('success')
      }
      notify('success', t('formSavedNotice'))
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || t('formSaveTryAgain'))
      setMessageType('error')
      notify('error', error?.response?.data?.message || error.message || t('formSaveTryAgain'))
    } finally {
      setSaving(false)
    }
  }

  const renderBuilderField = (field, index, groupFields) => {
    const fixed = isCoreApplicantField(field)
    const group = getBuilderFieldGroup(field, customFieldSections)
    const groupPosition = groupFields.findIndex((item) => item.id === field.id) + 1
    const localizedLabel = getLocaleValue(field.label, language)
    const label = localizedLabel || getLocalized(field.label, 'en') || t('untitledField')
    return (
      <article
        className={`form-builder-field${fixed ? ' form-builder-core-field' : ''}`}
        key={field.id}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => handleFieldDrop(event, field, group, groupPosition)}
      >
        <div className="form-builder-field-title">
          {!isWillingToWorkField(field) && (
            <button
              type="button"
              className="form-builder-drag-handle"
              draggable="true"
              aria-label={`${t('dragToReorder')}: ${label}`}
              title={t('dragToReorder')}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', `field:${field.id}`)
              }}
            >
              <FontAwesomeIcon icon={faGripVertical} />
            </button>
          )}
          <span className="form-builder-field-index">{String(index + 1).padStart(2, '0')}</span>
          <div className="form-builder-field-summary">
            <strong>{label}</strong>
            <small>{t(FIELD_TYPES.find(([value]) => value === field.type)?.[1] || 'shortText')} · {field.required ? t('required') : t('optional')}</small>
          </div>
          <div className="form-builder-field-actions">
            <label className="form-builder-position-control">
              <span>{t('position')}</span>
              <select
                className="form-control"
                aria-label={`${t('position')}: ${label}`}
                value={groupPosition}
                disabled={isWillingToWorkField(field)}
                onChange={(event) => moveFieldToPosition(field.id, group, Number(event.target.value))}
              >
                {groupFields.map((_, position) => <option key={position} value={position + 1}>{position + 1}</option>)}
              </select>
            </label>
            {fixed
              ? <span className="form-builder-fixed-badge">{t('fixedField')}</span>
              : <>
                <button type="button" className="form-builder-icon-action" aria-label={t('duplicateField')} title={t('duplicateField')} onClick={() => duplicateField(field)}><FontAwesomeIcon icon={faCopy} /></button>
                <button
                  type="button"
                  className="form-builder-remove"
                  aria-label={`${t('removeField')} ${label}`}
                  title={t('removeField')}
                  onClick={() => removeField(field)}
                >
                  <FontAwesomeIcon icon={faTrash} /><span>{t('removeLabel')}</span>
                </button>
              </>}
          </div>
        </div>
        <div className="form-builder-field-grid">
          <label className="form-builder-control form-builder-label-control">
            <span>{t('label')}</span>
            <input className="form-control" value={localizedLabel} onChange={(event) => editFieldLabel(field.id, event.target.value)} required />
          </label>
          {!fixed && <label className="form-builder-control">
            <span>{t('type')}</span>
            <select className="form-control" value={field.type || 'text'} onChange={(event) => updateField(field.id, { type: event.target.value })}>
              {FIELD_TYPES.map(([value, typeLabel]) => <option key={value} value={value}>{t(typeLabel)}</option>)}
            </select>
          </label>}
          <label className="form-builder-control">
            <span>{t('placeholder')}</span>
            <input className="form-control" value={getLocaleValue(field.placeholder, language)} onChange={(event) => editFieldText(field.id, 'placeholder', event.target.value)} />
          </label>
          <label className="form-builder-control">
            <span>{t('hint')}</span>
            <input className="form-control" value={getLocaleValue(field.hint, language)} onChange={(event) => editFieldText(field.id, 'hint', event.target.value)} />
          </label>
          {!fixed && <label className="form-builder-control">
            <span>{t('group')}</span>
            <select
              className="form-control"
              value={group}
              disabled={isWillingToWorkField(field)}
              onChange={(event) => {
                const nextGroup = event.target.value
                const position = fields.filter((item) => getBuilderFieldGroup(item, customFieldSections) === nextGroup && item.id !== field.id).length + 1
                moveFieldToPosition(field.id, nextGroup, position)
              }}
            >
              <option value="">{t('noGroup')}</option><option value="friend">{t('friendDetails')}</option><option value="confirmations">{t('confirmations')}</option>
              {customFieldSections.map((section) => <option key={section.id} value={section.id}>{customSectionLabel(section)}</option>)}
            </select>
          </label>}
          {!fixed && field.type === 'select' && (
            <label className="form-builder-control form-builder-options">
              <span>{t('optionsPerLine')}</span>
              <textarea className="form-control" rows="3" value={language === 'en' ? (Array.isArray(field.options) ? field.options.join('\n') : field.options || '') : getLocaleOptions(field, language)} onChange={(event) => updateFieldOptions(field.id, event.target.value)} />
            </label>
          )}
        </div>
        {!fixed && <label className="form-builder-required-toggle">
          <input type="checkbox" checked={Boolean(field.required)} onChange={(event) => updateField(field.id, { required: event.target.checked })} />
          <span><strong>{t('requiredField')}</strong><small>{t('requiredFieldHelp')}</small></span>
        </label>}
      </article>
    )
  }

  const renderPreviewField = (field) => {
    const label = getLocalized(field.label, language) || t('untitledField')
    return (
      <div className={`form-preview-field${field.type === 'checkbox' ? ' checkbox' : ''}`} key={field.id}>
        {field.type === 'checkbox' ? (
          <label><input type="checkbox" disabled /> <span>{label}{field.required && <b> *</b>}</span></label>
        ) : (
          <>
            <label>{label}{field.required && <b> *</b>}</label>
            {field.type === 'textarea'
              ? <textarea className="form-control" rows="2" disabled placeholder={getLocalized(field.placeholder, language)} />
              : field.type === 'select'
                ? <select className="form-control" disabled><option>{t('selectOption')}</option>{(Array.isArray(field.options) ? field.options : String(field.options || '').split('\n')).filter(Boolean).map((option) => <option key={option}>{option}</option>)}</select>
                : <input className="form-control" type={field.type || 'text'} disabled placeholder={getLocalized(field.placeholder, language)} />}
            {getLocalized(field.hint, language) && <small>{getLocalized(field.hint, language)}</small>}
          </>
        )}
      </div>
    )
  }

  if (loading) {
    return <div className="project-form-builder"><div className="form-builder-preview-loading" role="status">{t('loadingSavedForm')}</div></div>
  }

  return (
    <div className="project-form-builder">
      <div className="form-builder-page-actions">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate(-1)}>
          <FontAwesomeIcon icon={faArrowLeft} /> {t('backToProjects')}
        </button>
      </div>
      <button
        type="button"
        className="btn btn-primary btn-sm form-builder-preview-trigger"
        onClick={() => setPreviewOpen(true)}
      >
        <FontAwesomeIcon icon={faEye} /> {t('previewForm')}
      </button>

      {message && <div className={`form-builder-message ${messageType}`} role="status">{message}</div>}
      {previewOpen && <button type="button" className="form-preview-backdrop" aria-label={t('closeFormPreview')} onClick={() => setPreviewOpen(false)} />}

      <form className="form-builder-layout" onSubmit={saveForm}>
        <section className="form-builder-editor">
          <div className="form-builder-heading">
            <div>
              <h2>{t('builderHeading')}</h2>
              <p>{t('builderDescription')}</p>
            </div>
          </div>

          <div className="form-builder-tab-row">
            <div className="form-builder-tabs" role="tablist" aria-label={t('builderHeading')}>
              <button type="button" role="tab" aria-selected={editorTab === 'build'} className={editorTab === 'build' ? 'active' : ''} onClick={() => setEditorTab('build')}>{t('formBuilderTab')}</button>
              <button type="button" role="tab" aria-selected={editorTab === 'describe'} className={editorTab === 'describe' ? 'active' : ''} onClick={() => setEditorTab('describe')}>{t('describeFormTab')}</button>
            </div>
            <details className="form-builder-language-menu">
              <summary>{t('languages')}</summary>
              <div className="form-builder-language-options">
                {APPLICATION_LANGUAGES.map(([code, name, nativeName]) => (
                  <label key={code}>
                    <input
                      type="checkbox"
                      checked={enabledLanguages.includes(code)}
                      onChange={(event) => toggleEnabledLanguage(code, event.target.checked)}
                    />
                    <span>{name} <small>{nativeName}</small></span>
                  </label>
                ))}
              </div>
            </details>
            <div className="form-builder-languages" role="group" aria-label="Edit form language">
              <button type="button" className={language === 'en' ? 'active' : ''} aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button>
              {APPLICATION_LANGUAGES.filter(([code]) => enabledLanguages.includes(code)).map(([code, name]) => (
                <button key={code} type="button" className={language === code ? 'active' : ''} aria-pressed={language === code} onClick={() => setLanguage(code)}>{name}</button>
              ))}
            </div>
            {language !== 'en' && (
              <div className="form-builder-translation-status">
                {translationIssues.length > 0 && <p role="status">{t('translationIncompleteCount', { count: translationIssues.length })}</p>}
                <label className="form-builder-translation-review">
                  <input
                    type="checkbox"
                    checked={copy.translationReviewed === true}
                    disabled={translationIssues.length > 0}
                    onChange={(event) => setContent((current) => ({
                      ...current,
                      [language]: { ...(current[language] || current.en), translationReviewed: event.target.checked },
                    }))}
                  />
                  <span>{t('translationReview')}</span>
                </label>
              </div>
            )}
          </div>

          {editorTab === 'build' ? (
            <div className="form-builder-build-content">
          <details className="form-builder-section" open {...sectionProps('jobIntroduction')}>
            <summary className="form-builder-accordion-summary"><h3>{t('jobIntroduction')}</h3>{sectionPosition('jobIntroduction')}</summary>
            <div className="form-builder-accordion-content">
            <label className="form-builder-control"><span>{t('brandLine')}</span><input className="form-control" value={copy.brandLine} onChange={(event) => updateContent('brandLine', event.target.value)} /></label>
            <label className="form-builder-control"><span>{t('projectName')}</span><input className="form-control" value={copy.projectName} onChange={(event) => updateContent('projectName', event.target.value)} /></label>
            <label className="form-builder-control"><span>{t('trainingDate')}</span><input className="form-control" type="date" value={copy.trainingDate} onChange={(event) => updateContent('trainingDate', event.target.value)} /></label>
            <label className="form-builder-control"><span>{t('eyebrow')}</span><input className="form-control" value={copy.eyebrow} onChange={(event) => updateContent('eyebrow', event.target.value)} /></label>
            <label className="form-builder-control"><span>{t('headline')}</span><input className="form-control" value={copy.headline} onChange={(event) => updateContent('headline', event.target.value)} /></label>
            <label className="form-builder-control"><span>{t('introduction')}</span><textarea className="form-control" rows="2" value={copy.intro} onChange={(event) => updateContent('intro', event.target.value)} /></label>
            </div>
          </details>

          <details className="form-builder-section" open {...sectionProps('jobDetails')}>
            <summary className="form-builder-accordion-summary"><h3>{t('jobDetails')}</h3>{sectionPosition('jobDetails')}</summary>
            <div className="form-builder-accordion-content">
            <div className="form-builder-section-heading">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => addListItem('facts')}><FontAwesomeIcon icon={faPlus} /> {t('addDetail')}</button>
            </div>
            <label className="form-builder-control"><span>{t('sectionHeading')}</span><input className="form-control" value={copy.detailsTitle} onChange={(event) => updateContent('detailsTitle', event.target.value)} /></label>
            <div className="form-builder-repeat-list">
              {copy.facts.map(([label, value], index) => (
                <div
                  className="form-builder-repeat-row fact-row"
                  key={`fact-${index}`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleFactDrop(event, index)}
                >
                  <button
                    type="button"
                    className="form-builder-drag-handle"
                    draggable="true"
                    aria-label={`${t('dragToReorder')}: ${label || t('detailLabel')}`}
                    title={t('dragToReorder')}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', `fact:${index}`)
                    }}
                  >
                    <FontAwesomeIcon icon={faGripVertical} />
                  </button>
                  <input className="form-control" aria-label={t('detailLabel')} placeholder={t('detailLabelPlaceholder')} value={label} onChange={(event) => {
                    const facts = [...copy.facts]
                    facts[index] = [event.target.value, facts[index][1]]
                    updateContent('facts', facts)
                  }} />
                  <input className="form-control" aria-label={t('detailValue')} placeholder={t('detailValuePlaceholder')} value={value} onChange={(event) => {
                    const facts = [...copy.facts]
                    facts[index] = [facts[index][0], event.target.value]
                    updateContent('facts', facts)
                  }} />
                  <button type="button" className="form-builder-remove" onClick={() => removeListItem('facts', index)} aria-label={t('removeJobDetail')}><FontAwesomeIcon icon={faTrash} /><span>{t('removeLabel')}</span></button>
                </div>
              ))}
              {copy.facts.length === 0 && <p className="form-builder-empty">{t('noJobDetails')}</p>}
            </div>
            </div>
          </details>

          <details className="form-builder-section" open {...sectionProps('whoShouldApply')}>
            <summary className="form-builder-accordion-summary"><h3>{t('whoShouldApply')}</h3>{sectionPosition('whoShouldApply')}</summary>
            <div className="form-builder-accordion-content">
            <div className="form-builder-section-heading">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => addListItem('perks')}><FontAwesomeIcon icon={faPlus} /> {t('addPoint')}</button>
            </div>
            <label className="form-builder-control"><span>{t('sectionHeading')}</span><input className="form-control" value={copy.whoTitle} onChange={(event) => updateContent('whoTitle', event.target.value)} /></label>
            <label className="form-builder-control"><span>{t('description')}</span><textarea className="form-control" rows="2" value={copy.whoText} onChange={(event) => updateContent('whoText', event.target.value)} /></label>
            <div className="form-builder-repeat-list">
              {copy.perks.map((perk, index) => (
                <div className="form-builder-repeat-row single" key={`perk-${index}`}>
                  <input className="form-control" aria-label={t('applicantPointAria', { number: index + 1 })} value={perk} onChange={(event) => updateListItem('perks', index, event.target.value)} />
                  <button type="button" className="form-builder-remove" onClick={() => removeListItem('perks', index)} aria-label={t('removeApplicantPoint')}><FontAwesomeIcon icon={faTrash} /><span>{t('removeLabel')}</span></button>
                </div>
              ))}
              {copy.perks.length === 0 && <p className="form-builder-empty">{t('noApplicantPoints')}</p>}
            </div>
            </div>
          </details>

          <details className="form-builder-section" open {...sectionProps('contactTeam')}>
            <summary className="form-builder-accordion-summary"><h3>{t('contactTeam')}</h3>{sectionPosition('contactTeam')}</summary>
            <div className="form-builder-accordion-content">
            <div className="form-builder-section-heading">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => addListItem('contacts')}><FontAwesomeIcon icon={faPlus} /> {t('addContact')}</button>
            </div>
            <label className="form-builder-control"><span>{t('sectionHeading')}</span><input className="form-control" value={copy.contactTitle} onChange={(event) => updateContent('contactTitle', event.target.value)} /></label>
            <label className="form-builder-control"><span>{t('urgencyNote')}</span><input className="form-control" value={copy.urgent} onChange={(event) => updateContent('urgent', event.target.value)} /></label>
            <div className="form-builder-repeat-list">
              {copy.contacts.map((contact, index) => (
                <div className="form-builder-repeat-row" key={`contact-${index}`}>
                  <input className="form-control" aria-label={t('contactName')} placeholder={t('name')} value={contact.name} onChange={(event) => updateListItem('contacts', index, event.target.value, 'name')} />
                  <input className="form-control" aria-label={t('phoneNumber')} placeholder={t('phoneNumber')} value={contact.phone} onChange={(event) => updateListItem('contacts', index, event.target.value, 'phone')} />
                  <button type="button" className="form-builder-remove" onClick={() => removeListItem('contacts', index)} aria-label={t('removeContact')}><FontAwesomeIcon icon={faTrash} /><span>{t('removeLabel')}</span></button>
                </div>
              ))}
              {copy.contacts.length === 0 && <p className="form-builder-empty">{t('noContacts')}</p>}
            </div>
            </div>
          </details>

          <details className="form-builder-section" open {...sectionProps('application')}>
            <summary className="form-builder-accordion-summary"><h3>{t('applicationFormText')}</h3>{sectionPosition('application')}</summary>
            <div className="form-builder-accordion-content">
            <label className="form-builder-control"><span>{t('formTitle')}</span><input className="form-control" value={copy.formTitle} onChange={(event) => updateContent('formTitle', event.target.value)} /></label>
            <label className="form-builder-control"><span>{t('formIntroduction')}</span><textarea className="form-control" rows="2" value={copy.formIntro} onChange={(event) => updateContent('formIntro', event.target.value)} /></label>
            <div className="form-builder-section-heading">
              <h3>{t('additionalQuestions')}</h3>
              <div className="form-builder-section-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={addFieldSection}><FontAwesomeIcon icon={faPlus} /> {t('addSection')}</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => addField('')}><FontAwesomeIcon icon={faPlus} /> {t('addField')}</button>
              </div>
            </div>
            <p className="form-builder-section-note">{t('additionalQuestionsNote')}</p>
            {orderedFieldGroups.map((group) => {
              const groupFields = fields.filter((field) => getBuilderFieldGroup(field, customFieldSections) === group && !isWillingToWorkField(field))
              const customSection = customFieldSections.find((section) => section.id === group)
              const groupTitle = customSection
                ? customSectionLabel(customSection)
                : group === '' ? t('applicantDetails') : t(group === 'friend' ? 'friendDetails' : 'confirmations')
              return (
                <section className="form-builder-field-group" key={group || 'applicant'}>
                  <div className="form-builder-section-heading">
                    {customSection
                      ? <label className="form-builder-control">
                        <span>{t('sectionName')}</span>
                        <input className="form-control" value={groupTitle} onChange={(event) => updateCustomSectionTitle(group, event.target.value)} />
                      </label>
                      : <h4>{groupTitle}</h4>}
                    <div className="form-builder-section-actions">
                      <label className="form-builder-position-control">
                        <span>{t('position')}</span>
                        <select
                          className="form-control"
                          aria-label={`${t('position')}: ${groupTitle}`}
                          value={fieldGroupPosition(group)}
                          onChange={(event) => updateFieldGroupPosition(group, Number(event.target.value))}
                        >
                          {orderedFieldGroups.map((_, position) => <option key={position} value={position + 1}>{position + 1}</option>)}
                        </select>
                      </label>
                      {customSection && (
                        <button type="button" className="form-builder-remove" onClick={() => removeCustomFieldSection(customSection)} aria-label={`${t('removeSection')}: ${groupTitle}`}>
                          <FontAwesomeIcon icon={faTrash} /><span>{t('removeLabel')}</span>
                        </button>
                      )}
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => addField(group)}><FontAwesomeIcon icon={faPlus} /> {t('addField')}</button>
                    </div>
                  </div>
                  {!customSection && group === '' && <p className="form-builder-section-note">{t('standardFieldsNote')}</p>}
                  {group === 'confirmations' && (
                    <label className="form-builder-control">
                      <span>{t('confirmationHeading')}</span>
                      <input className="form-control" value={copy.checkTitle} onChange={(event) => updateContent('checkTitle', event.target.value)} />
                    </label>
                  )}
                  <div className="form-builder-fields">
                    {groupFields.map((field, index) => renderBuilderField(field, index, groupFields))}
                    {groupFields.length === 0 && (
                      <div className="form-builder-empty">
                        {t('noFields')}
                      </div>
                    )}
                  </div>
                </section>
              )
            })}
            {willingToWorkFields.length > 0 && (
              <section className="form-builder-field-group">
                <h4>{t('lastQuestion')}</h4>
                <div className="form-builder-fields">
                  {willingToWorkFields.map((field, index) => renderBuilderField(field, index, willingToWorkFields))}
                </div>
              </section>
            )}
            <label className="form-builder-control"><span>{t('submitButton')}</span><input className="form-control" value={copy.submit} onChange={(event) => updateContent('submit', event.target.value)} /></label>
            <label className="form-builder-control"><span>{t('successHeading')}</span><input className="form-control" value={copy.doneTitle} onChange={(event) => updateContent('doneTitle', event.target.value)} /></label>
            <label className="form-builder-control"><span>{t('successMessage')}</span><textarea className="form-control" rows="2" value={copy.doneText} onChange={(event) => updateContent('doneText', event.target.value)} /></label>
            <label className="form-builder-control"><span>{t('whatsAppShareButton')}</span><input className="form-control" value={copy.share} onChange={(event) => updateContent('share', event.target.value)} /></label>
            <label className="form-builder-control"><span>{t('whatsAppShareMessage')}</span><textarea className="form-control" rows="2" value={copy.shareMsg} onChange={(event) => updateContent('shareMsg', event.target.value)} /></label>
            <label className="form-builder-control"><span>{t('callButton')}</span><input className="form-control" value={copy.call} onChange={(event) => updateContent('call', event.target.value)} /></label>
            <label className="form-builder-control"><span>{t('footer')}</span><input className="form-control" value={copy.footer} onChange={(event) => updateContent('footer', event.target.value)} /></label>
            </div>
          </details>
            </div>
          ) : (
            <section className="form-builder-describe-panel" role="tabpanel">
              <div>
                <h3>{t('describeFormTitle')}</h3>
                <p>{t('describeFormHelp')}</p>
              </div>
              <label className="form-builder-control">
                <span>{t('describeFormTab')}</span>
                <textarea
                  className="form-control"
                  rows="12"
                  value={formDescription}
                  onChange={(event) => {
                    setFormDescription(event.target.value)
                    setDescriptionError('')
                  }}
                  placeholder={t('describeFormPlaceholder')}
                />
              </label>
              <p className="form-builder-section-note">{t('describeFormInfo')}</p>
              {descriptionError && <p className="form-builder-modal-error" role="alert">{descriptionError}</p>}
              <div className="form-builder-describe-actions">
                <button type="button" className="btn btn-primary" onClick={createFormFromDescription} disabled={loading}>{t('createFormFromDescription')}</button>
              </div>
            </section>
          )}

          <div className="form-builder-footer">
            <span>{coreFields.length} {t('fixedDetails')} · {optionalFields.length} {t('additionalQuestionsCount')}</span>
            <button type="submit" className="btn btn-primary" disabled={saving || loading}>
              {saving ? t('saving') : t('saveForm')}
            </button>
          </div>
        </section>

        {previewOpen && <aside className="form-builder-preview" role="dialog" aria-modal="true" aria-label={t('applicationForm')}>
          <div className="form-builder-preview-head">
            <span>{t('preview')}</span>
            <span>{t('project')} {projectId}</span>
            <button type="button" className="form-preview-close" aria-label={t('closePreview')} onClick={() => setPreviewOpen(false)}><FontAwesomeIcon icon={faXmark} /></button>
          </div>
          <div className="page-preview-hero">
            <span>{copy.brandLine} · {copy.eyebrow}</span>
            <small className="page-preview-project-name">{copy.projectName}</small>
            <h2>{copy.headline}</h2>
            <p>{copy.intro}</p>
          </div>
          <div className="page-preview-live-countdown" aria-live="polite">
            <small>{copy.trainingDate ? `${t('trainingDate')} · ${formatProjectDate(copy.trainingDate)}` : t('trainingDateNotSet')}</small>
            <strong>{trainingCountdown || (copy.trainingDate ? t('trainingDatePassed') : t('selectTrainingDate'))}</strong>
          </div>
          {copy.facts.length > 0 && <div className="page-preview-section">
            <h3>{copy.detailsTitle}</h3>
            <div className="page-preview-facts">{copy.facts.map(([label, value], index) => <div key={`preview-fact-${index}`}><small>{label}</small><strong>{value}</strong></div>)}</div>
          </div>}
          <div className="page-preview-section">
            <h3>{copy.whoTitle}</h3><p>{copy.whoText}</p>
            <ul>{copy.perks.map((perk, index) => <li key={`preview-perk-${index}`}>{perk}</li>)}</ul>
          </div>
          {copy.contacts.length > 0 && <div className="page-preview-section">
            <h3>{copy.contactTitle}</h3>
            {copy.contacts.map((contact, index) => <div className="page-preview-contact" key={`preview-contact-${index}`}><strong>{contact.name}</strong><span>{contact.phone}</span><span>{copy.call} · WhatsApp</span></div>)}
            <p className="page-preview-urgent">{copy.urgent}</p>
          </div>}
          <div className="form-preview-content">
            <h2>{copy.formTitle || t('applicationForm')}</h2>
            {copy.formIntro && <p>{copy.formIntro}</p>}
            {loading ? <div className="form-builder-preview-loading">{t('loadingSavedForm')}</div> : (
              <>
                {previewFieldGroups.map(({ group, fields: sectionFields }) => {
                  const customSection = customFieldSections.find((section) => section.id === group)
                  return (
                    <div className="form-preview-group" key={group || 'applicant'}>
                      {group === 'friend' && <div className="form-preview-friend-title">{t('friendPrompt')}</div>}
                      {group === 'confirmations' && <h3 className="form-preview-check-title">{copy.checkTitle}</h3>}
                      {customSection && <h3 className="form-preview-check-title">{customSectionLabel(customSection)}</h3>}
                      {sectionFields.map((field) => renderPreviewField(field))}
                    </div>
                  )
                })}
                {willingToWorkFields.map((field) => renderPreviewField(field))}
              </>
            )}
            <button type="button" className="btn btn-primary form-preview-submit" disabled>{copy.submit}</button>
          </div>
          <div className="page-preview-success"><h3>{copy.doneTitle}</h3><p>{copy.doneText}</p><span>{copy.share}</span><small>{copy.shareMsg}</small></div>
          <div className="page-preview-footer"><span>{copy.footer}</span></div>
        </aside>}
      </form>
      {sectionComposer && (
        <div
          className="form-builder-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSectionComposer(null)
          }}
        >
          <section className="form-builder-modal" role="dialog" aria-modal="true" aria-labelledby="form-builder-modal-title">
            <div className="form-builder-modal-header">
              <div>
                <h2 id="form-builder-modal-title">{t('addSection')}</h2>
                <p>{t('customSectionDescription')}</p>
              </div>
              <button type="button" className="form-builder-icon-action" aria-label={t('cancel')} onClick={() => setSectionComposer(null)}>×</button>
            </div>
            <label className="form-builder-control">
              <span>{t('sectionName')}</span>
              <input
                className="form-control"
                autoFocus
                value={sectionComposer.title}
                onChange={(event) => updateSectionDraft('title', event.target.value)}
              />
            </label>
            <div className="form-builder-modal-fields">
              {sectionComposer.fields.map((field, index) => (
                <section className="form-builder-modal-field" key={index}>
                  <div className="form-builder-section-heading">
                    <h3>{t('addSectionField')} {index + 1}</h3>
                    <button
                      type="button"
                      className="form-builder-remove"
                      onClick={() => updateSectionDraft('fields', sectionComposer.fields.filter((_, fieldIndex) => fieldIndex !== index))}
                      disabled={sectionComposer.fields.length === 1}
                    >
                      <FontAwesomeIcon icon={faTrash} /><span>{t('removeLabel')}</span>
                    </button>
                  </div>
                  <div className="form-builder-field-grid">
                    <label className="form-builder-control form-builder-label-control">
                      <span>{t('label')}</span>
                      <input className="form-control" value={field.label} onChange={(event) => updateSectionFieldDraft(index, 'label', event.target.value)} />
                    </label>
                    <label className="form-builder-control">
                      <span>{t('type')}</span>
                      <select className="form-control" value={field.type} onChange={(event) => updateSectionFieldDraft(index, 'type', event.target.value)}>
                        {FIELD_TYPES.map(([value, typeLabel]) => <option key={value} value={value}>{t(typeLabel)}</option>)}
                      </select>
                    </label>
                    <label className="form-builder-control">
                      <span>{t('placeholder')}</span>
                      <input className="form-control" value={field.placeholder} onChange={(event) => updateSectionFieldDraft(index, 'placeholder', event.target.value)} />
                    </label>
                    <label className="form-builder-control">
                      <span>{t('hint')}</span>
                      <input className="form-control" value={field.hint} onChange={(event) => updateSectionFieldDraft(index, 'hint', event.target.value)} />
                    </label>
                    {field.type === 'select' && (
                      <label className="form-builder-control form-builder-options">
                        <span>{t('fieldOptions')}</span>
                        <textarea className="form-control" rows="3" value={field.options} onChange={(event) => updateSectionFieldDraft(index, 'options', event.target.value)} />
                      </label>
                    )}
                  </div>
                  <label className="form-builder-required-toggle">
                    <input type="checkbox" checked={field.required} onChange={(event) => updateSectionFieldDraft(index, 'required', event.target.checked)} />
                    <span><strong>{t('fieldRequiredToggle')}</strong></span>
                  </label>
                </section>
              ))}
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => updateSectionDraft('fields', [...sectionComposer.fields, createSectionFieldDraft(sectionComposer.fields.length + 1)])}>
              <FontAwesomeIcon icon={faPlus} /> {t('addSectionField')}
            </button>
            {sectionComposer.error && <p className="form-builder-modal-error" role="alert">{sectionComposer.error}</p>}
            <div className="form-builder-modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setSectionComposer(null)}>{t('cancel')}</button>
              <button type="button" className="btn btn-primary" onClick={createCustomFieldSection}>{t('createSection')}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}