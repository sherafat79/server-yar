import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import { env } from "../env.ts"

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, 64, SCRYPT)
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltB64, hashB64] = stored.split("$")
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false
  const expected = Buffer.from(hashB64, "base64")
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"), expected.length, SCRYPT)
  return timingSafeEqual(actual, expected)
}

/** AES-256-GCM. Output: v1:<iv>:<tag>:<ciphertext>, all base64. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", env.encryptionKey, iv)
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":")
}

export function decrypt(payload: string): string {
  const [v, iv, tag, data] = payload.split(":")
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Bad ciphertext")
  const decipher = createDecipheriv("aes-256-gcm", env.encryptionKey, Buffer.from(iv, "base64"))
  decipher.setAuthTag(Buffer.from(tag, "base64"))
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8")
}

/** undefined → keep current, null/"" → clear, string → encrypt. */
export function secretUpdate(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === "") return null
  return encrypt(value)
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url")
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex")
