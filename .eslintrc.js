module.exports = {
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: 'tsconfig.json',
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint/eslint-plugin', 'jest', 'prettier', 'deprecation', 'unused-imports'],
    extends: ['plugin:@typescript-eslint/recommended', 'eslint:recommended', 'plugin:prettier/recommended', 'prettier'],
    root: true,
    env: {
        node: true,
        jest: true,
    },
    ignorePatterns: ['.eslintrc.js'],
    rules: {
        '@typescript-eslint/interface-name-prefix': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/consistent-type-imports': 'error',
        'no-unused-vars': 'off',
        'prettier/prettier': [
            'error',
            {
                endOfLine: 'auto',
            },
        ],
        'deprecation/deprecation': 'warn',
        'unused-imports/no-unused-imports': 'error',
    },
    overrides: [
        {
            files: ['*.spec.js'],
            plugins: ['jest'],
            extends: ['plugin:jest/recommended'],
            rules: {
                'jest/prefer-expect-assertions': 0,
            },
        },
        {
            files: ['*.json'],
            parser: 'jsonc-eslint-parser',
            extends: ['plugin:jsonc/recommended-with-jsonc'],
            rules: {
                'deprecation/deprecation': 'off',
                '@typescript-eslint/consistent-type-imports': 'off',
            },
        },
    ],
}
