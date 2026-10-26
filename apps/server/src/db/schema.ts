import { sql } from "drizzle-orm"
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import type { BillingCycle, CheckMethod, Currency, Role, ServiceType, Status } from "@serveryar/shared"

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
const createdAt = () => text("created_at").notNull().default(now)
const updatedAt = () => text("updated_at").notNull().default(now)

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<Role>().notNull().default("member"),
  totpSecret: text("totp_secret"), // encrypted
  totpEnabled: integer("totp_enabled", { mode: "boolean" }).notNull().default(false),
  totpLastStep: integer("totp_last_step"),
  canRevealSecrets: integer("can_reveal_secrets", { mode: "boolean" }).notNull().default(false),
  telegramChatId: text("telegram_chat_id"),
  telegramLinkCode: text("telegram_link_code"),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: text("locked_until"),
  createdAt: createdAt(),
})

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  createdAt: createdAt(),
})

export const providers = sqliteTable("providers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  website: text("website"),
  notes: text("notes"),
})

export const vendors = sqliteTable("vendors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  website: text("website"),
  notes: text("notes"),
})

export const servers = sqliteTable("servers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  ips: text("ips", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  providerId: integer("provider_id").references(() => providers.id, { onDelete: "set null" }),
  vendorId: integer("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
  location: text("location"),
  os: text("os"),
  cpu: text("cpu"),
  ram: text("ram"),
  disk: text("disk"),
  traffic: text("traffic"),
  panelUrl: text("panel_url"),
  sshUser: text("ssh_user"),
  sshPort: integer("ssh_port"),
  sshPassword: text("ssh_password"), // encrypted
  sshKey: text("ssh_key"), // encrypted
  panelUser: text("panel_user"),
  panelPassword: text("panel_password"), // encrypted
  price: real("price"),
  currency: text("currency").$type<Currency>().notNull().default("USD"),
  billingCycle: text("billing_cycle").$type<BillingCycle>().notNull().default("monthly"),
  nextRenewal: text("next_renewal"),
  autoRenew: integer("auto_renew", { mode: "boolean" }).notNull().default(false),
  monitor: integer("monitor", { mode: "boolean" }).notNull().default(true),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  notes: text("notes"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  status: text("status").$type<Status>().notNull().default("pending"),
  consecutiveFails: integer("consecutive_fails").notNull().default(0),
  lastCheckedAt: text("last_checked_at"),
  latencyMs: integer("latency_ms"),
  lastError: text("last_error"),
  maintenanceUntil: text("maintenance_until"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const domains = sqliteTable("domains", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  registrar: text("registrar"),
  vendorId: integer("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
  expiresAt: text("expires_at"),
  price: real("price"),
  currency: text("currency").$type<Currency>().notNull().default("USD"),
  autoRenew: integer("auto_renew", { mode: "boolean" }).notNull().default(false),
  checkSsl: integer("check_ssl", { mode: "boolean" }).notNull().default(true),
  notes: text("notes"),
  sslExpiresAt: text("ssl_expires_at"),
  sslIssuer: text("ssl_issuer"),
  whoisExpiresAt: text("whois_expires_at"),
  lastWhoisAt: text("last_whois_at"),
  createdAt: createdAt(),
})

export const services = sqliteTable(
  "services",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    type: text("type").$type<ServiceType>().notNull(),
    serverId: integer("server_id").references(() => servers.id, { onDelete: "set null" }),
    domainId: integer("domain_id").references(() => domains.id, { onDelete: "set null" }),
    hostname: text("hostname"),
    port: integer("port"),
    checkMethod: text("check_method").$type<CheckMethod>().notNull().default("none"),
    checkUrl: text("check_url"),
    checkKeyword: text("check_keyword"),
    heartbeatToken: text("heartbeat_token"),
    heartbeatGraceSec: integer("heartbeat_grace_sec").notNull().default(600),
    lastHeartbeatAt: text("last_heartbeat_at"),
    path: text("path"),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    notes: text("notes"),
    status: text("status").$type<Status>().notNull().default("pending"),
    consecutiveFails: integer("consecutive_fails").notNull().default(0),
    lastCheckedAt: text("last_checked_at"),
    latencyMs: integer("latency_ms"),
    lastError: text("last_error"),
    sslExpiresAt: text("ssl_expires_at"),
    maintenanceUntil: text("maintenance_until"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("services_hb_token").on(t.heartbeatToken)],
)

/** Raw check results, kept for 30 days. ts is epoch ms. */
export const checks = sqliteTable(
  "checks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    targetType: text("target_type").$type<"server" | "service">().notNull(),
    targetId: integer("target_id").notNull(),
    ts: integer("ts").notNull(),
    ok: integer("ok", { mode: "boolean" }).notNull(),
    latencyMs: integer("latency_ms"),
  },
  (t) => [index("checks_target_ts").on(t.targetType, t.targetId, t.ts), index("checks_ts").on(t.ts)],
)

/** Hourly roll-up of checks older than 30 days. hour is epoch ms at the hour start. */
export const checksHourly = sqliteTable(
  "checks_hourly",
  {
    targetType: text("target_type").$type<"server" | "service">().notNull(),
    targetId: integer("target_id").notNull(),
    hour: integer("hour").notNull(),
    total: integer("total").notNull(),
    okCount: integer("ok_count").notNull(),
    avgMs: real("avg_ms"),
  },
  (t) => [primaryKey({ columns: [t.targetType, t.targetId, t.hour] })],
)

export const incidents = sqliteTable(
  "incidents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    targetType: text("target_type").$type<"server" | "service">().notNull(),
    targetId: integer("target_id").notNull(),
    startedAt: text("started_at").notNull(),
    resolvedAt: text("resolved_at"),
    cause: text("cause"),
  },
  (t) => [index("incidents_target").on(t.targetType, t.targetId)],
)

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  targetType: text("target_type").$type<"server" | "domain">().notNull(),
  targetId: integer("target_id").notNull(),
  amount: real("amount").notNull(),
  currency: text("currency").$type<Currency>().notNull(),
  paidAt: text("paid_at").notNull(),
  periodFrom: text("period_from"),
  periodTo: text("period_to"),
  note: text("note"),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
})

export const activity = sqliteTable(
  "activity",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: integer("entity_id"),
    summary: text("summary").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("activity_created").on(t.createdAt)],
)

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
})

/** Dedupe for one-off notifications (reminders etc). */
export const sentNotifications = sqliteTable("sent_notifications", {
  key: text("key").primaryKey(),
  sentAt: text("sent_at").notNull().default(now),
})
