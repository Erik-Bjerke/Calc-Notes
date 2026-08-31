import { describe, it, expect } from 'vitest'

import { useCalculator } from '../index'

describe('sub keyword (subtraction aggregation)', () => {
  it('subtracts lines: 2, 3, 4, sub = -5', () => {
    const { evaluateLines } = useCalculator()
    const results = evaluateLines(['2', '3', '4', 'sub'])

    const subLine = results[3]
    expect(subLine.result).not.toBeNull()
    expect(parseFloat(subLine.result)).toBe(-5)
  })

  it('subtracts lines: first minus rest (10, 3, 2 = 5)', () => {
    const { evaluateLines } = useCalculator()
    const results = evaluateLines(['10', '3', '2', 'sub'])

    expect(parseFloat(results[3].result)).toBe(5)
  })

  it('single line above returns that value', () => {
    const { evaluateLines } = useCalculator()
    const results = evaluateLines(['42', 'sub'])

    expect(parseFloat(results[1].result)).toBe(42)
  })

  it('returns 0 when no lines above', () => {
    const { evaluateLines } = useCalculator()
    const results = evaluateLines(['sub'])

    expect(parseFloat(results[0].result)).toBe(0)
  })

  it('stops at empty line', () => {
    const { evaluateLines } = useCalculator()
    const results = evaluateLines(['100', '', '50', '10', 'sub'])

    // Only considers 50 and 10 (after the empty line)
    expect(parseFloat(results[4].result)).toBe(40)
  })

  it('stops at header line', () => {
    const { evaluateLines } = useCalculator()
    const results = evaluateLines(['# Header', '100', '30', 'sub'])

    // 100 - 30 = 70
    expect(parseFloat(results[3].result)).toBe(70)
  })

  it('works with labeled lines', () => {
    const { evaluateLines } = useCalculator()
    const results = evaluateLines(['Salary: 1457', 'Food: 200', 'Fuel: 100', 'sub'])

    // 1457 - 200 - 100 = 1157
    const subLine = results[3]
    expect(subLine.result).not.toBeNull()
    expect(parseFloat(subLine.result.replace(/,/g, ''))).toBe(1157)
  })

  it('works with currency (EUR)', () => {
    const { evaluateLines } = useCalculator()
    const results = evaluateLines(['Salary: €1457', 'Food: €200', 'Fuel: €100', 'sub'])

    const subLine = results[3]
    expect(subLine.result).not.toBeNull()
    expect(subLine.result).toContain('EUR')
    const numericResult = parseFloat(subLine.result.replace(/,/g, ''))
    expect(numericResult).toBe(1157)
  })

  it('sub with operation: sub - 10%', () => {
    const { evaluateLines } = useCalculator()
    const results = evaluateLines(['100', '20', 'sub - 10%'])

    // sub = 100 - 20 = 80, then 80 - 10% = 72
    const subLine = results[2]
    expect(subLine.result).not.toBeNull()
    expect(parseFloat(subLine.result)).toBe(72)
  })

  it('sub used inline in expression: "sub * 2"', () => {
    const { evaluateLines } = useCalculator()
    const results = evaluateLines(['100', '30', 'sub * 2'])

    // sub = 70, 70 * 2 = 140
    expect(parseFloat(results[2].result)).toBe(140)
  })

  it('sub with plain text lines (no colon)', () => {
    const { evaluateLines } = useCalculator()
    const results = evaluateLines(['Arwen 900 eur', 'Kaisa 200 eur', 'transporte 300 eur', 'sub'])

    const subLine = results[3]
    expect(subLine.result).not.toBeNull()
    // 900 - 200 - 300 = 400
    const numericResult = parseFloat(subLine.result.replace(/,/g, ''))
    expect(numericResult).toBe(400)
    expect(subLine.result).toContain('EUR')
  })

  it('sub as label: "Remaining: sub"', () => {
    const { evaluateLines } = useCalculator()
    const results = evaluateLines(['Salary: 5000', 'Rent: 1500', 'Food: 500', 'Remaining: sub'])

    const subLine = results[3]
    expect(subLine.result).not.toBeNull()
    // 5000 - 1500 - 500 = 3000
    expect(parseFloat(subLine.result.replace(/,/g, ''))).toBe(3000)
  })

  it('does not conflict with a variable named sub', () => {
    const { evaluateLines } = useCalculator()
    const results = evaluateLines(['sub = 10', '50', '20', 'sub'])

    // "sub" is now a variable with value 10, not the keyword
    const lastLine = results[3]
    expect(parseFloat(lastLine.result)).toBe(10)
  })
})
