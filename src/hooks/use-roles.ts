import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentUserRoles } from "@/lib/admin.functions";
import { useAuth } from "@/hooks/use-auth";

export function useRoles() {
  const { user } = useAuth();
  const fetchRoles = useServerFn(getCurrentUserRoles);
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
