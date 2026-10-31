export const formatWorkingDays = (value) => {
  let parsed = value

  for (let attempt = 0; attempt < 4 && typeof parsed === 'string'; attempt += 1) {
    const trimmed = parsed.trim()
    if (!trimmed) return ''

    try {
      const nextValue = JSON.parse(trimmed)
      if (nextValue === parsed) break
      parsed = nextValue
    } catch {
      return trimmed
    }
  }

  if (Array.isArray(parsed)) return parsed.map(String).join(', ')
  if (parsed == null) return ''
  return String(parsed)
}

export const formatProjectFacts = (facts) => Array.isArray(facts)
  ? facts.map(([label, value]) => [label, formatWorkingDays(value)])
  : []
