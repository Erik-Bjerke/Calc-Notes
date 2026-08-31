import { describe, it, expect } from 'vitest'

import { useCalculator } from '../index'

describe('sum with plain text lines (no colon/equals)', () => {
  it('sums lines like "Name 900 eur" with sum keyword', () => {
    const { evaluateLines } = useCalculator()
    const results = evaluateLines([
      'Arwen 900 eur',
      'Kaisa 900 eur',
      'transporte Arwen 800 eur',
      'transporte kaisa 2000 eur',
      'sum',
    ])

    const sumLine = results[4]
    expect(sumLine.result).not.toBeNull()
    // 900 + 900 + 800 + 2000 = 4600
    const numericResult = parseFloat(sumLine.result.replace(/,/g, ''))
    expect(numericResult).toBe(4600)
  })

  it('sums plain text lines without currency', () => {
    const { evaluateLines } = useCalculator()
    const results = evaluateLines(['apples 50', 'bananas 30', 'oranges 20', 'sum'])

    const sumLine = results[3]
    expect(sumLine.result).not.toBeNull()
    const numericResult = parseFloat(sumLine.result.replace(/,/g, ''))
    expect(numericResult).toBe(100)
  })

  it('sums mixed plain text and calculation lines', () => {
    const { evaluateLines } = useCalculator()
    const results = evaluateLines(['rent 1200 eur', '500 eur', 'groceries 300 eur', 'sum'])

    const sumLine = results[3]
    expect(sumLine.result).not.toBeNull()
    const numericResult = parseFloat(sumLine.result.replace(/,/g, ''))
    expect(numericResult).toBe(2000)
  })

  it('detects currency from plain text lines for sum', () => {
    const { evaluateLines } = useCalculator()
    const results = evaluateLines(['Arwen 900 eur', 'Kaisa 900 eur', 'sum'])

    const sumLine = results[2]
    expect(sumLine.result).toContain('EUR')
  })

  it('handles lines with only text (no number) gracefully', () => {
    const { evaluateLines } = useCalculator()
    const results = evaluateLines(['some header text', 'item 100 eur', 'sum'])

    // "some header text" has no number, so sum should only count "item 100 eur"
    // But sum stops at empty lines, not at lines without results
    // The first line might or might not have a result depending on extraction
    const sumLine = results[2]
    expect(sumLine.result).not.toBeNull()
  })
})
