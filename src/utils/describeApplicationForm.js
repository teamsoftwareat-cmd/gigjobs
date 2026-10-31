const SECTION_HINTS = /\b(personal|applicant|contact|work|employment|experience|education|qualification|availability|schedule|location|address|document|reference|emergency|skill|language|confirmation|additional|application)\b/i
const CORE_FIELD_LABELS = new Set([
  'name',
  'full name',
  'first name',
  'last name',
  'email',
  'email address',
  'mobile',
  'mobile number',
  'phone',
  'phone number',
  'contact number',
])

const cleanLabel = (value) => String(value || '')
  .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
  .replace(/\s*\((?:required|optional|mandatory|not required|text|number|email|date|dropdown|select|yes\/no|options?)[^)]*\)\s*$/i, '')
  .replace(/\s*[-–—]\s*(?:required|optional|mandatory|not required)\s*$/i, '')
  .replace(/\s+(?:is\s+)?(?:required|optional|mandatory|not required)\s*$/i, '')
  .replace(/^(?:required|optional|mandatory)\s*:\s*/i, '')
  .replace(/[.?!;:]+$/, '')
  .trim()

const fieldTypeFromLabel = (label, originalText) => {
  const text = `${label} ${originalText}`.toLowerCase()
  if (/\b(email|e-mail)\b/.test(text)) return 'email'
  if (/\b(phone|mobile|telephone|contact number)\b/.test(text)) return 'tel'
  if (/\b(date|when)\b/.test(text)) return 'date'
  if (/\b(confirm|agree|accept|acknowledge|consent)\b/.test(text)) return 'checkbox'
  if (/\b(number|numeric|age|years of experience|how many|quantity)\b/.test(text)) return 'number'
  if (/\b(choose|select|dropdown|one of|yes\/no|gender|education level)\b|\boptions?\s*:/i.test(text)) return 'select'
  if (/\b(address|describe|explain|comments?|additional information|experience|qualification|reason)\b/.test(text)) return 'textarea'
  return 'text'
}

const fieldOptionsFromText = (text, type) => {
  if (type !== 'select') return ''
  const optionMatch = String(text).match(/(?:options?|choose from)\s*:\s*([^.)]+)/i)
  if (optionMatch) return optionMatch[1].split(/[|,/;]|\s+\bor\b\s+|\s+\band\b\s+/i).map((option) => option.trim()).filter(Boolean).join('\n')
  if (/\byes\s*\/\s*no\b/i.test(text)) return 'Yes\nNo'
  return ''
}

const isSectionHeading = (line) => {
  if (/^\s*(?:[-*•]|\d+[.)])\s+/.test(line)) return false
  const unwrapped = line.replace(/^#{1,6}\s*/, '').replace(/:$/, '').trim()
  const words = unwrapped.split(/\s+/)
  return /^#{1,6}\s+/.test(line)
    || (words.length <= 5 && unwrapped.length <= 60 && SECTION_HINTS.test(unwrapped) && !/\b(fields?|required|optional|email|phone|mobile|name|date|age|form|include|collect|asks?|ask|need|should|please)\b/i.test(unwrapped))
}

const isFieldListLine = (line) => (
  /^\s*(?:[-*•]|\d+[.)])\s+/.test(line)
  || /\bfields?\s*(?::|include|are|is|to collect)\s*.+/i.test(line)
  || /\b(?:collect|asks?\s+for|ask(?:ing)? for|capture|information needed)\s*.+/i.test(line)
  || /^\s*(?:required|optional)\s+fields?\s*:/i.test(line)
)

const splitFieldList = (value) => {
  const source = String(value)
  const cue = /(?:\b(?:required|optional)\s+fields?\s*(?::|include|are|is)|\bfields?\s*(?::|include|are|is|to collect)|\bcollect(?:\s+for)?\s*(?::|include)?|\basks?\s+for|\bask(?:ing)? for|\bcapture\s*(?::|include)?|\binformation needed\s*(?::|include)?)/i
  const cueMatch = source.match(cue)
  const list = cueMatch ? source.slice(cueMatch.index + cueMatch[0].length) : source
  const items = []
  let current = ''
  let parentheses = 0
  for (let index = 0; index < list.length; index += 1) {
    const char = list[index]
    if (char === '(') parentheses += 1
    if (char === ')') parentheses = Math.max(0, parentheses - 1)
    const isAndSeparator = parentheses === 0 && /^\s+and\s+/i.test(list.slice(index))
    if (parentheses === 0 && (/[;|,\n]/.test(char) || isAndSeparator)) {
      if (current.trim()) items.push(current.trim())
      current = ''
      if (isAndSeparator) index += list.slice(index).match(/^\s+and\s+/i)[0].length - 1
    } else current += char
  }
  if (current.trim()) items.push(current.trim())
  return items
}

const toField = (rawText, sectionId, index, allRequired) => {
  const raw = String(rawText).replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()
  const label = cleanLabel(raw)
  if (!label || label.length > 100 || CORE_FIELD_LABELS.has(label.toLowerCase())) return null
  const type = fieldTypeFromLabel(label, raw)
  const slug = label.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `field_${index + 1}`
  const id = `described-${index + 1}-${slug}`
  const required = !/\b(optional|not required)\b/i.test(raw)
    && (/\b(required|mandatory)\b/i.test(raw) || allRequired)
  return {
    id,
    name: `described_${slug}`,
    label: { en: label, hi: label, ta: label },
    type,
    required,
    options: fieldOptionsFromText(raw, type),
    placeholder: { en: '', hi: '', ta: '' },
    hint: { en: '', hi: '', ta: '' },
    group: sectionId,
  }
}

export const generateApplicationFormFromDescription = (description) => {
  const source = String(description || '').trim()
  if (!source) return { sections: [], fields: [], title: '', error: 'Enter a form description first.' }

  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const titleLine = lines.find((line) => /^(?:form\s+)?title\s*:/i.test(line))
  const title = titleLine ? titleLine.replace(/^(?:form\s+)?title\s*:\s*/i, '').trim() : ''
  const allRequired = /\b(all|every)\s+(?:the\s+)?fields?\s+(?:are\s+)?(?:required|mandatory)\b/i.test(source)
  const sections = []
  const sectionByTitle = new Map()
  let activeSection = null
  let fieldIndex = 0

  const addSection = (sectionTitle) => {
    const normalizedTitle = sectionTitle.trim().replace(/:$/, '')
    const key = normalizedTitle.toLowerCase()
    if (!normalizedTitle) return null
    if (sectionByTitle.has(key)) return sectionByTitle.get(key)
    const section = {
      id: `described-section-${sections.length + 1}-${normalizedTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title: { en: normalizedTitle, hi: normalizedTitle, ta: normalizedTitle },
    }
    sections.push(section)
    sectionByTitle.set(key, section)
    return section
  }

  const ensureDefaultSection = () => activeSection || addSection('Application details')
  const fields = []

  lines.forEach((line) => {
    if (/^(?:form\s+)?title\s*:/i.test(line) || /^all\s+(?:the\s+)?fields?\s+(?:are\s+)?(?:required|mandatory)\b/i.test(line)) return

    const headingMatch = line.match(/^#{1,6}\s+(.+)$/) || line.match(/^section\s*:\s*(.+)$/i)
    const sectionMatch = line.match(/^(.+):$/i)
    const plainSection = isSectionHeading(line)
    if (headingMatch || (sectionMatch && SECTION_HINTS.test(sectionMatch[1])) || plainSection) {
      const heading = headingMatch?.[1] || sectionMatch?.[1] || line.replace(/:$/, '').trim()
      if (/^(?:fields?|questions?)$/i.test(heading.trim())) return
      if (/^(?:required|optional)\s+fields?$/i.test(heading.trim())) return
      activeSection = addSection(heading)
      return
    }

    if (!isFieldListLine(line)) return
    const candidates = splitFieldList(line).map((candidate) => (
      /^\s*required\s+fields?\s*:/i.test(line) ? `required: ${candidate}`
        : /^\s*optional\s+fields?\s*:/i.test(line) ? `optional: ${candidate}`
          : candidate
    ))
    candidates.forEach((candidate) => {
      const field = toField(candidate, ensureDefaultSection().id, fieldIndex, allRequired)
      if (!field) return
      const duplicate = fields.some((existing) => existing.label.en.toLowerCase() === field.label.en.toLowerCase())
      if (duplicate) return
      fields.push(field)
      fieldIndex += 1
    })
  })

  const usedSections = sections.filter((section) => fields.some((field) => field.group === section.id))
  if (!fields.length) {
    return {
      sections: [],
      fields: [],
      title,
      error: 'No application fields were identified. Add section headings and list the fields under each heading.',
    }
  }
  return { sections: usedSections, fields, title, error: '' }
}
