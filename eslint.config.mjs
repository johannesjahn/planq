import js from "@eslint/js"
import prettier from "eslint-config-prettier"
import tseslint from "typescript-eslint"

export default tseslint.config(
  // `web` is a separate package with its own ESLint config and tsconfig.
  { ignores: ["node_modules", "*.sqlite", "web"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }]
    }
  }
)
