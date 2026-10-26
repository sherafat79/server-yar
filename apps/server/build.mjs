import { build } from "esbuild"
import { cpSync, readFileSync, rmSync } from "node:fs"

const pkg = JSON.parse(readFileSync("package.json", "utf8"))
rmSync("dist", { recursive: true, force: true })
await build({
  entryPoints: { index: "src/index.ts", "create-admin": "src/cli/create-admin.ts" },
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outdir: "dist",
  sourcemap: true,
  // runtime deps are installed in the image; the workspace package is bundled in
  external: Object.keys(pkg.dependencies).filter((n) => n !== "@serveryar/shared"),
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
})
cpSync("drizzle", "dist/drizzle", { recursive: true })
console.log("server built → dist/")
