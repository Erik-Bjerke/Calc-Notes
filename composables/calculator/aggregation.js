// Sum and average operations
import { convertCurrency } from './currency'

// Check if a raw input line is a checkbox and whether it matches the filter
const matchesCheckboxFilter = (input, filter) => {
  if (!filter) return true // no filter — include all lines
  const checkMatch = input.match(/^\s*- \[([ x])\]\s/)
  if (!checkMatch) return true // not a checkbox line — include it (filter only applies to checkboxes)
  const isChecked = checkMatch[1] === 'x'
  if (filter === 'checked') return isChecked
  if (filter === 'unchecked') return !isChecked
  return true
}

export const calculateSum = (currentIndex, allResults, filter = null) => {
  let sum = 0
  for (let i = currentIndex - 1; i >= 0; i--) {
    const line = allResults[i]
    if (!line || !line.input.trim()) break
    if (!matchesCheckboxFilter(line.input, filter)) continue
    if (line.result && !isNaN(parseFloat(line.result))) sum += parseFloat(line.result)
  }
  return sum
}

export const detectSumCurrency = (currentIndex, allResults, filter = null) => {
  let firstCurrency = null
  for (let i = currentIndex - 1; i >= 0; i--) {
    const line = allResults[i]
    if (!line || !line.input.trim()) break
    if (!matchesCheckboxFilter(line.input, filter)) continue
    if (line.result) {
      const currMatch = line.result.match(/^-?[\d.,]+\s+([A-Z]{3})$/)
      if (currMatch) {
        if (!firstCurrency) firstCurrency = currMatch[1]
      }
    }
  }
  return firstCurrency
}

export const calculateSumWithCurrency = (
  currentIndex,
  allResults,
  targetCurrency,
  filter = null,
) => {
  let sum = 0
  for (let i = currentIndex - 1; i >= 0; i--) {
    const line = allResults[i]
    if (!line || !line.input.trim()) break
    if (!matchesCheckboxFilter(line.input, filter)) continue
    if (line.result) {
      const resultMatch = line.result.match(/^(-?[\d.]+)\s*([A-Z]{3})?$/)
      if (resultMatch) {
        const value = parseFloat(resultMatch[1])
        const currency = resultMatch[2]
        if (currency && targetCurrency) {
          try {
            sum += convertCurrency(value, currency, targetCurrency)
          } catch (_e) {
            sum += value
          }
        } else {
          sum += value
        }
      }
    }
  }
  return sum
}

export const calculateSub = (currentIndex, allResults, filter = null) => {
  const values = []
  for (let i = currentIndex - 1; i >= 0; i--) {
    const line = allResults[i]
    if (!line || !line.input.trim()) break
    if (!matchesCheckboxFilter(line.input, filter)) continue
    if (line.result && !isNaN(parseFloat(line.result))) values.push(parseFloat(line.result))
  }
  if (values.length === 0) return 0
  values.reverse()
  let result = values[0]
  for (let i = 1; i < values.length; i++) result -= values[i]
  return result
}

export const calculateSubWithCurrency = (
  currentIndex,
  allResults,
  targetCurrency,
  filter = null,
) => {
  const values = []
  for (let i = currentIndex - 1; i >= 0; i--) {
    const line = allResults[i]
    if (!line || !line.input.trim()) break
    if (!matchesCheckboxFilter(line.input, filter)) continue
    if (line.result) {
      const resultMatch = line.result.match(/^(-?[\d.]+)\s*([A-Z]{3})?$/)
      if (resultMatch) {
        const value = parseFloat(resultMatch[1])
        const currency = resultMatch[2]
        if (currency && targetCurrency) {
          try {
            values.push(convertCurrency(value, currency, targetCurrency))
          } catch (_e) {
            values.push(value)
          }
        } else {
          values.push(value)
        }
      }
    }
  }
  if (values.length === 0) return 0
  values.reverse()
  let result = values[0]
  for (let i = 1; i < values.length; i++) result -= values[i]
  return result
}

export const calculateAverage = (currentIndex, allResults) => {
  let sum = 0,
    count = 0
  for (let i = currentIndex - 1; i >= 0; i--) {
    const line = allResults[i]
    if (!line || !line.input.trim()) break
    if (line.result && !isNaN(parseFloat(line.result))) {
      sum += parseFloat(line.result)
      count++
    }
  }
  return count > 0 ? sum / count : 0
}
