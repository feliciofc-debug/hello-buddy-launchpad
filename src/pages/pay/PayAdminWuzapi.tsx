import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface InstanceRow {
  id: string;
  instance_name: string;
  port: number | null;
  phone_number: string | null;
  is_connected: boolean | null;
  connected_at: string | null;
  updated_at: string | null;
}

function getBillingHeaders() {
  const token = sessionStorage.getItem("billing_token");
  return token ? { "x-billing-token": token } : {};
}

export default function PayAdminWuzapi() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [instance, setInstance] = useState<InstanceRow | null>(null);
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);

  // ---------------- GUARD: somente billing_token (igual /pay/admin) ----------------
  useEffect(() => {
    const billingToken = sessionStorage.getItem("billing_token");
    console.log("[DEBUG PayAdminWuzapi] billing_token:", billingToken ? "presente" : "ausente");
    if (!billingToken) {
      console.warn("[PayAdminWuzapi] sem billing_token → redirect /pay");
      navigate("/pay");
      return;
    }
    setAuthChecked(true);
  }, [navigate]);

  const loadInstance = useCallback(async () => {
    const { data } = await supabase
      .from("wuzapi_instances")
      .select("id, instance_name, port, phone_number, is_connected, connected_at, updated_at")
      .eq("instance_name", "pietro-cobranca")
      .maybeSingle();
    setInstance((data as InstanceRow) || null);
  }, []);

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("pietro-cobranca-instance", {
        body: { action: "status" },
        headers: getBillingHeaders(),
      });
      if (err) throw err;
      if (data?.success) {
        if (data.connected) {
          setQrcode(null);
          setInfo(null);
        }
      } else {
        setError(data?.error || "Falha ao consultar status");
      }
      await loadInstance();
    } catch (e: any) {
      setError(e?.message || "Erro de comunicação");
    } finally {
      setStatusLoading(false);
    }
  }, [loadInstance]);

  // Carrega status inicial após guard ok
  useEffect(() => {
    if (authChecked) {
      fetchStatus();
    }
  }, [authChecked, fetchStatus]);

  // Polling enquanto QR está aberto OU não conectado (a cada 3s)
  useEffect(() => {
    if (!authChecked) return;
    if (instance?.is_connected) {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }
    if (pollingRef.current) window.clearInterval(pollingRef.current);
    pollingRef.current = window.setInterval(() => {
      fetchStatus();
    }, 3000);
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    };
  }, [authChecked, instance?.is_connected, fetchStatus]);

  const gerarQR = async () => {
    console.log("[gerarQR] === CLIQUE detectado ===");
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const headers = getBillingHeaders();
      console.log("[gerarQR] headers:", headers);
      console.log("[gerarQR] supabase client:", supabase);
      console.log("[gerarQR] chamando invoke...");

      const result = await Promise.race([
        supabase.functions.invoke("pietro-cobranca-instance", {
          body: { action: "gerar-qr" },
          headers,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT 15s")), 15000)
        )
      ]) as any;

      const { data, error: err } = result;
      console.log("[gerarQR] retorno:", { data, err });

      if (err) throw err;
      if (data?.already_connected) {
        setInfo("WhatsApp já está conectado");
        setQrcode(null);
        await loadInstance();
        return;
      }
      if (data?.success && data?.qrcode) {
        setQrcode(data.qrcode);
        setInfo("Escaneie o QR Code com o WhatsApp do Pietro");
      } else if (data?.retry) {
        setInfo("QR ainda não disponível — clique novamente em instantes");
      } else {
        setError(data?.error || "Não foi possível gerar QR");
      }
    } catch (e: any) {
      console.error("[gerarQR] EXCEPTION caught:", e);
      setError(e?.message || "Erro ao gerar QR");
    } finally {
      console.log("[gerarQR] === finally executado ===");
      setLoading(false);
    }
  };

  const desconectar = async () => {
    if (!confirm("Desconectar o WhatsApp do Pietro Cobrança?")) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("pietro-cobranca-instance", {
        body: { action: "desconectar" },
        headers: getBillingHeaders(),
      });
      if (err) throw err;
      if (data?.success) {
        setQrcode(null);
        setInfo("Desconectado.");
        await loadInstance();
      } else {
        setError(data?.error || "Falha ao desconectar");
      }
    } catch (e: any) {
      setError(e?.message || "Erro ao desconectar");
    } finally {
      setLoading(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        Validando acesso...
      </div>
    );
  }

  const connected = !!instance?.is_connected;

  // Render do QR: aceita data:image, base64 puro ou string com prefixo
  const qrSrc = qrcode
    ? (qrcode.startsWith("data:") ? qrcode : `data:image/png;base64,${qrcode}`)
    : null;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700">
        <h1 className="text-lg font-semibold">Pietro Cobrança — WhatsApp Gateway</h1>
        <nav className="flex gap-4 text-sm items-center">
          <button onClick={() => navigate("/pay/admin")} className="text-sky-400 hover:underline">
            ← Voltar ao Dashboard
          </button>
        </nav>
      </header>

      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
          {/* Status header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs text-slate-400">Instância</p>
              <p className="text-lg font-semibold">
                {instance?.instance_name || "pietro-cobranca"}{" "}
                <span className="text-xs text-slate-500">(porta {instance?.port ?? 8082})</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Status</p>
              {statusLoading && !instance ? (
                <p className="text-slate-300">verificando...</p>
              ) : connected ? (
                <p className="text-emerald-400 font-bold">● CONECTADO</p>
              ) : (
                <p className="text-amber-400 font-bold">○ DESCONECTADO</p>
              )}
            </div>
          </div>

          {connected && instance?.phone_number && (
            <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg p-4 mb-4">
              <p className="text-xs text-emerald-300">Número conectado</p>
              <p className="text-emerald-100 text-lg font-mono">+{instance.phone_number}</p>
              {instance.connected_at && (
                <p className="text-xs text-emerald-400 mt-1">
                  Desde {new Date(instance.connected_at).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
          )}

          {/* QR display */}
          {!connected && qrSrc && (
            <div className="flex flex-col items-center bg-white p-4 rounded-lg mb-4">
              <img src={qrSrc} alt="QR Code WhatsApp" className="w-72 h-72" />
              <p className="text-slate-700 text-xs mt-3 text-center">
                Abra o WhatsApp → Aparelhos conectados → Conectar aparelho
              </p>
            </div>
          )}

          {/* Mensagens */}
          {info && (
            <div className="bg-sky-900/30 border border-sky-700 text-sky-200 text-sm rounded-lg p-3 mb-4">
              {info}
            </div>
          )}
          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-200 text-sm rounded-lg p-3 mb-4">
              {error}
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 flex-wrap">
            {!connected && (
              <button
                onClick={gerarQR}
                disabled={loading}
                className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg"
              >
                {loading ? "Gerando..." : qrSrc ? "Gerar novo QR" : "Gerar QR Code"}
              </button>
            )}
            {connected && (
              <button
                onClick={desconectar}
                disabled={loading}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg"
              >
                {loading ? "..." : "Desconectar"}
              </button>
            )}
            <button
              onClick={fetchStatus}
              disabled={statusLoading}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 px-5 py-2.5 rounded-lg"
            >
              {statusLoading ? "..." : "Atualizar status"}
            </button>
          </div>

          <p className="text-xs text-slate-500 mt-6">
            Área restrita ao administrador. Status atualiza automaticamente a cada 3s enquanto desconectado.
          </p>
        </div>
      </div>
    </div>
  );
}
