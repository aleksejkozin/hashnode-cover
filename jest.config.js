/*
Responsible for running tests
*/

module.exports = {
  maxWorkers: 4,
  verbose: true,
  rootDir: './src',
  testEnvironment: 'node',
  // The test files should have suffix test or spec
  testRegex: '\\.(test|spec)\\.(ts|tsx|js)$',
  passWithNoTests: true,
  // Cut out all non-code files
  moduleNameMapper: {
    '^.+.(css|svg|styl|less|sass|scss|jpg|ttf|woff|woff2|mp3)$':
      'jest-transform-stub',
  },
}
