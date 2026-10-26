import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router"
import { Loader2 } from "lucide-react"
import { useMe } from "@/lib/queries"
import { AppShell } from "@/components/app-shell"
import { Aurora } from "@/components/common"
import { LoginPage, TotpSetupPage } from "@/pages/auth"
import { DashboardPage } from "@/pages/dashboard"

const ServersPage = lazy(() => import("@/pages/servers"))
const ServerDetailPage = lazy(() => import("@/pages/server-detail"))
const ServicesPage = lazy(() => import("@/pages/services"))
const DomainsPage = lazy(() => import("@/pages/domains"))
const RenewalsPage = lazy(() => import("@/pages/renewals"))
const CostsPage = lazy(() => import("@/pages/costs"))
const EventsPage = lazy(() => import("@/pages/events"))
const SettingsPage = lazy(() => import("@/pages/settings"))

function Splash() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

export default function App() {
  const { data: user, isLoading } = useMe()
  if (isLoading)
    return (
      <>
        <Aurora />
        <Splash />
      </>
    )
  if (!user) return <LoginPage />
  if (!user.totpEnabled) return <TotpSetupPage user={user} />

  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route element={<AppShell user={user} />}>
          <Route index element={<DashboardPage />} />
          <Route path="servers" element={<ServersPage />} />
          <Route path="servers/:id" element={<ServerDetailPage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="domains" element={<DomainsPage />} />
          <Route path="renewals" element={<RenewalsPage />} />
          <Route path="costs" element={<CostsPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="settings" element={<SettingsPage user={user} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
