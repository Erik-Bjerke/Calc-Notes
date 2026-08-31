// Currency parsing, conversion, and exchange rate fetching
import {
  currencyMap,
  exchangeRates,
  ratesFetched,
  variables,
  previousResult,
  previousResultCurrency,
} from './constants'
import { SCALE_SUFFIX, SCALED_NUM_RE, applyScale } from './scales'
import { evaluateMath } from './math'

// Regex for matching code-based currency amounts like "56 EUR", "2k usd", "1.5M gbp", "56EUR"
const CODE_CURRENCY_RE =
  /(\d+(?:\.\d+)?)\s*([kK]|M|thousand|thousands|million|millions|billion|billions|trillion|trillions)?\s*([a-zA-Z]+)/g

// Replace code-based currency amounts (e.g. "56 EUR") with their USD value in an expression
const replaceCodeCurrencies = (expr, targetCurrency) => {
  return expr.replace(CODE_CURRENCY_RE, (match, num, scale, code) => {
    const currency = currencyMap[code.toLowerCase()] || code.toUpperCase()
    if (exchangeRates.value[currency]) {
      const val = applyScale(num, scale)
      if (targetCurrency && currency === targetCurrency) return `(${val})`
      const usdVal = val / exchangeRates.value[currency]
      return `(${usdVal})`
    }
    return match
  })
}

// Find all code-based currency matches in an expression
const findCodeCurrencyMatches = (input) => {
  const matches = []
  const re = new RegExp(CODE_CURRENCY_RE.source, 'g')
  let m
  while ((m = re.exec(input)) !== null) {
    const code = m[3]
    const currency = currencyMap[code.toLowerCase()] || code.toUpperCase()
    if (exchangeRates.value[currency]) {
      matches.push({ value: applyScale(m[1], m[2]), currency })
    }
  }
  return matches
}

// Fetch live exchange rates
export const fetchExchangeRates = async () => {
  const tryFetch = async (url) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  const applyRates = (rates) => {
    rates.USD = 1
    exchangeRates.value = rates
    ratesFetched.value = true
  }

  // Primary: ExchangeRate-API (base USD)
  try {
    const data = await tryFetch('https://open.er-api.com/v6/latest/USD')
    if (data?.result === 'success' && data?.rates) {
      applyRates({ ...data.rates })
      return
    }
  } catch {
    /* fall through to secondary */
  }

  // Secondary: fawazahmed0/exchange-api
  const fawazPrimary = 'https://latest.currency-api.pages.dev/v1/currencies/usd.min.json'
  const fawazFallback =
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json'

  try {
    let data
    try {
      data = await tryFetch(fawazPrimary)
    } catch {
      data = await tryFetch(fawazFallback)
    }

    if (data?.usd) {
      const rates = {}
      for (const [code, rate] of Object.entries(data.usd)) {
        rates[code.toUpperCase()] = rate
      }
      applyRates(rates)
      return
    }
  } catch {
    /* fall through */
  }

  console.warn('Failed to fetch exchange rates from all providers, using hardcoded fallback values')
}

export const parseCurrency = (input) => {
  // "$30", "€50", "£100", "$2k", "€1.5M", "$3 million"
  const symbolScaleRe = new RegExp(`^([€$£¥₹₽])\\s*${SCALED_NUM_RE}(.*)$`)
  const symbolMatch = input.match(symbolScaleRe)
  if (symbolMatch) {
    const currency = currencyMap[symbolMatch[1]]
    const value = applyScale(symbolMatch[2], symbolMatch[3])
    const rest = symbolMatch[4].trim()
    return { value, currency, rest }
  }

  // "3€", "50£", "2k€", "1.5M€" (postfix symbol)
  const postfixSymbolRe = new RegExp(`^${SCALED_NUM_RE}\\s*([€$£¥₹₽])(.*)$`)
  const postfixMatch = input.match(postfixSymbolRe)
  if (postfixMatch) {
    const currency = currencyMap[postfixMatch[3]]
    const value = applyScale(postfixMatch[1], postfixMatch[2])
    const rest = postfixMatch[4].trim()
    return { value, currency, rest }
  }

  // "100 USD", "50 EUR", "2k EUR", "1.5M usd", "3 million eur", "100EUR"
  const codeScaleRe = new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*(${SCALE_SUFFIX})?\\s*([a-zA-Z]+)(.*)$`)
  const codeMatch = input.match(codeScaleRe)
  if (codeMatch) {
    const value = applyScale(codeMatch[1], codeMatch[2])
    const code = codeMatch[3].trim()
    const rest = codeMatch[4].trim()
    const currency = currencyMap[code.toLowerCase()] || code.toUpperCase()
    if (exchangeRates.value[currency]) {
      return { value, currency, rest }
    }
  }

  return null
}

export const convertCurrency = (value, fromCurrency, toCurrency) => {
  const fromRate = exchangeRates.value[fromCurrency]
  const toRate = exchangeRates.value[toCurrency]
  if (!fromRate || !toRate) throw new Error('Unknown currency')
  const usd = value / fromRate
  return usd * toRate
}

// Collect all distinct currencies present in an expression context
const collectCurrencies = (symbolMatches, currencyVarsInExpr, codeCurrencyMatches) => {
  const currencies = new Set()
  for (const s of symbolMatches) currencies.add(s.currency)
  for (const cv of currencyVarsInExpr) currencies.add(cv.currency)
  for (const cm of codeCurrencyMatches) currencies.add(cm.currency)
  return currencies
}

// Replace all currency tokens in an expression with numeric values.
// If allSameCurrency is true, just strip symbols and use raw values.
// If mixed, convert everything to USD for intermediate calculation.
const replaceCurrencyTokens = (
  expr,
  symbolMatches,
  currencyVarsInExpr,
  codeCurrencyMatches,
  allSameCurrency,
) => {
  let result = expr

  // Match prefix symbols: €50, $2k
  result = result.replace(
    /([€$£¥₹₽])\s*(\d+(?:\.\d+)?)\s*([kK]|M|thousand|thousands|million|millions|billion|billions|trillion|trillions)?/g,
    (_, symbol, num, scale) => {
      const cur = currencyMap[symbol]
      const val = applyScale(num, scale)
      if (allSameCurrency) return `(${val})`
      return `(${val / exchangeRates.value[cur]})`
    },
  )

  // Match postfix symbols: 50€, 2k$
  result = result.replace(
    /(\d+(?:\.\d+)?)\s*([kK]|M|thousand|thousands|million|millions|billion|billions|trillion|trillions)?\s*([€$£¥₹₽])/g,
    (_, num, scale, symbol) => {
      const cur = currencyMap[symbol]
      const val = applyScale(num, scale)
      if (allSameCurrency) return `(${val})`
      return `(${val / exchangeRates.value[cur]})`
    },
  )

  for (const cv of currencyVarsInExpr) {
    const regex = new RegExp(`\\b${cv.name}\\b`, 'gi')
    if (allSameCurrency) {
      result = result.replace(regex, `(${cv.value})`)
    } else {
      result = result.replace(regex, `(${cv.value / exchangeRates.value[cv.currency]})`)
    }
  }

  result = replaceCodeCurrencies(
    result,
    allSameCurrency
      ? currencyVarsInExpr[0]?.currency ||
          symbolMatches[0]?.currency ||
          codeCurrencyMatches[0]?.currency
      : null,
  )

  return result
}

export const handleCurrencyExpression = (input) => {
  const noResult = { value: 0, currency: null, hasCurrency: false, isConverted: false }

  // "$30 in EUR" or "€50 in USD" or "(a + $4) in GBP"
  const convMatch = input.match(/^(.+?)\s+in\s+([a-zA-Z€$£¥₹₽]+)$/i)
  if (convMatch) {
    const sourceExpr = convMatch[1].trim()
    const targetStr = convMatch[2].trim()
    const targetCurrency = currencyMap[targetStr.toLowerCase()] || targetStr.toUpperCase()

    if (exchangeRates.value[targetCurrency]) {
      const parsed = parseCurrency(sourceExpr)
      if (parsed && !parsed.rest) {
        if (parsed.currency === targetCurrency) {
          return {
            value: parsed.value,
            currency: targetCurrency,
            hasCurrency: true,
            isConverted: false,
          }
        }
        const converted = convertCurrency(parsed.value, parsed.currency, targetCurrency)
        return { value: converted, currency: targetCurrency, hasCurrency: true, isConverted: true }
      }

      const hasCurrencySymbols = /[€$£¥₹₽]/.test(sourceExpr)
      let hasCurrencyVars = false
      const cvarsInSource = []
      for (const [varName, varVal] of Object.entries(variables.value)) {
        if (varName.startsWith('_')) continue
        if (typeof varVal === 'object' && varVal.currency) {
          const regex = new RegExp(`\\b${varName}\\b`, 'i')
          if (regex.test(sourceExpr)) {
            hasCurrencyVars = true
            cvarsInSource.push({ name: varName, value: varVal.value, currency: varVal.currency })
          }
        }
      }

      // Also treat 'prev' as a currency variable if it has currency metadata
      if (
        /\bprev\b/i.test(sourceExpr) &&
        previousResult.value !== null &&
        previousResultCurrency.value
      ) {
        hasCurrencyVars = true
        cvarsInSource.push({
          name: 'prev',
          value: previousResult.value,
          currency: previousResultCurrency.value,
        })
      }

      const codeMatches = findCodeCurrencyMatches(sourceExpr)
      const hasCodeCurrencies = codeMatches.length > 0

      if (hasCurrencySymbols || hasCurrencyVars || hasCodeCurrencies) {
        const symbolMatches = []
        // Match prefix symbols: €50, $2k
        const symPreRe =
          /([€$£¥₹₽])\s*(\d+(?:\.\d+)?)\s*([kK]|M|thousand|thousands|million|millions|billion|billions|trillion|trillions)?/g
        let sm
        while ((sm = symPreRe.exec(sourceExpr)) !== null) {
          symbolMatches.push({
            symbol: sm[1],
            value: applyScale(sm[2], sm[3]),
            currency: currencyMap[sm[1]],
          })
        }
        // Match postfix symbols: 50€, 2k$
        const symPostRe =
          /(\d+(?:\.\d+)?)\s*([kK]|M|thousand|thousands|million|millions|billion|billions|trillion|trillions)?\s*([€$£¥₹₽])/g
        while ((sm = symPostRe.exec(sourceExpr)) !== null) {
          symbolMatches.push({
            symbol: sm[3],
            value: applyScale(sm[1], sm[2]),
            currency: currencyMap[sm[3]],
          })
        }

        const allCurrencies = collectCurrencies(symbolMatches, cvarsInSource, codeMatches)
        const allSame = allCurrencies.size === 1 && allCurrencies.has(targetCurrency)

        if (allSame) {
          // All source values are already in the target currency — just strip symbols and do plain math
          const expr = replaceCurrencyTokens(
            sourceExpr,
            symbolMatches,
            cvarsInSource,
            codeMatches,
            true,
          )
          try {
            const result = evaluateMath(expr)
            return {
              value: result,
              currency: targetCurrency,
              hasCurrency: true,
              isConverted: false,
            }
          } catch (_e) {
            /* fall through */
          }
        }

        // Mixed currencies — convert through USD
        const expr = replaceCurrencyTokens(
          sourceExpr,
          symbolMatches,
          cvarsInSource,
          codeMatches,
          false,
        )
        try {
          const usdResult = evaluateMath(expr)
          const converted = usdResult * exchangeRates.value[targetCurrency]
          return {
            value: converted,
            currency: targetCurrency,
            hasCurrency: true,
            isConverted: true,
          }
        } catch (_e) {
          /* fall through */
        }
      }

      try {
        const value = evaluateMath(sourceExpr)
        const converted = convertCurrency(value, 'USD', targetCurrency)
        return { value: converted, currency: targetCurrency, hasCurrency: true, isConverted: true }
      } catch (_e) {
        /* fall through */
      }
    }
  }

  // Currency arithmetic: "$30 + €20", "$2k + €500", "$1.5M - €200k", "30€ + 20$", "3€ + $2"
  // Match prefix or postfix symbol on each operand
  const currArithMatch = input.match(
    /^(?:([€$£¥₹₽])\s*(\d+(?:\.\d+)?)\s*([kK]|M|thousand|thousands|million|millions|billion|billions|trillion|trillions)?|(\d+(?:\.\d+)?)\s*([kK]|M|thousand|thousands|million|millions|billion|billions|trillion|trillions)?\s*([€$£¥₹₽]))\s*([+\-*/])\s*(?:([€$£¥₹₽])\s*(\d+(?:\.\d+)?)\s*([kK]|M|thousand|thousands|million|millions|billion|billions|trillion|trillions)?|(\d+(?:\.\d+)?)\s*([kK]|M|thousand|thousands|million|millions|billion|billions|trillion|trillions)?\s*([€$£¥₹₽]))$/,
  )
  if (currArithMatch) {
    // First operand: prefix groups [1,2,3] or postfix groups [4,5,6]
    const sym1 = currArithMatch[1] || currArithMatch[6]
    const num1 = currArithMatch[1] ? currArithMatch[2] : currArithMatch[4]
    const scale1 = currArithMatch[1] ? currArithMatch[3] : currArithMatch[5]
    const cur1 = currencyMap[sym1]
    const val1 = applyScale(num1, scale1)
    const op = currArithMatch[7]
    // Second operand: prefix groups [8,9,10] or postfix groups [11,12,13]
    const sym2 = currArithMatch[8] || currArithMatch[13]
    const num2 = currArithMatch[8] ? currArithMatch[9] : currArithMatch[11]
    const scale2 = currArithMatch[8] ? currArithMatch[10] : currArithMatch[12]
    const cur2 = currencyMap[sym2]
    const val2 = applyScale(num2, scale2)

    let result
    if (cur1 === cur2) {
      // Same currency — plain math, no conversion
      if (op === '+') result = val1 + val2
      else if (op === '-') result = val1 - val2
      else if (op === '*') result = val1 * val2
      else if (op === '/') result = val1 / val2
    } else {
      // Mixed currencies — convert second operand to first currency
      const converted2 = convertCurrency(val2, cur2, cur1)
      if (op === '+') result = val1 + converted2
      else if (op === '-') result = val1 - converted2
      else if (op === '*') result = val1 * converted2
      else if (op === '/') result = val1 / converted2
    }

    return { value: result, currency: cur1, hasCurrency: true, isConverted: false }
  }

  // Simple currency: "$30", "€50"
  const parsed = parseCurrency(input)
  if (parsed && !parsed.rest) {
    return { value: parsed.value, currency: parsed.currency, hasCurrency: true, isConverted: false }
  }

  // Check if expression involves currency variables
  const currencyVarsInExpr = []
  for (const [varName, varVal] of Object.entries(variables.value)) {
    if (varName.startsWith('_')) continue
    if (typeof varVal === 'object' && varVal.currency) {
      const regex = new RegExp(`\\b${varName}\\b`, 'i')
      if (regex.test(input)) {
        currencyVarsInExpr.push({ name: varName, value: varVal.value, currency: varVal.currency })
      }
    }
  }

  // Also treat 'prev' as a currency variable if it has currency metadata
  if (/\bprev\b/i.test(input) && previousResult.value !== null && previousResultCurrency.value) {
    currencyVarsInExpr.push({
      name: 'prev',
      value: previousResult.value,
      currency: previousResultCurrency.value,
    })
  }

  const symbolMatches = []
  // Match prefix symbols: €50, $2k
  const symbolRegex =
    /([€$£¥₹₽])\s*(\d+(?:\.\d+)?)\s*([kK]|M|thousand|thousands|million|millions|billion|billions|trillion|trillions)?/g
  let sMatch
  while ((sMatch = symbolRegex.exec(input)) !== null) {
    symbolMatches.push({
      symbol: sMatch[1],
      value: applyScale(sMatch[2], sMatch[3]),
      currency: currencyMap[sMatch[1]],
    })
  }
  // Match postfix symbols: 50€, 2k$
  const postfixSymbolRegex =
    /(\d+(?:\.\d+)?)\s*([kK]|M|thousand|thousands|million|millions|billion|billions|trillion|trillions)?\s*([€$£¥₹₽])/g
  while ((sMatch = postfixSymbolRegex.exec(input)) !== null) {
    symbolMatches.push({
      symbol: sMatch[3],
      value: applyScale(sMatch[1], sMatch[2]),
      currency: currencyMap[sMatch[3]],
    })
  }

  const codeCurrencyMatches = findCodeCurrencyMatches(input)

  const hasCurrencyContext =
    currencyVarsInExpr.length > 0 || symbolMatches.length > 0 || codeCurrencyMatches.length > 0

  if (hasCurrencyContext) {
    // Determine primary currency by what appears first in the expression
    let primaryCurrency
    if (currencyVarsInExpr.length > 0) {
      primaryCurrency = currencyVarsInExpr[0].currency
    } else {
      const firstSymbolIdx =
        symbolMatches.length > 0 ? input.indexOf(symbolMatches[0].symbol) : Infinity
      const firstCodeIdx =
        codeCurrencyMatches.length > 0
          ? input.search(
              new RegExp(
                `\\d[\\d.]*\\s*(?:[kKM]|thousand|thousands|million|millions|billion|billions|trillion|trillions)?\\s*${codeCurrencyMatches[0].currency}`,
                'i',
              ),
            )
          : Infinity
      primaryCurrency =
        firstSymbolIdx <= firstCodeIdx ? symbolMatches[0].currency : codeCurrencyMatches[0].currency
    }

    const allCurrencies = collectCurrencies(symbolMatches, currencyVarsInExpr, codeCurrencyMatches)
    const allSameCurrency = allCurrencies.size === 1

    let expr = replaceCurrencyTokens(
      input,
      symbolMatches,
      currencyVarsInExpr,
      codeCurrencyMatches,
      allSameCurrency,
    )

    try {
      const mathResult = evaluateMath(expr)
      const finalValue = allSameCurrency
        ? mathResult
        : mathResult * exchangeRates.value[primaryCurrency]
      return { value: finalValue, currency: primaryCurrency, hasCurrency: true, isConverted: false }
    } catch (_e) {
      /* fall through */
    }
  }

  return noResult
}
