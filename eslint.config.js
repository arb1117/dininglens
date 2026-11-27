// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*'],
  },
  {
    files: ['**/*.test.js', '**/*.test.ts', '**/*.test.tsx'],
    languageOptions: { globals: { ...require('globals').jest, ...require('globals').node } },
    // jest.mock factories must use require(); babel-jest hoists them above imports.
    rules: { '@typescript-eslint/no-require-imports': 'off', 'import/first': 'off' },
  },
  {
    // Raw quotes in <Text> render fine in React Native; this rule targets HTML.
    rules: { 'react/no-unescaped-entities': 'off' },
  },
]);
