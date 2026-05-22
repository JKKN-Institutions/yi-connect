import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Compiled outputs
    'dist/**',
    // Separate services
    'whatsapp-service/**',
    // Claude skill assets (not part of main app)
    '.claude/**',
    // Scripts (CommonJS)
    'scripts/**',
    // SW compiled output
    'public/sw.js'
  ]),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    }
  }
]);

export default eslintConfig;
