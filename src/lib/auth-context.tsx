import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "gate";

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles]     = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRoles = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    setRoles((data ?? []).map((r) => r.role as AppRole));
  };

  useEffect(() => {
    let mounted = true;

    // ── Ongoing auth events (sign-in, sign-out, token refresh) ────────────
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, sess) => {
      if (!mounted) return;

      if (event === "SIGNED_IN") {
        // Re-enter loading state so routing decisions wait for roles
        setLoading(true);
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) await loadRoles(sess.user.id);
        if (mounted) setLoading(false);
        return;
      }

      if (event === "SIGNED_OUT") {
        setSession(null);
        setUser(null);
        setRoles([]);
        return;
      }

      // TOKEN_REFRESHED, USER_UPDATED — keep session in sync silently
      setSession(sess);
      setUser(sess?.user ?? null);
    });

    // ── Initial session (page load / refresh) ─────────────────────────────
    // We await roles before clearing loading so index.tsx sees the correct
    // isAdmin value on first render and never mis-routes to /verify.
    supabase.auth.getSession().then(async ({ data: { session: sess } }) => {
      if (!mounted) return;
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) await loadRoles(sess.user.id);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName },
      },
    });
    return error ? { error: error.message } : {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        roles,
        loading,
        signIn,
        signUp,
        signOut,
        hasRole,
        isAdmin: roles.includes("admin"),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
