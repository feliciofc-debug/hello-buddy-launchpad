import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

const TEMPLATES: Record<string, string> = {
  "D-5":
    "Olá {nome}, tudo bem? Aqui é o Pietro da AMZ Ofertas. Passando pra lembrar com carinho que sua mensalidade de R$ {valor} vence dia {data}. Qualquer dúvida, é só chamar! 😊",
  "D-2":
    "Oi {nome}! Pietro aqui novamente. Faltam 2 diazinhos pro vencimento da sua mensalidade ({data} - R$ {valor}). Posso te ajudar com algo?",
  "D-0":
    "Olá {nome}, bom dia! Hoje é o dia do vencimento da sua mensalidade AMZ Ofertas (R$ {valor}). Já efetuou o pagamento? Se precisar do link, é só me dizer!",
  "D+1":
    "Oi {nome}, tudo bem? Notei que sua mensalidade de ontem ainda não consta como paga. Aconteceu algo? Posso te ajudar a regularizar.",
  "D+5":
    "Olá {nome}. Pietro aqui. Estou um pouco preocupado, sua mensalidade está com 5 dias de atraso. Por favor, entre em contato pra conversarmos. Tenho certeza que conseguimos uma solução juntos.",
};

function fmtValor(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtData(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function TestarPietroCobrancaModal({ open, onClose }: Props) {
  const [tipo, setTipo] = useState("D-2");
  const [nome, setNome] = useState("Felicio Teste");
  const [whatsapp, setWhatsapp] = useState("5521967520706");
  const [valor, setValor] = useState("597");
  const [dataVenc, setDataVenc] = useState("2026-04-29");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  const preview = useMemo(() => {
    const tpl = TEMPLATES[tipo] || "";
    return tpl
      .replaceAll("{nome}", nome || "amigo(a)")
      .replaceAll("{valor}", fmtValor(Number(valor) || 0))
      .replaceAll("{data}", fmtData(dataVenc));
  }, [tipo, nome, valor, dataVenc]);

  if (!open) return null;

  async function disparar() {
    setLoading(true);
    setResultado(null);
    try {
      const token = sessionStorage.getItem("billing_token") || "";
      const result = await Promise.race([
        supabase.functions.invoke("pietro-cobranca-disparar", {
          body: {
            tipo,
            test: {
              nome,
              whatsapp,
              valor: Number(valor) || 0,
              data_vencimento: dataVenc,
            },
          },
          headers: { "x-billing-token": token },
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT 15s")), 15000)),
      ]) as any;
      setResultado(result?.data ?? { error: result?.error?.message ?? "sem resposta" });
    } catch (e: any) {
      setResultado({ error: e?.message || String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-white font-semibold">🧪 Testar Pietro — Régua de Cobrança</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-slate-400 uppercase">Tipo régua</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full mt-1 bg-slate-900 border border-slate-700 rounded p-2 text-white"
            >
              {Object.keys(TEMPLATES).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 uppercase">Nome</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full mt-1 bg-slate-900 border border-slate-700 rounded p-2 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase">WhatsApp (com 55)</label>
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full mt-1 bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase">Valor (R$)</label>
              <input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full mt-1 bg-slate-900 border border-slate-700 rounded p-2 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase">Vencimento</label>
              <input
                type="date"
                value={dataVenc}
                onChange={(e) => setDataVenc(e.target.value)}
                className="w-full mt-1 bg-slate-900 border border-slate-700 rounded p-2 text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 uppercase">Preview da mensagem</label>
            <div className="mt-1 bg-slate-900 border border-slate-700 rounded p-3 text-sm text-slate-200 whitespace-pre-wrap">
              {preview}
            </div>
          </div>

          <button
            onClick={disparar}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded p-3 font-semibold"
          >
            {loading ? "Disparando..." : "🚀 Disparar agora"}
          </button>

          {resultado && (
            <div className="bg-slate-900 border border-slate-700 rounded p-3">
              <div className="text-xs text-slate-400 uppercase mb-1">Resultado</div>
              <pre className="text-xs text-slate-200 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(resultado, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
