import assert from "node:assert/strict"
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { test } from "node:test"
import { Hono } from "hono"
import type { CertificateDTO, ServerDTO } from "@serveryar/shared"
import type { AppEnv } from "../auth.ts"

test("independent SSL and remembered locations survive CRUD and migrations", async () => {
  const folder = await mkdtemp(join(tmpdir(), "serveryar-features-"))
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64")
  process.env.DATABASE_PATH = join(folder, "test.db")
  const migrations = resolve("drizzle")
  const baseline = join(folder, "baseline")
  await mkdir(join(baseline, "meta"), { recursive: true })
  const journal = JSON.parse(await readFile(join(migrations, "meta/_journal.json"), "utf8"))
  journal.entries = journal.entries.slice(0, 1)
  await writeFile(join(baseline, "meta/_journal.json"), JSON.stringify(journal))
  const initial = `${journal.entries[0].tag}.sql`
  await writeFile(join(baseline, initial), await readFile(join(migrations, initial)))
  process.env.MIGRATIONS_DIR = baseline
  const { db, schema, client, runMigrations } = await import("../db/index.ts")
  try {
    await runMigrations()
    await db.insert(schema.servers).values({ name: "existing", location: " Berlin " })
    process.env.MIGRATIONS_DIR = migrations
    await runMigrations()
    await runMigrations()
    assert.deepEqual(await db.select().from(schema.locations), [{ name: "Berlin" }])

    const [user] = await db.insert(schema.users).values({ username: "test", displayName: "Test", passwordHash: "unused" }).returning()
    const { certificateRoutes } = await import("./certificates.ts")
    const { serverRoutes } = await import("./servers.ts")
    const { locationRoutes } = await import("./admin.ts")
    const { HttpError } = await import("../lib/http.ts")
    const app = new Hono<AppEnv>()
    app.use("*", async (c, next) => { c.set("user", user!); await next() })
    app.onError((err, c) => {
      if (err instanceof HttpError) return c.json({ error: err.code }, err.status)
      throw err
    })
    app.route("/certificates", certificateRoutes)
    app.route("/servers", serverRoutes)
    app.route("/locations", locationRoutes)
    const request = (path: string, method = "GET", body?: unknown) => app.request(path, {
      method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
    })

    for (const hostname of ["https://example.com", "example.com/path", "*.example.com", "bad..example.com"]) {
      assert.equal((await request("/certificates", "POST", { hostname })).status, 400)
    }
    const created = await request("/certificates", "POST", { hostname: " Missing.Invalid ", notes: "SSL only" })
    assert.equal(created.status, 200)
    const cert = await created.json() as CertificateDTO
    assert.equal(cert.hostname, "missing.invalid")
    assert.ok(cert.lastCheckedAt)
    assert.ok(cert.lastError)
    assert.equal(cert.sslExpiresAt, null)
    assert.equal((await db.select().from(schema.domains)).length, 0)
    assert.equal((await request("/certificates", "POST", { hostname: "missing.invalid" })).status, 409)
    assert.equal(((await (await request("/certificates")).json()) as CertificateDTO[]).length, 1)
    assert.equal((await request(`/certificates/${cert.id}/refresh`, "POST", {})).status, 200)
    assert.equal((await request(`/certificates/${cert.id}`, "DELETE")).status, 200)
    assert.equal((await request(`/certificates/${cert.id}/refresh`, "POST", {})).status, 404)
    assert.equal((await request(`/certificates/${cert.id}`, "DELETE")).status, 404)

    const saved = await request("/servers", "POST", { name: "new", location: " Tehran " })
    assert.equal(saved.status, 200)
    const server = await saved.json() as ServerDTO
    assert.equal(server.location, "Tehran")
    assert.equal((await request(`/servers/${server.id}`, "PATCH", { location: "Paris" })).status, 200)
    assert.equal((await request(`/servers/${server.id}`, "DELETE")).status, 200)
    assert.deepEqual(await (await request("/locations")).json(), [{ name: "Berlin" }, { name: "Paris" }, { name: "Tehran" }])
    await request("/servers", "POST", { name: "another", location: "Tehran" })
    assert.equal(((await (await request("/locations")).json()) as { name: string }[]).length, 3)
  } finally {
    client.close()
    await rm(folder, { recursive: true, force: true })
  }
})
