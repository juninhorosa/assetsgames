import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let authTransition = 0;

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!mounted) return;

      if (event === "INITIAL_SESSION") {
        if (next) {
          setSession(next);
          setLoading(false);
        }
        return;
      }

      authTransition += 1;
      setSession(next);
      setLoading(false);
    });

    const transitionAtStart = authTransition;
    supabase.auth.getSession().then(({ data: { session: current } }) => {
      if (!mounted) return;
      // A SIGNED_IN event may resolve while this initial storage read is still
      // pending. Never let that older read overwrite the fresh Google session.
      if (authTransition !== transitionAtStart) return;
      setSession(current);
      setLoading(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const user: User | null = session?.user ?? null;
  return <AuthContext.Provider value={{ session, user, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
