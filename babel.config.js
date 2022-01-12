/*
Babel brings the world together
Will compile JavaScript dialects to a common standard
You can use moder features like React, ESNext, TypeScript and still run your code in old browsers
How cool is that?

A video regard Babel:
https://www.youtube.com/watch?v=YXtQms2msZQ
*/

module.exports = api => {
  return {
    presets: [
      // This plugin polyfills missing browsers features
      [
        '@babel/preset-env',
        {
          // debug: true,
          useBuiltIns: 'usage',
          corejs: 3,
          targets: api.caller(caller => caller && caller.target === 'node')
            ? {node: 'current'}
            : 'defaults',
        },
      ],

      /*
      This adds TypeScript support
      Well, "support", it will not actually validate any TypeScript code, it will just remove it
      This is why we run tsc during dev/test phases
      */
      '@babel/preset-typescript',

      // This adds JSX support
      '@babel/preset-react',
    ],
  }
}
