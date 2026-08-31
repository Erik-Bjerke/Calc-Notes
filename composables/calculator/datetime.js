// Date, time, and timezone handling
import { timezoneOffsets, cityTimezones, tzAbbrToIANA } from './constants'
import { evaluateMath, formatResult } from './math'

// ---- Timezone handling ----
export const handleTimezoneExpression = (input) => {
  const tzAbbrs = Object.keys(timezoneOffsets).join('|')
  const cityNames = Object.keys(cityTimezones).join('|')

  // "PST time" or "EST time"
  const tzTimeMatch = input.match(new RegExp(`^(${tzAbbrs})\\s+time`, 'i'))
  if (tzTimeMatch) {
    const tz = tzTimeMatch[1].toUpperCase()
    const iana = tzAbbrToIANA[tz]
    if (iana) {
      try {
        const now = new Date()
        const formatted = now.toLocaleString('en-US', { timeZone: iana })
        return { value: now.getTime(), display: formatted, liveTime: true, iana }
      } catch (_e) {
        /* fall through */
      }
    }
  }

  // "time in <City>" or "<City> time"
  const timeInCityMatch =
    input.match(new RegExp(`^time\\s+in\\s+(${cityNames})`, 'i')) ||
    input.match(new RegExp(`^(${cityNames})\\s+time`, 'i'))
  if (timeInCityMatch) {
    const city = timeInCityMatch[1].toLowerCase()
    const iana = cityTimezones[city]
    if (iana) {
      try {
        const now = new Date()
        const formatted = now.toLocaleString('en-US', { timeZone: iana })
        return { value: now.getTime(), display: formatted, liveTime: true, iana }
      } catch (_e) {
        /* fall through */
      }
    }
  }

  // "H:MM am/pm TZ in <City/TZ>" e.g. "2:30 pm HKT in Berlin"
  const tzConvMatch = input.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?\s*([\w]+)\s+in\s+([\w\s]+)$/i)
  if (tzConvMatch) {
    let hours = parseInt(tzConvMatch[1])
    const minutes = parseInt(tzConvMatch[2])
    const ampm = (tzConvMatch[3] || '').toLowerCase()
    const sourceTz = tzConvMatch[4].toUpperCase()
    const target = tzConvMatch[5].trim().toLowerCase()

    if (ampm) {
      if (ampm === 'pm' && hours !== 12) hours += 12
      if (ampm === 'am' && hours === 12) hours = 0
    }

    const sourceIANA = tzAbbrToIANA[sourceTz]
    const targetIANA = cityTimezones[target] || tzAbbrToIANA[target.toUpperCase()]

    if (sourceIANA && targetIANA) {
      try {
        const sourceOffset = timezoneOffsets[sourceTz] || 0
        const targetOffset = timezoneOffsets[target.toUpperCase()] || getOffsetForCity(target)
        const diffHours = targetOffset - sourceOffset

        const now = new Date()
        const sourceDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          hours,
          minutes,
          0,
        )
        const resultDate = new Date(sourceDate.getTime() + diffHours * 3600000)
        const formatted = resultDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
        return { value: resultDate.getTime(), display: formatted }
      } catch (_e) {
        /* fall through */
      }
    }
  }

  return null
}

export const getOffsetForCity = (city) => {
  const offsets = {
    'new york': -5,
    'los angeles': -8,
    chicago: -6,
    london: 0,
    paris: 1,
    berlin: 1,
    madrid: 1,
    tokyo: 9,
    beijing: 8,
    shanghai: 8,
    'hong kong': 8,
    singapore: 8,
    sydney: 10,
    moscow: 3,
    dubai: 4,
    mumbai: 5.5,
    delhi: 5.5,
    seoul: 9,
    toronto: -5,
    vancouver: -8,
  }
  return offsets[city.toLowerCase()] || 0
}

// ---- Date/Time handling ----
export const handleDateExpression = (input) => {
  const dateKeywords = [
    'now',
    'time',
    'today',
    'yesterday',
    'tomorrow',
    'next week',
    'last week',
    'next month',
    'last month',
    'next year',
    'last year',
  ]
  const hasDateKeyword = dateKeywords.some((kw) =>
    new RegExp(`\\b${kw}\\b`, 'i').test(input.toLowerCase()),
  )
  const hasTimePeriod =
    /\d+\s*(second|seconds|sec|minute|minutes|min(?!us)|hour|hours|day|days|week|weeks|month|months|year|years)\b/i.test(
      input,
    )

  if (!hasDateKeyword && !hasTimePeriod) return null

  const isDateCalculation = hasDateKeyword

  const getDateFromKeyword = (keyword) => {
    const kw = keyword.toLowerCase().trim()
    const date = new Date()
    if (kw === 'now' || kw === 'time') return date.getTime()
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

  let expression = input
  const sortedKeywords = [...dateKeywords].sort((a, b) => b.length - a.length)
  for (const keyword of sortedKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
    if (regex.test(expression)) {
      const timestamp = getDateFromKeyword(keyword)
      if (timestamp !== null) {
        expression = expression.replace(new RegExp(`\\b${keyword}\\b`, 'gi'), `(${timestamp})`)
      }
    }
  }

  expression = expression.replace(
    /(\d+(?:\.\d+)?)\s*(second|seconds|sec|minute|minutes|min(?!us)|hour|hours|day|days|week|weeks|month|months|year|years)\b/gi,
    (match, amount, unit) => {
      const num = parseFloat(amount)
      const u = unit.toLowerCase()
      let ms = 0
      if (u === 'second' || u === 'seconds' || u === 'sec') ms = num * 1000
      else if (u === 'minute' || u === 'minutes' || u.startsWith('min')) ms = num * 60000
      else if (u === 'hour' || u === 'hours') ms = num * 3600000
      else if (u === 'day' || u === 'days') ms = num * 86400000
      else if (u === 'week' || u === 'weeks') ms = num * 604800000
      else if (u === 'month' || u === 'months') ms = num * 2592000000
      else if (u === 'year' || u === 'years') ms = num * 31536000000
      return `(${ms})`
    },
  )

  try {
    const result = evaluateMath(expression)
    if (isDateCalculation) {
      const resultDate = new Date(result)
      const isLive = /^\s*(now|time)\s*$/i.test(input)
      return {
        value: result,
        display: resultDate.toLocaleString(),
        ...(isLive && { liveTime: true }),
      }
    } else {
      const totalMs = result
      const totalSeconds = totalMs / 1000
      const totalMinutes = totalSeconds / 60
      const totalHours = totalMinutes / 60
      const totalDays = totalHours / 24
      const totalWeeks = totalDays / 7
      const totalMonths = totalDays / 30
      const totalYears = totalDays / 365

      if (totalYears >= 1 && Number.isInteger(totalYears))
        return { value: result, display: `${totalYears} ${totalYears === 1 ? 'year' : 'years'}` }
      if (totalMonths >= 1 && Number.isInteger(totalMonths))
        return {
          value: result,
          display: `${totalMonths} ${totalMonths === 1 ? 'month' : 'months'}`,
        }
      if (totalWeeks >= 1 && Number.isInteger(totalWeeks))
        return { value: result, display: `${totalWeeks} ${totalWeeks === 1 ? 'week' : 'weeks'}` }
      if (totalDays >= 1 && Number.isInteger(totalDays))
        return { value: result, display: `${totalDays} ${totalDays === 1 ? 'day' : 'days'}` }
      if (totalHours >= 1 && Number.isInteger(totalHours))
        return { value: result, display: `${totalHours} ${totalHours === 1 ? 'hour' : 'hours'}` }
      if (totalMinutes >= 1 && Number.isInteger(totalMinutes))
        return {
          value: result,
          display: `${totalMinutes} ${totalMinutes === 1 ? 'minute' : 'minutes'}`,
        }
      if (totalSeconds >= 1 && Number.isInteger(totalSeconds))
        return {
          value: result,
          display: `${totalSeconds} ${totalSeconds === 1 ? 'second' : 'seconds'}`,
        }
      return { value: result, display: `${formatResult(totalDays)} days` }
    }
  } catch (_e) {
    const inputLower = input.toLowerCase().trim()
    const timestamp = getDateFromKeyword(inputLower)
    if (timestamp !== null) {
      const date = new Date(timestamp)
      const isLive = inputLower === 'now' || inputLower === 'time'
      return {
        value: timestamp,
        display: isLive ? date.toLocaleString() : date.toLocaleDateString(),
        ...(isLive && { liveTime: true }),
      }
    }
  }
  return null
}
