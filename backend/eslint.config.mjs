// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist/**', 'coverage/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
      // CLAUDE.md Â§4: imports internos sÃ³ por path alias.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['./*', '../*'],
              message: 'Use o path alias (@modules/*, @shared/*, @test/*, @/*) em vez de import relativo. Ver CLAUDE.md seÃ§Ã£o 4.',
            },
          ],
        },
      ],
      // CLAUDE.md Â§5 (SeguranÃ§a: SQL injection): sem SQL montado por concatenaÃ§Ã£o.
      'no-restricted-properties': [
        'error',
        {
          property: '$queryRawUnsafe',
          message: '$queryRawUnsafe Ã© proibido (SQL injection). Use $queryRaw com template tag. Ver CLAUDE.md seÃ§Ã£o 5.',
        },
        {
          property: '$executeRawUnsafe',
          message: '$executeRawUnsafe Ã© proibido (SQL injection). Use $executeRaw com template tag. Ver CLAUDE.md seÃ§Ã£o 5.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='Prisma'][property.name='raw']",
          message: 'Prisma.raw Ã© proibido (SQL injection). Use parÃ¢metros do template tag. Ver CLAUDE.md seÃ§Ã£o 5.',
        },
      ],
    },
  },
  {
    // jest-mock-extended: `expect(mock.metodo)` é o uso padrão e não depende de `this`.
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
    rules: { '@typescript-eslint/unbound-method': 'off' },
  },
);
