import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentUserRoles } from "@/lib/admin.functions";
import { useAuth } from "@/hooks/use-auth";
import { hasCompanyAdminRole, hasMasterRole } from "@/lib/roles";

export function useRoles() {
  const { user } = useAuth();
  const fetchRoles = useServerFn(getCurrentUserRoles);
  const q = useQuery({
    queryKey: ["current-user-roles", user?.id],
    queryFn: async () => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          fetchRoles(),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(
              () => reject(new Error("Tempo limite ao verificar permissões")),
              5_000,
            );
          }),
        ]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    },
    enabled: !!user,
    staleTime: 60_000,
    retry: false,
  });

  const sessionRole = typeof user?.role === "string" ? user.role : null;
  const roles = q.data?.roles?.length ? q.data.roles : sessionRole ? [sessionRole] : [];

  return {
    roles,
    isAdmin: q.data?.isAdmin ?? (hasMasterRole(roles) || hasCompanyAdminRole(roles)),
    loading: q.isLoading && !sessionRole,
    error: q.error,
  };
}
