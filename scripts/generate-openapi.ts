#!/usr/bin/env bun
/**
 * Generates the OpenAPI document for the HTTP API and writes it to `web/api.json`,
 * which the `web/` frontend turns into TypeScript types via `openapi-typescript`.
 *
 * Run with `bun run openapi:generate` after changing anything under `src/api` or
 * `src/domain`, and commit the regenerated `web/api.json` alongside the change.
 */
import { OpenApi } from "@effect/platform"
import { Api } from "../src/api/Api.ts"

const outFile = new URL("../web/api.json", import.meta.url)

const spec = OpenApi.fromApi(Api)

await Bun.write(outFile, `${JSON.stringify(spec, null, 2)}\n`)

console.log(`Wrote OpenAPI spec to ${Bun.fileURLToPath(outFile)}`)
