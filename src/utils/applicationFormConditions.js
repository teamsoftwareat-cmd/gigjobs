export const getApplicationFieldOptions = (field) => (
  Array.isArray(field?.options)
    ? field.options.map((option) => String(option).trim()).filter(Boolean)
    : String(field?.options || '').split('\n').map((option) => option.trim()).filter(Boolean)
)

export const getMatchingDeciderRules = (field, answers) => {
  const answer = String(answers[field?.name] ?? '').trim().toLocaleLowerCase()
  if (!field?.deciderEnabled || !answer || !Array.isArray(field?.deciderRules)) return []

  return field.deciderRules.filter((rule) => (
    String(rule.answer || '').trim().toLocaleLowerCase() === answer
  ))
}

export const isApplicationFieldVisible = (field, answers, fields, visiting = new Set()) => {
  const condition = field?.dependsOn
  if (!condition?.fieldId) return true
  if (visiting.has(field.id)) return false

  const parent = fields.find((item) => item.id === condition.fieldId)
  if (!parent) return true

  const nextVisiting = new Set(visiting).add(field.id)
  return isApplicationFieldVisible(parent, answers, fields, nextVisiting)
    && String(answers[parent.name] ?? '') === String(condition.value ?? '')
}

export const isApplicationSectionVisible = (section, answers, fields) => {
  const condition = section?.dependsOn
  if (!condition?.fieldId) return true

  const parent = fields.find((item) => item.id === condition.fieldId)
  if (!parent) return true

  return isApplicationFieldVisible(parent, answers, fields)
    && String(answers[parent.name] ?? '') === String(condition.value ?? '')
}