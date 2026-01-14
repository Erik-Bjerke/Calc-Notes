// Monaco Editor language definition for CalcNotes (.cnt files)
export const useMonacoCalcLanguage = () => {
  const registerCalcLanguage = (monaco) => {
    // Register the language
    monaco.languages.register({ id: 'calcnotes', extensions: ['.cnt'] })

    // Define the language tokens
    monaco.languages.setMonarchTokensProvider('calcnotes', {
      tokenizer: {
        root: [
          // Markdown headers - must be at start of line
          [/^#.*$/, 'header'],

          // Comments - must be at start of line
          [/^\/\/.*$/, 'comment'],

          // Labels (anything with colon at start of line)
          [/^[^:\n]+:/, 'label'],

          // Date/time keywords (with word boundaries)
          [/\b(now|time|today|yesterday|tomorrow)\b/, 'date'],
          [/\b(next|last)\s+(week|month|year)\b/, 'date'],

          // Special keywords (sum, average, etc.) - with word boundaries
          [/\b(sum|total|average|avg|prev)\b/, 'keyword'],

          // Conversion keywords - with word boundaries
          [/\b(in|to|as|into|of|on|off)\b/, 'conversion'],

          // Word operators - with word boundaries
          [/\b(plus|minus|times|divide|mod|and|with|without)\b/, 'operator'],

          // Functions with parentheses - with word boundaries
          [/\b(sqrt|cbrt|abs|log|ln|fact|round|ceil|floor|sin|cos|tan|fromunix)\s*\(/, 'function'],

          // Constants - separate "e" to avoid matching inside words
          [/\b(pi|tau|phi)\b/, 'constant'],
          [/\bc\b/, 'constant'], // Speed of light
          [/\be\b/, 'constant'], // Euler's number - only standalone

          // Currency symbols
          [/[$€£¥₹₽]/, 'currency'],

          // Currency codes - with word boundaries
          [/\b(USD|EUR|GBP|JPY|INR|RUB|CAD|AUD|CHF|CNY)\b/i, 'currency'],

          // Percentages (MUST come before plain numbers)
          [/\d+\.?\d*\s*%/, 'percentage'],

          // Numbers with specific units (to avoid matching variable names)
          [/\d+\.?\d*\s*(km|m|cm|mm|ft|inch|in|yd|mi|kg|g|mg|lb|oz|l|ml|gal|qt|pt|sec|min|hour|day|week|month|year|KB|MB|GB|TB|px|pt|em|rem)\b/, 'number'],

          // Plain numbers
          [/\d+\.?\d*/, 'number'],

          // Operators (symbol operators)
          [/[+\-*\/^%]/, 'operator'],

          // Assignment and comparison
          [/[=<>!&|]/, 'operator'],

          // Parentheses
          [/[()]/, 'bracket'],

          // Variables (identifiers) - same color for declaration and usage
          [/\b[a-zA-Z_]\w*\b/, 'variable'],
        ],
      },
    })

    // Define light theme (VSCode default light)
    monaco.editor.defineTheme('calcnotes-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'header', foreground: '0000ff', fontStyle: 'bold' },
        { token: 'comment', foreground: '008000', fontStyle: 'italic' },
        { token: 'label', foreground: '001080', fontStyle: 'bold' },
        { token: 'keyword', foreground: '0000ff', fontStyle: 'bold' },
        { token: 'conversion', foreground: '0000ff' },
        { token: 'date', foreground: 'a31515' },
        { token: 'function', foreground: '795e26' },
        { token: 'constant', foreground: '0070c1' },
        { token: 'currency', foreground: '098658' },
        { token: 'percentage', foreground: '098658' },
        { token: 'number', foreground: '098658' },
        { token: 'variable', foreground: '001080' },
        { token: 'operator', foreground: '000000' },
        { token: 'bracket', foreground: '000000' },
      ],
      colors: {
        'editor.foreground': '#000000',
        'editor.background': '#ffffff',
        'editor.lineHighlightBackground': '#f0f0f0',
        'editorLineNumber.foreground': '#237893',
        'editorLineNumber.activeForeground': '#0b216f',
        'editorCursor.foreground': '#000000',
        'editor.selectionBackground': '#add6ff',
      },
    })

    // Define dark theme (VSCode default dark)
    monaco.editor.defineTheme('calcnotes-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'header', foreground: '569cd6', fontStyle: 'bold' },
        { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
        { token: 'label', foreground: '9cdcfe', fontStyle: 'bold' },
        { token: 'keyword', foreground: '569cd6', fontStyle: 'bold' },
        { token: 'conversion', foreground: '569cd6' },
        { token: 'date', foreground: 'ce9178' },
        { token: 'function', foreground: 'dcdcaa' },
        { token: 'constant', foreground: '4fc1ff' },
        { token: 'currency', foreground: 'b5cea8' },
        { token: 'percentage', foreground: 'b5cea8' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'variable', foreground: '9cdcfe' },
        { token: 'operator', foreground: 'd4d4d4' },
        { token: 'bracket', foreground: 'ffd700' },
      ],
      colors: {
        'editor.foreground': '#d4d4d4',
        'editor.background': '#1e1e1e',
        'editor.lineHighlightBackground': '#282828',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#c6c6c6',
        'editorCursor.foreground': '#aeafad',
        'editor.selectionBackground': '#264f78',
      },
    })

    // Configure language features
    monaco.languages.setLanguageConfiguration('calcnotes', {
      comments: {
        lineComment: '//',
      },
      brackets: [
        ['(', ')'],
      ],
      autoClosingPairs: [
        { open: '(', close: ')' },
      ],
    })
  }

  return {
    registerCalcLanguage,
  }
}
