import type { SupabaseClient } from "@supabase/supabase-js";

export function signInWithEmailPassword(
  supabase: SupabaseClient,
  email: string,
  password: string,
) {
  return supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
}
