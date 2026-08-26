import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Only real auth transitions update state. INITIAL_SESSION can arrive with a
    // null session before the (async) preview session storage has been read, and
    // treating it as "signed out" bounces users back to /auth right after login.
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!mounted) return;
      if (event === "INITIAL_SESSION") {
        if (next) {
          setSession(next);
          setLoading(false);
        }
        return;
      }
      setSession(next);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: current } }) => {
      if (!mounted) return;
      setSession(current);
      setLoading(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const user: User | null = session?.user ?? null;
  return { session, user, loading };
}
