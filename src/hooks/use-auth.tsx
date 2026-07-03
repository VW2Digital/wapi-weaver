import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { db } from "@/integrations/mysql/client";

export interface User {
  id: string;
  email?: string;
  [key: string]: unknown;
}

export interface Session {
  access_token: string;
  user: User;
  [key: string]: unknown;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true });

function reportServerFnAbortDebug(
  hypothesisId: string,
  location: string,
  msg: string,
  data: Record<string, unknown>,
) {
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // #region debug-point A:auth-provider-mounted
    reportServerFnAbortDebug("A", "use-auth.tsx:mount", "AuthProvider mounted", {});
    // #endregion
    let cancelled = false;
    const { data: sub } = db.auth.onAuthStateChange((_event: string, s: Session | null) => {
      // #region debug-point B:auth-state-change
      reportServerFnAbortDebug("B", "use-auth.tsx:onAuthStateChange", "Auth state changed", {
        event: _event,
        hasSession: Boolean(s),
        userId: s?.user?.id ?? null,
      });
      // #endregion
      if (!cancelled) setSession(s);
    });
    db.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      // #region debug-point C:get-session-resolved
      reportServerFnAbortDebug("C", "use-auth.tsx:getSession", "Initial getSession resolved", {
        cancelled,
        hasSession: Boolean(data.session),
        userId: data.session?.user?.id ?? null,
      });
      // #endregion
      if (!cancelled) {
        setSession(data.session);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
      // #region debug-point D:auth-provider-unmount
      reportServerFnAbortDebug("D", "use-auth.tsx:cleanup", "AuthProvider cleanup executed", {});
      // #endregion
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <Ctx.Provider value={{ user: session?.user ?? null, session, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
