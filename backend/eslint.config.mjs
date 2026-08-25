import jsPlugin from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";

/**
 * Flat ESLint config.
 *
 * Previously there were two configs — an `eslint.config.js` written in ESM inside
 * a CommonJS package, which ESLint loads first and which therefore crashed
 * `npm run lint` outright, plus this `.mjs` one. The `.js` copy is gone.
 *
 * The surviving config also declared browser globals for a Node service and left
 * core `no-undef` enabled on TypeScript, so ambient types (`Express.Multer.File`)
 * and Node builtins (`__dirname`, `process`) were reported as undefined across
 * the whole codebase.
 *
 * @type {import('eslint').Linter.Config[]}
 */
export default [
  { ignores: ["node_modules/**", "dist/**", "coverage/**", "users/**"] },

  jsPlugin.configs.recommended,

  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        // This is a Node service, not a browser bundle.
        ...globals.node,
      },
    },
    rules: {
      "no-unused-expressions": ["error", { allowShortCircuit: true, allowTernary: true }],
      "prefer-const": "error",
      eqeqeq: ["error", "smart"],
      "no-return-await": "error",
      "no-var": "error",
      // The service has a structured logger; stray console output bypasses
      // redaction and log levels.
      "no-console": "error",
    },
  },

  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,

      // TypeScript resolves identifiers itself, including ambient declarations
      // and Node builtins. Core no-undef only produces false positives here.
      "no-undef": "off",

      // Defer to the TypeScript-aware version, which understands type-only
      // imports, and allow the `_`-prefix convention for deliberately unused
      // Express handler arguments.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },

  {
    // Config validation runs before the logger exists, so it writes directly to
    // stderr; the seed script is a CLI and prints to stdout by design.
    files: ["src/app/config/env.ts", "src/scripts/**/*.ts"],
    rules: { "no-console": "off" },
  },
];
