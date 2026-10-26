import { QueryClient } from "@tanstack/react-query"

const MESSAGES: Record<string, string> = {
  invalid_credentials: "نام کاربری یا رمز عبور اشتباه است",
  locked: "حساب به دلیل تلاش‌های ناموفق ۱۵ دقیقه قفل شد",
  invalid_otp: "کد تأیید نامعتبر است (یا قبلاً استفاده شده؛ تا کد بعدی صبر کن)",
  too_many_requests: "درخواست‌ها زیاد است، کمی بعد امتحان کن",
  unauthorized: "نشست منقضی شده، دوباره وارد شو",
  forbidden: "دسترسی نداری",
  not_found: "پیدا نشد",
  validation: "مقادیر فرم معتبر نیست",
  username_taken: "این نام کاربری قبلاً ثبت شده",
  domain_exists: "این دامنه قبلاً ثبت شده",
  wrong_password: "رمز فعلی اشتباه است",
  telegram_disabled: "ربات تلگرام روی سرور تنظیم نشده",
  cannot_delete_self: "نمی‌توانی خودت را حذف کنی",
  cannot_demote_self: "نمی‌توانی نقش خودت را کم کنی",
  totp_already_enabled: "تأیید دومرحله‌ای قبلاً فعال شده",
}

export class ApiError extends Error {
  status: number
  code: string
  details?: unknown
  constructor(status: number, code: string, details?: unknown) {
    super(MESSAGES[code] ?? `خطای ${status}: ${code}`)
    this.status = status
    this.code = code
    this.details = details
  }
}

export async function api<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
    headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new ApiError(res.status, data.error ?? "unknown", data.details)
    if (res.status === 401 && !path.startsWith("/auth/login")) queryClient.setQueryData(["me"], null)
    if (err.code === "totp_setup_required") queryClient.invalidateQueries({ queryKey: ["me"] })
    throw err
  }
  return data as T
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2,
      refetchOnWindowFocus: true,
      staleTime: 15_000,
    },
  },
})
