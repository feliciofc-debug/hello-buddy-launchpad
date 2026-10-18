import { supabase } from "@/integrations/supabase/client";

export const APP_ADMIN_EMAIL = "expo@atombrasildigital.com";

export function isAppAdminEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === APP_ADMIN_EMAIL;
}

export async function fetchIsAppAdmin(
  userId: string,
  email?: string | null,
): Promise<boolean> {
  if (isAppAdminEmail(email)) return true;
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return Boolean(data);
}
