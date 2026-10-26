import { eq, isNotNull } from "drizzle-orm"
import { Bot, InputFile, type Context } from "grammy"
import { HttpsProxyAgent } from "https-proxy-agent"
import { SocksProxyAgent } from "socks-proxy-agent"
import { db, schema } from "../db/index.ts"
import { env } from "../env.ts"
import { formatJalali } from "../lib/dates.ts"

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const STATUS_ICON: Record<string, string> = { up: "🟢", down: "🔴", pending: "⚪️", maintenance: "🛠", unknown: "⚪️" }

let bot: Bot | null = null
let username: string | null = null

function makeBot(token: string) {
  const proxy = env.telegramProxy
  const agent = proxy ? (proxy.startsWith("socks") ? new SocksProxyAgent(proxy) : new HttpsProxyAgent(proxy)) : undefined
  return new Bot(token, agent ? { client: { baseFetchConfig: { agent, compress: true } } } : undefined)
}

export async function botUsername() {
  if (!bot) return null
  if (!username) username = (await bot.api.getMe()).username
  return username
}

async function authorizedChat(ctx: Context) {
  if (ctx.chat?.type !== "private") return null
  return db.select().from(schema.users).where(eq(schema.users.telegramChatId, String(ctx.chat.id))).get()
}

export async function startBot() {
  if (!env.telegramToken) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN not set — bot disabled")
    return
  }
  bot = makeBot(env.telegramToken)

  bot.command("start", async (ctx) => {
    if (ctx.chat.type !== "private") return
    const code = ctx.match?.trim()
    if (code) {
      const user = await db.select().from(schema.users).where(eq(schema.users.telegramLinkCode, code)).get()
      if (!user) return ctx.reply("کد اتصال نامعتبر یا منقضی است. از پنل یک لینک تازه بگیر.")
      await db
        .update(schema.users)
        .set({ telegramChatId: String(ctx.chat.id), telegramLinkCode: null })
        .where(eq(schema.users.id, user.id))
      return ctx.reply(`✅ ${user.displayName} عزیز، تلگرامت به سرور یار وصل شد.\n\n/status — وضعیت کلی\n/servers — لیست سرورها\n/renewals — تمدیدهای پیش رو\n/down — موارد قطع`)
    }
    if (await authorizedChat(ctx)) return ctx.reply("/status — وضعیت کلی\n/servers — لیست سرورها\n/renewals — تمدیدهای پیش رو\n/down — موارد قطع")
    return ctx.reply("برای اتصال، از صفحهٔ پروفایل پنل سرور یار لینک بگیر.")
  })

  // everything below is only for linked users in private chat
  bot.use(async (ctx, next) => {
    if (await authorizedChat(ctx)) return next()
  })

  bot.command("status", async (ctx) => {
    const [srv, svc] = await Promise.all([
      db.select().from(schema.servers).where(eq(schema.servers.archived, false)).all(),
      db.select().from(schema.services).all(),
    ])
    const count = (rows: { status: string }[], s: string) => rows.filter((r) => r.status === s).length
    const { upcomingRenewals } = await import("../routes/overview.ts")
    const soon = (await upcomingRenewals(7)).length
    await ctx.reply(
      [
        "<b>📊 وضعیت کلی</b>",
        `سرورها: 🟢 ${count(srv, "up")}  🔴 ${count(srv, "down")}  🛠 ${count(srv, "maintenance")}  از ${srv.length}`,
        `سرویس‌ها: 🟢 ${count(svc, "up")}  🔴 ${count(svc, "down")}  🛠 ${count(svc, "maintenance")}  از ${svc.length}`,
        `تمدیدهای ۷ روز آینده: ${soon}`,
      ].join("\n"),
      { parse_mode: "HTML" },
    )
  })

  bot.command("servers", async (ctx) => {
    const rows = await db.select().from(schema.servers).where(eq(schema.servers.archived, false)).orderBy(schema.servers.name).all()
    if (!rows.length) return ctx.reply("هنوز سروری ثبت نشده.")
    const lines = rows.map(
      (s) =>
        `${STATUS_ICON[s.status] ?? "⚪️"} <b>${esc(s.name)}</b> <code>${esc(s.ips[0] ?? "-")}</code>${s.nextRenewal ? `\n    تمدید: ${formatJalali(s.nextRenewal)}` : ""}`,
    )
    await ctx.reply(lines.join("\n"), { parse_mode: "HTML" })
  })

  bot.command("renewals", async (ctx) => {
    const { upcomingRenewals } = await import("../routes/overview.ts")
    const items = await upcomingRenewals(30)
    if (!items.length) return ctx.reply("در ۳۰ روز آینده تمدیدی نداری 🎉")
    const lines = items.map(
      (i) =>
        `${i.daysLeft < 0 ? "⛔️" : i.daysLeft <= 3 ? "🔴" : i.daysLeft <= 7 ? "🟡" : "🟢"} ${i.type === "server" ? "🖥" : "🌐"} <b>${esc(i.name)}</b> — ${formatJalali(i.date)} (${i.daysLeft < 0 ? `${-i.daysLeft} روز گذشته` : i.daysLeft === 0 ? "امروز" : `${i.daysLeft} روز`})${i.price ? ` · ${i.price.toLocaleString("fa-IR")} ${i.currency}` : ""}`,
    )
    await ctx.reply(lines.join("\n"), { parse_mode: "HTML" })
  })

  bot.command("down", async (ctx) => {
    const [srv, svc] = await Promise.all([
      db.select().from(schema.servers).where(eq(schema.servers.status, "down")).all(),
      db.select().from(schema.services).where(eq(schema.services.status, "down")).all(),
    ])
    if (!srv.length && !svc.length) return ctx.reply("همه‌چیز سالمه 🟢")
    const lines = [
      ...srv.map((s) => `🔴 🖥 <b>${esc(s.name)}</b> — ${esc(s.lastError ?? "")}`),
      ...svc.map((s) => `🔴 ⚙️ <b>${esc(s.name)}</b> — ${esc(s.lastError ?? "")}`),
    ]
    await ctx.reply(lines.join("\n"), { parse_mode: "HTML" })
  })

  bot.catch((err) => console.error("[telegram]", err.message))

  await bot.api
    .setMyCommands([
      { command: "status", description: "وضعیت کلی" },
      { command: "servers", description: "لیست سرورها" },
      { command: "renewals", description: "تمدیدهای پیش رو" },
      { command: "down", description: "موارد قطع" },
    ])
    .catch((e) => console.warn("[telegram] setMyCommands failed:", e.message))

  bot.start({
    allowed_updates: ["message"],
    onStart: (me) => {
      username = me.username
      console.log(`[telegram] @${me.username} polling`)
    },
  }).catch((e) => console.error("[telegram] polling stopped:", e.message))
}

/** Post to the channel (or every linked user when no channel is configured). Never throws. */
export async function notify(html: string) {
  if (!bot) return
  const targets = env.telegramChannelId
    ? [env.telegramChannelId]
    : (await db.select({ id: schema.users.telegramChatId }).from(schema.users).where(isNotNull(schema.users.telegramChatId)).all()).map((r) => r.id!)
  for (const chat of targets) {
    await bot.api.sendMessage(chat, html, { parse_mode: "HTML", link_preview_options: { is_disabled: true } }).catch((e) => console.error("[telegram] send failed:", e.message))
  }
}

/** Send a file privately to every admin who linked Telegram. */
export async function sendToAdmins(file: Buffer, filename: string, caption: string) {
  if (!bot) return
  const admins = await db.select().from(schema.users).where(eq(schema.users.role, "admin")).all()
  for (const a of admins) {
    if (!a.telegramChatId) continue
    await bot.api.sendDocument(a.telegramChatId, new InputFile(file, filename), { caption }).catch((e) => console.error("[telegram] backup send failed:", e.message))
  }
}

export async function stopBot() {
  await bot?.stop()
}
