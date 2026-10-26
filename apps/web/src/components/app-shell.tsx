import { useState } from "react"
import { NavLink, Outlet, useLocation } from "react-router"
import { useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import {
  Activity,
  Boxes,
  CalendarClock,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Server,
  ServerCog,
  Settings,
  Sun,
  Wallet,
} from "lucide-react"
import type { UserDTO } from "@serveryar/shared"
import { api } from "@/lib/api"
import { useDashboard } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { faNum } from "@/lib/format"
import { Aurora } from "@/components/common"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const NAV = [
  { to: "/", label: "داشبورد", icon: LayoutDashboard, end: true },
  { to: "/servers", label: "سرورها", icon: Server },
  { to: "/services", label: "سرویس‌ها", icon: Boxes },
  { to: "/domains", label: "دامنه‌ها", icon: Globe },
  { to: "/renewals", label: "تمدیدها", icon: CalendarClock, badge: "renewals" as const },
  { to: "/costs", label: "هزینه‌ها", icon: Wallet },
  { to: "/events", label: "رخدادها و لاگ", icon: Activity },
  { to: "/settings", label: "تنظیمات", icon: Settings },
]

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-chart-1 to-chart-2 text-primary-foreground shadow-lg shadow-chart-1/25">
        <ServerCog className="size-5" />
      </div>
      <div>
        <div className="font-bold leading-tight">سرور یار</div>
        <div className="text-[11px] text-muted-foreground">ServerYar</div>
      </div>
    </div>
  )
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const { data } = useDashboard()
  const down = (data?.servers.down ?? 0) + (data?.services.down ?? 0)
  const soon = data?.upcoming.filter((u) => u.daysLeft <= 7).length ?? 0
  return (
    <nav className="grid gap-1">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
              isActive ? "text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl border border-glass-border bg-accent shadow-sm"
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              )}
              <item.icon className={cn("relative size-[18px]", isActive && "text-primary")} />
              <span className="relative flex-1">{item.label}</span>
              {item.to === "/" && down > 0 && (
                <span className="relative rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">{faNum(down)}</span>
              )}
              {item.badge === "renewals" && soon > 0 && (
                <span className="relative rounded-full bg-warning px-1.5 text-[10px] font-bold text-black">{faNum(soon)}</span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function UserMenu({ user }: { user: UserDTO }) {
  const qc = useQueryClient()
  const { theme, setTheme } = useTheme()
  async function logout() {
    await api("/auth/logout", { body: {} }).catch(() => {})
    qc.clear()
    qc.setQueryData(["me"], null)
  }
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="تغییر تم">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </motion.span>
        </AnimatePresence>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-9 gap-2 px-2">
            <span className="grid size-7 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">{user.displayName.slice(0, 1)}</span>
            <span className="hidden text-sm sm:inline">{user.displayName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="font-normal">
            <div className="text-sm">{user.displayName}</div>
            <div className="text-xs text-muted-foreground">{user.role === "admin" ? "مدیر" : "عضو"}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <NavLink to="/settings">
              <Settings />
              تنظیمات و پروفایل
            </NavLink>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={logout} variant="destructive">
            <LogOut />
            خروج
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function AppShell({ user }: { user: UserDTO }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  return (
    <div className="min-h-svh">
      <Aurora />
      {/* desktop sidebar (right side in RTL) */}
      <aside className="glass fixed inset-y-3 start-3 z-30 hidden w-60 flex-col gap-6 rounded-2xl p-4 lg:flex">
        <Brand />
        <Nav />
        <div className="mt-auto rounded-xl bg-muted/50 p-3 text-[11px] leading-5 text-muted-foreground">
          چک‌ها هر ۶۰ ثانیه · نوتیف‌ها در کانال تلگرام
        </div>
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-72 gap-6 p-4">
          <SheetTitle className="sr-only">منو</SheetTitle>
          <Brand />
          <Nav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="lg:ps-[16.5rem]">
        <header className="sticky top-0 z-20 px-3 pt-3 lg:px-6">
          <div className="glass flex h-14 items-center justify-between rounded-2xl px-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="منو">
                <Menu />
              </Button>
              <span className="text-sm text-muted-foreground">
                {new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", dateStyle: "full" }).format(new Date())}
              </span>
            </div>
            <UserMenu user={user} />
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-3 py-6 lg:px-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
