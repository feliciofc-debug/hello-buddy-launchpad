import { supabase } from "@/integrations/supabase/client";
import {
  gestaoOsAnuncioPathFromPublicUrl,
  gestaoOsFotoRefBucket,
} from "../../supabase/functions/_shared/gestao-os-foto-origens.ts";
import type { GestaoOsFotoRefRow } from "../../supabase/functions/_shared/gestao-os-fotos.ts";

export async function resolveGestaoOsFotoSignedUrl(ref: GestaoOsFotoRefRow): Promise<string | null> {
  const bucket = gestaoOsFotoRefBucket(ref);
  if (bucket === "url") return ref.storage_path;
  const path = bucket === "produtos"
    ? (gestaoOsAnuncioPathFromPublicUrl(ref.storage_path) ?? ref.storage_path)
    : ref.storage_path;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
