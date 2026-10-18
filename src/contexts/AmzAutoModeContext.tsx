import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchIsAppAdmin } from "@/lib/app-admin";
import {
  canToggleAmzAutoMode,
  clearAmzAutoModePreference,
  isEffectiveAmzAutoMode,
  readAmzAutoModePreference,
  writeAmzAutoModePreference,
} from "@/lib/amz-auto-mode";

type AmzAutoModeContextValue = {
  ready: boolean;
  profileTipo: string | null;
  isAdmin: boolean;
  effectiveAmzAutoMode: boolean;
  canToggleAmzAutoMode: boolean;
  enableAmzAutoMode: () => void;
  disableAmzAutoMode: () => void;
  refresh: () => Promise<void>;
};

const AmzAutoModeContext = createContext<AmzAutoModeContextValue | null>(null);

export function AmzAutoModeProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profileTipo, setProfileTipo] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPreference, setAdminPreference] = useState(false);

  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setProfileTipo(null);
      setIsAdmin(false);
      setAdminPreference(false);
      setReady(true);
      return;
    }

    const [{ data: profile }, admin] = await Promise.all([
      supabase
        .from("profiles")
        .select("tipo")
        .eq("id", session.user.id)
        .maybeSingle(),
      fetchIsAppAdmin(session.user.id, session.user.email),
    ]);

    setProfileTipo(profile?.tipo ?? null);
    setIsAdmin(admin);
    setAdminPreference(readAmzAutoModePreference());
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearAmzAutoModePreference();
        setProfileTipo(null);
        setIsAdmin(false);
        setAdminPreference(false);
      }
      void refresh();
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const enableAmzAutoMode = useCallback(() => {
    writeAmzAutoModePreference(true);
    setAdminPreference(true);
  }, []);

  const disableAmzAutoMode = useCallback(() => {
    writeAmzAutoModePreference(false);
    setAdminPreference(false);
  }, []);

  const effective = isEffectiveAmzAutoMode(adminPreference);
  const toggleAllowed = canToggleAmzAutoMode(profileTipo, isAdmin);

  const value = useMemo(
    (): AmzAutoModeContextValue => ({
      ready,
      profileTipo,
      isAdmin,
      effectiveAmzAutoMode: effective,
      canToggleAmzAutoMode: toggleAllowed,
      enableAmzAutoMode,
      disableAmzAutoMode,
      refresh,
    }),
    [
      ready,
      profileTipo,
      isAdmin,
      effective,
      toggleAllowed,
      enableAmzAutoMode,
      disableAmzAutoMode,
      refresh,
    ],
  );

  return (
    <AmzAutoModeContext.Provider value={value}>
      {children}
    </AmzAutoModeContext.Provider>
  );
}

export function useAmzAutoMode(): AmzAutoModeContextValue {
  const ctx = useContext(AmzAutoModeContext);
  if (!ctx) {
    throw new Error("useAmzAutoMode must be used within AmzAutoModeProvider");
  }
  return ctx;
}
