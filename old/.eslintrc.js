module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
  ],
  parser: '@typescript-eslint/parser',
  env: {
    browser: true,
    amd: true,
    node: true,
    jest: true,
    'jest/globals': true
  },
  plugins: ['jest', '@typescript-eslint'],
  ignorePatterns: ['build', 'dist', 'graphql_api_build', 'jest'],
  rules: {
    semi: 0,
    'no-shadow': 'off',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['error'],
    'react/no-children-prop': 'off',
    'no-constant-condition': 'off'
  },
}
