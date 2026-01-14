<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    @click="close">
    <div class="bg-white dark:bg-gray-925 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden" @click.stop>
      <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-400">{{ $t('help.title') }}</h2>
        <button @click="close" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white">
          <Icon name="mdi:close" class="w-6 h-6" />
        </button>
      </div>

      <!-- Tabs -->
      <div class="border-b border-gray-200 dark:border-gray-800">
        <div class="flex overflow-x-auto">
          <button v-for="tab in tabs" :key="tab.id" @click="activeTab = tab.id"
            class="px-6 py-3 text-sm font-medium whitespace-nowrap transition-colors" :class="activeTab === tab.id
              ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'">
            {{ tab.label }}
          </button>
        </div>
      </div>

      <div class="overflow-y-auto p-6 max-h-[calc(90vh-140px)]">
        <!-- Basics Tab -->
        <div v-show="activeTab === 'basics'" class="space-y-6">
          <section>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-400 mb-3">{{ $t('help.basics.title') }}</h3>
            <div class="space-y-2 text-sm text-gray-700 dark:text-gray-400">
              <p>{{ $t('help.basics.desc') }}</p>
              <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono text-xs space-y-1">
                <div>10 + 20 <span class="text-primary-600 dark:text-primary-400">= 30</span></div>
                <div>100 * 1.5 <span class="text-primary-600 dark:text-primary-400">= 150</span></div>
                <div>50 minus 10 <span class="text-primary-600 dark:text-primary-400">= 40</span></div>
                <div>20 times 5 <span class="text-primary-600 dark:text-primary-400">= 100</span></div>
                <div>2 ^ 8 <span class="text-primary-600 dark:text-primary-400">= 256</span></div>
                <div>17 mod 5 <span class="text-primary-600 dark:text-primary-400">= 2</span></div>
              </div>
            </div>
          </section>

          <section>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-400 mb-3">Operators</h3>
            <div class="space-y-2 text-sm text-gray-700 dark:text-gray-400">
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  <span class="font-semibold">Addition:</span> +, plus, and, with
                </div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  <span class="font-semibold">Subtraction:</span> -, minus, subtract, without
                </div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  <span class="font-semibold">Multiplication:</span> *, times, multiplied by, mul
                </div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  <span class="font-semibold">Division:</span> /, divide, divide by
                </div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  <span class="font-semibold">Exponent:</span> ^
                </div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  <span class="font-semibold">Modulo:</span> mod, %
                </div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  <span class="font-semibold">Bitwise AND:</span> &
                </div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  <span class="font-semibold">Bitwise OR:</span> |
                </div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  <span class="font-semibold">Bitwise XOR:</span> xor
                </div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  <span class="font-semibold">Left Shift:</span> &lt;&lt;
                </div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  <span class="font-semibold">Right Shift:</span> &gt;&gt;
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-400 mb-3">{{ $t('help.variables.title') }}
            </h3>
            <div class="space-y-2 text-sm text-gray-700 dark:text-gray-400">
              <p>{{ $t('help.variables.desc') }}</p>
              <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono text-xs space-y-1">
                <div>price = 100 <span class="text-primary-600 dark:text-primary-400">= 100</span></div>
                <div>tax = price * 0.2 <span class="text-primary-600 dark:text-primary-400">= 20</span></div>
                <div>total = price + tax <span class="text-primary-600 dark:text-primary-400">= 120</span></div>
              </div>
            </div>
          </section>

          <section>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-400 mb-3">{{ $t('help.percentages.title') }}
            </h3>
            <div class="space-y-3 text-sm text-gray-700 dark:text-gray-400">
              <p class="font-medium">Percentages work consistently across all operators:</p>

              <div>
                <p class="font-semibold text-gray-900 dark:text-gray-400 mb-2">Contextual (Addition & Subtraction)</p>
                <p class="text-xs mb-2">Apply percentage to base, then add/subtract:</p>
                <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono text-xs space-y-1">
                  <div>100 + 20% <span class="text-primary-600 dark:text-primary-400">= 120</span> <span
                      class="text-gray-500 dark:text-gray-400-muted">// Add 20% of 100</span></div>
                  <div>100 - 15% <span class="text-primary-600 dark:text-primary-400">= 85</span> <span
                      class="text-gray-500 dark:text-gray-400-muted">// Subtract 15% of 100</span></div>
                  <div>200 + 10% <span class="text-primary-600 dark:text-primary-400">= 220</span> <span
                      class="text-gray-500 dark:text-gray-400-muted">// Add 10% of 200</span></div>
                  <div>200 - 10% <span class="text-primary-600 dark:text-primary-400">= 180</span> <span
                      class="text-gray-500 dark:text-gray-400-muted">// Subtract 10% of 200</span></div>
                </div>
              </div>

              <div>
                <p class="font-semibold text-gray-900 dark:text-gray-400 mb-2">Literal (Multiplication & Division)</p>
                <p class="text-xs mb-2">Treat percentage as decimal (standard calculator):</p>
                <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono text-xs space-y-1">
                  <div>100 * 5% <span class="text-primary-600 dark:text-primary-400">= 5</span> <span
                      class="text-gray-500 dark:text-gray-400-muted">// 100 × 0.05</span></div>
                  <div>100 / 5% <span class="text-primary-600 dark:text-primary-400">= 2000</span> <span
                      class="text-gray-500 dark:text-gray-400-muted">// 100 ÷ 0.05</span></div>
                  <div>200 * 10% <span class="text-primary-600 dark:text-primary-400">= 20</span> <span
                      class="text-gray-500 dark:text-gray-400-muted">// 200 × 0.10</span></div>
                </div>
              </div>

              <div>
                <p class="font-semibold text-gray-900 dark:text-gray-400 mb-2">Explicit Keywords</p>
                <p class="text-xs mb-2">Use keywords for clarity:</p>
                <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono text-xs space-y-1">
                  <div>20% of 100 <span class="text-primary-600 dark:text-primary-400">= 20</span> <span
                      class="text-gray-500 dark:text-gray-400-muted">// Calculate percentage</span></div>
                  <div>10% on 200 <span class="text-primary-600 dark:text-primary-400">= 220</span> <span
                      class="text-gray-500 dark:text-gray-400-muted">// Add percentage</span></div>
                  <div>10% off 50 <span class="text-primary-600 dark:text-primary-400">= 45</span> <span
                      class="text-gray-500 dark:text-gray-400-muted">// Subtract percentage</span></div>
                </div>
              </div>

              <div>
                <p class="font-semibold text-gray-900 dark:text-gray-400 mb-2">Real-World Examples</p>
                <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono text-xs space-y-1">
                  <div class="text-gray-500 dark:text-gray-400-muted">// Shopping discount</div>
                  <div>price = $100</div>
                  <div>final = price - 20% <span class="text-primary-600 dark:text-primary-400">= 80 USD</span></div>
                  <div class="mt-2 text-gray-500 dark:text-gray-400-muted">// Tax calculation</div>
                  <div>subtotal = $100</div>
                  <div>tax = 8.5% of subtotal <span class="text-primary-600 dark:text-primary-400">= 8.5 USD</span>
                  </div>
                  <div>total = subtotal + tax <span class="text-primary-600 dark:text-primary-400">= 108.5 USD</span>
                  </div>
                  <div class="mt-2 text-gray-500 dark:text-gray-400-muted">// Tip calculation</div>
                  <div>bill = $85</div>
                  <div>tip = 18% of bill <span class="text-primary-600 dark:text-primary-400">= 15.3 USD</span></div>
                  <div>total = bill + 18% <span class="text-primary-600 dark:text-primary-400">= 100.3 USD</span></div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <!-- Currency Tab -->
        <div v-show="activeTab === 'currency'" class="space-y-6">
          <section>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-400 mb-3">{{ $t('help.currency.title') }}</h3>
            <div class="space-y-2 text-sm text-gray-700 dark:text-gray-400">
              <p>{{ $t('help.currency.desc') }}</p>
              <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono text-xs space-y-1">
                <div>$100 + $50 <span class="text-primary-600 dark:text-primary-400">= 150 USD</span></div>
                <div>€200 - €75 <span class="text-primary-600 dark:text-primary-400">= 125 EUR</span></div>
                <div>£50 * 2 <span class="text-primary-600 dark:text-primary-400">= 100 GBP</span></div>
              </div>
              <p class="mt-3 font-semibold">Currency Conversion:</p>
              <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono text-xs space-y-1">
                <div>$100 in EUR <span class="text-primary-600 dark:text-primary-400">= 92 EUR</span></div>
                <div>£50 to USD <span class="text-primary-600 dark:text-primary-400">= 63.29 USD</span></div>
                <div>€100 as GBP <span class="text-primary-600 dark:text-primary-400">= 85.87 GBP</span></div>
              </div>
              <p class="mt-3 text-xs">Supported: USD ($), EUR (€), GBP (£), JPY (¥), INR (₹), RUB (₽), CAD, AUD, CHF,
                CNY</p>
            </div>
          </section>
        </div>

        <!-- Units Tab -->
        <div v-show="activeTab === 'units'" class="space-y-6">
          <section>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-400 mb-3">{{ $t('help.units.title') }}</h3>
            <div class="space-y-3 text-sm text-gray-700 dark:text-gray-400">
              <div>
                <p class="font-semibold text-gray-900 dark:text-gray-400 mb-2">Length</p>
                <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono text-xs space-y-1">
                  <div>100 cm in meters <span class="text-primary-600 dark:text-primary-400">= 1 meters</span></div>
                  <div>5 feet to inches <span class="text-primary-600 dark:text-primary-400">= 60 inches</span></div>
                  <div>10 km in miles <span class="text-primary-600 dark:text-primary-400">= 6.21 miles</span></div>
                </div>
              </div>

              <div>
                <p class="font-semibold text-gray-900 dark:text-gray-400 mb-2">Weight</p>
                <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono text-xs space-y-1">
                  <div>100 kg in lbs <span class="text-primary-600 dark:text-primary-400">= 220.46 lbs</span></div>
                  <div>5 pounds to kg <span class="text-primary-600 dark:text-primary-400">= 2.27 kg</span></div>
                  <div>2 stone in kg <span class="text-primary-600 dark:text-primary-400">= 12.7 kg</span></div>
                </div>
              </div>

              <div>
                <p class="font-semibold text-gray-900 dark:text-gray-400 mb-2">Volume</p>
                <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono text-xs space-y-1">
                  <div>2 liters in gallons <span class="text-primary-600 dark:text-primary-400">= 0.528 gallons</span>
                  </div>
                  <div>500 ml to cups <span class="text-primary-600 dark:text-primary-400">= 2.11 cups</span></div>
                  <div>1 gallon in liters <span class="text-primary-600 dark:text-primary-400">= 3.79 liters</span>
                  </div>
                </div>
              </div>

              <div>
                <p class="font-semibold text-gray-900 dark:text-gray-400 mb-2">Area</p>
                <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono text-xs space-y-1">
                  <div>100 m2 in ft2 <span class="text-primary-600 dark:text-primary-400">= 1076.39 ft2</span></div>
                  <div>1 acre in m2 <span class="text-primary-600 dark:text-primary-400">= 4046.86 m2</span></div>
                  <div>5 km2 in hectares <span class="text-primary-600 dark:text-primary-400">= 500 hectares</span>
                  </div>
                </div>
              </div>

              <div>
                <p class="font-semibold text-gray-900 dark:text-gray-400 mb-2">Temperature</p>
                <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono text-xs space-y-1">
                  <div>100 celsius in fahrenheit <span class="text-primary-600 dark:text-primary-400">= 212
                      fahrenheit</span></div>
                  <div>32 fahrenheit to celsius <span class="text-primary-600 dark:text-primary-400">= 0 celsius</span>
                  </div>
                  <div>273 kelvin in celsius <span class="text-primary-600 dark:text-primary-400">= -0.15 celsius</span>
                  </div>
                </div>
              </div>

              <div>
                <p class="font-semibold text-gray-900 dark:text-gray-400 mb-2">Time</p>
                <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono text-xs space-y-1">
                  <div>3600 seconds in hours <span class="text-primary-600 dark:text-primary-400">= 1 hours</span></div>
                  <div>2 weeks in days <span class="text-primary-600 dark:text-primary-400">= 14 days</span></div>
                  <div>365 days in years <span class="text-primary-600 dark:text-primary-400">= 1 years</span></div>
                </div>
              </div>

              <div>
                <p class="font-semibold text-gray-900 dark:text-gray-400 mb-2">Speed</p>
                <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono text-xs space-y-1">
                  <div>100 km/h in mph <span class="text-primary-600 dark:text-primary-400">= 62.14 mph</span></div>
                  <div>60 mph to m/s <span class="text-primary-600 dark:text-primary-400">= 26.82 m/s</span></div>
                  <div>20 knots in km/h <span class="text-primary-600 dark:text-primary-400">= 37.04 km/h</span></div>
                </div>
              </div>

              <div>
                <p class="font-semibold text-gray-900 dark:text-gray-400 mb-2">Data</p>
                <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono text-xs space-y-1">
                  <div>100 MB in GB <span class="text-primary-600 dark:text-primary-400">= 0.1 GB</span></div>
                  <div>1 GiB in MiB <span class="text-primary-600 dark:text-primary-400">= 1024 MiB</span></div>
                  <div>8 bits in bytes <span class="text-primary-600 dark:text-primary-400">= 1 bytes</span></div>
                </div>
                <p class="text-xs italic mt-2">Note: KB/MB/GB use 1000, KiB/MiB/GiB use 1024</p>
              </div>

              <div>
                <p class="font-semibold text-gray-900 dark:text-gray-400 mb-2">CSS Units</p>
                <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono text-xs space-y-1">
                  <div>16 px in em <span class="text-primary-600 dark:text-primary-400">= 1 em</span></div>
                  <div>2 em in px <span class="text-primary-600 dark:text-primary-400">= 32 px</span></div>
                  <div>12 pt in px <span class="text-primary-600 dark:text-primary-400">= 16 px</span></div>
                </div>
                <p class="text-xs italic mt-2">Note: 1em = 16px (default), 1pt = 1.333px</p>
              </div>
            </div>
          </section>

          <section>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-400 mb-3">{{ $t('help.si.title') }}</h3>
            <div class="space-y-2 text-sm text-gray-700 dark:text-gray-400">
              <p>{{ $t('help.si.desc') }}</p>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">k (kilo) = 10³</div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">M (mega) = 10⁶</div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">G (giga) = 10⁹</div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">T (tera) = 10¹²</div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">m (milli) = 10⁻³</div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">μ (micro) = 10⁻⁶</div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">n (nano) = 10⁻⁹</div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">p (pico) = 10⁻¹²</div>
              </div>
              <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono text-xs space-y-1 mt-3">
                <div>100 km <span class="text-gray-500">// kilometer</span></div>
                <div>500 MB <span class="text-gray-500">// megabyte</span></div>
                <div>2 Gm in km <span class="text-gray-500">// gigameter to kilometer</span></div>
                <div>50 mm in cm <span class="text-gray-500">// millimeter to centimeter</span></div>
              </div>
              <p class="text-xs italic mt-2">Note: SI prefixes are case-sensitive. Use MB for megabytes, not mB.</p>
            </div>
          </section>
        </div>

        <!-- Functions Tab -->
        <div v-show="activeTab === 'functions'" class="space-y-6">
          <section>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-400 mb-3">{{ $t('help.functions.title') }}
            </h3>
            <div class="space-y-2 text-sm text-gray-700 dark:text-gray-400">
              <p>{{ $t('help.functions.desc') }}</p>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">sqrt(16) = 4</div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">cbrt(8) = 2</div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">abs(-5) = 5</div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">round(3.7) = 4</div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">ceil(3.2) = 4</div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">floor(3.8) = 3</div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">sin(45°) = 0.707</div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">cos(90°) = 0</div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">tan(45°) = 1</div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">log(100) = 2</div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">ln(10) = 2.303</div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">fact(5) = 120</div>
              </div>
            </div>
          </section>

          <section>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-400 mb-3">{{ $t('help.constants.title') }}
            </h3>
            <div class="space-y-2 text-sm text-gray-700 dark:text-gray-400">
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">pi = 3.14159...</div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">e = 2.71828...</div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">tau = 6.28318...</div>
                <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded">phi = 1.61803...</div>
              </div>
            </div>
          </section>

          <section>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-400 mb-3">{{ $t('help.special.title') }}</h3>
            <div class="space-y-2 text-sm text-gray-700 dark:text-gray-400">
              <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono text-xs space-y-1">
                <div>prev <span class="text-gray-500">// Previous result</span></div>
                <div>sum <span class="text-gray-500">// Sum all lines above</span></div>
                <div>average <span class="text-gray-500">// Average all lines above</span></div>
                <div>sum in USD <span class="text-gray-500">// Sum with currency conversion</span></div>
              </div>
            </div>
          </section>

          <section>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-400 mb-3">Date & Time</h3>
            <div class="space-y-2 text-sm text-gray-700 dark:text-gray-400">
              <p>Get current date/time and perform date arithmetic.</p>
              <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono text-xs space-y-1">
                <div class="font-semibold text-gray-600 dark:text-gray-400-muted">Current:</div>
                <div>now <span class="text-gray-500">// Current date and time</span></div>
                <div>today <span class="text-gray-500">// Today at midnight</span></div>
                <div class="font-semibold text-gray-600 dark:text-gray-400-muted mt-2">Shortcuts:</div>
                <div>yesterday <span class="text-gray-500">// Yesterday</span></div>
                <div>tomorrow <span class="text-gray-500">// Tomorrow</span></div>
                <div>next week <span class="text-gray-500">// 7 days from now</span></div>
                <div>last week <span class="text-gray-500">// 7 days ago</span></div>
                <div>next month <span class="text-gray-500">// Next month</span></div>
                <div>last month <span class="text-gray-500">// Last month</span></div>
                <div>next year <span class="text-gray-500">// Next year</span></div>
                <div>last year <span class="text-gray-500">// Last year</span></div>
                <div class="font-semibold text-gray-600 dark:text-gray-400-muted mt-2">Arithmetic:</div>
                <div>today + 2 weeks <span class="text-gray-500">// Date arithmetic</span></div>
                <div>tomorrow + 3 days <span class="text-gray-500">// Combine shortcuts</span></div>
                <div>yesterday - 1 month <span class="text-gray-500">// Subtract time</span></div>
                <div>fromunix(1446587186) <span class="text-gray-500">// Convert Unix timestamp</span></div>
              </div>
              <p class="text-xs italic mt-2">Supported units: second, minute, hour, day, week, month, year</p>
            </div>
          </section>
        </div>

        <!-- Formatting Tab -->
        <div v-show="activeTab === 'formatting'" class="space-y-6">
          <section>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-400 mb-3">{{ $t('help.formatting.title') }}
            </h3>
            <div class="space-y-2 text-sm text-gray-700 dark:text-gray-400">
              <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono text-xs space-y-1">
                <div># Header <span class="text-gray-500">// Large bold text</span></div>
                <div>// Comment <span class="text-gray-500">// Italic gray text</span></div>
                <div>Label: <span class="text-gray-500">// Bold label</span></div>
                <div>Price: $100 * 2 <span class="text-gray-500">// Label with calculation</span></div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close'])

const activeTab = ref('basics')

const tabs = [
  { id: 'basics', label: 'Basics' },
  { id: 'currency', label: 'Currency' },
  { id: 'units', label: 'Units' },
  { id: 'functions', label: 'Functions' },
  { id: 'formatting', label: 'Formatting' },
]

const close = () => {
  emit('close')
}
</script>
