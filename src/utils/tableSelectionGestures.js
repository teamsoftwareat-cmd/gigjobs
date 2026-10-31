const getTableRow = (target) => {
  if (!(target instanceof Element)) return null
  const row = target.closest('tbody tr')
  const table = row?.closest('table')
  return row && table ? { row, table } : null
}

const getSelectionColumnIndex = (table) => {
  const headerRows = Array.from(table.tHead?.rows || [])
  for (const row of headerRows) {
    const cellIndex = Array.from(row.cells).findIndex((cell) => cell.querySelector('input[type="checkbox"]'))
    if (cellIndex >= 0) return cellIndex
  }

  const columnCounts = new Map()
  Array.from(table.tBodies).flatMap((body) => Array.from(body.rows)).forEach((row) => {
    Array.from(row.cells).forEach((cell, cellIndex) => {
      if (cell.querySelectorAll('input[type="checkbox"]').length === 1) {
        columnCounts.set(cellIndex, (columnCounts.get(cellIndex) || 0) + 1)
      }
    })
  })

  return [...columnCounts.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0])[0]?.[0] ?? -1
}

const getRowSelectionInput = (row, columnIndex) => {
  const cell = row.cells[columnIndex]
  if (!cell) return null
  const checkboxes = cell.querySelectorAll('input[type="checkbox"]')
  return checkboxes.length === 1 ? checkboxes[0] : null
}

export const installTableSelectionGestures = () => {
  const anchors = new WeakMap()
  let drag = null
  let suppressedClick = null

  const handleClick = (event) => {
    if (!(event.target instanceof HTMLInputElement) || event.target.type !== 'checkbox') return
    if (event.isTrusted && suppressedClick?.input === event.target) {
      event.preventDefault()
      event.stopImmediatePropagation()
      suppressedClick = null
      return
    }
    if (!event.isTrusted) return
    const context = getTableRow(event.target)
    if (!context) return

    const columnIndex = getSelectionColumnIndex(context.table)
    if (context.row.cells[columnIndex]?.querySelector('input[type="checkbox"]') !== event.target) return

    const anchorRow = anchors.get(context.table)
    if (event.shiftKey && anchorRow?.isConnected) {
      const rows = Array.from(context.table.tBodies).flatMap((body) => Array.from(body.rows))
      const anchorIndex = rows.indexOf(anchorRow)
      const targetIndex = rows.indexOf(context.row)
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const desiredChecked = event.target.checked
        const rangeInputs = rows
          .slice(Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1)
          .filter((row) => row !== context.row)
          .map((row) => getRowSelectionInput(row, columnIndex))
          .filter((input) => input && !input.disabled)

        let rangeIndex = 0
        const applyNextRangeInput = () => {
          const input = rangeInputs[rangeIndex]
          if (!input) return
          if (input.isConnected && input.checked !== desiredChecked) input.click()
          rangeIndex += 1
          if (rangeIndex < rangeInputs.length) window.setTimeout(applyNextRangeInput, 0)
        }
        if (rangeInputs.length) window.setTimeout(applyNextRangeInput, 0)
      }
    }

    anchors.set(context.table, context.row)
  }

  const handlePointerDown = (event) => {
    if (event.button !== 0 || event.shiftKey || !(event.target instanceof HTMLInputElement) || event.target.type !== 'checkbox') return
    const context = getTableRow(event.target)
    if (!context) return

    const columnIndex = getSelectionColumnIndex(context.table)
    if (context.row.cells[columnIndex]?.querySelector('input[type="checkbox"]') !== event.target || event.target.disabled) return

    const desiredChecked = !event.target.checked
    drag = { table: context.table, row: context.row, columnIndex, desiredChecked }
    anchors.set(context.table, context.row)
    const clickGuard = { input: event.target }
    suppressedClick = clickGuard
    event.preventDefault()
    if (event.target.checked !== desiredChecked) event.target.click()
  }

  const handlePointerOver = (event) => {
    if (!drag || !(event.buttons & 1)) return
    const context = getTableRow(event.target)
    if (!context || context.table !== drag.table || context.row === drag.row) return

    const input = getRowSelectionInput(context.row, drag.columnIndex)
    if (input && !input.disabled && input.checked !== drag.desiredChecked) input.click()
    drag.row = context.row
  }

  const clearDrag = () => {
    drag = null
    const clickGuard = suppressedClick
    if (clickGuard) {
      window.setTimeout(() => {
        if (suppressedClick === clickGuard) suppressedClick = null
      }, 0)
    }
  }

  document.addEventListener('click', handleClick, true)
  document.addEventListener('pointerdown', handlePointerDown, true)
  document.addEventListener('pointerover', handlePointerOver, true)
  window.addEventListener('pointerup', clearDrag, true)
  window.addEventListener('pointercancel', clearDrag, true)

  return () => {
    document.removeEventListener('click', handleClick, true)
    document.removeEventListener('pointerdown', handlePointerDown, true)
    document.removeEventListener('pointerover', handlePointerOver, true)
    window.removeEventListener('pointerup', clearDrag, true)
    window.removeEventListener('pointercancel', clearDrag, true)
  }
}