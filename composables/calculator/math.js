// Math evaluation, functions, percentages, and formatting
import { constants, variables, previousResult, scales } from './constants'
import { handleUnitExpression } from './units'

// ---- Format result ----
export const formatResult = (value) => {
  if (value === null || value === undefined) return null
  if (typeof value !== 'number') return String(value)
  if (!isFinite(value)) return null

  // Handle very small numbers
  if (Math.abs(value) < 1e-10 && value !== 0) return value.toExponential()

  // Round to avoid floating point artifacts
  const rounded = Math.round(value * 1e10) / 1e10

  if (Number.isInteger(rounded)) return rounded.toString()

  // Format with reasonable decimal places
  const str = rounded.toString()
  if (str.includes('e')) return str

  // Limit to 10 decimal places
  const fixed = rounded.toFixed(10).replace(/0+$/, '').replace(/\.$/, '')
  return fixed
}

// ---- Percentages ----
export const handlePercentages = (expr) => {
  let expression = expr

  expression = expression.replace(
    /(\d+(?:\.\d+)?)\s*as\s+a\s*%\s*of\s*(\d+(?:\.\d+)?)/gi,
    (_, x, y) => `((${x} / ${y}) * 100)`,
  )
  expression = expression.replace(
    /(\d+(?:\.\d+)?)\s*as\s+a\s*%\s*on\s*(\d+(?:\.\d+)?)/gi,
    (_, x, y) => `(((${x} - ${y}) / ${y}) * 100)`,
  )
  expression = expression.replace(
    /(\d+(?:\.\d+)?)\s*as\s+a\s*%\s*off\s*(\d+(?:\.\d+)?)/gi,
    (_, x, y) => `(((${y} - ${x}) / ${y}) * 100)`,
  )
  expression = expression.replace(
    /(\d+(?:\.\d+)?)\s*%\s*of\s+what\s+is\s+(\d+(?:\.\d+)?)/gi,
    (_, p, v) => `(${v} / (${p} / 100))`,
  )
  expression = expression.replace(
    /(\d+(?:\.\d+)?)\s*%\s*on\s+what\s+is\s+(\d+(?:\.\d+)?)/gi,
    (_, p, v) => `(${v} / (1 + ${p} / 100))`,
  )
  expression = expression.replace(
    /(\d+(?:\.\d+)?)\s*%\s*off\s+what\s+is\s+(\d+(?:\.\d+)?)/gi,
    (_, p, v) => `(${v} / (1 - ${p} / 100))`,
  )
  expression = expression.replace(
    /(\d+(?:\.\d+)?)\s*%\s*of\s*(\([^)]+\)|\d+(?:\.\d+)?)/g,
    (_, p, v) => `((${p} / 100) * ${v})`,
  )
  expression = expression.replace(
    /(\d+(?:\.\d+)?)\s*%\s*on\s*(\([^)]+\)|\d+(?:\.\d+)?)/g,
    (_, p, v) => `(${v} + (${v} * ${p} / 100))`,
  )
  expression = expression.replace(
    /(\d+(?:\.\d+)?)\s*%\s*off\s*(\([^)]+\)|\d+(?:\.\d+)?)/g,
    (_, p, v) => `(${v} - (${v} * ${p} / 100))`,
  )
  expression = expression.replace(
    /(\([^)]+\)|\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)\s*%(?!\s*\^)/g,
    (_, b, p) => `(${b} + (${b} * ${p} / 100))`,
  )
  expression = expression.replace(
    /(\([^)]+\)|\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*%(?!\s*\^)/g,
    (_, b, p) => `(${b} - (${b} * ${p} / 100))`,
  )
  expression = expression.replace(
    /(\([^)]+\)|\d+(?:\.\d+)?)\s*\*\s*(\d+(?:\.\d+)?)\s*%(?!\s*\^)/g,
    (_, b, p) => `(${b} * ${p} / 100)`,
  )
  expression = expression.replace(
    /(\([^)]+\)|\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*%(?!\s*\^)/g,
    (_, b, p) => `(${b} / (${p} / 100))`,
  )

  return expression
}

// ---- Simple math evaluator (used by functions) ----
export const evaluateMathSimple = (expr) => {
  let processed = handleFunctions(expr)
  processed = processed.replace(/\bpi\b/gi, `(${constants.pi})`)
  processed = processed.replace(/(?<![a-z])e(?![a-z0-9])/gi, `(${constants.e})`)
  for (const [varName, value] of Object.entries(variables.value)) {
    if (varName.startsWith('_')) continue
    const regex = new RegExp(`\\b${varName}\\b`, 'gi')
    if (typeof value === 'object' && value.value !== undefined) {
      processed = processed.replace(regex, `(${value.value})`)
    } else if (typeof value !== 'string' || !value.endsWith?.('%')) {
      processed = processed.replace(regex, `(${value})`)
    }
  }
  processed = processed.replace(/(\d)\s*\(/g, '$1*(')
  processed = processed.replace(/\)\s*\(/g, ')*(')
  processed = processed.replace(/\^/g, '**')
  const cleanExpr = processed.replace(/\s/g, '')
  try {
    const result = new Function(`return ${cleanExpr}`)()
    if (typeof result !== 'number' || !isFinite(result)) throw new Error('Invalid result')
    return result
  } catch {
    throw new Error('Invalid expression')
  }
}

// ---- Functions ----
export const handleFunctions = (expr) => {
  let expression = expr

  // First handle round() wrapping unit conversions: round(1 month in days)
  expression = expression.replace(
    /\b(round|ceil|floor)\s*\(([^)]*\b(?:in|to|as)\b[^)]*)\)/gi,
    (_, fn, inner) => {
      try {
        const unitResult = handleUnitExpression(inner.trim())
        if (unitResult.isConverted || unitResult.hasUnit) {
          const mathFn =
            fn.toLowerCase() === 'round'
              ? Math.round
              : fn.toLowerCase() === 'ceil'
                ? Math.ceil
                : Math.floor
          return mathFn(unitResult.value).toString()
        }
      } catch (_e) {
        /* fall through */
      }
      return `${fn}(${inner})`
    },
  )

  // N-th root: root N (X)
  expression = expression.replace(/\broot\s+(\d+(?:\.\d+)?)\s*\(([^)]+)\)/gi, (_, n, arg) => {
    return Math.pow(evaluateMathSimple(arg), 1 / parseFloat(n)).toString()
  })

  // Log with base: log N (X)
  expression = expression.replace(/\blog\s+(\d+(?:\.\d+)?)\s*\(([^)]+)\)/gi, (_, base, arg) => {
    return (Math.log(evaluateMathSimple(arg)) / Math.log(parseFloat(base))).toString()
  })

  const funcMap = [
    [/\bsqrt\s*\(([^)]+)\)/gi, (_, a) => Math.sqrt(evaluateMathSimple(a)).toString()],
    [/\bcbrt\s*\(([^)]+)\)/gi, (_, a) => Math.cbrt(evaluateMathSimple(a)).toString()],
    [/\babs\s*\(([^)]+)\)/gi, (_, a) => Math.abs(evaluateMathSimple(a)).toString()],
    [/\blog\s*\(([^)]+)\)/gi, (_, a) => Math.log10(evaluateMathSimple(a)).toString()],
    [/\bln\s*\(([^)]+)\)/gi, (_, a) => Math.log(evaluateMathSimple(a)).toString()],
    [
      /\bfact\s*\(([^)]+)\)/gi,
      (_, a) => {
        let n = Math.floor(evaluateMathSimple(a)),
          r = 1
        for (let i = 2; i <= n; i++) r *= i
        return r.toString()
      },
    ],
    [/\bround\s*\(([^)]+)\)/gi, (_, a) => Math.round(evaluateMathSimple(a)).toString()],
    [/\bceil\s*\(([^)]+)\)/gi, (_, a) => Math.ceil(evaluateMathSimple(a)).toString()],
    [/\bfloor\s*\(([^)]+)\)/gi, (_, a) => Math.floor(evaluateMathSimple(a)).toString()],
    [/\barcsin\s*\(([^)]+)\)/gi, (_, a) => Math.asin(evaluateMathSimple(a)).toString()],
    [/\barccos\s*\(([^)]+)\)/gi, (_, a) => Math.acos(evaluateMathSimple(a)).toString()],
    [/\barctan\s*\(([^)]+)\)/gi, (_, a) => Math.atan(evaluateMathSimple(a)).toString()],
    [/\bsinh\s*\(([^)]+)\)/gi, (_, a) => Math.sinh(evaluateMathSimple(a)).toString()],
    [/\bcosh\s*\(([^)]+)\)/gi, (_, a) => Math.cosh(evaluateMathSimple(a)).toString()],
    [/\btanh\s*\(([^)]+)\)/gi, (_, a) => Math.tanh(evaluateMathSimple(a)).toString()],
  ]

  const trigFuncs = [
    [/\bsin\s*\(([^)]+)\)/gi, Math.sin],
    [/\bcos\s*\(([^)]+)\)/gi, Math.cos],
    [/\btan\s*\(([^)]+)\)/gi, Math.tan],
  ]

  for (const [regex, fn] of funcMap) {
    expression = expression.replace(regex, fn)
  }

  for (const [regex, fn] of trigFuncs) {
    expression = expression.replace(regex, (_, arg) => {
      const hasDeg = arg.includes('°')
      const cleanArg = arg.replace('°', '')
      const value = evaluateMathSimple(cleanArg)
      const radians = hasDeg ? (value * Math.PI) / 180 : value
      return fn(radians).toString()
    })
  }

  return expression
}

// ---- Main math evaluator ----
export const evaluateMath = (expr) => {
  let expression = expr.toLowerCase()

  expression = expression
    .replace(/\bplus\b/g, '+')
    .replace(/\band\b/g, '+')
    .replace(/\bwith\b/g, '+')
    .replace(/\bminus\b/g, '-')
    .replace(/\bsubtract\b/g, '-')
    .replace(/\bwithout\b/g, '-')
    .replace(/\btimes\b/g, '*')
    .replace(/\bmultiplied\s+by\b/g, '*')
    .replace(/\bmul\b/g, '*')
    .replace(/\bdivide\s+by\b/g, '/')
    .replace(/\bdivide\b/g, '/')
    .replace(/\bmod\b/g, '⊘')
    .replace(/\bxor\b/g, '⊕')

  // Replace constants
  expression = expression.replace(/\bpi\b/g, `(${constants.pi})`)
  expression = expression.replace(/(?<![a-z])e(?![a-z0-9])/g, `(${constants.e})`)
  expression = expression.replace(/\btau\b/g, `(${constants.tau})`)
  expression = expression.replace(/\bphi\b/g, `(${constants.phi})`)

  if (expression.includes('prev') && previousResult.value !== null) {
    expression = expression.replace(/\bprev\b/g, `(${previousResult.value})`)
  }

  // Replace variables
  for (const [varName, value] of Object.entries(variables.value)) {
    if (varName.startsWith('_')) continue
    const regex = new RegExp(`\\b${varName}\\b`, 'gi')
    if (typeof value === 'string' && value.endsWith('%')) {
      expression = expression.replace(regex, value)
    } else if (typeof value === 'object' && value.value !== undefined) {
      expression = expression.replace(regex, `(${value.value})`)
    } else {
      expression = expression.replace(regex, `(${value})`)
    }
  }

  // Handle scales (word form)
  expression = expression.replace(
    /(\d+(?:\.\d+)?)\s*(thousand|thousands|million|millions|billion|billions|trillion|trillions)\b/g,
    (_, num, scale) => {
      const multiplier = scales[scale]
      return `(${parseFloat(num) * multiplier})`
    },
  )

  // Handle k scale (case-insensitive since expression is lowered)
  expression = expression.replace(/(\d+(?:\.\d+)?)\s*k\b/g, (_, num) => {
    return `(${parseFloat(num) * 1e3})`
  })

  // Handle M scale — need original casing. Use a separate pass on original expr.
  let casedExpr = expr
  for (const [varName, value] of Object.entries(variables.value)) {
    if (varName.startsWith('_')) continue
    const regex = new RegExp(`\\b${varName}\\b`, 'gi')
    if (typeof value === 'object' && value.value !== undefined) {
      casedExpr = casedExpr.replace(regex, `(${value.value})`)
    } else if (typeof value !== 'string' || !value.endsWith?.('%')) {
      casedExpr = casedExpr.replace(regex, `(${value})`)
    }
  }
  const mScaleRegex = /(\d+(?:\.\d+)?)\s*M\b/g
  let mMatch
  while ((mMatch = mScaleRegex.exec(casedExpr)) !== null) {
    const num = parseFloat(mMatch[1])
    const fullMatch = mMatch[0].toLowerCase()
    expression = expression.replace(fullMatch, `(${num * 1e6})`)
  }

  // Handle percentages
  expression = handlePercentages(expression)

  // Convert remaining standalone percentages to decimals
  expression = expression.replace(/(\d+(?:\.\d+)?)\s*%/g, (_, num) => `(${num} / 100)`)

  // Implicit multiplication
  expression = expression.replace(/(\d)\s*\(/g, '$1*(')
  expression = expression.replace(/\)\s*\(/g, ')*(')

  // ^ → ** for exponentiation, ⊕ → ^ for XOR, ⊘ → % for modulo
  expression = expression.replace(/\^/g, '**')
  expression = expression.replace(/⊕/g, '^')
  expression = expression.replace(/⊘/g, '%')

  const cleanExpr = expression.replace(/\s/g, '')
  try {
    const result = new Function(`return ${cleanExpr}`)()
    if (typeof result !== 'number' || !isFinite(result)) throw new Error('Invalid result')
    return result
  } catch {
    throw new Error('Invalid expression')
  }
}
