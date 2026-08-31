// Core calculator composable — orchestrates all modules
import {
  variables,
  previousResult,
  previousResultCurrency,
  exchangeRates,
  ratesFetched,
  currencyMap,
  unitConversions,
} from './constants'
import { evaluateMath, handleFunctions, formatResult } from './math'
import { handleUnitExpression, findUnitCategory } from './units'
import { handleCurrencyExpression, fetchExchangeRates } from './currency'
import { handleTimezoneExpression, handleDateExpression } from './datetime'
import {
  calculateSum,
  calculateAverage,
  detectSumCurrency,
  calculateSumWithCurrency,
  calculateSub,
  calculateSubWithCurrency,
} from './aggregation'
import { extractTrailingNumber } from './extract'

// Auto-fetch rates once (non-blocking)
if (typeof window !== 'undefined') {
  fetchExchangeRates()
}

// Dimensional analysis: distance / fuel_economy → volume
// e.g., 100 km / 60 mpl → litres
const computeDimensionalDivision = (leftVar, rightVar) => {
  const leftInfo = findUnitCategory(leftVar.unit)
  const rightInfo = findUnitCategory(rightVar.unit)
  if (!leftInfo || !rightInfo) return null

  // distance / fuel_economy = volume
  if (leftInfo.category === 'length' && rightInfo.category === 'fueleconomy') {
    // Convert distance to km (base for fuel economy is kpl = km per litre)
    const distanceKm = (leftVar.value * leftInfo.factor) / 1000 // factor gives meters, /1000 for km
    // Convert fuel economy to kpl (base)
    const fuelFactor = unitConversions.fueleconomy[rightVar.unit.toLowerCase()]
    if (fuelFactor === undefined) return null

    let kpl
    if (fuelFactor === -1) {
      // l/100km: kpl = 100 / value
      kpl = 100 / rightVar.value
    } else {
      kpl = rightVar.value * fuelFactor
    }

    // fuel = distance_km / kpl → litres
    const litres = distanceKm / kpl

    // Determine display unit based on fuel economy unit
    const feUnit = rightVar.unit.toLowerCase()
    let displayUnit = 'l'
    let displayValue = litres
    if (
      feUnit === 'mpg' ||
      feUnit === 'miles per gallon' ||
      feUnit === 'kpg' ||
      feUnit === 'km per gallon'
    ) {
      // US gallons
      displayUnit = 'gal'
      displayValue = litres / 3.78541
    } else if (
      feUnit === 'mpg_uk' ||
      feUnit === 'miles per uk gallon' ||
      feUnit === 'kpg_uk' ||
      feUnit === 'km per uk gallon'
    ) {
      // UK gallons
      displayUnit = 'gal'
      displayValue = litres / 4.54609
    }

    return {
      value: displayValue,
      display: `${formatResult(displayValue)} ${displayUnit}`,
      unit: displayUnit,
      category: 'volume',
    }
  }

  return null
}

// Dimensional multiplication — placeholder for future compound unit math
const computeDimensionalMultiplication = (_leftVar, _rightVar) => {
  // fuel_economy * distance doesn't make physical sense for fuel consumption
  // but we can handle rate * time = distance, etc. in the future
  return null
}

export const useCalculator = () => {
  const evaluateLines = (inputLines, options) => {
    variables.value = {}
    previousResult.value = null
    previousResultCurrency.value = null
    const results = []
    const skipCodeBlocks = !options?.showResultsInCodeBlocks
    let inCodeBlock = false
    inputLines.forEach((input, index) => {
      const line = { input: input.trim(), result: null, error: null, type: 'calculation' }
      if (skipCodeBlocks) {
        const trimmed = line.input
        if (!inCodeBlock && /^```[\w+#.-]*$/.test(trimmed)) {
          inCodeBlock = true
          line.type = 'comment'
          results.push(line)
          return
        }
        if (inCodeBlock) {
          if (trimmed === '```') inCodeBlock = false
          line.type = 'comment'
          results.push(line)
          return
        }
      }
      evaluateLine(line, index, results)
      results.push(line)
    })
    return results
  }

  const evaluateLine = (line, index, allResults) => {
    const input = line.input
    if (!input) return

    if (input.startsWith('#')) {
      line.type = 'header'
      return
    }
    if (input.startsWith('//')) {
      line.type = 'comment'
      return
    }

    // Label with calculation (but not time format like "2:30")
    const labelMatch = input.match(/^([^:]+):\s*(.+)$/)
    if (labelMatch && labelMatch[2] && !/^\d+$/.test(labelMatch[1].trim())) {
      line.type = 'label'
      try {
        const result = evaluateExpression(labelMatch[2].trim(), index, allResults)
        line.result = result.display
        // For labeled lines, only hide plain numbers/variables — always show unit values
        if (result.hideResult && !result.unit) line.hideResult = true
        if (result.liveTime) {
          line.liveTime = true
          line.iana = result.iana || null
        }
        previousResult.value = result.value
        previousResultCurrency.value = result.currency || null
      } catch (_error) {
        /* silent */
      }
      return
    }

    if (input.endsWith(':')) {
      line.type = 'label'
      return
    }

    line.type = 'calculation'
    try {
      const result = evaluateExpression(input, index, allResults)
      line.result = result.display
      if (result.hideResult) line.hideResult = true
      if (result.liveTime) {
        line.liveTime = true
        line.iana = result.iana || null
      }
      previousResult.value = result.value
      previousResultCurrency.value = result.currency || null
    } catch (_error) {
      // Fallback 1: strip leading text label and retry expression evaluation
      // e.g. "Arwen 900 eur + 20 eur" → evaluate "900 eur + 20 eur" = 920 EUR
      const exprMatch = input.match(/^[a-zA-Z\s]+?(?=\d)(.+)$/)
      if (exprMatch) {
        const strippedExpr = exprMatch[1].trim()
        // Only retry if the stripped expression contains an operator (arithmetic, not just a plain value)
        if (/[+\-*/]/.test(strippedExpr)) {
          try {
            const result = evaluateExpression(strippedExpr, index, allResults)
            if (result.display) {
              line.type = 'label'
              line.result = result.display
              if (result.hideResult) line.hideResult = true
              previousResult.value = result.value
              previousResultCurrency.value = result.currency || null
              return
            }
          } catch (_e) {
            /* fall through to extractTrailingNumber */
          }
        }
      }

      // Fallback 2: extract trailing number (with optional currency) from plain text
      // e.g. "Arwen 900 eur" → 900 EUR, "transporte Kaisa 2000" → 2000
      const extracted = extractTrailingNumber(input)
      if (extracted) {
        line.type = 'label'
        line.result = extracted.display
        line.hideResult = true
        previousResult.value = extracted.value
        previousResultCurrency.value = extracted.currency || null
      }
    }
  }

  const evaluateExpression = (input, index, allResults) => {
    // Strip inline comments: // to end of line, then double-quoted text
    let cleanInput = input.replace(/\/\/.*$/, '').trim()
    cleanInput = cleanInput.replace(/"[^"]*"/g, '').trim()
    if (!cleanInput) cleanInput = input
    cleanInput = cleanInput.replace(/\bfor\s+the\b/gi, '').trim()
    const cleanLower = cleanInput.toLowerCase().trim()

    // Variable assignment — check BEFORE sum/total to avoid "total = X" being caught as sum
    if (
      cleanInput.includes('=') &&
      !cleanInput.includes('==') &&
      !cleanInput.includes('<=') &&
      !cleanInput.includes('>=')
    ) {
      const eqIdx = cleanInput.indexOf('=')
      const varName = cleanInput.substring(0, eqIdx).trim()
      const expression = cleanInput.substring(eqIdx + 1).trim()

      if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) {
        const percentMatch = expression.match(/^(\d+(?:\.\d+)?)\s*%$/)
        if (percentMatch) {
          const percentValue = parseFloat(percentMatch[1])
          variables.value[varName] = `${percentValue}%`
          return { value: percentValue, display: `${percentValue}%`, hideResult: true }
        }

        const result = evaluateExpression(expression, index, allResults)

        // Store with currency metadata if applicable
        if (result.display && typeof result.display === 'string' && result.display.includes(' ')) {
          const parts = result.display.split(' ')
          const lastPart = parts[parts.length - 1]
          if (exchangeRates.value[lastPart]) {
            variables.value[varName] = { value: result.value, currency: lastPart }
          } else if (result.unit) {
            // Store unit metadata for unit-aware variables
            variables.value[varName] = {
              value: result.value,
              unit: result.unit,
              category: result.category || null,
            }
          } else {
            variables.value[varName] = result.value
          }
        } else {
          variables.value[varName] = result.value
        }

        if (varName === 'em' || varName === 'rem') {
          unitConversions.css[varName] = result.value
        }
        if (varName === 'ppi') {
          variables.value._ppi = result.value
        }

        return result
      }
    }

    // Sum / total (only if not a defined variable)
    // Check for checkbox filter: "sum checked", "sum unchecked"
    const sumFilterMatch = cleanLower.match(/^sum\s+(checked|unchecked)$/)
    const sumFilter = sumFilterMatch ? sumFilterMatch[1] : null

    const isSumKeyword = (cleanLower === 'sum' || sumFilterMatch) && !variables.value['sum']
    if (isSumKeyword) {
      const currency = detectSumCurrency(index, allResults, sumFilter)
      if (currency) {
        const sum = calculateSumWithCurrency(index, allResults, currency, sumFilter)
        return { value: sum, display: `${formatResult(sum)} ${currency}`, currency }
      }
      const sum = calculateSum(index, allResults, sumFilter)
      return { value: sum, display: formatResult(sum) }
    }

    const isSumWithOp = cleanLower.startsWith('sum ') && !variables.value['sum'] && !sumFilterMatch
    if (isSumWithOp) {
      // Check for "sum checked/unchecked" followed by an operation
      const sumFilterOpMatch = cleanInput.match(/^sum\s+(checked|unchecked)\s+(.+)$/i)
      if (sumFilterOpMatch) {
        const filter = sumFilterOpMatch[1].toLowerCase()
        const rest = sumFilterOpMatch[2].trim()
        const currency = detectSumCurrency(index, allResults, filter)
        // Check for currency conversion: "sum checked in EUR"
        const convMatch = rest.match(/^(in|as)\s+([a-zA-Z€$£¥₹₽]+\d?|m\/s|km\/h|mi\/h|ft\/s)/i)
        if (convMatch) {
          const targetStr = convMatch[2].trim()
          const targetCurrency = currencyMap[targetStr.toLowerCase()] || targetStr.toUpperCase()
          if (exchangeRates.value[targetCurrency]) {
            const sum = calculateSumWithCurrency(index, allResults, targetCurrency, filter)
            return {
              value: sum,
              display: `${formatResult(sum)} ${targetCurrency}`,
              currency: targetCurrency,
            }
          }
          const sum = calculateSum(index, allResults, filter)
          return { value: sum, display: `${formatResult(sum)} ${targetStr}` }
        }
        const sum = currency
          ? calculateSumWithCurrency(index, allResults, currency, filter)
          : calculateSum(index, allResults, filter)
        const expression = rest.replace(/^/, `${sum} `)
        const result = evaluateMath(expression)
        return { value: result, display: formatResult(result) }
      }

      const sumConvMatch = cleanInput.match(
        /^sum\s+(in|as)\s+([a-zA-Z€$£¥₹₽]+\d?|m\/s|km\/h|mi\/h|ft\/s)/i,
      )
      if (sumConvMatch) {
        const targetStr = sumConvMatch[2].trim()
        const targetCurrency = currencyMap[targetStr.toLowerCase()] || targetStr.toUpperCase()
        if (exchangeRates.value[targetCurrency]) {
          const sum = calculateSumWithCurrency(index, allResults, targetCurrency)
          return {
            value: sum,
            display: `${formatResult(sum)} ${targetCurrency}`,
            currency: targetCurrency,
          }
        }
        const sum = calculateSum(index, allResults)
        return { value: sum, display: `${formatResult(sum)} ${targetStr}` }
      }
      const sum = calculateSum(index, allResults)
      const expression = cleanInput.replace(/^sum\s+/i, `${sum} `)
      const result = evaluateMath(expression)
      return { value: result, display: formatResult(result) }
    }

    // Sub (subtraction aggregation)
    // Check for checkbox filter: "sub checked", "sub unchecked"
    const subFilterMatch = cleanLower.match(/^sub\s+(checked|unchecked)$/)
    const subFilter = subFilterMatch ? subFilterMatch[1] : null

    const isSubKeyword = (cleanLower === 'sub' || subFilterMatch) && !variables.value['sub']
    if (isSubKeyword) {
      const currency = detectSumCurrency(index, allResults, subFilter)
      if (currency) {
        const sub = calculateSubWithCurrency(index, allResults, currency, subFilter)
        return { value: sub, display: `${formatResult(sub)} ${currency}`, currency }
      }
      const sub = calculateSub(index, allResults, subFilter)
      return { value: sub, display: formatResult(sub) }
    }

    const isSubWithOp = cleanLower.startsWith('sub ') && !variables.value['sub'] && !subFilterMatch
    if (isSubWithOp) {
      // Check for "sub checked/unchecked" followed by an operation
      const subFilterOpMatch = cleanInput.match(/^sub\s+(checked|unchecked)\s+(.+)$/i)
      if (subFilterOpMatch) {
        const filter = subFilterOpMatch[1].toLowerCase()
        const rest = subFilterOpMatch[2].trim()
        const currency = detectSumCurrency(index, allResults, filter)
        const convMatch = rest.match(/^(in|as)\s+([a-zA-Z€$£¥₹₽]+\d?|m\/s|km\/h|mi\/h|ft\/s)/i)
        if (convMatch) {
          const targetStr = convMatch[2].trim()
          const targetCurrency = currencyMap[targetStr.toLowerCase()] || targetStr.toUpperCase()
          if (exchangeRates.value[targetCurrency]) {
            const sub = calculateSubWithCurrency(index, allResults, targetCurrency, filter)
            return {
              value: sub,
              display: `${formatResult(sub)} ${targetCurrency}`,
              currency: targetCurrency,
            }
          }
          const sub = calculateSub(index, allResults, filter)
          return { value: sub, display: `${formatResult(sub)} ${targetStr}` }
        }
        const sub = currency
          ? calculateSubWithCurrency(index, allResults, currency, filter)
          : calculateSub(index, allResults, filter)
        const expression = rest.replace(/^/, `${sub} `)
        const result = evaluateMath(expression)
        return { value: result, display: formatResult(result) }
      }

      const subConvMatch = cleanInput.match(
        /^sub\s+(in|as)\s+([a-zA-Z€$£¥₹₽]+\d?|m\/s|km\/h|mi\/h|ft\/s)/i,
      )
      if (subConvMatch) {
        const targetStr = subConvMatch[2].trim()
        const targetCurrency = currencyMap[targetStr.toLowerCase()] || targetStr.toUpperCase()
        if (exchangeRates.value[targetCurrency]) {
          const sub = calculateSubWithCurrency(index, allResults, targetCurrency)
          return {
            value: sub,
            display: `${formatResult(sub)} ${targetCurrency}`,
            currency: targetCurrency,
          }
        }
        const sub = calculateSub(index, allResults)
        return { value: sub, display: `${formatResult(sub)} ${targetStr}` }
      }
      const sub = calculateSub(index, allResults)
      const expression = cleanInput.replace(/^sub\s+/i, `${sub} `)
      const result = evaluateMath(expression)
      return { value: result, display: formatResult(result) }
    }

    // Average
    if (cleanLower === 'average' || cleanLower === 'avg') {
      const avg = calculateAverage(index, allResults)
      return { value: avg, display: formatResult(avg) }
    }
    if (cleanLower.startsWith('average ') || cleanLower.startsWith('avg ')) {
      const avg = calculateAverage(index, allResults)
      const expression = cleanInput.replace(/^(average|avg)\s+/i, `${avg} `)
      const result = evaluateMath(expression)
      return { value: result, display: formatResult(result) }
    }

    // Timezone conversion
    const tzResult = handleTimezoneExpression(cleanInput)
    if (tzResult) return tzResult

    // Date/time handling
    const dateResult = handleDateExpression(cleanInput)
    if (dateResult) return dateResult

    // fromunix
    const fromunixMatch = cleanInput.match(/fromunix\s*\(([^)]+)\)/i)
    if (fromunixMatch) {
      const timestamp = parseFloat(fromunixMatch[1])
      const date = new Date(timestamp * 1000)
      return { value: timestamp, display: date.toLocaleString() }
    }

    // Number format conversion: "X in hex/bin/oct/sci"
    const formatConvMatch = cleanInput.match(
      /^(.+?)\s+in\s+(hex|bin|oct|binary|octal|hexadecimal|sci|scientific)$/i,
    )
    if (formatConvMatch) {
      const sourceExpr = formatConvMatch[1].trim()
      const targetFormat = formatConvMatch[2].toLowerCase()
      try {
        let value
        try {
          value = evaluateMath(sourceExpr)
        } catch (_e) {
          const unitResult = handleUnitExpression(sourceExpr)
          if (unitResult.hasUnit || unitResult.isConverted) value = unitResult.value
          else {
            const currResult = handleCurrencyExpression(sourceExpr)
            value = currResult.hasCurrency ? currResult.value : evaluateMath(sourceExpr)
          }
        }
        const intValue = Math.round(value)
        if (targetFormat === 'hex' || targetFormat === 'hexadecimal')
          return { value, display: `0x${intValue.toString(16).toUpperCase()}` }
        if (targetFormat === 'bin' || targetFormat === 'binary')
          return { value, display: `0b${intValue.toString(2)}` }
        if (targetFormat === 'oct' || targetFormat === 'octal')
          return { value, display: `0o${intValue.toString(8)}` }
        if (targetFormat === 'sci' || targetFormat === 'scientific')
          return { value, display: value.toExponential() }
      } catch (_e) {
        /* fall through */
      }
    }

    // Unit conversion (try before currency since some overlap)
    const unitResult = handleUnitExpression(cleanInput)
    if (unitResult.isConverted || unitResult.hasUnit) {
      return {
        value: unitResult.value,
        display: unitResult.unit
          ? `${formatResult(unitResult.value)} ${unitResult.unit}`
          : formatResult(unitResult.value),
        unit: unitResult.unit || null,
        category: unitResult.category || null,
        hideResult: unitResult.hasUnit && !unitResult.isConverted,
      }
    }

    // Currency
    const currencyResult = handleCurrencyExpression(cleanInput)
    if (currencyResult.isConverted || currencyResult.hasCurrency) {
      // Hide when it's just a simple currency value with no operation (e.g., "$30", "100 EUR", "-£300")
      // Show when there's a conversion or arithmetic (e.g., "$30 in EUR", "$30 + €20", "price * 2")
      // Use lookbehind to only match infix operators (after a digit/letter/symbol), not prefix negation
      const isCurrencyOperation =
        currencyResult.isConverted ||
        /(?<=[\d\w€$£¥₹₽)])\s*[+\-*/]/.test(cleanInput) ||
        /\b(times|multiplied\s+by|mul|plus|minus|subtract|without|divide|divide\s+by|and|with)\b/i.test(
          cleanInput,
        )
      return {
        value: currencyResult.value,
        display: currencyResult.currency
          ? `${formatResult(currencyResult.value)} ${currencyResult.currency}`
          : formatResult(currencyResult.value),
        currency: currencyResult.currency || null,
        hideResult: !isCurrencyOperation,
      }
    }

    // Dimensional analysis: distance / fuel_economy = volume
    // Detect expressions like "varA / varB" where vars have unit metadata
    const divMatch = cleanInput.match(/^([a-zA-Z_]\w*)\s*\/\s*([a-zA-Z_]\w*)$/)
    if (divMatch) {
      const leftVar = variables.value[divMatch[1]]
      const rightVar = variables.value[divMatch[2]]
      if (
        leftVar &&
        rightVar &&
        typeof leftVar === 'object' &&
        typeof rightVar === 'object' &&
        leftVar.unit &&
        rightVar.unit
      ) {
        const dimResult = computeDimensionalDivision(leftVar, rightVar)
        if (dimResult) return dimResult
      }
    }

    // Also handle "varA * varB" for dimensional multiplication
    const mulMatch = cleanInput.match(/^([a-zA-Z_]\w*)\s*\*\s*([a-zA-Z_]\w*)$/)
    if (mulMatch) {
      const leftVar = variables.value[mulMatch[1]]
      const rightVar = variables.value[mulMatch[2]]
      if (
        leftVar &&
        rightVar &&
        typeof leftVar === 'object' &&
        typeof rightVar === 'object' &&
        leftVar.unit &&
        rightVar.unit
      ) {
        const dimResult = computeDimensionalMultiplication(leftVar, rightVar)
        if (dimResult) return dimResult
      }
    }

    // Inline aggregation: replace sum/total/average/avg tokens within larger expressions
    // (standalone cases are handled above; this catches e.g. "Salary - sum", "2 * avg")
    const hasSumToken = /\bsum\b/i.test(cleanInput) && !variables.value['sum']
    const hasTotalToken = /\btotal\b/i.test(cleanInput) && !variables.value['total']
    const hasSubToken = /\bsub\b/i.test(cleanInput) && !variables.value['sub']
    if (hasSumToken || hasTotalToken || hasSubToken) {
      const sumCurrency = detectSumCurrency(index, allResults)
      if (hasSumToken || hasTotalToken) {
        const sumValue = sumCurrency
          ? calculateSumWithCurrency(index, allResults, sumCurrency)
          : calculateSum(index, allResults)
        if (hasSumToken) cleanInput = cleanInput.replace(/\bsum\b/gi, `(${sumValue})`)
        if (hasTotalToken) cleanInput = cleanInput.replace(/\btotal\b/gi, `(${sumValue})`)
      }
      if (hasSubToken) {
        const subValue = sumCurrency
          ? calculateSubWithCurrency(index, allResults, sumCurrency)
          : calculateSub(index, allResults)
        cleanInput = cleanInput.replace(/\bsub\b/gi, `(${subValue})`)
      }
      if (sumCurrency) {
        const result = evaluateMath(handleFunctions(cleanInput))
        return {
          value: result,
          display: `${formatResult(result)} ${sumCurrency}`,
          currency: sumCurrency,
        }
      }
    }
    const hasAvgToken = /\baverage\b/i.test(cleanInput) && !variables.value['average']
    const hasAvgShortToken = /\bavg\b/i.test(cleanInput) && !variables.value['avg']
    if (hasAvgToken || hasAvgShortToken) {
      const avgValue = calculateAverage(index, allResults)
      if (hasAvgToken) cleanInput = cleanInput.replace(/\baverage\b/gi, `(${avgValue})`)
      if (hasAvgShortToken) cleanInput = cleanInput.replace(/\bavg\b/gi, `(${avgValue})`)
    }

    // Regular math
    let expression = handleFunctions(cleanInput)
    const value = evaluateMath(expression)

    // Hide result when input is just a plain number, variable, or constant — no operation performed
    const isPlainNumber = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(cleanInput)
    const isScaledNumber =
      /^-?\d+(\.\d+)?\s*([kK]|M|thousand|thousands|million|millions|billion|billions|trillion|trillions)$/i.test(
        cleanInput,
      )
    const isHexBinOct = /^0[xXbBoO][0-9a-fA-F]+$/.test(cleanInput)
    const isVariableRef =
      /^[a-zA-Z_]\w*$/.test(cleanInput) &&
      (variables.value[cleanInput] !== undefined || /^(pi|e|tau|phi|prev)$/i.test(cleanInput))
    const hideResult = isPlainNumber || isScaledNumber || isHexBinOct || isVariableRef

    return { value, display: formatResult(value), hideResult }
  }

  const clearAll = () => {
    variables.value = {}
    previousResult.value = null
    previousResultCurrency.value = null
  }

  return { evaluateLines, clearAll, fetchExchangeRates, ratesFetched, exchangeRates }
}
