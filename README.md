# Calculator Notes App

A powerful note-taking application with built-in calculator features, built with Nuxt 3. Combines the simplicity of note-taking with live mathematical calculations, unit conversions, and more.

## Features

- 🧮 **Live Calculator** - Type calculations naturally and see results instantly
- 📝 **Note Taking** - Organize your calculations and notes
- 💾 **Auto-Save** - Everything saves automatically to local storage
- 📱 **Mobile Friendly** - Responsive design with mobile-optimized toolbar
- ✨ **Markdown Support** - Format your notes with markdown syntax
- 🎨 **Syntax Highlighting** - Color-coded calculator expressions
- 🗂️ **Note Management** - Create, edit, delete, and organize notes
- 🏷️ **Metadata** - Add titles and descriptions to your notes
- 🌓 **Theme Switching** - Light and dark mode with system preference detection
- 🌐 **Multi-Language** - English (UK) and Spanish support with easy switching

## Calculator Features

### Basic Operations
```
10 + 20              // Addition
50 minus 10          // Natural language
20 times 5           // Word operators
2 ^ 8                // Exponents
```

### Variables
```
price = 100
tax = price * 0.2
total = price + tax
```

### Unit Conversions
```
100 km in miles
5 feet to inches
100 celsius in fahrenheit
2 liters in gallons
```

### Currency
```
$100 + $50
€200 - €75
$100 in EUR
```

### Functions
- Math: `sqrt()`, `abs()`, `round()`, `ceil()`, `floor()`
- Trig: `sin()`, `cos()`, `tan()`
- More: `log()`, `ln()`, `fact()`

### Special Features
- `sum` or `total` - Sum all lines above
- `average` or `avg` - Average all lines above
- `prev` - Reference previous result
- Date/time: `now`, `today`, `tomorrow + 3 days`

## Markdown Formatting

The toolbar provides quick access to markdown formatting:

- **Bold** - `**text**`
- *Italic* - `*text*`
- ~~Strikethrough~~ - `~~text~~`
- # Heading - `# text`
- List - `- item`
- Checklist - `- [ ] task`
- Quote - `> text`
- Code - `` `code` ``
- Link - `[text](url)`

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Usage

1. **Create a Note** - Click "New Note" in the sidebar
2. **Type Calculations** - Write math naturally, see results on the right
3. **Format Text** - Use toolbar for markdown or calculator syntax
4. **Edit Details** - Click note title to edit name and description
5. **Switch Notes** - Click any note in sidebar to switch
6. **Delete Notes** - Click trash icon to delete
7. **Change Theme** - Click sun/moon icon to toggle light/dark mode
8. **Change Language** - Click translate icon to switch languages

All changes save automatically to local storage.

## Customization

### Theme
- Click the sun/moon icon (☀️/🌙) in the toolbar to toggle between light and dark modes
- Theme preference is saved and persists across sessions
- Automatically detects system preference on first visit

### Language
- Click the translate icon (🌐) in the toolbar to open language menu
- Currently supports English (UK) and Spanish
- Language preference is saved and persists across sessions
- See `THEME_AND_I18N.md` for instructions on adding more languages

## Tech Stack

- **Nuxt 3** - Vue.js framework
- **Vue 3** - Progressive JavaScript framework
- **Tailwind CSS** - Utility-first CSS framework
- **@nuxtjs/color-mode** - Theme switching support
- **nuxt-i18n-micro** - Internationalization
- **Local Storage API** - Browser storage for persistence

## Documentation

- `THEME_AND_I18N.md` - Theme and language switching documentation
- `UI_GUIDE.md` - UI/UX guide and color palette
- `CHANGES_SUMMARY.md` - Recent changes and updates
- `BEFORE_AFTER.md` - Visual comparison of improvements

## License

GPLv3 - See LICENSE file for details
