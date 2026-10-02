// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const globals = require('globals');

/**
 * ESLint — `npm run lint` (ან ავტომატურად, ყოველი commit-ის წინ: .husky/pre-commit → lint-staged).
 *   src/**\/*.ts    — Angular (TypeScript)
 *   src/**\/*.html  — Angular template-ები, ხელმისაწვდომობის (a11y) წესებით
 *   electron/, scripts/ — Node.js (Electron-ის main process, CommonJS)
 */
module.exports = tseslint.config(
  {
    // აწყობის შედეგები და დამოკიდებულებები — არ მოწმდება
    ignores: ['dist/**', 'release/**', '.angular/**', 'node_modules/**', 'coverage/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {},
  },
  {
    // Electron-ის main process და სკრიპტები — Node, CommonJS (require / module.exports)
    files: ['electron/**/*.js', 'scripts/**/*.js', 'eslint.config.js'],
    extends: [eslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      // `catch {}` ცარიელი ბლოკი ზოგან განზრახაა (მაგ. ფაილი არ არსებობს — ნორმალურია)
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  }
);
