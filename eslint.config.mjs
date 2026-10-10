import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'eslint.config.mjs'] },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Numbers in template literals are unambiguous; everything else must be
      // converted explicitly.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // Declaration merging needs an interface with a single extends clause.
      '@typescript-eslint/no-empty-object-type': ['error', { allowInterfaces: 'with-single-extends' }],
      // The escape hatches this codebase must not use.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports' },
      ],
      // Decorator metadata needs the parameter types emitted, so interfaces
      // used in decorated signatures stay as value-position imports.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
  {
    // Tests may assert on loosely typed fixtures and mock partial objects.
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      // body<T>() is a deliberate single-use generic narrowing an `any` body.
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
);
