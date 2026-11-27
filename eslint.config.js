// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*'],
  },
  {
    // Raw quotes in <Text> render fine in React Native; this rule targets HTML.
    rules: { 'react/no-unescaped-entities': 'off' },
  },
]);
