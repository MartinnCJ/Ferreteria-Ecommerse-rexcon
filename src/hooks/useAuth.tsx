import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { CustomerType, Profile } from "@/types";

interface AuthValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  /** Nivel de precio que la UI espera. El backend siempre lo vuelve a calcular. */
  priceTier: CustomerType;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const B2B_TYPES: CustomerType[] = ["professional", "company", "wholesale", "distributor"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }
    const [{ data: profileData, error: profileError }, { data: roles, error: rolesError }] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, email, first_name, last_name, phone, rut, company_name, company_rut, customer_type, b2b_status, b2b_review_note, b2b_reviewed_at, b2b_reviewed_by, is_admin",
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    if (profileError) throw profileError;
    if (rolesError) throw rolesError;
    let resolvedProfile = profileData as Profile | null;
    if (!resolvedProfile) {
      const { data: repairedProfile, error: repairError } = await supabase.rpc("ensure_my_profile");
      if (repairError) throw repairError;
      resolvedProfile = repairedProfile as Profile | null;
    }
    setProfile(resolvedProfile);
    setIsAdmin(Boolean(resolvedProfile?.is_admin || roles?.some((r) => r.role === "admin")));
  }, []);

  useEffect(() => {
    let active = true;

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      // Un refresh de JWT no cambia perfil/roles y no debe provocar parpadeos
      // ni consultas extra en toda la aplicación.
      if (event === "TOKEN_REFRESHED") return;

      // Evita renderizar una cuenta autenticada como "sin perfil" durante la
      // pequeña ventana entre el cambio de sesión y la consulta de profiles.
      setLoading(true);
      // Evita deadlocks: las consultas se hacen fuera del callback.
      setTimeout(() => {
        void loadProfile(nextSession?.user?.id)
          .catch((error) => {
            console.error("No pudimos cargar el perfil de usuario", error);
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      }, 0);
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      try {
        await loadProfile(data.session?.user?.id);
      } catch (error) {
        console.error("No pudimos cargar el perfil de usuario", error);
      } finally {
        if (active) setLoading(false);
      }
    }).catch((error) => {
      console.error("No pudimos recuperar la sesión", error);
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    await loadProfile(data.user?.id);
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
    setIsAdmin(false);
  }, []);

  const priceTier: CustomerType = useMemo(() => {
    if (!profile) return "retail";
    if (B2B_TYPES.includes(profile.customer_type) && profile.b2b_status === "approved") {
      return profile.customer_type;
    }
    return "retail";
  }, [profile]);

  const value: AuthValue = {
    user: session?.user ?? null,
    session,
    profile,
    isAdmin,
    loading,
    priceTier,
    refreshProfile,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
