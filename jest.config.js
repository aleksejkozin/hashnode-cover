module.exports = {
  maxWorkers: 4,
  verbose: true,
  rootDir: './src',
  testEnvironment: 'node',
  testRegex: '\\.(test|spec)\\.(ts|tsx|js)$',
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-native-community|@react-native-picker|@hookform|@react-native-cookies/cookies)',
  ],
  passWithNoTests: true,
  moduleNameMapper: {
    '^.+.(css|svg|styl|less|sass|scss|jpg|ttf|woff|woff2|mp3)$':
      'jest-transform-stub',
  },
  modulePathIgnorePatterns: ['dist/'],
}
