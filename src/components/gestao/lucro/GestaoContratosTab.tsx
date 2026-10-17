import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { GestaoVeiculoEnriched } from "@/lib/gestao-lucro-types.ts";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";
import {
  GESTAO_CONTRATO_AVISO_ADVOGADO,
  renderGestaoContratoCorpo,
  type GestaoContratoTipo,
} from "../../../../supabase/functions/_shared/gestao-contrato-template.ts";
import {
  insertContrato,
  loadContratoModelos,
  loadContratos,
  saveContratoModelo,
  type GestaoContratoModelo,
  type GestaoContratoRow,
} from "@/lib/gestao-contrato-load.ts";
import { contratoCorpoToPdfBase64 } from "@/lib/gestao-contrato-pdf.ts";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  userId: string;
  veiculos: GestaoVeiculoEnriched[];
};

type ClienteForm = {
  nome: string;
  cpf: string;
  endereco: string;
  email: string;
  telefone: string;
};

export function GestaoContratosTab({ userId, veiculos }: Props) {
  const [modelos, setModelos] = useState<GestaoContratoModelo[]>([]);
  const [contratos, setContratos] = useState<GestaoContratoRow[]>([]);
  const [filtro, setFiltro] = useState("todos");
  const [loja, setLoja] = useState({ nome: "", cnpj: "", cidade: "" });

  const [gerarTipo, setGerarTipo] = useState<GestaoContratoTipo>("venda");
  const [gerarVeiculoId, setGerarVeiculoId] = useState("");
  const [gerarModeloId, setGerarModeloId] = useState("");
  const [cliente, setCliente] = useState<ClienteForm>({
    nome: "", cpf: "", endereco: "", email: "", telefone: "",
  });
  const [preview, setPreview] = useState("");

  const reload = useCallback(async () => {
    const [m, c] = await Promise.all([
      loadContratoModelos(userId),
      loadContratos(userId, filtro),
    ]);
    setModelos(m);
    setContratos(c);
    const { data: emp } = await supabase.from("empresa_config")
      .select("nome_empresa, cnpj, cidade")
      .eq("user_id", userId)
      .maybeSingle();
    if (emp) {
      setLoja({
        nome: String(emp.nome_empresa ?? ""),
        cnpj: String(emp.cnpj ?? ""),
        cidade: String(emp.cidade ?? ""),
      });
    }
  }, [userId, filtro]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const veiculoSel = useMemo(
    () => veiculos.find((v) => v.id === gerarVeiculoId) ?? null,
    [veiculos, gerarVeiculoId],
  );

  const buildPreview = () => {
    const modelo = modelos.find((m) => m.id === gerarModeloId);
    if (!modelo || !veiculoSel) {
      toast.error("Selecione veículo e modelo.");
      return;
    }
    const v = veiculoSel;
    const text = renderGestaoContratoCorpo(modelo.corpo, {
      loja_nome: loja.nome,
      loja_cnpj: loja.cnpj,
      cliente_nome: cliente.nome,
      cliente_cpf: cliente.cpf,
      cliente_endereco: cliente.endereco,
      veiculo: `${v.marca} ${v.modelo} ${v.versao ?? ""}`.trim(),
      ano: String(v.ano_modelo ?? ""),
      placa: v.placa ?? "",
      chassi: "",
      cor: "",
      km: "",
      valor: formatGestaoMoney(Number(v.valorVenda ?? v.preco ?? 0)),
      forma_pagamento: "",
      data: new Date().toISOString().slice(0, 10),
      cidade: loja.cidade,
    });
    setPreview(text);
  };

  const salvarRascunho = async () => {
    if (!preview || !veiculoSel) return;
    const modelo = modelos.find((m) => m.id === gerarModeloId);
    await insertContrato(userId, {
      veiculo_id: veiculoSel.id,
      modelo_id: gerarModeloId || null,
      tipo: gerarTipo,
      status: "rascunho",
      titulo: modelo?.titulo ?? "Contrato",
      corpo_renderizado: preview,
      cliente_nome: cliente.nome,
      cliente_cpf: cliente.cpf || null,
      cliente_endereco: cliente.endereco || null,
      cliente_email: cliente.email || null,
      cliente_telefone: cliente.telefone || null,
    });
    toast.success("Rascunho salvo.");
    void reload();
  };

  const enviarAssinatura = async (contratoId: string, corpo: string) => {
    const base64_pdf = contratoCorpoToPdfBase64(corpo);
    const { data, error } = await supabase.functions.invoke("gestao-zapsign-sign", {
      body: { contrato_id: contratoId, base64_pdf },
    });
    if (error || !data?.success) {
      toast.error(data?.error ?? "Falha ao enviar para assinatura.");
      return;
    }
    toast.success("Enviado. E-mail ZapSign + link para WhatsApp.");
    void reload();
  };

  const renderAtual = (): string => {
    const modelo = modelos.find((m) => m.id === gerarModeloId);
    if (!modelo || !veiculoSel) return "";
    const v = veiculoSel;
    return renderGestaoContratoCorpo(modelo.corpo, {
      loja_nome: loja.nome,
      loja_cnpj: loja.cnpj,
      cliente_nome: cliente.nome,
      cliente_cpf: cliente.cpf,
      cliente_endereco: cliente.endereco,
      veiculo: `${v.marca} ${v.modelo} ${v.versao ?? ""}`.trim(),
      ano: String(v.ano_modelo ?? ""),
      placa: v.placa ?? "",
      chassi: "",
      cor: "",
      km: "",
      valor: formatGestaoMoney(Number(v.valorVenda ?? v.preco ?? 0)),
      forma_pagamento: "",
      data: new Date().toISOString().slice(0, 10),
      cidade: loja.cidade,
    });
  };

  const gerarEEnviar = async () => {
    const corpo = renderAtual();
    if (!corpo || !veiculoSel) {
      toast.error("Selecione veículo, modelo e cliente.");
      return;
    }
    setPreview(corpo);
    const id = await insertContrato(userId, {
      veiculo_id: veiculoSel.id,
      modelo_id: gerarModeloId || null,
      tipo: gerarTipo,
      status: "rascunho",
      titulo: modelos.find((m) => m.id === gerarModeloId)?.titulo ?? "Contrato",
      corpo_renderizado: corpo,
      cliente_nome: cliente.nome,
      cliente_cpf: cliente.cpf || null,
      cliente_endereco: cliente.endereco || null,
      cliente_email: cliente.email || null,
      cliente_telefone: cliente.telefone || null,
    });
    await enviarAssinatura(id, corpo);
  };

  const cancelar = async (id: string) => {
    const { data, error } = await supabase.functions.invoke("gestao-zapsign-cancel", {
      body: { contrato_id: id },
    });
    if (error || !data?.success) {
      toast.error(data?.error ?? "Não foi possível cancelar.");
      return;
    }
    toast.success("Cancelado.");
    void reload();
  };

  const copiarLink = async (url: string | null) => {
    if (!url) {
      toast.error("Sem link de assinatura.");
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado — envie pelo WhatsApp da loja.");
  };

  const modelosTipo = modelos.filter((m) => m.tipo === gerarTipo);

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
        {GESTAO_CONTRATO_AVISO_ADVOGADO}
      </p>

      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="gerar">Gerar</TabsTrigger>
          <TabsTrigger value="modelos">Modelos</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="mt-4 space-y-3">
          <Select value={filtro} onValueChange={setFiltro}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente_assinatura">Pendentes</SelectItem>
              <SelectItem value="assinado">Assinados</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
            </SelectContent>
          </Select>
          <ul className="space-y-2 text-sm">
            {contratos.map((c) => (
              <li key={c.id} className="rounded-lg border p-3">
                <p className="font-medium">{c.titulo} · {c.status.replace(/_/g, " ")}</p>
                <p className="text-muted-foreground">{c.cliente_nome} · {c.created_at.slice(0, 10)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.zapsign_sign_url && (
                    <Button size="sm" variant="outline" onClick={() => void copiarLink(c.zapsign_sign_url)}>
                      Reenviar (copiar link)
                    </Button>
                  )}
                  {c.status !== "cancelado" && c.status !== "assinado" && (
                    <Button size="sm" variant="ghost" onClick={() => void cancelar(c.id)}>Cancelar</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="gerar" className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="space-y-3">
            <Label>Tipo</Label>
            <Select value={gerarTipo} onValueChange={(v) => setGerarTipo(v as GestaoContratoTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["compra", "venda", "consignacao", "garantia"] as const).map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label>Veículo</Label>
            <Select value={gerarVeiculoId} onValueChange={setGerarVeiculoId}>
              <SelectTrigger><SelectValue placeholder="Carro" /></SelectTrigger>
              <SelectContent>
                {veiculos.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.marca} {v.modelo} {v.placa ? `· ${v.placa}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label>Modelo</Label>
            <Select value={gerarModeloId} onValueChange={setGerarModeloId}>
              <SelectTrigger><SelectValue placeholder="Modelo" /></SelectTrigger>
              <SelectContent>
                {modelosTipo.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.titulo}{m.is_exemplo ? " (exemplo)" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label>Cliente</Label>
            <Input placeholder="Nome" value={cliente.nome} onChange={(e) => setCliente({ ...cliente, nome: e.target.value })} />
            <Input placeholder="CPF" value={cliente.cpf} onChange={(e) => setCliente({ ...cliente, cpf: e.target.value })} />
            <Input placeholder="Endereço" value={cliente.endereco} onChange={(e) => setCliente({ ...cliente, endereco: e.target.value })} />
            <Input placeholder="E-mail" value={cliente.email} onChange={(e) => setCliente({ ...cliente, email: e.target.value })} />
            <Input placeholder="WhatsApp" value={cliente.telefone} onChange={(e) => setCliente({ ...cliente, telefone: e.target.value })} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={buildPreview}>Pré-visualizar</Button>
              <Button type="button" variant="outline" onClick={() => void salvarRascunho()}>Salvar rascunho</Button>
              <Button type="button" onClick={() => void gerarEEnviar()}>Enviar assinatura</Button>
            </div>
          </div>
          <div>
            <Label>Pré-visualização / PDF</Label>
            <Textarea className="min-h-[320px] font-mono text-xs" value={preview} readOnly />
          </div>
        </TabsContent>

        <TabsContent value="modelos" className="mt-4 space-y-4">
          {modelos.map((m) => (
            <ModeloEditor key={m.id} modelo={m} onSave={async (titulo, corpo) => {
              await saveContratoModelo(userId, { id: m.id, tipo: m.tipo, titulo, corpo });
              toast.success("Modelo salvo.");
              void reload();
            }} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ModeloEditor({
  modelo,
  onSave,
}: {
  modelo: GestaoContratoModelo;
  onSave: (titulo: string, corpo: string) => Promise<void>;
}) {
  const [titulo, setTitulo] = useState(modelo.titulo);
  const [corpo, setCorpo] = useState(modelo.corpo);
  return (
    <div className="rounded-lg border p-3 space-y-2">
      {modelo.is_exemplo && (
        <p className="text-xs font-semibold text-amber-700">EXEMPLO — revisar com o advogado da loja</p>
      )}
      <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      <Textarea className="min-h-[120px] font-mono text-xs" value={corpo} onChange={(e) => setCorpo(e.target.value)} />
      <Button size="sm" onClick={() => void onSave(titulo, corpo)}>Salvar modelo</Button>
    </div>
  );
}
