"use client";

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Clock, Loader2, Megaphone, Send } from "lucide-react";
import { toast } from "sonner";

const NOME_TEMPLATE_NOVIDADE = "novidade_v1";

export const BODY_NOVIDADE_V1 =
  "Oi {{1}}! 🎉 Aqui é a {{2}} e temos novidades muito legais pra te mostrar hoje. " +
  "Toque em \"Quero ver!\" que eu te conto tudo agora.";

// Regra da plataforma: todo template vem com botão de 1 toque (nunca \"digite X\").
export const BOTOES_NOVIDADE_V1 = [
  { type: "QUICK_REPLY", text: "Quero ver!" },
  { type: "QUICK_REPLY", text: "Agora não" },
];


interface Props {
  open: boolean;
  onClose: () => void;
  listaId: string;
  listaNome: string;
}

interface Alvo {
  telefone: string;
  nome: string;
  naJanela: boolean;
}

const normalizarTelefone = (t: string): string => {
  const d = (t || "").replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("55") ? d : `55${d}`;
};

export default function AvisarNovidadeModal({ open, onClose, listaId, listaNome }: Props) {
  const [carregando, setCarregando] = useState(false);
  const [alvos, setAlvos] = useState<Alvo[]>([]);
  const [negocio, setNegocio] = useState("");
  const [template, setTemplate] = useState<{ id: string; status_meta: string } | null>(null);
  const [criandoRascunho, setCriandoRascunho] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ enviados: number; falhas: number } | null>(null);

  const dentro = alvos.filter((a) => a.naJanela);
  const fora = alvos.filter((a) => !a.naJanela);
  const templateAprovado = template?.status_meta === "aprovado";

  useEffect(() => {
    if (!open) {
      setAlvos([]);
      setResultado(null);
      setTemplate(null);
      return;
    }
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, listaId]);

  const carregar = async () => {
    setCarregando(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;

      const [membrosRes, empresaRes, tplRes] = await Promise.all([
        supabase
          .from("pj_lista_membros")
          .select("nome, telefone, opt_in_status")
          .eq("lista_id", listaId)
          .eq("opt_in_status", "confirmado"),
        supabase.from("empresa_config").select("nome_empresa").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("whatsapp_templates")
          .select("id, status_meta")
          .eq("user_id", user.id)
          .eq("nome_meta", NOME_TEMPLATE_NOVIDADE)
          .maybeSingle(),
      ]);

      setNegocio(((empresaRes.data as any)?.nome_empresa || "").trim());
      setTemplate((tplRes.data as any) || null);

      // Janela de 24h: quem enviou mensagem ao agente nas últimas 24h
      const janela = new Set<string>();
      try {
        const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: convs } = await supabase
          .from("whatsapp_cloud_conversations")
          .select("id, contact_number")
          .eq("user_id", user.id);
        const idParaNumero = new Map<string, string>();
        (convs || []).forEach((c: any) =>
          idParaNumero.set(c.id, normalizarTelefone(String(c.contact_number || ""))),
        );
        if (idParaNumero.size > 0) {
          const { data: inbounds } = await supabase
            .from("whatsapp_cloud_messages")
            .select("conversation_id")
            .eq("user_id", user.id)
            .eq("direction", "inbound")
            .gte("created_at", desde);
          (inbounds || []).forEach((m: any) => {
            const tel = idParaNumero.get(m.conversation_id);
            if (tel) janela.add(tel);
          });
        }
      } catch {
        /* janela indisponível → todos tratados como fora */
      }

      const mapa = new Map<string, Alvo>();
      (membrosRes.data || []).forEach((m: any) => {
        const tel = normalizarTelefone(String(m.telefone || ""));
        if (!tel || mapa.has(tel)) return;
        mapa.set(tel, {
          telefone: tel,
          nome: (m.nome || "").trim() || "Cliente",
          naJanela: janela.has(tel),
        });
      });
      setAlvos(Array.from(mapa.values()));
    } finally {
      setCarregando(false);
    }
  };

  const criarRascunho = async () => {
    setCriandoRascunho(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .insert({
          user_id: user.id,
          nome_meta: NOME_TEMPLATE_NOVIDADE,
          idioma: "pt_BR",
          categoria_meta: "UTILITY",
          tipo_uso: "transacional",
          body_text: BODY_NOVIDADE_V1,
          status_meta: "rascunho",
          variaveis_map: { "1": { campo: "nome", exemplo: "Maria" }, "2": { campo: "negocio", exemplo: negocio || "Sua Empresa" } },
        } as any)
        .select("id, status_meta")
        .single();
      if (error) throw error;
      setTemplate(data as any);
      toast.success("Rascunho criado. Revise e envie para análise na tela de mensagens aprovadas.");
    } catch (e) {
      toast.error("Não foi possível criar o rascunho: " + (e as Error).message);
    } finally {
      setCriandoRascunho(false);
    }
  };

  const textoLivre = (nome: string) =>
    BODY_NOVIDADE_V1.replace("{{1}}", nome).replace("{{2}}", negocio || "nossa equipe");

  const enviar = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return;
    if (!negocio.trim()) {
      toast.error("Informe o nome do seu negócio.");
      return;
    }
    const lista = templateAprovado ? alvos : dentro;
    if (lista.length === 0) {
      toast.error("Ninguém elegível agora.");
      return;
    }

    setEnviando(true);
    let enviados = 0;
    let falhas = 0;
    for (const alvo of lista) {
      try {
        const resp = alvo.naJanela
          ? await supabase.functions.invoke("whatsapp-send-message", {
              body: { user_id: user.id, to: alvo.telefone, message: textoLivre(alvo.nome) },
            })
          : await supabase.functions.invoke("whatsapp-cloud-send-template", {
              body: {
                user_id: user.id,
                to: alvo.telefone,
                template_id: template!.id,
                variaveis: [alvo.nome, negocio.trim()],
                tipo: "campanha",
              },
            });
        if (!resp.error && (resp.data as any)?.success) enviados++;
        else falhas++;
      } catch {
        falhas++;
      }
    }
    setResultado({ enviados, falhas });
    setEnviando(false);
    if (enviados > 0) toast.success(`Aviso de novidade enviado para ${enviados} contato(s).`);
    else toast.error("Nenhum aviso foi enviado.");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" /> Avisar novidade
          </DialogTitle>
          <DialogDescription>
            Recado genérico (sem produto) para os qualificados de <strong>{listaNome}</strong>.
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Analisando os contatos...
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Nome do seu negócio</Label>
              <Input
                className="mt-1"
                value={negocio}
                onChange={(e) => setNegocio(e.target.value)}
                placeholder="Ex.: Academia Corpo Leve"
              />
            </div>

            <div>
              <Label className="text-sm">Mensagem que o cliente recebe</Label>
              <Textarea
                readOnly
                className="mt-1 text-xs bg-muted/40"
                rows={3}
                value={textoLivre("Maria")}
              />
            </div>

            <div className="rounded-md border p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Conversa aberta (envio livre, sem custo)
                </span>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  {dentro.length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                  Fora da conversa (precisa da mensagem aprovada)
                </span>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  {fora.length}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground pt-1">
                A plataforma escolhe automaticamente: quem falou com você nas últimas 24h recebe
                texto livre; os demais recebem pela mensagem aprovada pelo WhatsApp.
              </p>
            </div>

            {fora.length > 0 && !templateAprovado && (
              <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <div>
                    {template
                      ? `A mensagem de novidade está em "${template.status_meta}". Só depois de aprovada os ${fora.length} contatos fora da conversa recebem.`
                      : `Você ainda não tem a mensagem de novidade. Crie o rascunho e envie para aprovação — os ${fora.length} contatos fora da conversa dependem dela.`}
                  </div>
                  {!template && (
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={criarRascunho} disabled={criandoRascunho}>
                      {criandoRascunho ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                      Criar rascunho da mensagem de novidade
                    </Button>
                  )}
                  <div>
                    <Link to="/pj/whatsapp-templates" className="underline font-medium" onClick={onClose}>
                      Abrir mensagens aprovadas
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {resultado && (
              <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                ✅ Enviados: <strong>{resultado.enviados}</strong> · ❌ Falhas:{" "}
                <strong>{resultado.falhas}</strong>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={onClose}>Fechar</Button>
              <Button
                onClick={enviar}
                disabled={enviando || (templateAprovado ? alvos.length === 0 : dentro.length === 0)}
              >
                {enviando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Avisar {templateAprovado ? alvos.length : dentro.length} contato(s)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
