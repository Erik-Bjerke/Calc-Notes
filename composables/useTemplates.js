export const useTemplates = () => {
  const templates = [
    {
      id: 'price-per-unit',
      name: 'Price per Unit',
      description: 'Calculate price per kg, liter, etc.',
      category: 'shopping',
      content: `# Price per Unit
total = $10
quantity = 2.5 kg
price_per_kg = total / quantity`
    },
    {
      id: 'discount',
      name: 'Discount Calculator',
      description: 'Calculate final price after discount',
      category: 'shopping',
      content: `# Discount
original = $100
discount = 20%
final = original - discount`
    },
    {
      id: 'percentage-examples',
      name: 'Percentage Examples',
      description: 'Learn how percentages work',
      category: 'shopping',
      content: `# Percentage Examples

// Contextual (Addition & Subtraction)
100 + 20%
100 - 15%
200 + 10%

// Literal (Multiplication & Division)
100 * 5%
100 / 5%
200 * 10%

// Explicit Keywords
20% of 100
10% on 200
10% off 50

// Real-World: Shopping
price = $100
discount = 20% of price
final = price - 20%

// Real-World: Tax
subtotal = $100
tax = 8.5% of subtotal
total = subtotal + tax

// Real-World: Tip
bill = $85
tip = 18% of bill
total = bill + 18%`
    },
    {
      id: 'tip',
      name: 'Tip Calculator',
      description: 'Calculate tip and total bill',
      category: 'dining',
      content: `# Tip Calculator
bill = $50
tip = 15% of bill
total = bill + tip`
    },
    {
      id: 'split-bill',
      name: 'Split Bill',
      description: 'Split bill among people',
      category: 'dining',
      content: `# Split Bill
total = $120
people = 4
per_person = total / people`
    },
    {
      id: 'vat',
      name: 'VAT Calculator',
      description: 'Calculate price with VAT',
      category: 'shopping',
      content: `# VAT Calculator
price = $100
vat = 20% of price
total = price + vat`
    },
    {
      id: 'currency-trip',
      name: 'Currency for Trip',
      description: 'Convert budget to foreign currency',
      category: 'travel',
      content: `# Trip Budget
budget = $1000
budget in EUR
budget in GBP
budget in JPY`
    },
    {
      id: 'fuel-cost',
      name: 'Fuel Cost',
      description: 'Calculate fuel cost for trip',
      category: 'travel',
      content: `# Fuel Cost
distance = 200 km
consumption = 7 l
price_per_liter = $1.5
total_fuel = distance * consumption / 100
cost = total_fuel * price_per_liter`
    },
    {
      id: 'unit-price',
      name: 'Compare Unit Prices',
      description: 'Compare prices of different package sizes',
      category: 'shopping',
      content: `# Compare Prices
// Package A
price_a = $5
size_a = 0.5 kg
unit_a = price_a / size_a

// Package B
price_b = $8
size_b = 1 kg
unit_b = price_b / size_b`
    },
    {
      id: 'loan-payment',
      name: 'Loan Payment',
      description: 'Calculate monthly loan payment',
      category: 'finance',
      content: `# Loan Payment
loan = $10000
annual_rate = 5% / 100
months = 12
monthly_rate = annual_rate / 12
monthly_payment = loan * (monthly_rate * (1 + monthly_rate)^months) / ((1 + monthly_rate)^months - 1)`
    },
    {
      id: 'savings',
      name: 'Savings Goal',
      description: 'Calculate monthly savings needed',
      category: 'finance',
      content: `# Savings Goal
goal = $5000
months = 12
monthly = goal / months`
    },
    {
      id: 'bmi',
      name: 'BMI Calculator',
      description: 'Calculate Body Mass Index',
      category: 'health',
      content: `# BMI Calculator
weight = 70 kg
height = 1.75 m
bmi = weight / (height ^ 2)`
    },
    {
      id: 'age',
      name: 'Age Calculator',
      description: 'Calculate age from birthdate',
      category: 'personal',
      content: `# Age Calculator
birthdate = today - 30 years
age_days = today - birthdate
age_years = age_days / 365 days`
    },
    {
      id: 'time-until',
      name: 'Time Until Event',
      description: 'Calculate time until future date',
      category: 'personal',
      content: `# Time Until
event = today + 2 weeks
days_left = event - today
weeks_left = days_left / 7 days`
    },
    {
      id: 'hourly-rate',
      name: 'Hourly Rate',
      description: 'Calculate hourly rate from salary',
      category: 'work',
      content: `# Hourly Rate
monthly_salary = $3000
hours_per_week = 40
weeks_per_month = 4.33
hourly = monthly_salary / (hours_per_week * weeks_per_month)`
    },
    {
      id: 'project-time',
      name: 'Project Time',
      description: 'Calculate project hours and cost',
      category: 'work',
      content: `# Project Time
hours = 40
hourly_rate = $50
total = hours * hourly_rate`
    },
    {
      id: 'cooking-scale',
      name: 'Recipe Scaling',
      description: 'Scale recipe ingredients',
      category: 'cooking',
      content: `# Recipe Scaling
original_servings = 4
new_servings = 6
scale = new_servings / original_servings

// Ingredients
flour = 200 g
flour * scale`
    },
    {
      id: 'temperature',
      name: 'Temperature Conversion',
      description: 'Convert between temperature units',
      category: 'cooking',
      content: `# Temperature
180 celsius in fahrenheit
350 fahrenheit in celsius`
    },
    {
      id: 'area-room',
      name: 'Room Area',
      description: 'Calculate room area and materials needed',
      category: 'home',
      content: `# Room Area
length = 5 m
width = 4 m
area = length * width
area in ft2`
    },
    {
      id: 'paint',
      name: 'Paint Calculator',
      description: 'Calculate paint needed for walls',
      category: 'home',
      content: `# Paint Needed
wall_area = 50 m2
coverage_per_liter = 10 m2
liters_needed = wall_area / coverage_per_liter`
    },
    {
      id: 'data-transfer',
      name: 'Data Transfer Time',
      description: 'Calculate file transfer time',
      category: 'tech',
      content: `# Data Transfer
file_size = 5 GB
speed = 100 MB
time_seconds = (file_size * 1000) / speed
time_minutes = time_seconds / 60`
    }
  ]

  const categories = [
    { id: 'all', name: 'All Templates' },
    { id: 'shopping', name: 'Shopping' },
    { id: 'dining', name: 'Dining' },
    { id: 'travel', name: 'Travel' },
    { id: 'finance', name: 'Finance' },
    { id: 'health', name: 'Health' },
    { id: 'personal', name: 'Personal' },
    { id: 'work', name: 'Work' },
    { id: 'cooking', name: 'Cooking' },
    { id: 'home', name: 'Home' },
    { id: 'tech', name: 'Tech' }
  ]

  const getTemplates = (category = 'all') => {
    if (category === 'all') return templates
    return templates.filter(t => t.category === category)
  }

  const getTemplate = (id) => {
    return templates.find(t => t.id === id)
  }

  return {
    templates,
    categories,
    getTemplates,
    getTemplate
  }
}
