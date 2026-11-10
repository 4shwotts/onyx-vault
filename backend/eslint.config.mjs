import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      ecmaVersion: 2024,
      globals: globals.node,
    },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2024,
      globals: globals.node,
    },
  },
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
];
