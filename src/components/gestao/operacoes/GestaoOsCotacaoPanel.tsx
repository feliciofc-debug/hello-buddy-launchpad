import { useMemo, useState } from "react";
import { Eye, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";
import {
  buildGestaoOsCotacaoPdfBlob,
  podeEscolherCotacaoOs,
} from "@/lib/gestao-os-cotacao-pdf.ts";
import type { GestaoOsCotacaoPdfInput } from "@/lib/gestao-os-cotacao-pdf.ts";
import type { GestaoOsCotacaoRow, GestaoOsItemRow, GestaoOsRow, GestaoParceiroRow } from "@/lib/gestao-os-types.ts";
import type { GestaoOsFotoRefRow } from "../../../../supabase/functions/_shared/gestao-os-fotos.ts";

type VeiculoPdf = {
  marca: string;
  modelo: string;
  placa?: string | null;
  ano_modelo?: number | null;
  cor?: string | null;
  km?: number | null;
};

type LojaPdf = {
  nome: string;
  contato?: string | null;
  site?: string | null;
  logoDataUrl?: string | null;
};

type Props = {
  userId: string;
  os: GestaoOsRow;
  itens: GestaoOsItemRow[];
  cotacoes: GestaoOsCotacaoRow[];
  parceiros: GestaoParceiroRow[];
  veiculo: VeiculoPdf | null;
  loja: LojaPdf;
  fotosSelecionadas: GestaoOsFotoRefRow[];
  fotoSignedUrls: Record<string, string>;
  onReload: () => Promise<void>;
  disabled?: boolean;
};

export function GestaoOsCotacaoPanel({
  userId,
  os,
  itens,
  cotacoes,
  parceiros,
  veiculo,
  loja,
  fotosSelecionadas,
  fotoSignedUrls,
  onReload,
  disabled,
}: Props) {
  const [parceirosSolicitar, setParceirosSolicitar] = useState<string[]>([]);
  const [registro, setRegistro] = useState({ cotacaoId: "", valor: "", prazo: "", obs: "" });
  const [busy, setBusy] = useState(false);

  const parceiroMap = useMemo(
    () => new Map(parceiros.map((p) => [p.id, p])),
    [parceiros],
  );

  const pdfBase = (): Omit<GestaoOsCotacaoPdfInput, "titulo" | "parceiroNome" | "valorCombinado"> => ({
    lojaNome: loja.nome,
    lojaContato: loja.contato,
    lojaSite: loja.site,
    osNumero: os.numero,
    dataIso: new Date().toISOString(),
    veiculo: {
      marca: veiculo?.marca ?? "—",
      modelo: veiculo?.modelo ?? "—",
      placa: veiculo?.placa,
      ano: veiculo?.ano_modelo,
      cor: veiculo?.cor,
      km: veiculo?.km,
    },
    itens: itens.map((i) => ({ descricao: i.descricao })),
    prazoDesejado: os.data_prevista ?? undefined,
    fotoLegendas: fotosSelecionadas.map((f) => f.storage_path.split("/").pop() ?? f.storage_path),
  });

  const salvarPdf = async (blob: Blob, nome: string, tipo: "pedido_cotacao" | "os_aprovada") => {
    const path = `${userId}/os/${os.id}/${crypto.randomUUID()}-${nome}`;
    const { error: upErr } = await supabase.storage.from("gestao-os-documentos").upload(path, blob, {
      contentType: "application/pdf",
    });
    if (upErr) throw new Error(upErr.message);
    const { error: dbErr } = await supabase.from("gestao_os_documento" as "veiculos_estoque").insert({
      user_id: userId,
      os_id: os.id,
      tipo,
      storage_path: path,
      mime_type: "application/pdf",
      tamanho_bytes: blob.size,
    } as never);
    if (dbErr) throw new Error(dbErr.message);
  };

  const gerarPdfParceiro = async (
    parceiroId: string,
    titulo: GestaoOsCotacaoPdfInput["titulo"],
    valorCombinado?: number | null,
  ) => {
    const parceiro = parceiroMap.get(parceiroId);
    if (!parceiro) throw new Error("Parceiro não encontrado");
    const input: GestaoOsCotacaoPdfInput = {
      ...pdfBase(),
      titulo,
      parceiroNome: parceiro.nome,
      valorCombinado: valorCombinado ?? null,
    };
    const fotoUrls = fotosSelecionadas
      .map((f) => fotoSignedUrls[f.storage_path])
      .filter((url): url is string => Boolean(url));
    return buildGestaoOsCotacaoPdfBlob(input, {
      logoDataUrl: loja.logoDataUrl,
      fotoUrls,
    });
  };

  const reenviarWhatsApp = async (cotacaoId: string) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("gestao-os-cotacao-whatsapp-send", {
        body: { os_id: os.id, cotacao_ids: [cotacaoId] },
      });
      if (error) throw new Error(error.message);
      if (data?.success !== true) throw new Error(String(data?.error ?? "Falha no reenvio"));
      toast.success("Pedido reenviado.");
      await onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no reenvio");
    } finally {
      setBusy(false);
    }
  };

  const solicitar = async () => {
    if (parceirosSolicitar.length === 0) {
      return toast.error("Escolha ao menos um parceiro.");
    }
    setBusy(true);
    try {
      const { data: cotRows, error } = await (supabase as unknown as {
        rpc: (name: string, args: Record<string, unknown>) => Promise<{
          data: { id: string }[] | null;
          error: { message: string } | null;
        }>;
      }).rpc("gestao_os_cotacao_solicitar", {
        p_os_id: os.id,
        p_parceiro_ids: parceirosSolicitar,
      });
      if (error) throw new Error(error.message);
      const idsEnvio = (cotRows ?? []).map((c) => c.id);
      const { data: sendData, error: sendErr } = await supabase.functions.invoke(
        "gestao-os-cotacao-whatsapp-send",
        { body: { os_id: os.id, cotacao_ids: idsEnvio } },
      );
      if (sendErr) throw new Error(sendErr.message);
      if (sendData?.success !== true) {
        throw new Error(String(sendData?.error ?? "Falha ao enviar WhatsApp"));
      }
      const falhas = (sendData.results as { ok: boolean; mode?: string }[] | undefined)
        ?.filter((r) => !r.ok) ?? [];
      if (falhas.length) {
        toast.warning(
          `Cotação criada; ${falhas.length} envio(s) pendente(s) (modelo WhatsApp ou telefone). PDF salvo para envio manual.`,
        );
      } else {
        toast.success("Pedido enviado ao parceiro via WhatsApp (PDF + instruções).");
      }
      setParceirosSolicitar([]);
      await onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na cotação");
    } finally {
      setBusy(false);
    }
  };

  const registrar = async () => {
    if (!registro.cotacaoId || !registro.valor) {
      return toast.error("Escolha a cotação e informe o valor.");
    }
    setBusy(true);
    const { error } = await (supabase as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    }).rpc("gestao_os_cotacao_registrar", {
      p_cotacao_id: registro.cotacaoId,
      p_valor: Number(registro.valor),
      p_prazo_dias: registro.prazo ? Number(registro.prazo) : null,
      p_observacao: registro.obs || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Cotação registrada.");
    setRegistro({ cotacaoId: "", valor: "", prazo: "", obs: "" });
    await onReload();
  };

  const escolher = async (cotacaoId: string) => {
    const gate = podeEscolherCotacaoOs(os.status);
    if (!gate.ok) return toast.error(gate.mensagem);
    setBusy(true);
    try {
      const { data, error } = await (supabase as unknown as {
        rpc: (name: string, args: Record<string, unknown>) => Promise<{
          data: GestaoOsRow | null;
          error: { message: string } | null;
        }>;
      }).rpc("gestao_os_cotacao_escolher", { p_cotacao_id: cotacaoId });
      if (error) throw new Error(error.message);
      const cot = cotacoes.find((c) => c.id === cotacaoId);
      if (cot) {
        const blob = await gerarPdfParceiro(cot.parceiro_id, "os_aprovada", cot.valor);
        await salvarPdf(blob, `os-aprovada.pdf`, "os_aprovada");
      }
      toast.success("Fornecedor e valor aprovado definidos.");
      if (data) await onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível escolher");
    } finally {
      setBusy(false);
    }
  };

  const verPdf = async (cotacaoId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "gestao-os-cotacao-whatsapp-send",
        {
          body: {
            os_id: os.id,
            cotacao_ids: [cotacaoId],
            preview_only: true,
          },
        },
      );
      if (error) throw new Error(error.message);
      const url = data?.results?.[0]?.pdfUrl;
      if (!url) throw new Error(data?.results?.[0]?.error ?? "Prévia indisponível");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar PDF");
    }
  };

  const toggleParceiro = (id: string) => {
    setParceirosSolicitar((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const podeEscolher = podeEscolherCotacaoOs(os.status).ok;
  const cotacoesAtivas = cotacoes.filter((c) => c.status !== "descartada" || c.status === "escolhida");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Status <strong>Em cotação</strong>: envie o mesmo pedido a vários parceiros e compare propostas.
      </p>

      {!disabled && parceiros.length > 0 && (
        <div className="rounded border p-3">
          <Label className="mb-2 block">Solicitar cotação</Label>
          <div className="mb-3 flex flex-wrap gap-3">
            {parceiros.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={parceirosSolicitar.includes(p.id)}
                  onCheckedChange={() => toggleParceiro(p.id)}
                />
                {p.nome}
              </label>
            ))}
          </div>
          <Button disabled={busy} onClick={() => void solicitar()}>
            Solicitar cotação (WhatsApp + PDF)
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="p-2">Parceiro</th>
              <th className="p-2">Valor</th>
              <th className="p-2">Prazo</th>
              <th className="p-2">Canal</th>
              <th className="p-2">Envio WA</th>
              <th className="p-2">Status</th>
              <th className="p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {cotacoesAtivas.length === 0 ? (
              <tr><td className="p-3 text-muted-foreground" colSpan={7}>Nenhuma cotação ainda.</td></tr>
            ) : cotacoesAtivas.map((c) => (
              <tr key={c.id} className="border-b">
                <td className="p-2">{parceiroMap.get(c.parceiro_id)?.nome ?? "—"}</td>
                <td className="p-2">{c.valor == null ? "—" : formatGestaoMoney(c.valor)}</td>
                <td className="p-2">{c.prazo_dias == null ? "—" : `${c.prazo_dias} dias`}</td>
                <td className="p-2 capitalize">{c.canal ?? "painel"}</td>
                <td className="p-2 text-xs">
                  {c.envio_whatsapp_status ?? "—"}
                  {c.envio_pendente_motivo ? ` · ${c.envio_pendente_motivo}` : ""}
                </td>
                <td className="p-2 capitalize">
                  {c.status.replace("_", " ")}
                  {c.transcricao_audio ? (
                    <p className="mt-1 text-xs text-muted-foreground" title={c.transcricao_audio}>
                      Áudio: {c.transcricao_audio.slice(0, 60)}{c.transcricao_audio.length > 60 ? "…" : ""}
                    </p>
                  ) : null}
                </td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void reenviarWhatsApp(c.id)}>
                      Reenviar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void verPdf(c.id)}>
                      <Eye className="mr-1 h-4 w-4" /> Ver PDF
                    </Button>
                    {c.status === "recebida" && !disabled && podeEscolher && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void escolher(c.id)}>
                        <Star className="mr-1 h-3 w-3" /> Escolher
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!disabled && (
        <div className="grid gap-2 rounded border p-3 md:grid-cols-4">
          <div>
            <Label>Cotação</Label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm"
              value={registro.cotacaoId}
              onChange={(e) => setRegistro((r) => ({ ...r, cotacaoId: e.target.value }))}
            >
              <option value="">Selecione…</option>
              {cotacoes.filter((c) => ["solicitada", "recebida"].includes(c.status)).map((c) => (
                <option key={c.id} value={c.id}>
                  {parceiroMap.get(c.parceiro_id)?.nome ?? c.id}
                </option>
              ))}
            </select>
          </div>
          <div><Label>Valor recebido</Label><Input type="number" value={registro.valor} onChange={(e) => setRegistro((r) => ({ ...r, valor: e.target.value }))} /></div>
          <div><Label>Prazo (dias)</Label><Input type="number" value={registro.prazo} onChange={(e) => setRegistro((r) => ({ ...r, prazo: e.target.value }))} /></div>
          <div className="flex items-end">
            <Button className="w-full" disabled={busy} onClick={() => void registrar()}>Registrar cotação recebida</Button>
          </div>
        </div>
      )}
    </div>
  );
}
