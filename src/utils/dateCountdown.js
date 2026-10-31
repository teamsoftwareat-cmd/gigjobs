const FALLBACK_TEXT = {
  en: {
    today: 'Training is today',
    tomorrow: 'Training is tomorrow',
    days: (count) => `Training starts in ${count} days`,
  },
  hi: {
    today: 'ट्रेनिंग आज है',
    tomorrow: 'ट्रेनिंग कल है',
    days: (count) => `ट्रेनिंग ${count} दिन में शुरू होगी`,
  },
  ta: {
    today: 'பயிற்சி இன்று',
    tomorrow: 'பயிற்சி நாளை',
    days: (count) => `பயிற்சி இன்னும் ${count} நாட்களில் தொடங்கும்`,
  },
}

export const getDaysUntilDate = (dateValue) => {
  if (!dateValue) return null
  const [year, month, day] = String(dateValue).split('T')[0].split('-').map(Number)
  if (!year || !month || !day) return null
  const targetDay = Date.UTC(year, month - 1, day)
  const current = new Date()
  const today = Date.UTC(current.getFullYear(), current.getMonth(), current.getDate())
  return Math.round((targetDay - today) / 86400000)
}

export const getCountdownLabelForDays = (days, language = 'en', content = {}) => {
  if (!Number.isFinite(days) || days < 0) return ''
  if (days === 0) return FALLBACK_TEXT[language]?.today || FALLBACK_TEXT.en.today
  if (days === 1) return FALLBACK_TEXT[language]?.tomorrow || FALLBACK_TEXT.en.tomorrow
  if (typeof content.countdown === 'string' && content.countdown.includes('{n}')) {
    return content.countdown.replace('{n}', String(days))
  }
  return (FALLBACK_TEXT[language]?.days || FALLBACK_TEXT.en.days)(days)
}

export const getTrainingCountdownLabel = (dateValue, language = 'en', content = {}) => {
  const days = getDaysUntilDate(dateValue)
  return days == null ? '' : getCountdownLabelForDays(days, language, content)
}
