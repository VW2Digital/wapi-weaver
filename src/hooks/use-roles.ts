import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentUserRoles } from "@/lib/admin.functions";
import { useAuth } from "@/hooks/use-auth";

function reportServerFnAbortDebug(
  hypothesisId: string,
  location: string,
  msg: string,
  data: Record<string, unknown>,
) {
  if (!import.meta.env.DEV) return;
  void fetch("http://127.0.0.1:7777/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "serverfn-aborts",
      runId: "pre-fix",
      hypothesisId,
      location,
      msg: `[DEBUG] ${msg}`,
      data,
      ts: Date.now(),
    }),
  }).catch(() => {});
}

export function useRoles() {
  const { user } = useAuth();
  const fetchRoles = useServerFn(getCurrentUserRoles);
  // #region debug-point G:use-roles-query-config
  reportServerFnAbortDebug("G", "use-roles.ts:render", "useRoles render state", {
    userId: user?.id ?? null,
    enabled: Boolean(user),
  });
  // #endregion
  const q = useQuery({
    queryKey: ["current-user-roles", user?.id],
    queryFn: () => fetchRoles(),
    enabled: !!user,
    staleTime: 60_000,
  });
  return {
    roles: q.data?.roles ?? [],
    isAdmin: q.data?.isAdmin ?? false,
    loading: q.isLoading,
  };
}
