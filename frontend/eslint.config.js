import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: ['dist', 'build', 'node_modules'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: {
        // Browser / Web API globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        URLSearchParams: 'readonly',
        URL: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        performance: 'readonly',
        RequestInit: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        BodyInit: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        React: 'readonly',
        AudioContext: 'readonly',
        JSX: 'readonly',
        MouseEvent: 'readonly',
        File: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      // A const and a type sharing a name (the "companion object" pattern, used in
      // lib/types.ts) is valid TS; no-redeclare doesn't recognize type-level scoping
      // without type-aware parsing, so it's off rather than fighting false positives.
      'no-redeclare': 'off',
      // react-hooks v7's compiler-oriented ruleset flags any effect that calls an
      // async function which eventually calls setState (e.g. "fetch on mount") --
      // that's the standard data-fetching pattern used throughout this codebase,
      // not a bug. Keep rules-of-hooks and exhaustive-deps; skip this one.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];
