// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  // Workaround for https://github.com/nuxt/nuxt/issues/34812
  // Remove the @nuxt/nitro-server duplicate useAppConfig auto-import
  // (safe to remove once the upstream fix lands)
  hooks: {
    'nitro:config'(nitroConfig) {
      const imports = nitroConfig.imports
      if (imports && typeof imports === 'object' && 'imports' in imports && imports.imports) {
        imports.imports = imports.imports.filter(
          (i) =>
            !(
              (i as { name?: string })?.name === 'useAppConfig' &&
              String((i as { from?: string })?.from || '').includes('nitro-server')
            ),
        )
      }
    },
  },

  app: {
    head: {
      title: 'Numori Notes — notes that calculate',
      htmlAttrs: { lang: 'en' },
      meta: [
        {
          name: 'viewport',
          content:
            'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
        },
        {
          name: 'description',
          content:
            'Free, open-source notes app with a built-in natural language calculator. Do math as you write, export to multiple formats, and sync with end-to-end encryption.',
        },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'Numori Notes' },
        { name: 'application-name', content: 'Numori Notes' },
        { name: 'theme-color', content: '#ffffff' },
        { name: 'og:title', content: 'Numori Notes — notes that calculate' },
        {
          name: 'og:description',
          content:
            'Free, open-source notes app with a built-in natural language calculator. Do math as you write, export to multiple formats, and sync with end-to-end encryption.',
        },
        { name: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: 'Numori Notes — notes that calculate' },
        {
          name: 'twitter:description',
          content:
            'Free, open-source notes app with a built-in natural language calculator. Do math as you write, export to multiple formats, and sync with end-to-end encryption.',
        },
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/favicon.ico' },
      ],
    },
  },
  modules: [
    '@vueuse/nuxt',
    '@nuxt/icon',
    '@nuxt/fonts',
    '@nuxt/eslint',
    '@nuxtjs/i18n',
    '@nuxtjs/tailwindcss',
    '@nuxtjs/color-mode',
    'nuxt-codemirror',
    '~/modules/version',
  ],
  icon: {
    // Ensure all icons are bundled into the app — no network requests at runtime.
    // This is critical for the mobile app which must work fully offline.
    provider: 'server',
    serverBundle: 'local',
    clientBundle: {
      scan: true,
      includeCustomCollections: true,
      // Explicitly list every MDI icon used in the app so they are guaranteed
      // to be embedded in the JS bundle even when scan fails to detect them.
      icons: [
        'mdi:account',
        'mdi:account-circle-outline',
        'mdi:account-edit-outline',
        'mdi:account-group',
        'mdi:account-group-outline',
        'mdi:account-lock-outline',
        'mdi:download-outline',
        'mdi:account-outline',
        'mdi:account-remove-outline',
        'mdi:alert-circle',
        'mdi:alert-circle-outline',
        'mdi:alert-outline',
        'mdi:alpha-k-box-outline',
        'mdi:animation-outline',
        'mdi:archive-off-outline',
        'mdi:archive-outline',
        'mdi:arrow-expand-down',
        'mdi:arrow-expand-vertical',
        'mdi:arrow-left',
        'mdi:backspace-outline',
        'mdi:calculator',
        'mdi:calculator-variant-outline',
        'mdi:calendar-clock',
        'mdi:calendar-outline',
        'mdi:camera',
        'mdi:cellphone-remove',
        'mdi:chart-bar',
        'mdi:check',
        'mdi:checkbox-multiple-marked-outline',
        'mdi:check-circle',
        'mdi:chevron-double-left',
        'mdi:chevron-double-right',
        'mdi:chevron-down',
        'mdi:chevron-left',
        'mdi:chevron-right',
        'mdi:chevron-up',
        'mdi:clipboard-text-outline',
        'mdi:clock-outline',
        'mdi:close',
        'mdi:close-circle',
        'mdi:cloud-sync-outline',
        'mdi:code-braces',
        'mdi:code-brackets',
        'mdi:code-json',
        'mdi:code-tags',
        'mdi:cog-outline',
        'mdi:content-copy',
        'mdi:content-duplicate',
        'mdi:cup-water',
        'mdi:currency-usd',
        'mdi:cursor-text',
        'mdi:database-export',
        'mdi:database-off-outline',
        'mdi:database-remove-outline',
        'mdi:decimal',
        'mdi:decimal-decrease',
        'mdi:decimal-increase',
        'mdi:delete',
        'mdi:delete-empty-outline',
        'mdi:delete-forever-outline',
        'mdi:delete-outline',
        'mdi:devices',
        'mdi:dots-vertical',
        'mdi:download',
        'mdi:earth',
        'mdi:email',
        'mdi:email-alert-outline',
        'mdi:email-lock-outline',
        'mdi:email-outline',
        'mdi:export',
        'mdi:eye-off-outline',
        'mdi:eye-outline',
        'mdi:file-document-outline',
        'mdi:file-export-outline',
        'mdi:file-pdf-box',
        'mdi:file-plus-outline',
        'mdi:file-search-outline',
        'mdi:fingerprint',
        'mdi:fingerprint-off',
        'mdi:folder-open-outline',
        'mdi:folder-outline',
        'mdi:folder-plus-outline',
        'mdi:folder-remove-outline',
        'mdi:folder-swap-outline',
        'mdi:format-bold',
        'mdi:format-color-highlight',
        'mdi:format-font',
        'mdi:format-header-pound',
        'mdi:format-indent-decrease',
        'mdi:format-indent-increase',
        'mdi:format-italic',
        'mdi:format-letter-matches',
        'mdi:format-line-spacing',
        'mdi:format-list-numbered',
        'mdi:format-size',
        'mdi:format-text',
        'mdi:fullscreen',
        'mdi:fullscreen-exit',
        'mdi:function-variant',
        'mdi:gas-station-outline',
        'mdi:gate-and',
        'mdi:github',
        'mdi:heart-outline',
        'mdi:help-circle-outline',
        'mdi:image-plus',
        'mdi:information',
        'mdi:information-outline',
        'mdi:keyboard-close',
        'mdi:keyboard-outline',
        'mdi:keyboard-tab',
        'mdi:key-outline',
        'mdi:key-variant',
        'mdi:language-css3',
        'mdi:language-markdown-outline',
        'mdi:license',
        'mdi:lightbulb-outline',
        'mdi:link-variant',
        'mdi:link-variant-off',
        'mdi:loading',
        'mdi:lock',
        'mdi:lock-open-outline',
        'mdi:lock-outline',
        'mdi:login',
        'mdi:logout',
        'mdi:logout-variant',
        'mdi:magnify',
        'mdi:magnify-minus-outline',
        'mdi:magnify-plus-outline',
        'mdi:map-marker-distance',
        'mdi:menu',
        'mdi:minus',
        'mdi:note-multiple-outline',
        'mdi:note-plus-outline',
        'mdi:numeric',
        'mdi:open-in-new',
        'mdi:package-up',
        'mdi:package-variant',
        'mdi:package-variant-closed',
        'mdi:page-layout-body',
        'mdi:palette-outline',
        'mdi:pencil',
        'mdi:pencil-outline',
        'mdi:percent-outline',
        'mdi:pi',
        'mdi:plus',
        'mdi:plus-minus-variant',
        'mdi:printer',
        'mdi:printer-outline',
        'mdi:redo',
        'mdi:refresh',
        'mdi:restore',
        'mdi:rotate-left',
        'mdi:rotate-right',
        'mdi:ruler',
        'mdi:share',
        'mdi:share-variant-outline',
        'mdi:shield-account-outline',
        'mdi:shield-alert-outline',
        'mdi:shield-lock-outline',
        'mdi:sigma',
        'mdi:star-outline',
        'mdi:sync',
        'mdi:theme-light-dark',
        'mdi:thermometer',
        'mdi:timer-outline',
        'mdi:timer-sand',
        'mdi:translate',
        'mdi:trash-can',
        'mdi:trash-can-outline',
        'mdi:tune-variant',
        'mdi:undo',
        'mdi:update',
        'mdi:upload',
        'mdi:variable',
        'mdi:weather-night',
        'mdi:weather-sunny',
        'mdi:web',
        'mdi:wifi-off',
        'mdi:wizard-hat',
        'mdi:wrap',
      ],
    },
  },
  colorMode: {
    classSuffix: '',
    preference: 'system',
    fallback: 'light',
  },
  i18n: {
    defaultLocale: 'en-GB',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
    },
    locales: [
      {
        code: 'en-GB',
        language: 'en-GB',
        name: 'English (UK)',
        dir: 'ltr',
        file: 'en-GB.json',
      },
      // {
      //   code: 'es-ES',
      //   language: 'es-ES',
      //   name: 'Español (ES)',
      //   dir: 'ltr',
      //   file: 'es-ES.json',
      // },
    ],
  },
  nitro: {
    prerender: {
      routes: ['/'],
    },
    routeRules: {
      '/.well-known/apple-app-site-association': {
        headers: { 'Content-Type': 'application/json' },
      },
      '/version.json': {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        },
      },
    },
  },
  runtimeConfig: {
    appVersion: process.env.npm_package_version || '0.0.0',
    public: {
      // Baked at build time — logged on boot so you can confirm which build is
      // actually live (helps verify a deploy actually rebuilt the app).
      buildTime: new Date().toISOString(),
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '',
      // WebSocket URL of the CRDT sync service, including the app segment
      // (e.g. wss://crdt.numori.app/notes). When empty, the client derives it
      // from the API base / current origin (see useCollabConfig).
      collabWsUrl: process.env.NUXT_PUBLIC_COLLAB_WS_URL || '',
      storeAndroid:
        process.env.NUXT_PUBLIC_STORE_ANDROID ||
        'https://play.google.com/store/apps/details?id=notes.numori.app',
      storeIos:
        process.env.NUXT_PUBLIC_STORE_IOS || 'https://apps.apple.com/app/numori/id0000000000',
    },
  },
  vite: {
    resolve: {
      // Force a single instance of CodeMirror's core packages. nuxt-codemirror
      // nests its own @codemirror/state|view, and the Automerge codemirror
      // plugin uses the top-level copy — two instances break CodeMirror's
      // class-identity-based extension system ("object is not the right class").
      // (Also enforced at install time via package.json "overrides".)
      dedupe: ['@codemirror/state', '@codemirror/view'],
      alias: [
        // Automerge ships several entrypoints. `automerge-repo` and the
        // codemirror plugin import the bare `@automerge/automerge`, whose
        // `browser` condition resolves to a build that expects the bundler to
        // handle a separate `.wasm` asset. We pin all bare imports to the
        // `slim` build instead and initialize the WASM ourselves from an
        // inlined base64 copy (see utils/automerge.js). This keeps a single
        // shared WASM instance and works under capacitor:// and file://.
        // The regex is anchored so it does NOT match `@automerge/automerge-repo`
        // or the `@automerge/automerge/slim` subpath imports.
        { find: /^@automerge\/automerge$/, replacement: '@automerge/automerge/slim' },
      ],
    },
    optimizeDeps: {
      include: [
        '@automerge/automerge/slim',
        '@automerge/automerge/automerge.wasm.base64',
        '@automerge/automerge-repo',
        '@automerge/automerge-repo-network-websocket',
        '@automerge/automerge-repo-storage-indexeddb',
        '@automerge/automerge-codemirror',
        '@codemirror/view',
        '@codemirror/state',
        '@codemirror/language',
        '@codemirror/autocomplete',
        '@codemirror/commands',
        '@codemirror/theme-one-dark',
        '@codemirror/search',
        '@codemirror/lint',
        '@lezer/highlight',
        'tailwind-merge',
        'dexie',
        'highlight.js/lib/core',
        'highlight.js/lib/languages/javascript',
        'highlight.js/lib/languages/typescript',
        'highlight.js/lib/languages/python',
        'highlight.js/lib/languages/c',
        'highlight.js/lib/languages/cpp',
        'highlight.js/lib/languages/csharp',
        'highlight.js/lib/languages/php',
        'highlight.js/lib/languages/ruby',
        'highlight.js/lib/languages/perl',
        'highlight.js/lib/languages/css',
        'highlight.js/lib/languages/xml',
        'highlight.js/lib/languages/bash',
        'highlight.js/lib/languages/json',
        'highlight.js/lib/languages/yaml',
        'highlight.js/lib/languages/ini',
        'highlight.js/lib/languages/diff',
        'highlight.js/lib/languages/sql',
        'highlight.js/lib/languages/markdown',
        'highlight.js/lib/languages/go',
        'highlight.js/lib/languages/rust',
        'highlight.js/lib/languages/java',
        'highlight.js/lib/languages/kotlin',
        'highlight.js/lib/languages/swift',
        'highlight.js/lib/languages/lua',
        'highlight.js/lib/languages/dockerfile',
        '@capacitor/app',
        '@capacitor/core',
        '@capacitor/status-bar',
        '@capacitor/filesystem',
        '@capacitor/share',
        '@capacitor/privacy-screen',
        '@capacitor/network',
      ],
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
    },
    build: {
      sourcemap: false,
      rollupOptions: {
        onwarn(warning, warn) {
          // Suppress the module-preload-polyfill sourcemap warning
          if (warning.plugin === 'nuxt:module-preload-polyfill') return
          warn(warning)
        },
        output: {
          manualChunks(id) {
            // Split CodeMirror + Lezer into their own chunk (~377 kB)
            if (id.includes('@codemirror') || id.includes('@lezer')) {
              return 'codemirror'
            }
            // Split Capacitor plugins into their own chunk
            if (id.includes('@capacitor')) {
              return 'capacitor'
            }
          },
        },
      },
    },
  },
  ssr: false, // Pure client-side SPA
})
