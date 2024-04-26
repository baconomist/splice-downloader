module.exports = {
    root: true,
    env: {
        es6: true,
        node: true,
    },
    extends: [
        "eslint:recommended",
        "plugin:import/errors",
        "plugin:import/warnings",
        "plugin:import/typescript",
        "google",
        "plugin:@typescript-eslint/recommended",
    ],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        project: ["tsconfig.json", "tsconfig.dev.json"],
        sourceType: "module",
    },
    ignorePatterns: [
        "/lib/**/*", // Ignore built files.
    ],
    plugins: [
        "@typescript-eslint",
        "import",
    ],
    rules: {
        "linebreak-style": 0,
        "guard-for-in": 0,
        "@typescript-eslint/no-var-requires": 0,
        "max-len": 0,
        "semi": ["error", "never"],
        "quotes": 0,
        "import/no-unresolved": 0,
        "indent": ["error", 4],
        "require-jsdoc": 0,
    },
}
