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
      // CLAUDE.md §4: imports internos só por path alias.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['./*', '../*'],
              message: 'Use o path alias (@modules/*, @shared/*, @test/*, @/*) em vez de import relativo. Ver CLAUDE.md seção 4.',
            },
          ],
        },
      ],
      // CLAUDE.md §5 (Segurança: SQL injection): sem SQL montado por concatenação.
      'no-restricted-properties': [
        'error',
        {
          property: '$queryRawUnsafe',
          message: '$queryRawUnsafe é proibido (SQL injection). Use $queryRaw com template tag. Ver CLAUDE.md seção 5.',
        },
        {
          property: '$executeRawUnsafe',
          message: '$executeRawUnsafe é proibido (SQL injection). Use $executeRaw com template tag. Ver CLAUDE.md seção 5.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='Prisma'][property.name='raw']",
          message: 'Prisma.raw é proibido (SQL injection). Use parâmetros do template tag. Ver CLAUDE.md seção 5.',
        },
      ],
    },
  },
  {
    // jest-mock-extended: `expect(mock.metodo)` � o uso padr�o e n�o depende de `this`.
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
    rules: { '@typescript-eslint/unbound-method': 'off' },
  },
);
