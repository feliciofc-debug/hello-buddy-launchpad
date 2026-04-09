import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

interface NewTicketFormProps {
  onBack: () => void;
  onCreated: () => void;
}

export default function NewTicketForm({ onBack, onCreated }: NewTicketFormProps) {
  const [form, setForm] = useState({
    cliente_email: "",
    cliente_nome: "",
    cliente_phone: "",
    assunto: "",
    descricao: "",
    prioridade: "media",
    categoria: "geral",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.assunto || !form.cliente_email) {
      toast.error("Preencha pelo menos o email e o assunto");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("support_tickets").insert({
      cliente_email: form.cliente_email,
      cliente_nome: form.cliente_nome || null,
      cliente_phone: form.cliente_phone || null,
      assunto: form.assunto,
      descricao: form.descricao || null,
      prioridade: form.prioridade,
      categoria: form.categoria,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao criar chamado: " + error.message);
    } else {
      toast.success("Chamado criado!");
      onCreated();
    }
  };

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-400">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <CardTitle className="text-white text-base">Novo Chamado</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            placeholder="Email do cliente *"
            value={form.cliente_email}
            onChange={(e) => setForm({ ...form, cliente_email: e.target.value })}
            className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
          />
          <Input
            placeholder="Nome do cliente"
            value={form.cliente_nome}
            onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })}
            className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
          />
          <Input
            placeholder="WhatsApp do cliente"
            value={form.cliente_phone}
            onChange={(e) => setForm({ ...form, cliente_phone: e.target.value })}
            className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
          />
          <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
            <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="baixa">Baixa</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          placeholder="Assunto do chamado *"
          value={form.assunto}
          onChange={(e) => setForm({ ...form, assunto: e.target.value })}
          className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
        />
        <textarea
          placeholder="Descrição do problema..."
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          rows={4}
          className="w-full rounded-md bg-slate-700/50 border border-slate-600 text-white placeholder:text-slate-400 p-3 text-sm resize-none"
        />
        <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
          <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="geral">Geral</SelectItem>
            <SelectItem value="login">Login / Acesso</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="produtos">Produtos</SelectItem>
            <SelectItem value="pagamento">Pagamento</SelectItem>
            <SelectItem value="bug">Bug / Erro</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleSubmit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 w-full">
          {saving ? "Criando..." : "Criar Chamado"}
        </Button>
      </CardContent>
    </Card>
  );
}
