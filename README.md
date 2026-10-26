# سرور یار (ServerYar)

پنل شخصی برای مدیریت سرورها، سرویس‌ها، دامنه‌ها، هزینه‌ها و تمدیدها، با مانیتورینگ آپ‌تایم و نوتیف تلگرام.

- مانیتورینگ بدون Agent: چک دوره‌ای سرویس‌ها و سرورها، و روش Heartbeat برای ربات‌ها و Cronها
- هشدار و بکاپ روزانه دیتابیس در تلگرام
- ورود با نام کاربری، رمز و ۲FA (TOTP)، و مدیریت چند کاربر
- رابط کاربری فارسی و راست‌چین (RTL)

مشخصات کامل در [docs/SPEC.md](docs/SPEC.md) است.

## پیش‌نیازها

| ابزار                   | نسخه | یادداشت                                              |
| ----------------------- | ---- | ---------------------------------------------------- |
| Node.js                 | 22   | فقط برای توسعه محلی                                  |
| pnpm                    | 10   | فقط برای توسعه محلی؛ با `corepack enable` نصب می‌شود |
| Docker + Docker Compose | اخیر | برای دیپلوی روی سرور                                 |

## تنظیمات محیطی

فایل `.env` را از روی `.env.example` بساز:

```bash
cp .env.example .env
```

| متغیر                 | اجباری         | توضیح                                                                                                                                            |
| --------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ENCRYPTION_KEY`      | بله            | کلید ۳۲ بایتی به‌صورت base64 برای رمزنگاری رمزهای ذخیره‌شده. ساخت: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `PUBLIC_URL`          | بله (روی سرور) | آدرس عمومی پنل، مثل `https://panel.example.com`. در لینک‌ها استفاده می‌شود                                                                       |
| `PORT`                | خیر            | پورت سرور API. پیش‌فرض `8080`                                                                                                                    |
| `DATABASE_PATH`       | خیر            | مسیر فایل SQLite. پیش‌فرض `./data/serveryar.db` (در Docker: `/data/serveryar.db`)                                                                |
| `TELEGRAM_BOT_TOKEN`  | خیر            | توکن ربات از BotFather. بدون آن نوتیف و بکاپ تلگرامی کار نمی‌کند                                                                                 |
| `TELEGRAM_CHANNEL_ID` | خیر            | آیدی کانال برای نوتیف‌ها، مثل `-1001234567890`. ربات باید ادمین کانال باشد                                                                       |
| `TELEGRAM_PROXY`      | خیر            | پروکسی برای دسترسی به API تلگرام، مثل `http://127.0.0.1:8118`                                                                                    |
| `TZ`                  | خیر            | منطقه زمانی. پیش‌فرض `Asia/Tehran`                                                                                                               |

> ⚠️ `ENCRYPTION_KEY` را در جای امنی نسخه پشتیبان بگیر. اگر گم شود، رمزهای ذخیره‌شده دیگر قابل بازیابی نیستند.

## اجرای محلی (توسعه)

```bash
pnpm install
cp .env.example .env          # ENCRYPTION_KEY را پر کن
pnpm create-admin <username> "<نام نمایشی>"
pnpm dev                      # API روی :8080 و وب روی :5173
```

`create-admin` رمز را از ورودی می‌پرسد (حداقل ۸ کاراکتر). برای اجرای غیرتعاملی می‌توانی متغیر `SERVERYAR_PASSWORD` را قبل از دستور تنظیم کنی.

بعد از اولین ورود، QR را با Google Authenticator یا هر اپ TOTP دیگری اسکن کن و ۲FA را فعال کن.

## دیپلوی روی سرور

پیش‌نیاز: Docker، Nginx روی هاست با گواهی SSL (مثلاً با Certbot)، و یک رکورد DNS (مثلاً `panel.example.com`) که به IP سرور اشاره کند.

پنل فقط روی `127.0.0.1:5050` منتشر می‌شود. SSL و دسترسی عمومی با Nginx انجام می‌شود، نه با خود Docker.

### ۱. ربات تلگرام (اختیاری ولی توصیه‌شده)

1. در [@BotFather](https://t.me/BotFather) یک ربات بساز و توکنش را بردار.
2. ربات را **ادمین** کانال خود کن.
3. برای گرفتن آیدی کانال، یک پیام از کانال را برای [@userinfobot](https://t.me/userinfobot) فوروارد کن. آیدی به شکل `-100…` است.

### ۲. تنظیم `.env`

```bash
cp .env.example .env
```

حداقل این مقادیر را پر کن: `ENCRYPTION_KEY`، `PUBLIC_URL=https://panel.example.com` (دامنه‌ای که Nginx به پنل وصل می‌کند)، و در صورت استفاده از تلگرام، `TELEGRAM_BOT_TOKEN` و `TELEGRAM_CHANNEL_ID`. `PORT` را روی `8080` نگه دار.

### ۳. اجرا

```bash
docker compose up -d --build
docker compose exec -it app node dist/create-admin.js <username> "<نام نمایشی>"
```

پرچم `-it` لازم است چون رمز از ورودی تعاملی خوانده می‌شود. رمز را در پرامپت وارد کن تا در تاریخچه شل ذخیره نشود.

### ۳.۱. تنظیم Nginx

یک server block برای دامنه بساز و آن را به `127.0.0.1:5050` وصل کن. گواهی SSL را با Certbot بگیر:

```nginx
server {
    server_name panel.example.com;

    location / {
        proxy_pass http://127.0.0.1:5050;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 443 ssl;
    # ssl_certificate / ssl_certificate_key را Certbot اضافه می‌کند
}
```

### ۴. راه‌اندازی اولیه

1. وارد پنل شو و ۲FA را فعال کن.
2. از **تنظیمات ← تلگرام** حساب تلگرامت را وصل کن. این کار برای دستورهای ربات و دریافت بکاپ روزانه لازم است.
3. همکارانت را از **تنظیمات ← کاربران** اضافه کن. برای ساخت کاربر عادی به‌جای مدیر، از `--member` در `create-admin` استفاده کن.

### به‌روزرسانی

```bash
git pull
docker compose up -d --build
```

مایگریشن‌های دیتابیس موقع بالا آمدن سرور خودکار اجرا می‌شوند. داده‌ها در volume با نام `serveryar_data` می‌مانند و با rebuild از بین نمی‌روند.

## Heartbeat برای ربات‌ها و Cronها

برای سرویس‌هایی با روش چک «Heartbeat»، آدرس `https://panel.example.com/hb/<token>` در کارت سرویس نمایش داده می‌شود. سرویس باید هر چند دقیقه یک بار (طبق «مهلت» تعیین‌شده) آن را صدا بزند.

با crontab:

```cron
*/5 * * * * curl -fsS -m 10 https://panel.example.com/hb/<token> > /dev/null
```

داخل کد ربات (Python):

```python
requests.get("https://panel.example.com/hb/<token>", timeout=10)
```

اگر در مهلت تعیین‌شده پینگی نرسد، سرویس قطع در نظر گرفته می‌شود و نوتیف ارسال می‌شود. آدرس `/hb/` هم با GET و هم با POST کار می‌کند.

## بکاپ

هر ساعت بررسی می‌شود و در ساعتی که در تنظیمات مشخص شده (پیش‌فرض ساعت ۳ بامداد، به وقت `Asia/Tehran`) فایل دیتابیس برای کاربرانی که تلگرامشان وصل است ارسال می‌شود.

## عیب‌یابی

- **۵۰۲ Bad Gateway از Nginx:** مطمئن شو کانتینر بالاست (`docker compose ps`) و `curl -I http://127.0.0.1:5050/api/health` پاسخ `200` می‌دهد.
- **`ENCRYPTION_KEY must be 32 bytes`:** کلید را دوباره با دستور بالا بساز. باید دقیقاً ۳۲ بایت باشد و به‌صورت base64 ذخیره شود.
- **نوتیف تلگرام نمی‌آید:** توکن و آیدی کانال را بررسی کن و مطمئن شو ربات ادمین کانال است. اگر تلگرام از سرور در دسترس نیست، `TELEGRAM_PROXY` را تنظیم کن.
- **`create-admin` در Docker منتظر ورودی می‌ماند یا خطا می‌دهد:** از `docker compose exec -it` استفاده کن.

## توسعه

```bash
pnpm typecheck     # بررسی تایپ‌ها در همه پکیج‌ها
pnpm build         # ساخت shared، وب و سرور
```

- **تغییر اسکیمای دیتابیس:** فایل `apps/server/src/db/schema.ts` را تغییر بده، سپس اجرا کن:
  ```bash
  pnpm --filter @serveryar/server db:generate
  ```
  مایگریشن‌ها موقع بالا آمدن سرور اعمال می‌شوند.

## ساختار پروژه

```
apps/server     Hono + Drizzle (libSQL/SQLite) + grammY + croner
apps/web        Vite + React + shadcn/ui (RTL) + Motion + Recharts
packages/shared تایپ‌ها و اسکیمای Zod مشترک
docs/SPEC.md    مشخصات کامل محصول
```

فایل‌های دیپلوی: `Dockerfile` (ساخت image چندمرحله‌ای) و `docker-compose.yml` (سرویس app که روی `127.0.0.1:5050` منتشر می‌شود).
