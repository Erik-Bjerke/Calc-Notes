export const useTemplates = () => {
  const templates = [
    {
      id: 'price-per-unit',
      name: 'Price per Unit',
      description: 'Calculate price per kg, liter, etc.',
      category: 'shopping',
      content: `# Price per Unit
total = $10
quantity = 2.5
price_per_unit = total / quantity`,
    },
    {
      id: 'discount',
      name: 'Discount Calculator',
      description: 'Calculate final price after discount',
      category: 'shopping',
      content: `# Discount
original = $100
discount = 20%
final = original - discount`,
    },
    {
      id: 'percentage-examples',
      name: 'Percentage Examples',
      description: 'Learn how percentages work',
      category: 'learning',
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

// Reverse Percentage
50 as a % of 100
70 as a % on 20
20 as a % off 70

// Find the Original
5% of what is 6
5% on what is 6
5% off what is 6

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
total = bill + 18%`,
    },
    {
      id: 'tip',
      name: 'Tip Calculator',
      description: 'Calculate tip and total bill',
      category: 'dining',
      content: `# Tip Calculator
bill = $50
tip = 15% of bill
total = bill + tip`,
    },
    {
      id: 'split-bill',
      name: 'Split Bill',
      description: 'Split bill among people with tip',
      category: 'dining',
      content: `# Split Bill
subtotal = $120
total = subtotal + 18%
people = 4
per_person = total / people`,
    },
    {
      id: 'vat',
      name: 'VAT Calculator',
      description: 'Calculate price with VAT',
      category: 'shopping',
      content: `# VAT Calculator
price = $100
vat = 20% of price
total = price + vat`,
    },
    {
      id: 'unit-price',
      name: 'Compare Unit Prices',
      description: 'Compare prices of different package sizes',
      category: 'shopping',
      content: `# Compare Prices
// Package A
price_a = $5
size_a = 500
unit_a = price_a / size_a

// Package B
price_b = $8
size_b = 1000
unit_b = price_b / size_b`,
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
budget in JPY

// Mixed Currency Math
hotel = €80
flights = $450
hotel + flights in GBP`,
    },
    {
      id: 'currency-scales',
      name: 'Currency with Scales',
      description: 'Use k, M, billion with currencies',
      category: 'finance',
      content: `# Currency Scales
salary = $85k
bonus = $5k
total = salary + bonus

// Large Amounts
revenue = €3M
costs = €1.5M
profit = revenue - costs

// Convert Scaled Currency
$2k in EUR
£1 million in USD`,
    },
    {
      id: 'fuel-economy',
      name: 'Fuel Economy',
      description: 'Convert between fuel economy units',
      category: 'travel',
      content: `# Fuel Economy Conversions
// Miles per gallon to metric
30 mpg in kpl
30 mpg in l/100km

// Metric to imperial
12 kpl in mpg
8 l/100km in mpg

// UK vs US gallons
30 mpg in mpg_uk
30 miles per uk gallon in kpl

// Trip fuel calculation
distance = 200 km
efficiency = 10 kpl
fuel = distance / efficiency`,
    },
    {
      id: 'fuel-cost',
      name: 'Fuel Cost',
      description: 'Calculate fuel cost for a trip',
      category: 'travel',
      content: `# Fuel Cost
distance = 100 miles
mileage = 30 mpg
fuel = distance / mileage
price_per_gallon = $3.50
cost = fuel * price_per_gallon`,
    },
    {
      id: 'compound-interest',
      name: 'Compound Interest',
      description: 'Calculate compound interest growth',
      category: 'finance',
      content: `# Compound Interest
starting = $1000
interest = 110%
years = 3
final = starting * interest ^ years`,
    },
    {
      id: 'loan-payment',
      name: 'Loan Payment',
      description: 'Calculate monthly loan payment',
      category: 'finance',
      content: `# Loan Payment
loan = $10000
annual_rate = 0.05
months = 12
monthly_rate = annual_rate / 12
monthly_payment = loan * (monthly_rate * (1 + monthly_rate)^months) / ((1 + monthly_rate)^months - 1)`,
    },
    {
      id: 'savings',
      name: 'Savings Goal',
      description: 'Calculate monthly savings needed',
      category: 'finance',
      content: `# Savings Goal
goal = $5000
months = 12
monthly = goal / months`,
    },
    {
      id: 'budget',
      name: 'Monthly Budget',
      description: 'Track income and expenses with sub',
      category: 'finance',
      content: `# Monthly Budget
Salary: €1457
Food: €200
Fuel: €100
Car insurance: €60
Hobbies: €30
Fun: €100
Remaining: sub`,
    },
    {
      id: 'invoice',
      name: 'Invoice Total',
      description: 'Sum line items with tax',
      category: 'finance',
      content: `# Invoice

Web design: $500
Logo design: $200
Hosting setup: $150
Subtotal: sum

Tax: prev * 8.5%
Total: prev + Subtotal`,
    },
    {
      id: 'bmi',
      name: 'BMI Calculator',
      description: 'Calculate Body Mass Index',
      category: 'health',
      content: `# BMI Calculator
weight = 70
height = 1.75
bmi = weight / (height ^ 2)`,
    },
    {
      id: 'age',
      name: 'Age Calculator',
      description: 'Calculate age from birthdate',
      category: 'planning',
      content: `# Age Calculator
birthdate = today - 30 years
days_since = today - birthdate`,
    },
    {
      id: 'time-until',
      name: 'Time Until Event',
      description: 'Calculate time until future date',
      category: 'planning',
      content: `# Time Until
event = today + 2 weeks
days_left = event - today

// Date Keywords
today
tomorrow
yesterday
next week
next month
next year`,
    },
    {
      id: 'timezone',
      name: 'Timezone Converter',
      description: 'Convert times between timezones',
      category: 'travel',
      content: `# Timezone Converter
PST time
time in Madrid
time in Tokyo
2:30 pm HKT in Berlin

// Unix Timestamp
fromunix(1446587186)
fromunix(0)`,
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
hourly = monthly_salary / (hours_per_week * weeks_per_month)`,
    },
    {
      id: 'project-time',
      name: 'Project Time',
      description: 'Calculate project hours and cost',
      category: 'work',
      content: `# Project Time
hours = 40
hourly_rate = $50
total = hours * hourly_rate

// Time Conversions
1 week in hours
2.5 hours in minutes
1 year in days`,
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
flour = 200
sugar = 100
flour * scale
sugar * scale`,
    },
    {
      id: 'cooking-conversions',
      name: 'Cooking Conversions',
      description: 'Convert between cooking units',
      category: 'cooking',
      content: `# Cooking Conversions
// Volume
1 cup in ml
1 tablespoon in ml
1 teaspoon in ml
25 ml in tea spoons
1 pint in ml
1 quart in liters
1 gallon in liters

// Temperature
180 celsius in fahrenheit
350 fahrenheit in celsius
0 celsius in kelvin

// Weight
1 oz in g
1 lb in kg`,
    },
    {
      id: 'area-room',
      name: 'Room Area',
      description: 'Calculate room area and convert units',
      category: 'home',
      content: `# Room Area
length = 5 m
width = 4 m
area = length * width
area in sqft

// Other Area Conversions
1 acre in sqm
1 hectare in acres`,
    },
    {
      id: 'paint',
      name: 'Paint Calculator',
      description: 'Calculate paint needed for walls',
      category: 'home',
      content: `# Paint Needed
wall_height = 2.5
wall_lengths = 5 + 4 + 5 + 4
wall_area = wall_height * wall_lengths
coverage_per_liter = 10
liters_needed = wall_area / coverage_per_liter
price_per_liter = $15
cost = liters_needed * price_per_liter`,
    },
    {
      id: 'unit-conversions',
      name: 'Unit Conversions',
      description: 'Common unit conversions for length, weight, speed',
      category: 'learning',
      content: `# Unit Conversions

// Length
1 mile in km
1 foot in cm
1 inch in cm
1 yard in m
1 km + 500 m in m

// Weight
1 kg in lb
1 oz in g
1 tonne in kg
1 stone in lb

// Speed
100 kph in mph
60 mph in kph
1 knot in kph

// Data
1 GB in MB
1 TB in GB
1 GiB in MiB
1 byte in bits
1 KiB in bytes`,
    },
    {
      id: 'data-transfer',
      name: 'Data Transfer Time',
      description: 'Calculate file transfer time',
      category: 'dev',
      content: `# Data Transfer
file_size = 5 GB
file_size in MB
speed = 100
time_seconds = file_size in MB / speed
time_minutes = time_seconds / 60`,
    },
    {
      id: 'css-units',
      name: 'CSS Unit Converter',
      description: 'Convert between CSS units (px, pt, em, rem)',
      category: 'dev',
      content: `# CSS Units
// Default: 1em = 16px
12 pt in px
1 em in px
1 rem in px
1 inch in px

// Custom em size
em = 20
1.2 em in px

// Custom PPI
ppi = 326
1 cm in px`,
    },
    {
      id: 'number-formats',
      name: 'Number Formats',
      description: 'Binary, hex, octal conversions',
      category: 'dev',
      content: `# Number Formats
// Binary
0b1010
0b1010 + 0b0101
10 in bin

// Hexadecimal
0xFF
0xFF + 1
255 in hex

// Octal
0o1435343
8 in oct

// Scientific Notation
5300 in sci`,
    },
    {
      id: 'bitwise',
      name: 'Bitwise Operations',
      description: 'AND, OR, XOR, shifts',
      category: 'dev',
      content: `# Bitwise Operations
// AND, OR, XOR
12 & 10
12 | 10
12 xor 10

// Bit Shifts
1 << 4
16 >> 2

// Combine with hex
0xFF & 0x0F
0xFF | 0x0F`,
    },
    {
      id: 'math-functions',
      name: 'Math Functions',
      description: 'sqrt, log, round, trig, and more',
      category: 'learning',
      content: `# Math Functions
sqrt(16)
cbrt(8)
abs(-4)
log(100)
ln(2.718281828459045)
fact(5)

// Rounding
round(3.55)
ceil(3.76)
floor(2.56)

// Roots & Logs
root 2 (8)
root 3 (27)
log 2 (10)
log 10 (1000)

// Constants
pi
e
tau
phi`,
    },
    {
      id: 'trigonometry',
      name: 'Trigonometry',
      description: 'sin, cos, tan, and inverse functions',
      category: 'learning',
      content: `# Trigonometry
// Degrees (use ° symbol)
sin(45°)
cos(60°)
tan(45°)

// Inverse Trig
arcsin(1)
arccos(0)
arctan(1)

// Hyperbolic
sinh(1)
cosh(1)
tanh(1)

// Angular Conversion
180 degrees in radians
90° in radians`,
    },
    {
      id: 'scales-and-big-numbers',
      name: 'Scales & Big Numbers',
      description: 'Use k, M, billion, trillion shorthand',
      category: 'learning',
      content: `# Scales
5k
2M
1 billion
1.5M - 500k
2k + 500

// With Units
2k meters in km
5k seconds in hours
500k bytes in MB
1 million seconds in days`,
    },
    {
      id: 'sum-and-average',
      name: 'Sum, Sub & Average',
      description: 'Aggregate lines with sum, sub, and average',
      category: 'learning',
      content: `# Sum
10
15
25
sum

// Sum with Labels
Item 1: 10
Item 2: 20
Item 3: 30
Total: sum

# Sub
// First line minus all others
2
3
4
sub

// Budget with Sub
Salary: €1457
Food: €200
Fuel: €100
Remaining: sub

# Average
85
90
78
92
average

// Sum with Operations
100
200
sum - 10%`,
    },
    {
      id: 'variables-and-prev',
      name: 'Variables & Prev',
      description: 'Use variables and reference previous results',
      category: 'learning',
      content: `# Variables
x = 10
y = 20
x + y
x * y

// Prev references the line above
20 + 56
prev - 5%

// Labels with Prev
Cost: $20 + $56
Discounted: prev - 10%`,
    },
    {
      id: 'word-operators',
      name: 'Word Operators',
      description: 'Use English words for math operations',
      category: 'learning',
      content: `# Word Operators
5 plus 3
10 minus 3
8 times 9
20 divide by 4
17 mod 5

// Also works with
5 and 3
5 with 3
10 without 3
10 subtract 3
8 multiplied by 9`,
    },
  ]

  const categories = [
    { id: 'all', name: 'All Templates' },
    { id: 'shopping', name: 'Shopping' },
    { id: 'dining', name: 'Dining' },
    { id: 'travel', name: 'Travel' },
    { id: 'finance', name: 'Finance' },
    { id: 'work', name: 'Work' },
    { id: 'cooking', name: 'Cooking' },
    { id: 'home', name: 'Home' },
    { id: 'health', name: 'Health' },
    { id: 'planning', name: 'Planning' },
    { id: 'dev', name: 'Dev' },
    { id: 'learning', name: 'Learning' },
  ]

  const getTemplates = (category = 'all') => {
    if (category === 'all') return templates
    return templates.filter((t) => t.category === category)
  }

  const getTemplate = (id) => {
    return templates.find((t) => t.id === id)
  }

  return {
    templates,
    categories,
    getTemplates,
    getTemplate,
  }
}
