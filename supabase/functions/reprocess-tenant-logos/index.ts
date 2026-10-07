import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  LOGO_BACKGROUND_WARNING,
  removeSolidLogoBackground,
} from "../_shared/logo-background.ts";
import { TENANT_LOGO_BUCKET } from "../_shared/tenant-logo.ts";

const jsonHeaders = { "Content-Type": "application/json" };

Deno.serve(async (request) => {
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authorization = request.headers.get("authorization") || "";
    if (!serviceKey || authorization !== `Bearer ${serviceKey}`) {
      return Response.json({ error: "não autorizado" }, {
        status: 401,
        headers: jsonHeaders,
      });
    }
    if (request.method !== "POST") {
      return Response.json({ error: "método não permitido" }, {
        status: 405,
        headers: jsonHeaders,
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey,
    );
    const { data: logos, error } = await supabase.from("tenant_logos")
      .select(
        "id, user_id, storage_path, mime_type, variant, background_warning",
      )
      .eq("ativo", true);
    if (error) throw error;

    const report = {
      processed: 0,
      changed: 0,
      warnings: 0,
      items: [] as Array<Record<string, unknown>>,
    };
    for (const logo of logos || []) {
      report.processed++;
      const item: Record<string, unknown> = {
        id: logo.id,
        variant: logo.variant,
        changed: false,
      };
      try {
        if (!String(logo.storage_path).startsWith(`${logo.user_id}/`)) {
          throw new Error("path fora do tenant");
        }
        const { data: file, error: downloadError } = await supabase.storage
          .from(TENANT_LOGO_BUCKET).download(logo.storage_path);
        if (downloadError || !file) throw downloadError ??
          new Error("arquivo ausente");
        const original = new Uint8Array(await file.arrayBuffer());
        const result = await removeSolidLogoBackground(
          original,
          logo.mime_type || file.type || "application/octet-stream",
        );
        if (result.changed) {
          const stamp = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
          const backupPath =
            `${logo.user_id}/backups/${stamp}-${String(logo.storage_path).split("/").pop()}`;
          const processedPath =
            `${logo.user_id}/${logo.variant}/${stamp}-reprocessada.png`;
          const { error: backupError } = await supabase.storage
            .from(TENANT_LOGO_BUCKET).upload(backupPath, original, {
              contentType: logo.mime_type || file.type ||
                "application/octet-stream",
              upsert: false,
            });
          if (backupError) throw backupError;
          const { error: uploadError } = await supabase.storage
            .from(TENANT_LOGO_BUCKET).upload(processedPath, result.bytes, {
              contentType: "image/png",
              upsert: false,
            });
          if (uploadError) throw uploadError;
          const { error: updateError } = await supabase.from("tenant_logos")
            .update({
              storage_path: processedPath,
              mime_type: "image/png",
              background_warning: null,
            }).eq("id", logo.id);
          if (updateError) throw updateError;
          report.changed++;
          item.changed = true;
          item.backup_path = backupPath;
        } else if (result.warning) {
          report.warnings++;
          item.warning = result.warning;
          await supabase.from("tenant_logos").update({
            background_warning: result.warning || LOGO_BACKGROUND_WARNING,
          }).eq("id", logo.id);
        }
      } catch (caught) {
        report.warnings++;
        const reason = caught instanceof Error
          ? caught.message
          : String(caught);
        console.warn(`[logo-background] falhou motivo=${reason}`);
        item.warning = LOGO_BACKGROUND_WARNING;
        item.error = reason;
        await supabase.from("tenant_logos").update({
          background_warning: LOGO_BACKGROUND_WARNING,
        }).eq("id", logo.id);
      }
      report.items.push(item);
    }
    return Response.json(report, { headers: jsonHeaders });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500, headers: jsonHeaders });
  }
});
