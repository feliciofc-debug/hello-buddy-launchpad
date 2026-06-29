import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Save, Bot, MessageCircle, BookOpen, UserCog, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

type AgentConfig = {
  agent_name: string;
  persona: string;
  tone: string;
  greeting: string;
  knowledge_base: string;
  handoff_rules: string;
  is_active: boolean;
};

const EMPTY: AgentConfig = {
  agent_name: "",
  persona: "",
  tone: "",
  greeting: "",
  knowledge_base: "",
  handoff_rules: "",
  is_active: true,
};

const FIELDS: Record<
  keyof Omit<AgentConfig, "is_active">,
  { label: string; placeholder: string; help: string; multiline: boolean; rows?: number }
> = {
  agent_name: {
    label: "Nome do Agente",
    placeholder: "Ex: Sofia, Bruno, Atendente Virtual",
    help: "Como o agente vai se apresentar. Use um nome curto e amigável.",
    multiline: false,
  },
  persona: {
    label: "Persona do Agente",
    placeholder:
      "Ex: Sou um atendente atencioso de uma loja de roupas femininas. Falo de forma próxima, mas sempre profissional. Ajudo o cliente a encontrar a peça ideal.",
    help: "Quem é o agente, como ele se comporta e quais valores carrega. Escreva do seu jeito — se quiser, depois clique em ✨ Melhorar com IA.",
    multiline: true,
    rows: 4,
  },
  tone: {
    label: "Tom de Voz",
    placeholder: "Ex: descontraído e próximo, mas profissional",
    help: "Como o agente conversa: formal, informal, descolado, técnico...",
    multiline: false,
  },
  greeting: {
    label: "Saudação Inicial",
    placeholder: "Ex: Olá! 👋 Sou a Sofia da Moda Style. Como posso te ajudar hoje?",
    help: "Primeira mensagem que o agente envia quando o cliente inicia a conversa.",
    multiline: true,
    rows: 3,
  },
  knowledge_base: {
    label: "O que o Negócio Faz / Base de Conhecimento",
    placeholder:
      "Ex: Vendemos roupas femininas, acessórios e calçados. Atendemos de seg a sáb, 9h às 19h. Entregamos para todo Brasil. Aceitamos PIX, cartão e boleto. Trocas em até 7 dias.",
    help: "Tudo que o agente precisa saber sobre o seu negócio: o que vende, horários, formas de pagamento, entrega, diferenciais, perguntas frequentes. Quanto mais detalhe, melhor.",
    multiline: true,
    rows: 8,
  },
  handoff_rules: {
    label: "Quando Transferir para um Humano",
    placeholder:
      "Ex: Quando o cliente pedir desconto especial, reclamar de produto com defeito, ou quando a conversa ficar muito longa sem resolução.",
    help: "Em quais situações o agente deve passar a conversa para um atendente humano.",
    multiline: true,
    rows: 3,
  },
};

const SECTIONS = [
  { id: "identidade", icon: Bot, title: "Identidade do Agente", fields: ["agent_name", "persona", "tone"] as const },
  { id: "conversa", icon: MessageCircle, title: "Conversa", fields: ["greeting"] as const },
  { id: "conhecimento", icon: BookOpen, title: "Conhecimento do Negócio", fields: ["knowledge_base"] as const },
  { id: "handoff", icon: UserCog, title: "Transferência para Humano", fields: ["handoff_rules"] as const },
];

export default function ConfigAgenteWhatsApp() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [improving, setImproving] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [config, setConfig] = useState<AgentConfig>(EMPTY);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        navigate("/login");
        return;
      }
      setUserId(auth.user.id);
      const { data } = await supabase
        .from("whatsapp_cloud_agent_config")
        .select("*")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (data) {
        setConfig({
          agent_name: data.agent_name ?? "",
          persona: data.persona ?? "",
          tone: data.tone ?? "",
          greeting: data.greeting ?? "",
          knowledge_base: data.knowledge_base ?? "",
          handoff_rules: typeof data.handoff_rules === "string" ? data.handoff_rules : (data.handoff_rules ? JSON.stringify(data.handoff_rules) : ""),
          is_active: data.is_active ?? true,
        });
      }
      setLoading(false);
    })();
  }, [navigate]);

  const update = (k: keyof AgentConfig, v: string | boolean) => setConfig((c) => ({ ...c, [k]: v }));

  const handleImprove = async (field: keyof typeof FIELDS) => {
    const text = (config[field] as string)?.trim();
    if (!text) {
      toast({ title: "Escreva algo primeiro", description: "A IA precisa de um texto base para melhorar.", variant: "destructive" });
      return;
    }
    setImproving(field);
    try {
      const { data, error } = await supabase.functions.invoke("improve-agent-text", {
        body: { field, text, context: config.knowledge_base || undefined },
      });
      if (error) throw error;
      if (data?.improved) {
        update(field, data.improved);
        toast({ title: "Texto melhorado ✨", description: "Revise e ajuste se quiser." });
      } else if (data?.error) {
        toast({ title: "Não foi possível melhorar", description: data.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro ao melhorar com IA", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setImproving(null);
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const payload = {
        user_id: userId,
        agent_name: config.agent_name || null,
        persona: config.persona || null,
        tone: config.tone || null,
        greeting: config.greeting || null,
        knowledge_base: config.knowledge_base || null,
        handoff_rules: config.handoff_rules || null,
        is_active: config.is_active,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("whatsapp_cloud_agent_config")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
      toast({ title: "Configuração salva ✅", description: "O agente já está usando os novos ajustes." });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Voltar</span>
        </button>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary" />
                  Configurar Agente do WhatsApp
                </CardTitle>
                <CardDescription>
                  Um único formulário, organizado em seções. Preencha do seu jeito — em qualquer campo de texto longo, use ✨ <strong>Melhorar com IA</strong> para deixar o texto mais completo e profissional.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  id="active"
                  checked={config.is_active}
                  onCheckedChange={(v) => update("is_active", v)}
                />
                <Label htmlFor="active" className="text-sm">
                  {config.is_active ? "Ativo" : "Pausado"}
                </Label>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Accordion type="multiple" defaultValue={SECTIONS.map((s) => s.id)} className="space-y-3">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <AccordionItem
                key={section.id}
                value={section.id}
                className="border rounded-lg bg-card px-4"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2 text-left">
                    <Icon className="w-4 h-4 text-primary" />
                    <span className="font-medium">{section.title}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4 space-y-5">
                  {section.fields.map((fieldKey) => {
                    const f = FIELDS[fieldKey];
                    const value = config[fieldKey] as string;
                    const isImprovingThis = improving === fieldKey;
                    return (
                      <div key={fieldKey} className="space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <Label htmlFor={fieldKey} className="text-sm font-medium">
                            {f.label}
                          </Label>
                          {f.multiline && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleImprove(fieldKey)}
                              disabled={isImprovingThis || !value?.trim()}
                              className="h-8 gap-1.5"
                            >
                              {isImprovingThis ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5" />
                              )}
                              <span className="text-xs">Melhorar com IA</span>
                            </Button>
                          )}
                        </div>
                        {f.multiline ? (
                          <Textarea
                            id={fieldKey}
                            value={value}
                            onChange={(e) => update(fieldKey, e.target.value)}
                            placeholder={f.placeholder}
                            rows={f.rows ?? 4}
                            className="resize-y"
                          />
                        ) : (
                          <Input
                            id={fieldKey}
                            value={value}
                            onChange={(e) => update(fieldKey, e.target.value)}
                            placeholder={f.placeholder}
                          />
                        )}
                        <p className="text-xs text-muted-foreground">{f.help}</p>
                      </div>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        <div className="flex justify-end mt-6 sticky bottom-4">
          <Button onClick={handleSave} disabled={saving} size="lg" className="shadow-lg">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Configuração
          </Button>
        </div>
      </div>
    </div>
  );
}
