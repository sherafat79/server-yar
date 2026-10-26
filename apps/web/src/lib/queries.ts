import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type {
  ActivityDTO,
  CheckPoint,
  DashboardDTO,
  DomainDTO,
  IncidentDTO,
  Named,
  PaymentDTO,
  RenewalItem,
  ServerDTO,
  ServiceDTO,
  SettingsDTO,
  UserDTO,
} from "@serveryar/shared"
import { api } from "./api"

const LIVE = { refetchInterval: 30_000 }

export const useMe = () =>
  useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: UserDTO }>("/auth/me").then((r) => r.user).catch(() => null),
    staleTime: 60_000,
  })

export const useDashboard = () => useQuery({ queryKey: ["dashboard"], queryFn: () => api<DashboardDTO>("/dashboard"), ...LIVE })
export const useServers = () => useQuery({ queryKey: ["servers"], queryFn: () => api<ServerDTO[]>("/servers"), ...LIVE })
export const useServer = (id: number) => useQuery({ queryKey: ["servers", id], queryFn: () => api<ServerDTO>(`/servers/${id}`), ...LIVE })
export const useServices = (filter?: { serverId?: number; domainId?: number }) => {
  const qs = filter?.serverId ? `?serverId=${filter.serverId}` : filter?.domainId ? `?domainId=${filter.domainId}` : ""
  return useQuery({ queryKey: ["services", filter ?? {}], queryFn: () => api<ServiceDTO[]>(`/services${qs}`), ...LIVE })
}
export const useDomains = () => useQuery({ queryKey: ["domains"], queryFn: () => api<DomainDTO[]>("/domains") })
export const useProviders = () => useQuery({ queryKey: ["providers"], queryFn: () => api<Named[]>("/providers") })
export const useVendors = () => useQuery({ queryKey: ["vendors"], queryFn: () => api<Named[]>("/vendors") })
export const useRenewals = () => useQuery({ queryKey: ["renewals"], queryFn: () => api<RenewalItem[]>("/renewals?days=400") })
export const usePayments = () => useQuery({ queryKey: ["payments"], queryFn: () => api<PaymentDTO[]>("/payments") })
export const useMonthlyPayments = () =>
  useQuery({ queryKey: ["payments", "monthly"], queryFn: () => api<{ month: string; currency: string; total: number }[]>("/payments/monthly") })
export const useCosts = () =>
  useQuery({
    queryKey: ["costs"],
    queryFn: () =>
      api<{
        monthly: Record<string, number>
        yearly: Record<string, number>
        byProvider: { provider: string; currency: string; monthly: number }[]
      }>("/costs"),
  })
export const useIncidents = (target?: { type: "server" | "service"; id: number }) =>
  useQuery({
    queryKey: ["incidents", target ?? {}],
    queryFn: () => api<IncidentDTO[]>(`/incidents${target ? `?targetType=${target.type}&targetId=${target.id}&limit=30` : ""}`),
    ...LIVE,
  })
export const useActivity = () => useQuery({ queryKey: ["activity"], queryFn: () => api<ActivityDTO[]>("/activity") })
export const useUsers = (enabled = true) => useQuery({ queryKey: ["users"], queryFn: () => api<UserDTO[]>("/users"), enabled })
export const useSettings = () => useQuery({ queryKey: ["settings"], queryFn: () => api<SettingsDTO>("/settings") })
export const useChecks = (type: "servers" | "services", id: number, range: string) =>
  useQuery({ queryKey: ["checks", type, id, range], queryFn: () => api<CheckPoint[]>(`/${type}/${id}/checks?range=${range}`), ...LIVE })

/** Mutation that toasts errors/success and refreshes everything that may have changed. */
export function useAction<TVars, TRes = unknown>(fn: (v: TVars) => Promise<TRes>, success?: string | ((r: TRes) => string)) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "me" })
      if (success) toast.success(typeof success === "function" ? success(r) : success)
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
