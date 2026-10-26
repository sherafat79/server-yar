import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import { KeyRound, Loader2, LogOut, ServerCog, ShieldCheck, Smartphone } from "lucide-react"
import type { UserDTO } from "@serveryar/shared"
import { api, ApiError } from "@/lib/api"
import { Aurora, Field } from "@/components/common"
import { OtpInput } from "@/components/otp-input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh place-items-center px-4 py-10">
      <Aurora />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        transition={{ type: "spring", stiffness: 200, damping: 24 }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-chart-1 to-chart-2 text-primary-foreground shadow-lg shadow-chart-1/30">
            <ServerCog className="size-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">سرور یار</h1>
            <p className="text-sm text-muted-foreground">مدیریت سرورها، سرویس‌ها و تمدیدها</p>
          </div>
        </div>
        <Card className="gap-5 p-6">{children}</Card>
      </motion.div>
    </div>
  )
}

export function LoginPage() {
  const qc = useQueryClient()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState<"password" | "otp">("password")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(code?: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await api<{ user?: UserDTO; needOtp?: boolean }>("/auth/login", {
        body: { username, password, otp: step === "otp" ? (code ?? otp) : undefined },
      })
      if (res.needOtp) {
        setStep("otp")
        return
      }
      qc.setQueryData(["me"], res.user)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "خطای شبکه")
      if (step === "otp") setOtp("")
      if (e instanceof ApiError && e.code === "locked") setStep("password")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthFrame>
      <AnimatePresence mode="wait" initial={false}>
        {step === "password" ? (
          <motion.form
            key="pw"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <Field label="نام کاربری">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" dir="ltr" autoFocus required />
            </Field>
            <Field label="رمز عبور">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" dir="ltr" required />
            </Field>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" size="lg" disabled={busy} className="mt-1">
              {busy ? <Loader2 className="animate-spin" /> : <KeyRound />}
              ورود
            </Button>
          </motion.form>
        ) : (
          <motion.div key="otp" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="grid gap-4 text-center">
            <Smartphone className="mx-auto size-8 text-primary" />
            <div>
              <div className="font-semibold">کد تأیید دومرحله‌ای</div>
              <p className="mt-1 text-sm text-muted-foreground">کد ۶ رقمی اپ Authenticator را وارد کن</p>
            </div>
            <OtpInput value={otp} onChange={setOtp} onComplete={(v) => submit(v)} autoFocus />
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setStep("password")}>
                بازگشت
              </Button>
              <Button className="flex-1" disabled={busy || otp.length !== 6} onClick={() => submit()}>
                {busy && <Loader2 className="animate-spin" />}
                تأیید
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthFrame>
  )
}

export function TotpSetupPage({ user }: { user: UserDTO }) {
  const qc = useQueryClient()
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null)
  const [otp, setOtp] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function start() {
    setBusy(true)
    try {
      setSetup(await api("/auth/totp/setup", { body: {} }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function confirm(code: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await api<{ user: UserDTO }>("/auth/totp/confirm", { body: { otp: code } })
      qc.setQueryData(["me"], res.user)
    } catch (e) {
      setError((e as Error).message)
      setOtp("")
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    await api("/auth/logout", { body: {} }).catch(() => {})
    qc.setQueryData(["me"], null)
  }

  return (
    <AuthFrame>
      <div className="grid gap-4 text-center">
        <ShieldCheck className="mx-auto size-9 text-primary" />
        <div>
          <div className="font-semibold">{user.displayName}، تأیید دومرحله‌ای را فعال کن</div>
          <p className="mt-1 text-sm text-muted-foreground">برای ادامه، QR را با Google Authenticator یا هر اپ TOTP دیگری اسکن کن.</p>
        </div>
        {!setup ? (
          <Button onClick={start} disabled={busy} size="lg">
            {busy && <Loader2 className="animate-spin" />}
            ساخت QR
          </Button>
        ) : (
          <>
            <motion.img
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              src={setup.qr}
              alt="QR code"
              className="mx-auto size-48 rounded-xl bg-white p-2"
            />
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">اسکن نمی‌شود؟ کلید دستی</summary>
              <code className="ltr mt-2 block break-all rounded-md bg-muted p-2 font-mono text-foreground">{setup.secret}</code>
            </details>
            <OtpInput value={otp} onChange={setOtp} onComplete={confirm} autoFocus />
          </>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button variant="ghost" size="sm" onClick={logout} className="mx-auto">
          <LogOut />
          خروج
        </Button>
      </div>
    </AuthFrame>
  )
}
