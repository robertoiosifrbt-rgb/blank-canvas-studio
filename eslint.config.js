import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

/**
 * Legea 4 a coloanei: niciun ecran nu vorbește direct cu Supabase.
 *
 * Scrisă aici, nu într-un document, pentru că o lege care depinde de
 * bunăvoință nu e o lege. Interzice și pachetul (singura cale de a construi
 * un client) și fișierele de client din interiorul repository-ului, ca să nu
 * poată fi ocolită cu un import relativ.
 */
export const IMPORTURI_INTERZISE = [
  'error',
  {
    patterns: [
      {
        group: [
          '@supabase/*',
          '@supabase/*/**',
          '**/repository/supabase*',
          '*/repository/supabase*',
          './supabase*',
          '../**/repository/supabase*',
        ],
        message:
          'Legea 4: clientul Supabase se folosește numai în src/repository/. ' +
          'Ecranele cer și primesc de la repository.',
      },
    ],
  },
]

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },

  // Codul aplicației.
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'error',
        { allowConstantExport: true },
      ],
      // Varianta din typescript-eslint, nu regula de bază: aceea lasă să
      // treacă `import type`, iar un tip importat din pachet e tot un import.
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': IMPORTURI_INTERZISE,
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['error', 'warn'] }],
    },
  },

  // Singurul loc care are voie să atingă Supabase.
  {
    files: ['src/repository/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-restricted-imports': 'off' },
  },

  // Verificatorul de așezare: codul lui rulează parte în Node, parte în
  // pagină, deci vede globalele amândurora.
  {
    files: ['scripts/check-layout.mjs', 'scripts/lib/layout.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
  },

  // Fișierele de configurare și scripturile de verificare rulează în Node.
  {
    files: ['*.{js,ts,mjs}', 'scripts/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
  },
)
