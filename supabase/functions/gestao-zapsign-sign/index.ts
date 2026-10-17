import { decryptGestaoIntegracaoSecret } from "../_shared/gestao-integracoes-crypto.ts";
import { zapsignCreateDocFromPdf } from "../_shared/gestao-zapsign-api.ts";
import {
  gestaoZapsignAdminClient,
  gestaoZapsignAuthedUser,
  jsonResponse,
  optionsResponse,
} from "../_shared/gestao-zapsign-http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  try {
    const { user } = await gestaoZapsignAuthedUser(req);
    if (!user) return jsonResponse({ success: false, error: "Não autenticado" }, 401);
    const body = await req.json();
    const contratoId = String(body?.contrato_id ?? "");
    const base64_pdf = String(body?.base64_pdf ?? "");
    if (!contratoId || !base64_pdf) throw new Error("Dados incompletos para assinatura.");

    const admin = gestaoZapsignAdminClient();
    const { data: conta } = await admin.from("gestao_zapsign_conta")
      .select("api_token_enc, ambiente, status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!conta || conta.status !== "active") throw new Error("ZapSign não conectada.");

    const { data: contrato } = await admin.from("gestao_contrato")
      .select("id, titulo, cliente_nome, cliente_email, cliente_telefone, status")
      .eq("id", contratoId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!contrato) throw new Error("Contrato não encontrado.");
    if (contrato.status === "assinado") throw new Error("Contrato já assinado.");

    const token = await decryptGestaoIntegracaoSecret(conta.api_token_enc);
    const phone = String(contrato.cliente_telefone ?? "").replace(/\D/g, "");
    const phone_number = phone.length >= 10 ? phone.slice(-11) : "";
    const phone_country = phone_number ? "55" : undefined;

    const doc = await zapsignCreateDocFromPdf(conta.ambiente, token, {
      name: contrato.titulo || "Contrato",
      base64_pdf,
      sandbox: conta.ambiente === "sandbox",
      external_id: contratoId,
      signers: [{
        name: contrato.cliente_nome || "Cliente",
        email: contrato.cliente_email || undefined,
        phone_country,
        phone_number: phone_number || undefined,
        send_automatic_email: !!contrato.cliente_email,
        send_automatic_whatsapp: false,
      }],
    });

    const signUrl = doc.signers?.[0]?.sign_url ?? null;
    const docToken = doc.token ?? null;

    await admin.from("gestao_contrato").update({
      status: "pendente_assinatura",
      zapsign_doc_token: docToken,
      zapsign_sign_url: signUrl,
      zapsign_status: doc.status ?? "pending",
    }).eq("id", contratoId).eq("user_id", user.id);

    return jsonResponse({
      success: true,
      sign_url: signUrl,
      doc_token: docToken,
    });
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 422);
  }
});
