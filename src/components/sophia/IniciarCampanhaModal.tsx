import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { normalizePhoneNumber } from "@/lib/phoneUtils";

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
}

const TEMPLATE_OPTIN = `Oi {{nome}}! Tudo bem? Aqui é a Sophia da Fortem Academy 😊`;

const TEMPLATE_COMPLETA = `Oi {{nome}}! Tudo bem? 😊

Me permite compartilhar algo rápido sobre desenvolvimento profissional?

Existe uma habilidade que separa profissionais comuns de negociadores extraordinários — a capacidade de ler pessoas.

Entender o que o outro precisa antes de ele dizer. Perceber resistência antes dela virar objeção.

Isso tem nome: inteligência comportamental.

O livro "Arquivo Confidencial" apresenta o Método ARC — um framework prático de Análise, Resistência e Conversão para quem leva negócios a sério.

Se fizer sentido pra você: https://go.hotmart.com/C104903078G

Qualquer dúvida, estou por aqui! Abraço 👊`;

export function IniciarCampanhaModal({ open, onClose, userId }: Props) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"optin" | "completa">("optin");
  const [contatosRaw, setContatosRaw] = useState("");
  const [loading, setLoading] = useState(false);

  const template = tipo === "optin" ? TEMPLATE_OPTIN : TEMPLATE_COMPLETA;

  const parseContatos = (raw: string) => {
    return raw
      .split(/[\n,;]+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        // Formato: "nome - telefone" ou "telefone" ou "nome,telefone"
        const parts = line.split(/[-\t]+/).map((p) => p.trim());
        if (parts.length >= 2) {
          return { nome: parts[0], phone: normalizePhoneNumber(parts[1]) };
        }
        // Só telefone
        return { nome: "Amigo(a)", phone: normalizePhoneNumber(parts[0]) };
      })
      .filter((c) => c.phone.length >= 10);
  };

  const handleIniciar = async () => {
    if (!nome.trim()) {
      toast.error("Dê um nome para a campanha");
      return;
    }

    const contatos = parseContatos(contatosRaw);
    if (contatos.length === 0) {
      toast.error("Nenhum contato válido encontrado");
      return;
    }

    setLoading(true);
    try {
      // Verificar sessão antes de inserir
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error("❌ [SOPHIA] Sessão inválida:", sessionError);
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }
      
      const currentUserId = session.user.id;
      console.log("🎯 [SOPHIA] Criando campanha com user_id:", currentUserId, "userId prop:", userId);

      // 1. Criar campanha
      const insertData = {
        user_id: currentUserId,
        nome: nome.trim(),
        tipo,
        mensagem_template: template,
        total_leads: contatos.length,
        status: "agendada",
      };
      console.log("📝 [SOPHIA] Insert data:", JSON.stringify(insertData));

      const { data: campanha, error: errCampanha } = await supabase
        .from("sophia_campanhas")
        .insert(insertData)
        .select()
        .single();

      if (errCampanha) {
        console.error("❌ [SOPHIA] Erro ao criar campanha:", JSON.stringify(errCampanha));
        throw errCampanha;
      }

      console.log("✅ [SOPHIA] Campanha criada:", campanha?.id);

      // 2. Inserir na fila
      const filaItems = contatos.map((c) => ({
        user_id: currentUserId,
        lead_phone: c.phone,
        lead_name: c.nome,
        mensagem: template.replace(/\{\{nome\}\}/g, c.nome),
        status: "pendente" as const,
        opt_in_status: tipo === "optin" ? "aguardando" : "novo",
        campanha_id: campanha.id,
        lead_source: "sophia_campanha",
        scheduled_at: new Date().toISOString(),
      }));

      // Inserir em batches de 100
      for (let i = 0; i < filaItems.length; i += 100) {
        const batch = filaItems.slice(i, i + 100);
        const { error: errFila } = await supabase.from("fila_atendimento_pj").insert(batch);
        if (errFila) {
          console.error("❌ [SOPHIA] Erro ao inserir fila batch", i, ":", JSON.stringify(errFila));
          throw errFila;
        }
        console.log("✅ [SOPHIA] Fila batch", i, "inserida com", batch.length, "itens");
      }

      toast.success(`🚀 Campanha "${nome}" criada com ${contatos.length} contatos!`);
      setNome("");
      setContatosRaw("");
      onClose();
    } catch (err: any) {
      console.error("❌ [SOPHIA] Erro completo:", err);
      toast.error(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🎯 Nova Campanha — Sophia</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome da Campanha</Label>
            <Input
              placeholder="Ex: Arquivo Confidencial - Lote 1"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>

          <div>
            <Label>Tipo de Envio</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as "optin" | "completa")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="optin">
                  🔥 Opt-in (aquecimento) — Só envia "Oi, tudo bem?"
                </SelectItem>
                <SelectItem value="completa">
                  📚 Completa — Envia pitch do Arquivo Confidencial
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Preview da Mensagem</Label>
            <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap border">
              {template.replace(/\{\{nome\}\}/g, "João")}
            </div>
          </div>

          <div>
            <Label>
              Contatos (um por linha: "Nome - Telefone" ou só telefone)
            </Label>
            <Textarea
              placeholder={`Maria Silva - 21967520706\nJoão - 11999887766\n21988776655`}
              rows={8}
              value={contatosRaw}
              onChange={(e) => setContatosRaw(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {parseContatos(contatosRaw).length} contato(s) válido(s) detectado(s)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleIniciar} disabled={loading}>
            {loading ? "Criando..." : `🚀 Criar Campanha (${parseContatos(contatosRaw).length} contatos)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
