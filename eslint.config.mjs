import tseslint from 'typescript-eslint';

// Flat config (ESLint 9+). This mirrors the previous .eslintrc.json rule set;
// `@typescript-eslint/semi` was removed in typescript-eslint v8, so the base
// `semi` rule is used instead.
export default tseslint.config(
    {
        ignores: ['out/**', 'dist/**', '**/*.d.ts'],
    },
    {
        files: ['src/**/*.ts'],
        plugins: {
            '@typescript-eslint': tseslint.plugin,
        },
        languageOptions: {
            parser: tseslint.parser,
            ecmaVersion: 2020,
            sourceType: 'module',
        },
        rules: {
            '@typescript-eslint/naming-convention': 'warn',
            'curly': 'warn',
            'eqeqeq': 'warn',
            'no-throw-literal': 'warn',
            'semi': 'warn',
        },
    },
);
