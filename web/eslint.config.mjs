import js from "@eslint/js"
import prettier from "eslint-config-prettier"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import globals from "globals"
import tseslint from "typescript-eslint"

export default tseslint.config(
  { ignores: ["dist", "node_modules", "src/lib/api.gen.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  // The plugin still ships an eslintrc-shaped `configs.recommended`; the flat
  // variants live under `configs.flat`.
  reactHooks.configs.flat["recommended-latest"],
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: { "react-refresh": reactRefresh },
    rules: {
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }]
    }
  },
  {
    // shadcn/ui primitives deliberately export their `cva` variant maps next to the
    // component, which the fast-refresh rule flags but which is the upstream layout.
    files: ["src/components/ui/**"],
    rules: { "react-refresh/only-export-components": "off" }
  },
  {
    // TanStack Router signals a redirect from a route guard by throwing the object
    // returned from `redirect()`, which is not an Error subclass.
    files: ["src/router.tsx"],
    rules: { "@typescript-eslint/only-throw-error": "off" }
  },
  prettier
)
