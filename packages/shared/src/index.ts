import { z } from "zod"

export const CURRENCIES = ["IRT", "TRY", "USD"] as const
export type Currency = (typeof CURRENCIES)[number]

export const BILLING_CYCLES = ["monthly", "quarterly", "semiannual", "yearly"] as const
export type BillingCycle = (typeof BILLING_CYCLES)[number]
export const CYCLE_MONTHS: Record<BillingCycle, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
}

export const SERVICE_TYPES = ["telegram_bot", "website", "api", "database", "worker", "panel", "other"] as const
export type ServiceType = (typeof SERVICE_TYPES)[number]

export const CHECK_METHODS = ["http", "tcp", "heartbeat", "none"] as const
export type CheckMethod = (typeof CHECK_METHODS)[number]

export const ROLES = ["admin", "member"] as const
export type Role = (typeof ROLES)[number]

export const STATUSES = ["up", "down", "pending", "maintenance", "unknown"] as const
export type Status = (typeof STATUSES)[number]

const optStr = z.string().trim().max(500).optional().nullable()
const optInt = z.coerce.number().int().nonnegative().optional().nullable()
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")

// ---------- auth ----------
export const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
  otp: z.string().regex(/^\d{6}$/).optional(),
})

export const totpConfirmSchema = z.object({ otp: z.string().regex(/^\d{6}$/) })

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

export const userCreateSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/),
  displayName: z.string().trim().min(1).max(64),
  password: z.string().min(8),
  role: z.enum(ROLES),
})

export const userUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(64).optional(),
  role: z.enum(ROLES).optional(),
  canRevealSecrets: z.boolean().optional(),
  resetTotp: z.boolean().optional(),
  password: z.string().min(8).optional(),
})

// ---------- lookups ----------
export const namedSchema = z.object({
  name: z.string().trim().min(1).max(100),
  website: optStr,
  notes: optStr,
})

// ---------- server ----------
export const serverSchema = z.object({
  name: z.string().trim().min(1).max(100),
  ips: z.array(z.string().trim().min(1)).default([]),
  providerId: z.number().int().optional().nullable(),
  vendorId: z.number().int().optional().nullable(),
  location: optStr,
  os: optStr,
  cpu: optStr,
  ram: optStr,
  disk: optStr,
  traffic: optStr,
  panelUrl: optStr,
  sshUser: optStr,
  sshPort: optInt,
  // secrets: undefined = keep, null/"" = clear, string = set
  sshPassword: z.string().optional().nullable(),
  sshKey: z.string().optional().nullable(),
  panelUser: optStr,
  panelPassword: z.string().optional().nullable(),
  price: z.coerce.number().nonnegative().optional().nullable(),
  currency: z.enum(CURRENCIES).default("USD"),
  billingCycle: z.enum(BILLING_CYCLES).default("monthly"),
  nextRenewal: isoDate.optional().nullable(),
  autoRenew: z.boolean().default(false),
  monitor: z.boolean().default(true),
  tags: z.array(z.string().trim().min(1)).default([]),
  notes: z.string().max(5000).optional().nullable(),
  archived: z.boolean().default(false),
})
export type ServerInput = z.infer<typeof serverSchema>

// ---------- service ----------
export const serviceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.enum(SERVICE_TYPES),
  serverId: z.number().int().optional().nullable(),
  domainId: z.number().int().optional().nullable(),
  hostname: optStr, // full host, e.g. api.example.com
  port: optInt,
  checkMethod: z.enum(CHECK_METHODS).default("none"),
  checkUrl: optStr,
  checkKeyword: optStr,
  heartbeatGraceSec: z.coerce.number().int().min(60).max(86400 * 7).default(600),
  path: optStr,
  tags: z.array(z.string().trim().min(1)).default([]),
  notes: z.string().max(5000).optional().nullable(),
})
export type ServiceInput = z.infer<typeof serviceSchema>

// ---------- domain ----------
export const domainSchema = z.object({
  name: z.string().trim().toLowerCase().min(3).max(253),
  registrar: optStr,
  vendorId: z.number().int().optional().nullable(),
  expiresAt: isoDate.optional().nullable(),
  price: z.coerce.number().nonnegative().optional().nullable(),
  currency: z.enum(CURRENCIES).default("USD"),
  autoRenew: z.boolean().default(false),
  checkSsl: z.boolean().default(true),
  notes: z.string().max(5000).optional().nullable(),
})
export type DomainInput = z.infer<typeof domainSchema>

// ---------- renewals ----------
export const renewSchema = z.object({
  amount: z.coerce.number().nonnegative().optional(),
  currency: z.enum(CURRENCIES).optional(),
  paidAt: isoDate.optional(),
  note: optStr,
})

export const maintenanceSchema = z.object({
  until: z.string().datetime().nullable(), // null = end maintenance
})

export const revealSchema = z.object({
  field: z.enum(["sshPassword", "sshKey", "panelPassword"]),
  otp: z.string().regex(/^\d{6}$/),
})

export const settingsSchema = z.object({
  reminderDays: z.array(z.number().int().min(0).max(90)).optional(),
  reminderHour: z.number().int().min(0).max(23).optional(),
  sslReminderDays: z.array(z.number().int().min(0).max(90)).optional(),
  backupHour: z.number().int().min(0).max(23).optional(),
})
export type SettingsDTO = Required<z.infer<typeof settingsSchema>>

// ---------- API response types ----------
export interface UserDTO {
  id: number
  username: string
  displayName: string
  role: Role
  totpEnabled: boolean
  telegramLinked: boolean
  canRevealSecrets: boolean
  createdAt: string
}

export interface Named {
  id: number
  name: string
  website: string | null
  notes: string | null
}

export interface ServerDTO extends Omit<ServerInput, "sshPassword" | "sshKey" | "panelPassword"> {
  id: number
  hasSshPassword: boolean
  hasSshKey: boolean
  hasPanelPassword: boolean
  status: Status
  lastCheckedAt: string | null
  latencyMs: number | null
  maintenanceUntil: string | null
  uptime24h: number | null
  uptime7d: number | null
  uptime30d: number | null
  serviceCount: number
  createdAt: string
  updatedAt: string
}

export interface ServiceDTO extends ServiceInput {
  id: number
  heartbeatToken: string | null
  status: Status
  lastCheckedAt: string | null
  latencyMs: number | null
  lastError: string | null
  maintenanceUntil: string | null
  uptime24h: number | null
  uptime7d: number | null
  createdAt: string
  updatedAt: string
}

export interface DomainDTO extends DomainInput {
  id: number
  sslExpiresAt: string | null
  sslIssuer: string | null
  whoisExpiresAt: string | null
  lastWhoisAt: string | null
  serviceCount: number
  createdAt: string
}

export interface PaymentDTO {
  id: number
  targetType: "server" | "domain"
  targetId: number
  targetName: string
  amount: number
  currency: Currency
  paidAt: string
  periodFrom: string | null
  periodTo: string | null
  note: string | null
  userName: string | null
}

export interface IncidentDTO {
  id: number
  targetType: "server" | "service"
  targetId: number
  targetName: string
  startedAt: string
  resolvedAt: string | null
  cause: string | null
}

export interface ActivityDTO {
  id: number
  userName: string | null
  action: string
  entity: string
  entityId: number | null
  summary: string
  createdAt: string
}

export interface RenewalItem {
  type: "server" | "domain"
  id: number
  name: string
  date: string
  daysLeft: number
  price: number | null
  currency: Currency
  autoRenew: boolean
}

export interface DashboardDTO {
  servers: { total: number; up: number; down: number; maintenance: number }
  services: { total: number; up: number; down: number; maintenance: number }
  renewals30d: number
  monthlyCost: Partial<Record<Currency, number>>
  yearlyCost: Partial<Record<Currency, number>>
  upcoming: RenewalItem[]
  costByProvider: { provider: string; currency: Currency; monthly: number }[]
  uptimeSeries: { date: string; uptime: number | null }[]
  recentIncidents: IncidentDTO[]
  liveServices: Pick<ServiceDTO, "id" | "name" | "type" | "status" | "latencyMs" | "hostname">[]
}

export interface CheckPoint {
  t: string
  ok: boolean
  ms: number | null
}

/** Monthly-normalised cost for a recurring price. */
export function monthlyCost(price: number, cycle: BillingCycle): number {
  return price / CYCLE_MONTHS[cycle]
}
