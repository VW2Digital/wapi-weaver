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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const { data: sub } = db.auth.onAuthStateChange((_event: string, s: Session | null) => {
      if (!cancelled) setSession(s);
    });
    db.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (!cancelled) {
        setSession(data.session);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
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
