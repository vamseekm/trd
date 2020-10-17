module.exports = {
    parser: '@typescript-eslint/parser', // Specifies the ESLint parser

    parserOptions: {
        ecmaVersion: 2020, // Allows for the parsing of modern ECMAScript features
        project: './tsconfig.json',
        sourceType: 'module', // Allows for the use of imports
    },

    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended', // Uses the recommended rules from the @typescript-eslint/eslint-plugin
        // 'plugin:unicorn/recommended',
        'plugin:sonarjs/recommended',
        'prettier/@typescript-eslint', // Uses eslint-config-prettier to disable ESLint rules from @typescript-eslint/eslint-plugin that would conflict with prettier
        'plugin:prettier/recommended', // Enables eslint-plugin-prettier and eslint-config-prettier. This will display prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
    ],
    plugins: ['@typescript-eslint', 'sonarjs', 'simple-import-sort'],
    rules: {
        // Place to specify ESLint rules. Can be used to overwrite rules specified from the extended configs
        // e.g. "@typescript-eslint/explicit-function-return-type": "off",
        'simple-import-sort/sort': 'error',
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/adjacent-overload-signatures': 'error',
        '@typescript-eslint/ban-types': 'error',
        '@typescript-eslint/explicit-module-boundary-types': 'error',
        '@typescript-eslint/no-extra-non-null-assertion': 'error',
        '@typescript-eslint/no-inferrable-types': 'error',
        '@typescript-eslint/no-misused-new': 'error',
        '@typescript-eslint/no-misused-promises': 'error',
        '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
        '@typescript-eslint/no-non-null-assertion': 'error',
        '@typescript-eslint/no-this-alias': 'error',
        '@typescript-eslint/no-unnecessary-type-assertion': 'error',
        '@typescript-eslint/prefer-function-type': 'error',
        '@typescript-eslint/prefer-as-const': 'error',
        '@typescript-eslint/no-var-requires': 'error',
        '@typescript-eslint/prefer-regexp-exec': 'error',
        '@typescript-eslint/restrict-plus-operands': 'error',
        '@typescript-eslint/unbound-method': 'error',
        '@typescript-eslint/no-array-constructor': 'error',
    },
};
