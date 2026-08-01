import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

/**
 * ESLint flat config.
 *
 * `eslint-config-next` ships native flat configs, so they are imported
 * directly rather than through `FlatCompat` — the compat shim re-validates the
 * config against the legacy schema and fails on this combination.
 *
 * The Next presets already encode the accessibility, hooks, and performance
 * rules that matter for an App Router project. Staying close to them means
 * upgrades do not require re-litigating individual rules.
 */
const config = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'public/widget.js',
      'drizzle/**',
      '.data/**',
      '.screenshots/**',
      'coverage/**',
    ],
  },
  {
    rules: {
      // Unused arguments are often required by a callback signature; the
      // underscore prefix is the conventional way to say "deliberately unused".
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
    },
  },
  {
    // Scripts are CLI tools; printing is the point.
    files: ['scripts/**/*.{ts,mjs}'],
    rules: {
      'no-console': 'off',
    },
  },
];

export default config;
