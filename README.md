# سرور یار (ServerYar)

پنل شخصی برای مدیریت سرورها، سرویس‌ها، دامنه‌ها، هزینه‌ها و تمدیدها؛ با مانیتورینگ آپ‌تایم و نوتیف تلگرام.
مشخصات کامل: [docs/SPEC.md](docs/SPEC.md)

## اجرای محلی (توسعه)

```bash
pnpm install
cp .env.example .env        # ENCRYPTION_KEY را پر کن (دستورش داخل فایل هست)
pnpm create-admin <username> "<نام نمایشی>"
pnpm dev                    # API روی :8080 و وب روی :5173
```

بعد از اولین ورود، QR را با Google Authenticator اسکن کن.

## دیپلوی روی سرور

پیش‌نیاز: Docker و یک رکورد DNS (مثلاً `panel.example.com`) که به IP سرور اشاره کند.

1. **ربات تلگرام:** در [@BotFather](https://t.me/BotFather) یک ربات بساز و توکنش را بردار.
2. **کانال:** ربات را **ادمین** کانال کن. برای گرفتن آیدی کانال، یک پیام از کانال را برای [@userinfobot](https://t.me/userinfobot) فوروارد کن (شکلش `-100…` است).
3. **`.env`:**
   ```bash
   cp .env.example .env
   # ENCRYPTION_KEY, PUBLIC_URL=https://panel.example.com, DOMAIN=panel.example.com
   # TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID
   ```
   > ⚠️ از `ENCRYPTION_KEY` یک نسخه جای امن نگه دار. اگر گم شود، رمزهای ذخیره‌شده قابل بازیابی نیستند.
4. **اجرا:**
   ```bash
   docker compose up -d --build
   docker compose exec app node dist/create-admin.js <username> "<نام نمایشی>"
   ```
5. وارد پنل شو، ۲FA را فعال کن و از **تنظیمات ← تلگرام** حساب تلگرامت را وصل کن (برای دستورها و بکاپ روزانه).
6. همکارت را از **تنظیمات ← کاربران** اضافه کن.

## Heartbeat برای ربات‌ها و Cronها

برای سرویس‌هایی با روش چک «Heartbeat»، آدرس `https://panel.example.com/hb/<token>` در کارت سرویس نمایش داده می‌شود.
سرویس باید هر چند دقیقه آن را صدا بزند، مثلاً در crontab:

```cron
*/5 * * * * curl -fsS -m 10 https://panel.example.com/hb/<token> > /dev/null
```

یا داخل کد ربات (Python):

```python
requests.get("https://panel.example.com/hb/<token>", timeout=10)
```

اگر در «مهلت» تعیین‌شده پینگی نرسد، سرویس قطع حساب می‌شود و نوتیف می‌آید.

## ساختار

```
apps/server     Hono + Drizzle (libSQL/SQLite) + grammY + croner
apps/web        Vite + React + shadcn/ui (RTL) + Motion + Recharts
packages/shared تایپ‌ها و اسکیمای Zod مشترک
```

- تغییر اسکیمای دیتابیس: `apps/server/src/db/schema.ts` را عوض کن، بعد `pnpm --filter @serveryar/server db:generate`. مایگریشن‌ها موقع بالا آمدن سرور خودکار اجرا می‌شوند.
- بکاپ: هر روز ساعت ۳ بامداد (قابل تغییر) فایل دیتابیس برای مدیرهایی که تلگرامشان وصل است فرستاده می‌شود.
