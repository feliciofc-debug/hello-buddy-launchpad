import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { mlClientId } from "../_shared/ml-config.ts";
import { resolveUserIdForMlNotification } from "../_shared/ml-notifications-process-run.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("ok", { status: 200 });
  }
  try {
    const payload = await req.json();
    const applicationId = String(payload?.application_id ?? "");
    if (applicationId !== mlClientId()) {
      return new Response(JSON.stringify({ ok: false }), { status: 401 });
    }
    const mlUserId = Number(payload?.user_id);
    if (!mlUserId) return new Response(JSON.stringify({ ok: true }), { status: 200 });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userId = await resolveUserIdForMlNotification(admin, mlUserId);
    if (!userId) return new Response(JSON.stringify({ ok: true, skipped: "unknown_user" }), { status: 200 });

    const notificationId = String(payload?._id ?? `${payload?.topic}:${payload?.resource}:${payload?.sent}`);
    await admin.from("ml_notification_inbox").upsert({
      notification_id: notificationId,
      topic: String(payload?.topic ?? "unknown"),
      resource: String(payload?.resource ?? ""),
      ml_user_id: mlUserId,
      user_id: userId,
      payload,
      status: "pending",
    }, { onConflict: "notification_id", ignoreDuplicates: true });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    console.warn("[ml-notifications]", (e as Error).message);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
});
