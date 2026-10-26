import type { Context } from "hono"
import type { z } from "zod"

/** Parse a JSON body against a schema; throws a 400 response-like error on failure. */
export async function body<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  const raw = await c.req.json().catch(() => null)
  const parsed = schema.safeParse(raw)
  if (!parsed.success) throw new HttpError(400, "validation", parsed.error.issues)
  return parsed.data
}

export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 423 | 429,
    public code: string,
    public details?: unknown,
  ) {
    super(code)
  }
}

export function idParam(c: Context): number {
  const id = Number(c.req.param("id"))
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "bad_id")
  return id
}

export const notFound = () => new HttpError(404, "not_found")
