// Core calculator engine for Calc Notes
const variables = ref({})
const previousResult = ref(null)

// Constants
const constants = {
  pi: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
  phi: (1 + Math.sqrt(5)) / 2,
  c: 299792458,
}

// Currency symbols and codes mapping
const currencyMap = {
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '₹': 'INR',
  '₽': 'RUB',
  'C$': 'CAD',
  'A$': 'AUD',
  'usd': 'USD',
  'eur': 'EUR',
  'euro': 'EUR',
  'gbp': 'GBP',
  'pound': 'GBP',
  'pounds': 'GBP',
  'jpy': 'JPY',
  'yen': 'JPY',
  'inr': 'INR',
  'rupee': 'INR',
  'rupees': 'INR',
  'rub': 'RUB',
  'rouble': 'RUB',
  'roubles': 'RUB',
  'cad': 'CAD',
  'aud': 'AUD',
  'chf': 'CHF',
  'cny': 'CNY',
  'yuan': 'CNY',
}

// Exchange rates (base: USD)
const exchangeRates = ref({
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.50,
  INR: 83.12,
  RUB: 92.50,
  CAD: 1.36,
  AUD: 1.52,
  CHF: 0.88,
  CNY: 7.24,
})

// Unit conversion factors (to base unit)
const unitConversions = {
  length: {
    m: 1, meter: 1, meters: 1, metre: 1, metres: 1,
    km: 1000, kilometer: 1000, kilometers: 1000,
    cm: 0.01, centimeter: 0.01, centimeters: 0.01,
    mm: 0.001, millimeter: 0.001, millimeters: 0.001,
    ft: 0.3048, foot: 0.3048, feet: 0.3048,
    inch: 0.0254, inches: 0.0254, in: 0.0254,
    yd: 0.9144, yard: 0.9144, yards: 0.9144,
    mi: 1609.344, mile: 1609.344, miles: 1609.344,
  },
  weight: {
    kg: 1, kilogram: 1, kilograms: 1,
    g: 0.001, gram: 0.001, grams: 0.001,
    mg: 0.000001, milligram: 0.000001, milligrams: 0.000001,
    lb: 0.453592, lbs: 0.453592, pound: 0.453592, pounds: 0.453592,
    oz: 0.0283495, ounce: 0.0283495, ounces: 0.0283495,
    ton: 1000, tons: 1000, tonne: 1000, tonnes: 1000,
    stone: 6.35029, stones: 6.35029,
  },
  volume: {
    l: 1, liter: 1, liters: 1, litre: 1, litres: 1,
    ml: 0.001, milliliter: 0.001, milliliters: 0.001,
    gal: 3.78541, gallon: 3.78541, gallons: 3.78541,
    qt: 0.946353, quart: 0.946353, quarts: 0.946353,
    pt: 0.473176, pint: 0.473176, pints: 0.473176,
    cup: 0.236588, cups: 0.236588,
    floz: 0.0295735,
    tbsp: 0.0147868, tablespoon: 0.0147868,
    tsp: 0.00492892, teaspoon: 0.00492892,
  },
  temperature: {
    celsius: 'C', c: 'C',
    fahrenheit: 'F', f: 'F',
    kelvin: 'K', k: 'K',
  },
  time: {
    s: 1, sec: 1, second: 1, seconds: 1,
    min: 60, minute: 60, minutes: 60,
    h: 3600, hr: 3600, hour: 3600, hours: 3600,
    day: 86400, days: 86400,
    week: 604800, weeks: 604800,
    month: 2592000, months: 2592000,
    year: 31536000, years: 31536000,
  },
  area: {
    'm2': 1, 'sqm': 1,
    'km2': 1000000,
    'cm2': 0.0001,
    'ft2': 0.092903, 'sqft': 0.092903,
    'in2': 0.00064516,
    'yd2': 0.836127,
    'mi2': 2589988,
    'acre': 4046.86, 'acres': 4046.86,
    'hectare': 10000, 'hectares': 10000,
  },
  speed: {
    'mps': 1, 'm/s': 1,
    'kph': 0.277778, 'km/h': 0.277778,
    'mph': 0.44704, 'mi/h': 0.44704,
    'fps': 0.3048, 'ft/s': 0.3048,
    'knot': 0.514444, 'knots': 0.514444,
  },
  data: {
    'bit': 0.125, 'bits': 0.125,
    'B': 1, 'byte': 1, 'bytes': 1,
    'KB': 1000, 'kilobyte': 1000, 'kilobytes': 1000,
    'MB': 1000000, 'megabyte': 1000000, 'megabytes': 1000000,
    'GB': 1000000000, 'gigabyte': 1000000000, 'gigabytes': 1000000000,
    'TB': 1000000000000, 'terabyte': 1000000000000, 'terabytes': 1000000000000,
    'PB': 1000000000000000, 'petabyte': 1000000000000000, 'petabytes': 1000000000000000,
    'KiB': 1024, 'kibibyte': 1024, 'kibibytes': 1024,
    'MiB': 1048576, 'mebibyte': 1048576, 'mebibytes': 1048576,
    'GiB': 1073741824, 'gibibyte': 1073741824, 'gibibytes': 1073741824,
    'TiB': 1099511627776, 'tebibyte': 1099511627776, 'tebibytes': 1099511627776,
  },
  css: {
    'px': 1, 'pixel': 1, 'pixels': 1,
    'pt': 1.333333, 'point': 1.333333, 'points': 1.333333,
    'em': 16, // Default: 1em = 16px
    'rem': 16, // Default: 1rem = 16px
  },
}

// SI prefixes (case-sensitive)
const siPrefixes = {
  // Large
  'Y': 1e24,   // yotta
  'Z': 1e21,   // zetta
  'E': 1e18,   // exa
  'P': 1e15,   // peta
  'T': 1e12,   // tera
  'G': 1e9,    // giga
  'M': 1e6,    // mega
  'k': 1e3,    // kilo
  'h': 1e2,    // hecto
  'da': 1e1,   // deca
  // Small
  'd': 1e-1,   // deci
  'c': 1e-2,   // centi
  'm': 1e-3,   // milli
  'μ': 1e-6,   // micro
  'u': 1e-6,   // micro (alternative)
  'n': 1e-9,   // nano
  'p': 1e-12,  // pico
  'f': 1e-15,  // femto
  'a': 1e-18,  // atto
  'z': 1e-21,  // zepto
  'y': 1e-24,  // yocto
}

// Long form SI prefixes
const siPrefixesLong = {
  'yotta': 1e24,
  'zetta': 1e21,
  'exa': 1e18,
  'peta': 1e15,
  'tera': 1e12,
  'giga': 1e9,
  'mega': 1e6,
  'kilo': 1e3,
  'hecto': 1e2,
  'deca': 1e1,
  'deci': 1e-1,
  'centi': 1e-2,
  'milli': 1e-3,
  'micro': 1e-6,
  'nano': 1e-9,
  'pico': 1e-12,
  'femto': 1e-15,
  'atto': 1e-18,
  'zepto': 1e-21,
  'yocto': 1e-24,
}

// Base units that support SI prefixes
const siBaseUnits = ['m', 'meter', 'metre', 'g', 'gram', 'l', 'liter', 'litre', 'B', 'byte', 's', 'second']

export const useCalculator = () => {

  const evaluateLines = (inputLines) => {
    // Reset state
    variables.value = {}
    previousResult.value = null

    const results = []

    inputLines.forEach((input, index) => {
      const line = { input: input.trim(), result: null, error: null, type: 'calculation' }
      evaluateLine(line, index, results)
      results.push(line)
    })

    return results
  }

  const evaluateLine = (line, index, allResults) => {
    const input = line.input

    if (!input) {
      return
    }

    // Header
    if (input.startsWith('#')) {
      line.type = 'header'
      return
    }

    // Comment
    if (input.startsWith('//')) {
      line.type = 'comment'
      return
    }

    // Label with calculation
    const labelMatch = input.match(/^([^:]+):\s*(.+)$/)
    if (labelMatch && labelMatch[2]) {
      line.type = 'label'
      const expression = labelMatch[2].trim()

      try {
        const result = evaluateExpression(expression, index, allResults)
        line.result = result.display
        previousResult.value = result.value
      } catch (error) {
        // Silent - don't show errors
      }
      return
    }

    // Label without calculation
    if (input.endsWith(':')) {
      line.type = 'label'
      return
    }

    line.type = 'calculation'

    try {
      const result = evaluateExpression(input, index, allResults)
      line.result = result.display
      previousResult.value = result.value
    } catch (error) {
      // Silent - don't show errors
    }
  }

  const evaluateExpression = (input, index, allResults) => {
    const inputLower = input.toLowerCase().trim()

    // Sum operator (exact match only)
    if (inputLower === 'sum') {
      const sum = calculateSum(index, allResults)
      return { value: sum, display: formatResult(sum) }
    }

    // Sum with operations: "sum - 10%", "sum + 5", etc.
    if (inputLower.startsWith('sum ')) {
      const sum = calculateSum(index, allResults)
      // Replace sum with the actual value
      const expression = input.replace(/^sum\s+/i, `${sum} `)
      const result = evaluateMath(expression)
      return { value: result, display: formatResult(result) }
    }

    // Sum with currency/unit: "sum in USD", "sum in kg"
    const sumMatch = input.match(/^sum\s+(in|as)\s+([a-zA-Z€$£¥₹₽]+\d?|m\/s|km\/h|mi\/h|ft\/s)$/i)
    if (sumMatch) {
      const targetStr = sumMatch[2].trim()
      const targetCurrency = currencyMap[targetStr.toLowerCase()] || targetStr.toUpperCase()

      if (exchangeRates.value[targetCurrency]) {
        const sum = calculateSumWithCurrency(index, allResults, targetCurrency)
        return { value: sum, display: `${formatResult(sum)} ${targetCurrency}` }
      }

      const sum = calculateSum(index, allResults)
      return { value: sum, display: `${formatResult(sum)} ${targetStr}` }
    }

    // Average operator (exact match only)
    if (inputLower === 'average' || inputLower === 'avg') {
      const avg = calculateAverage(index, allResults)
      return { value: avg, display: formatResult(avg) }
    }

    // Average with operations
    if (inputLower.startsWith('average ') || inputLower.startsWith('avg ')) {
      const avg = calculateAverage(index, allResults)
      const expression = input.replace(/^(average|avg)\s+/i, `${avg} `)
      const result = evaluateMath(expression)
      return { value: result, display: formatResult(result) }
    }

    // Helper function to get date value from keyword
    const getDateFromKeyword = (keyword) => {
      const kw = keyword.toLowerCase().trim()
      const date = new Date()

      if (kw === 'now' || kw === 'time') {
        return date.getTime()
      }

      date.setHours(0, 0, 0, 0)

      if (kw === 'today') return date.getTime()

      if (kw === 'yesterday') {
        date.setDate(date.getDate() - 1)
        return date.getTime()
      }

      if (kw === 'tomorrow') {
        date.setDate(date.getDate() + 1)
        return date.getTime()
      }

      if (kw === 'next week') {
        date.setDate(date.getDate() + 7)
        return date.getTime()
      }

      if (kw === 'last week') {
        date.setDate(date.getDate() - 7)
        return date.getTime()
      }

      if (kw === 'next month') {
        date.setMonth(date.getMonth() + 1)
        return date.getTime()
      }

      if (kw === 'last month') {
        date.setMonth(date.getMonth() - 1)
        return date.getTime()
      }

      if (kw === 'next year') {
        date.setFullYear(date.getFullYear() + 1)
        return date.getTime()
      }

      if (kw === 'last year') {
        date.setFullYear(date.getFullYear() - 1)
        return date.getTime()
      }

      return null
    }

    // Check if input contains date keywords or time periods
    const dateKeywords = ['now', 'time', 'today', 'yesterday', 'tomorrow', 'next week', 'last week', 'next month', 'last month', 'next year', 'last year']
    const hasDateKeyword = dateKeywords.some(kw => input.toLowerCase().includes(kw))
    const hasTimePeriod = /\d+\s*(second|seconds|sec|minute|minutes|min|hour|hours|h|day|days|d|week|weeks|w|month|months|year|years|y)\b/i.test(input)

    if (hasDateKeyword || hasTimePeriod) {
      // Determine if this is a date calculation or duration calculation
      // If it has date keywords, it's a date calculation
      // If it only has time periods, it's a duration calculation
      const isDateCalculation = hasDateKeyword

      // Replace all date keywords with their timestamp values
      let expression = input

      // Sort by length (longest first) to avoid partial matches
      const sortedKeywords = [...dateKeywords].sort((a, b) => b.length - a.length)

      for (const keyword of sortedKeywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
        const matches = expression.match(regex)
        if (matches) {
          matches.forEach(() => {
            const timestamp = getDateFromKeyword(keyword)
            if (timestamp !== null) {
              expression = expression.replace(regex, `(${timestamp})`)
            }
          })
        }
      }

      // Convert time periods to milliseconds (handle both singular and plural)
      expression = expression.replace(/(\d+(?:\.\d+)?)\s*(second|seconds|sec|minute|minutes|min|hour|hours|h|day|days|d|week|weeks|w|month|months|year|years|y)\b/gi, (match, amount, unit) => {
        const num = parseFloat(amount)
        const u = unit.toLowerCase()

        let milliseconds = 0
        if (u === 'second' || u === 'seconds' || u === 'sec') milliseconds = num * 1000
        else if (u === 'minute' || u === 'minutes' || u === 'min') milliseconds = num * 60000
        else if (u === 'hour' || u === 'hours' || u === 'h') milliseconds = num * 3600000
        else if (u === 'day' || u === 'days' || u === 'd') milliseconds = num * 86400000
        else if (u === 'week' || u === 'weeks' || u === 'w') milliseconds = num * 604800000
        else if (u === 'month' || u === 'months') milliseconds = num * 2592000000
        else if (u === 'year' || u === 'years' || u === 'y') milliseconds = num * 31536000000

        return `(${milliseconds})`
      })

      // Now evaluate the expression as math
      try {
        const result = evaluateMath(expression)

        if (isDateCalculation) {
          // Return as a date
          const resultDate = new Date(result)
          return { value: result, display: resultDate.toLocaleString() }
        } else {
          // Return as a duration (convert back to appropriate unit)
          const totalMs = result
          const totalSeconds = totalMs / 1000
          const totalMinutes = totalSeconds / 60
          const totalHours = totalMinutes / 60
          const totalDays = totalHours / 24
          const totalWeeks = totalDays / 7
          const totalMonths = totalDays / 30
          const totalYears = totalDays / 365

          // Choose the most appropriate unit (prefer whole numbers)
          if (totalYears >= 1 && Number.isInteger(totalYears)) {
            return { value: result, display: `${totalYears} ${totalYears === 1 ? 'year' : 'years'}` }
          } else if (totalMonths >= 1 && Number.isInteger(totalMonths)) {
            return { value: result, display: `${totalMonths} ${totalMonths === 1 ? 'month' : 'months'}` }
          } else if (totalWeeks >= 1 && Number.isInteger(totalWeeks)) {
            return { value: result, display: `${totalWeeks} ${totalWeeks === 1 ? 'week' : 'weeks'}` }
          } else if (totalDays >= 1 && Number.isInteger(totalDays)) {
            return { value: result, display: `${totalDays} ${totalDays === 1 ? 'day' : 'days'}` }
          } else if (totalHours >= 1 && Number.isInteger(totalHours)) {
            return { value: result, display: `${totalHours} ${totalHours === 1 ? 'hour' : 'hours'}` }
          } else if (totalMinutes >= 1 && Number.isInteger(totalMinutes)) {
            return { value: result, display: `${totalMinutes} ${totalMinutes === 1 ? 'minute' : 'minutes'}` }
          } else if (totalSeconds >= 1 && Number.isInteger(totalSeconds)) {
            return { value: result, display: `${totalSeconds} ${totalSeconds === 1 ? 'second' : 'seconds'}` }
          } else {
            // Default to days with decimal if nothing else fits
            return { value: result, display: `${formatResult(totalDays)} days` }
          }
        }
      } catch (e) {
        // If math evaluation fails, try simple date keyword
        const inputLower = input.toLowerCase().trim()
        const timestamp = getDateFromKeyword(inputLower)
        if (timestamp !== null) {
          const date = new Date(timestamp)
          return { value: timestamp, display: inputLower === 'now' || inputLower === 'time' ? date.toLocaleString() : date.toLocaleDateString() }
        }
      }
    }

    // fromunix function
    const fromunixMatch = input.match(/fromunix\s*\(([^)]+)\)/i)
    if (fromunixMatch) {
      const timestamp = parseFloat(fromunixMatch[1])
      const date = new Date(timestamp * 1000) // Unix timestamp is in seconds
      return { value: timestamp, display: date.toLocaleString() }
    }

    // Variable assignment
    if (input.includes('=') && !input.includes('==') && !input.includes('<=') && !input.includes('>=')) {
      const parts = input.split('=')
      if (parts.length === 2) {
        const varName = parts[0].trim()
        const expression = parts[1].trim()

        if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) {
          // Check if the expression is a standalone percentage (e.g., "20%")
          const percentMatch = expression.match(/^(\d+(?:\.\d+)?)\s*%$/)
          if (percentMatch) {
            const percentValue = parseFloat(percentMatch[1])
            // Store the percentage as a string so it can be used in expressions
            variables.value[varName] = `${percentValue}%`
            return { value: percentValue, display: `${percentValue}%` }
          }

          const result = evaluateExpression(expression, index, allResults)

          // Store value with metadata (currency, unit, etc.)
          // Check if result has currency or unit information
          if (result.display && result.display.includes(' ')) {
            const parts = result.display.split(' ')
            const lastPart = parts[parts.length - 1]

            // Check if it's a currency
            if (exchangeRates.value[lastPart]) {
              variables.value[varName] = { value: result.value, currency: lastPart }
            } else {
              variables.value[varName] = result.value
            }
          } else {
            variables.value[varName] = result.value
          }

          return result
        }
      }
    }
    // Unit conversion
    const unitResult = handleUnitExpression(input)
    if (unitResult.isConverted || unitResult.hasUnit) {
      return {
        value: unitResult.value,
        display: unitResult.unit ? `${formatResult(unitResult.value)} ${unitResult.unit}` : formatResult(unitResult.value)
      }
    }

    // Currency
    const currencyResult = handleCurrencyExpression(input)
    if (currencyResult.isConverted || currencyResult.hasCurrency) {
      return {
        value: currencyResult.value,
        display: currencyResult.currency ? `${formatResult(currencyResult.value)} ${currencyResult.currency}` : formatResult(currencyResult.value)
      }
    }

    // Regular math
    let expression = input.toLowerCase()

    // Handle functions first
    expression = handleFunctions(expression)

    const value = evaluateMath(expression)
    return { value, display: formatResult(value) }
  }

  const calculateSum = (currentIndex, allResults) => {
    let sum = 0
    for (let i = currentIndex - 1; i >= 0; i--) {
      const line = allResults[i]
      if (!line || !line.input.trim()) break
      if (line.result && !isNaN(parseFloat(line.result))) {
        sum += parseFloat(line.result)
      }
    }
    return sum
  }

  const calculateSumWithCurrency = (currentIndex, allResults, targetCurrency) => {
    let sum = 0
    for (let i = currentIndex - 1; i >= 0; i--) {
      const line = allResults[i]
      if (!line || !line.input.trim()) break

      if (line.result) {
        const resultMatch = line.result.match(/^([\d.]+)\s*([A-Z]{3})?$/)
        if (resultMatch) {
          const value = parseFloat(resultMatch[1])
          const currency = resultMatch[2]

          if (currency && targetCurrency) {
            try {
              const converted = convertCurrency(value, currency, targetCurrency)
              sum += converted
            } catch (e) {
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

  const calculateAverage = (currentIndex, allResults) => {
    let sum = 0
    let count = 0
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

  const evaluateMath = (expr) => {
    let expression = expr.toLowerCase()

    // Replace word operators
    expression = expression
      .replace(/\bplus\b/g, '+')
      .replace(/\band\b/g, '+')
      .replace(/\bwith\b/g, '+')
      .replace(/\bminus\b/g, '-')
      .replace(/\bsubtract\b/g, '-')
      .replace(/\bwithout\b/g, '-')
      .replace(/\btimes\b/g, '*')
      .replace(/\bmultiplied by\b/g, '*')
      .replace(/\bmul\b/g, '*')
      .replace(/\bdivide by\b/g, '/')
      .replace(/\bdivide\b/g, '/')
      .replace(/\bmod\b/g, '%')
      .replace(/\bxor\b/g, '^')

    // Replace constants
    expression = expression.replace(/\bpi\b/g, `(${constants.pi})`)
    expression = expression.replace(/\be\b/g, `(${constants.e})`)
    expression = expression.replace(/\btau\b/g, `(${constants.tau})`)
    expression = expression.replace(/\bphi\b/g, `(${constants.phi})`)

    // Replace prev
    if (expression.includes('prev') && previousResult.value !== null) {
      expression = expression.replace(/\bprev\b/g, `(${previousResult.value})`)
    }

    // Replace variables (handle percentage strings and objects specially)
    for (const [varName, value] of Object.entries(variables.value)) {
      const regex = new RegExp(`\\b${varName}\\b`, 'gi')
      // If the value is a percentage string, keep it as percentage for now
      // The percentage handling will process it correctly based on context
      if (typeof value === 'string' && value.endsWith('%')) {
        expression = expression.replace(regex, value)
      } else if (typeof value === 'object' && value.value !== undefined) {
        // If it's an object with value property, use the numeric value
        expression = expression.replace(regex, `(${value.value})`)
      } else {
        expression = expression.replace(regex, `(${value})`)
      }
    }

    // Handle percentages first
    expression = handlePercentages(expression)

    // After percentage handling, convert any remaining standalone percentages to decimals
    // This handles cases like "5% / 12" where the percentage isn't part of a special pattern
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*%/g, (_, num) => {
      return `(${num} / 100)`
    })

    // Handle exponentiation (convert ^ to **)
    expression = expression.replace(/\^/g, '**')

    // Handle bitwise operations (need to be done before evaluation)
    // Convert to a format that JavaScript can evaluate
    expression = expression
      .replace(/<<(?!=)/g, '<<')  // Left shift
      .replace(/>>(?!=)/g, '>>')  // Right shift
      .replace(/&(?!=)/g, '&')    // Bitwise AND
      .replace(/\|(?!=)/g, '|')   // Bitwise OR

    // Evaluate
    const cleanExpr = expression.replace(/\s/g, '')

    try {
      const result = new Function(`return ${cleanExpr}`)()
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Invalid result')
      }
      return result
    } catch {
      throw new Error('Invalid expression')
    }
  }

  const handleFunctions = (expr) => {
    let expression = expr

    expression = expression.replace(/sqrt\s*\(([^)]+)\)/g, (_, arg) => {
      const argValue = evaluateMathSimple(arg)
      return Math.sqrt(argValue).toString()
    })
    expression = expression.replace(/cbrt\s*\(([^)]+)\)/g, (_, arg) => {
      const argValue = evaluateMathSimple(arg)
      return Math.cbrt(argValue).toString()
    })
    expression = expression.replace(/abs\s*\(([^)]+)\)/g, (_, arg) => {
      const argValue = evaluateMathSimple(arg)
      return Math.abs(argValue).toString()
    })
    expression = expression.replace(/log\s*\(([^)]+)\)/g, (_, arg) => {
      const argValue = evaluateMathSimple(arg)
      return Math.log10(argValue).toString()
    })
    expression = expression.replace(/ln\s*\(([^)]+)\)/g, (_, arg) => {
      const argValue = evaluateMathSimple(arg)
      return Math.log(argValue).toString()
    })
    expression = expression.replace(/fact\s*\(([^)]+)\)/g, (_, arg) => {
      const argValue = evaluateMathSimple(arg)
      const n = Math.floor(argValue)
      let result = 1
      for (let i = 2; i <= n; i++) result *= i
      return result.toString()
    })
    expression = expression.replace(/round\s*\(([^)]+)\)/g, (_, arg) => {
      const argValue = evaluateMathSimple(arg)
      return Math.round(argValue).toString()
    })
    expression = expression.replace(/ceil\s*\(([^)]+)\)/g, (_, arg) => {
      const argValue = evaluateMathSimple(arg)
      return Math.ceil(argValue).toString()
    })
    expression = expression.replace(/floor\s*\(([^)]+)\)/g, (_, arg) => {
      const argValue = evaluateMathSimple(arg)
      return Math.floor(argValue).toString()
    })
    expression = expression.replace(/sin\s*\(([^)]+)\)/g, (_, arg) => {
      const hasDegreesSymbol = arg.includes('°')
      const cleanArg = arg.replace('°', '')
      const value = evaluateMathSimple(cleanArg)
      const radians = hasDegreesSymbol ? (value * Math.PI) / 180 : value
      return Math.sin(radians).toString()
    })
    expression = expression.replace(/cos\s*\(([^)]+)\)/g, (_, arg) => {
      const hasDegreesSymbol = arg.includes('°')
      const cleanArg = arg.replace('°', '')
      const value = evaluateMathSimple(cleanArg)
      const radians = hasDegreesSymbol ? (value * Math.PI) / 180 : value
      return Math.cos(radians).toString()
    })
    expression = expression.replace(/tan\s*\(([^)]+)\)/g, (_, arg) => {
      const hasDegreesSymbol = arg.includes('°')
      const cleanArg = arg.replace('°', '')
      const value = evaluateMathSimple(cleanArg)
      const radians = hasDegreesSymbol ? (value * Math.PI) / 180 : value
      return Math.tan(radians).toString()
    })

    return expression
  }

  const evaluateMathSimple = (expr) => {
    const cleanExpr = expr.replace(/\s/g, '')
    try {
      const result = new Function(`return ${cleanExpr}`)()
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Invalid result')
      }
      return result
    } catch {
      throw new Error('Invalid expression')
    }
  }

  const handlePercentages = (expr) => {
    let expression = expr

    // X% of Y (explicit percentage calculation - always means X% of Y)
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\([^)]+\)|\d+(?:\.\d+)?)/g, (_, percent, value) => {
      return `((${percent} / 100) * ${value})`
    })

    // X% on Y (contextual - adds X% of Y to Y)
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*%\s*on\s*(\([^)]+\)|\d+(?:\.\d+)?)/g, (_, percent, value) => {
      return `(${value} + (${value} * ${percent} / 100))`
    })

    // X% off Y (contextual - subtracts X% of Y from Y)
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*%\s*off\s*(\([^)]+\)|\d+(?:\.\d+)?)/g, (_, percent, value) => {
      return `(${value} - (${value} * ${percent} / 100))`
    })

    // Handle X + Y% (contextual: adds Y% of X to X)
    expression = expression.replace(/(\([^)]+\)|\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)\s*%/g, (_, base, percent) => {
      return `(${base} + (${base} * ${percent} / 100))`
    })

    // Handle X - Y% (contextual: subtracts Y% of X from X)
    expression = expression.replace(/(\([^)]+\)|\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*%/g, (_, base, percent) => {
      return `(${base} - (${base} * ${percent} / 100))`
    })

    // Handle X * Y% (literal: multiply X by Y as a percentage, i.e., X * Y/100)
    // This is standard calculator behavior: 100 * 5% = 5
    expression = expression.replace(/(\([^)]+\)|\d+(?:\.\d+)?)\s*\*\s*(\d+(?:\.\d+)?)\s*%/g, (_, base, percent) => {
      return `(${base} * ${percent} / 100)`
    })

    // Handle X / Y% (literal: divide X by Y as a percentage, i.e., X / (Y/100))
    // This is standard calculator behavior: 100 / 5% = 2000
    expression = expression.replace(/(\([^)]+\)|\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*%/g, (_, base, percent) => {
      return `(${base} / (${percent} / 100))`
    })

    return expression
  }

  const findUnitCategory = (unit) => {
    // First try exact match
    for (const [category, units] of Object.entries(unitConversions)) {
      if (units[unit]) {
        return { category, factor: units[unit] }
      }
    }

    // Try case-insensitive match
    const unitLower = unit.toLowerCase()
    for (const [category, units] of Object.entries(unitConversions)) {
      if (units[unitLower]) {
        return { category, factor: units[unitLower] }
      }
    }

    // Try SI prefix parsing (case-sensitive)
    // Check short prefixes (k, M, G, etc.)
    for (const baseUnit of siBaseUnits) {
      // Try each SI prefix
      for (const [prefix, multiplier] of Object.entries(siPrefixes)) {
        if (unit === prefix + baseUnit) {
          // Find the base unit's category and factor
          for (const [category, units] of Object.entries(unitConversions)) {
            if (units[baseUnit]) {
              const baseFactor = units[baseUnit]
              // Special handling for temperature (no SI prefixes)
              if (typeof baseFactor === 'string') continue
              return { category, factor: baseFactor * multiplier }
            }
          }
        }
      }

      // Try long form prefixes (kilo, mega, giga, etc.)
      for (const [prefix, multiplier] of Object.entries(siPrefixesLong)) {
        const longUnit = baseUnit + 's' // plural form
        if (unit.toLowerCase() === prefix + baseUnit || unit.toLowerCase() === prefix + longUnit) {
          for (const [category, units] of Object.entries(unitConversions)) {
            if (units[baseUnit]) {
              const baseFactor = units[baseUnit]
              if (typeof baseFactor === 'string') continue
              return { category, factor: baseFactor * multiplier }
            }
          }
        }
      }
    }

    return null
  }

  const convertUnit = (value, fromUnit, toUnit) => {
    const fromInfo = findUnitCategory(fromUnit)
    const toInfo = findUnitCategory(toUnit)

    if (!fromInfo || !toInfo) {
      throw new Error(`Unknown unit`)
    }

    if (fromInfo.category !== toInfo.category) {
      throw new Error(`Cannot convert units`)
    }

    if (fromInfo.category === 'temperature') {
      return convertTemperature(value, fromInfo.factor, toInfo.factor)
    }

    const baseValue = value * fromInfo.factor
    return baseValue / toInfo.factor
  }

  const convertTemperature = (value, from, to) => {
    let celsius
    if (from === 'C') celsius = value
    else if (from === 'F') celsius = (value - 32) * 5 / 9
    else if (from === 'K') celsius = value - 273.15

    if (to === 'C') return celsius
    if (to === 'F') return celsius * 9 / 5 + 32
    if (to === 'K') return celsius + 273.15

    return value
  }

  const parseUnit = (text) => {
    const pattern = /(\d+(?:\.\d+)?)\s*([a-zA-Z]+\d?|m\/s|km\/h|mi\/h|ft\/s)/gi
    const matches = []

    let match
    while ((match = pattern.exec(text)) !== null) {
      const value = parseFloat(match[1])
      const unit = match[2]
      const unitInfo = findUnitCategory(unit)

      if (unitInfo) {
        matches.push({
          value,
          unit,
          category: unitInfo.category,
          match: match[0],
          index: match.index,
          length: match[0].length
        })
      }
    }

    return matches
  }

  const handleUnitExpression = (expr) => {
    const conversionPattern = /(.+?)\s+(in|into|as|to)\s+([a-zA-Z]+\d?|m\/s|km\/h|mi\/h|ft\/s)\s*$/i
    const conversionMatch = expr.match(conversionPattern)

    if (conversionMatch) {
      const sourceExpr = conversionMatch[1].trim()
      const targetUnit = conversionMatch[3].trim()

      const unitMatches = parseUnit(sourceExpr)

      if (unitMatches.length > 0) {
        if (unitMatches.length === 1 && sourceExpr === unitMatches[0].match) {
          const converted = convertUnit(unitMatches[0].value, unitMatches[0].unit, targetUnit)
          return { value: converted, unit: targetUnit, isConverted: true }
        }

        let workingExpr = sourceExpr
        let offset = 0

        unitMatches.sort((a, b) => a.index - b.index)
        unitMatches.forEach(m => {
          const adjustedIndex = m.index + offset
          const before = workingExpr.substring(0, adjustedIndex)
          const after = workingExpr.substring(adjustedIndex + m.length)
          const replacement = m.value.toString()

          workingExpr = before + replacement + after
          offset += replacement.length - m.length
        })

        const result = evaluateMath(workingExpr)
        const converted = convertUnit(result, unitMatches[0].unit, targetUnit)
        return { value: converted, unit: targetUnit, isConverted: true }
      }
    }

    const unitMatches = parseUnit(expr)

    if (unitMatches.length === 0) {
      return { expression: expr, unit: null, hasUnit: false }
    }

    let workingExpr = expr
    let offset = 0

    unitMatches.sort((a, b) => a.index - b.index)
    unitMatches.forEach(m => {
      const adjustedIndex = m.index + offset
      const before = workingExpr.substring(0, adjustedIndex)
      const after = workingExpr.substring(adjustedIndex + m.length)
      const replacement = m.value.toString()

      workingExpr = before + replacement + after
      offset += replacement.length - m.length
    })

    const result = evaluateMath(workingExpr)
    const unit = unitMatches[0].unit

    return { value: result, expression: workingExpr, unit: unit, hasUnit: true }
  }

  const parseCurrency = (text) => {
    const patterns = [
      { regex: /([€$£¥₹₽])(\d+(?:\.\d+)?)/g, symbolFirst: true },
      { regex: /(\d+(?:\.\d+)?)\s*([€$£¥₹₽])/g, symbolFirst: false },
      { regex: /(C\$|A\$)(\d+(?:\.\d+)?)/g, symbolFirst: true },
      { regex: /(\d+(?:\.\d+)?)\s*(USD|EUR|GBP|JPY|INR|RUB|CAD|AUD|CHF|CNY|usd|eur|gbp|jpy|inr|rub|cad|aud|chf|cny|euro|pound|pounds|yen|rupee|rupees|rouble|roubles|yuan)\b/gi, symbolFirst: false },
    ]

    const matches = []
    const seenIndices = new Set()

    // First, check for currency symbol followed by variable name (e.g., $var_name)
    const varPattern = /([€$£¥₹₽])([a-zA-Z_][a-zA-Z0-9_]*)/g
    let varMatch
    while ((varMatch = varPattern.exec(text)) !== null) {
      const currencySymbol = varMatch[1]
      const varName = varMatch[2]

      // Check if this variable exists
      if (variables.value[varName] !== undefined) {
        const varValue = variables.value[varName]
        // Get the numeric value (handle both plain numbers and objects)
        const numericValue = typeof varValue === 'object' && varValue.value !== undefined
          ? varValue.value
          : (typeof varValue === 'string' && !varValue.endsWith('%') ? parseFloat(varValue) : varValue)

        if (typeof numericValue === 'number' && !isNaN(numericValue)) {
          const currencyKey = currencySymbol.toLowerCase()
          const currency = currencyMap[currencyKey] || currencySymbol.toUpperCase()

          matches.push({
            value: numericValue,
            currency,
            match: varMatch[0],
            index: varMatch.index,
            length: varMatch[0].length
          })
          seenIndices.add(varMatch.index)
        }
      }
    }

    for (const pattern of patterns) {
      let match
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags)
      while ((match = regex.exec(text)) !== null) {
        // Skip if we've already matched this position
        if (seenIndices.has(match.index)) continue

        const fullMatch = match[0]
        const numMatch = fullMatch.match(/\d+(?:\.\d+)?/)
        const currMatch = fullMatch.match(/[€$£¥₹₽]|C\$|A\$|[a-zA-Z]+/)

        if (numMatch && currMatch) {
          const value = parseFloat(numMatch[0])
          const currencyKey = currMatch[0].toLowerCase()
          const currency = currencyMap[currencyKey] || currMatch[0].toUpperCase()

          matches.push({
            value,
            currency,
            match: fullMatch,
            index: match.index,
            length: fullMatch.length
          })
          seenIndices.add(match.index)
        }
      }
    }

    return matches
  }

  const convertCurrency = (amount, fromCurrency, toCurrency) => {
    if (!exchangeRates.value[fromCurrency] || !exchangeRates.value[toCurrency]) {
      throw new Error(`Unknown currency`)
    }

    const inUSD = amount / exchangeRates.value[fromCurrency]
    return inUSD * exchangeRates.value[toCurrency]
  }

  const handleCurrencyExpression = (expr) => {
    const conversionPattern = /(.+?)\s+(in|into|as|to)\s+([a-zA-Z€$£¥₹₽]+)\s*$/i
    const conversionMatch = expr.match(conversionPattern)

    if (conversionMatch) {
      const sourceExpr = conversionMatch[1].trim()
      const targetCurrencyStr = conversionMatch[3].trim()
      const targetCurrency = currencyMap[targetCurrencyStr.toLowerCase()] || targetCurrencyStr.toUpperCase()

      // Check if sourceExpr is a variable with currency metadata
      const varData = variables.value[sourceExpr]
      if (varData && typeof varData === 'object' && varData.currency) {
        const converted = convertCurrency(varData.value, varData.currency, targetCurrency)
        return { value: converted, currency: targetCurrency, isConverted: true, hasCurrency: true }
      }

      const sourceResult = handleCurrencyExpression(sourceExpr)

      if (sourceResult.hasCurrency && sourceResult.currency) {
        const converted = convertCurrency(sourceResult.value, sourceResult.currency, targetCurrency)
        return { value: converted, currency: targetCurrency, isConverted: true, hasCurrency: true }
      }
    }

    const currencyMatches = parseCurrency(expr)

    if (currencyMatches.length === 0) {
      return { expression: expr, currency: null, hasCurrency: false }
    }

    let workingExpr = expr
    let offset = 0
    const currencies = new Set()

    currencyMatches.sort((a, b) => a.index - b.index)

    currencyMatches.forEach(m => {
      const adjustedIndex = m.index + offset
      const before = workingExpr.substring(0, adjustedIndex)
      const after = workingExpr.substring(adjustedIndex + m.length)
      const replacement = m.value.toString()

      workingExpr = before + replacement + after
      offset += replacement.length - m.length
      currencies.add(m.currency)
    })

    const result = evaluateMath(workingExpr)
    const currency = currencyMatches[0].currency

    return { value: result, expression: workingExpr, currency: currency, hasCurrency: true }
  }

  const formatResult = (value) => {
    if (Number.isInteger(value)) {
      return value.toString()
    }

    const rounded = Math.round(value * 10000000000) / 10000000000

    if (Math.abs(rounded) >= 1e10 || (Math.abs(rounded) < 1e-6 && rounded !== 0)) {
      return rounded.toExponential(6)
    }

    return rounded.toString()
  }

  const clearAll = () => {
    variables.value = {}
    previousResult.value = null
  }

  return {
    evaluateLines,
    clearAll,
  }
}
