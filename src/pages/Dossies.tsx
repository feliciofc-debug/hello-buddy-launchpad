import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, User, Phone, MapPin, Briefcase, DollarSign, Target, Download, Copy, CheckCircle2, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

type Dossie = {
  id: string;
  telefone_cliente: string;
  nome_completo: string | null;
  cpf: string | null;
  rg: string | null;
  data_nascimento: string | null;
  estado_civil: string | null;
  profissao: string | null;
  renda_mensal: number | null;
  email: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  endereco_cep: string | null;
  interesse_bem: string | null;
  interesse_valor_carta: number | null;
  interesse_prazo_meses: number | null;
  interesse_aceita_lance: boolean | null;
  status: string;
  completeness_score: number;
  parcial_notified_at: string | null;
  completo_notified_at: string | null;
  updated_at: string;
};

type Documento = {
  id: string;
  tipo: string;
  storage_path: string;
  status_validacao: string;
  observacoes_ia: string | null;
  dados_extraidos: any;
  created_at: string;
};

const TIPO_LABEL: Record<string, string> = {
  rg: "RG",
  cnh: "CNH",
  comprovante_residencia: "Comprovante de residência",
  comprovante_renda: "Comprovante de renda",
  ir: "Declaração de IR",
  foto_bem: "Foto do bem",
  outro: "Outro documento",
};

const STATUS_COLORS: Record<string, string> = {
  coletando: "bg-yellow-500",
  aguardando_proposta: "bg-blue-500",
  proposta_enviada: "bg-purple-500",
  fechado: "bg-green-500",
  descartado: "bg-gray-500",
};

export default function Dossies() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dossies, setDossies] = useState<Dossie[]>([]);
  const [selected, setSelected] = useState<Dossie | null>(null);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  async function carregar() {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      navigate("/login");
      return;
    }
    const { data, error } = await supabase
      .from("silvester_dossies")
      .select("*")
      .eq("user_id", auth.user.id)
      .order("updated_at", { ascending: false });
    if (error) {
      toast({ title: "Erro ao carregar dossiês", description: error.message, variant: "destructive" });
    }
    setDossies((data as Dossie[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
    const interval = setInterval(carregar, 15000);
    return () => clearInterval(interval);
  }, []);

  async function abrirDossie(d: Dossie) {
    setSelected(d);
    const { data } = await supabase
      .from("silvester_documentos")
      .select("*")
      .eq("dossie_id", d.id)
      .order("created_at", { ascending: false });
    const docsList = (data as Documento[]) || [];
    setDocs(docsList);
    // Signed URLs
    const urls: Record<string, string> = {};
    for (const doc of docsList) {
      const { data: u } = await supabase.storage.from("silvester-docs").createSignedUrl(doc.storage_path, 3600);
      if (u?.signedUrl) urls[doc.id] = u.signedUrl;
    }
    setSignedUrls(urls);
  }

  async function atualizarStatus(novoStatus: string) {
    if (!selected) return;
    await supabase.from("silvester_dossies").update({ status: novoStatus }).eq("id", selected.id);
    toast({ title: "Status atualizado" });
    setSelected({ ...selected, status: novoStatus });
    carregar();
  }

  function copiarFicha() {
    if (!selected) return;
    const linhas = [
      `=== DOSSIÊ SILVESTER — ${selected.nome_completo || "sem nome"} ===`,
      ``,
      `📞 Telefone: ${selected.telefone_cliente}`,
      selected.email ? `📧 E-mail: ${selected.email}` : "",
      selected.cpf ? `📄 CPF: ${selected.cpf}` : "",
      selected.rg ? `📄 RG: ${selected.rg}` : "",
      selected.data_nascimento ? `🎂 Nascimento: ${selected.data_nascimento}` : "",
      selected.estado_civil ? `💍 Estado civil: ${selected.estado_civil}` : "",
      selected.profissao ? `💼 Profissão: ${selected.profissao}` : "",
      selected.renda_mensal ? `💰 Renda: R$ ${Number(selected.renda_mensal).toLocaleString("pt-BR")}` : "",
      selected.endereco_cidade ? `📍 Cidade: ${selected.endereco_cidade}/${selected.endereco_estado ?? ""}` : "",
      selected.endereco_cep ? `📮 CEP: ${selected.endereco_cep}` : "",
      ``,
      `=== INTERESSE ===`,
      selected.interesse_bem ? `🎯 Bem: ${selected.interesse_bem}` : "",
      selected.interesse_valor_carta ? `💵 Valor carta: R$ ${Number(selected.interesse_valor_carta).toLocaleString("pt-BR")}` : "",
      selected.interesse_prazo_meses ? `⏳ Prazo: ${selected.interesse_prazo_meses} meses` : "",
      selected.interesse_aceita_lance !== null ? `📈 Aceita lance: ${selected.interesse_aceita_lance ? "Sim" : "Não"}` : "",
      ``,
      `=== DOCUMENTOS ANEXADOS ===`,
      ...docs.map((d) => `• ${TIPO_LABEL[d.tipo] ?? d.tipo} — ${d.status_validacao === "validado" ? "✅" : "⚠️"} ${d.observacoes_ia ?? ""}`),
      ``,
      `Completude: ${selected.completeness_score}%`,
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(linhas);
    toast({ title: "Ficha copiada ✅", description: "Cole no sistema Ademicon." });
  }

  async function baixarTodos() {
    if (!docs.length) return;
    toast({ title: "Baixando documentos..." });
    for (const doc of docs) {
      const url = signedUrls[doc.id];
      if (!url) continue;
      const a = document.createElement("a");
      a.href = url;
      a.download = `${TIPO_LABEL[doc.tipo] ?? doc.tipo}_${doc.id.slice(0, 6)}`;
      a.target = "_blank";
      a.click();
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-6 h-6" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <Button variant="outline" size="sm" onClick={carregar}>
            <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
          </Button>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Dossiês do Silvester
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Fichas dos clientes que o Silvester atendeu — com documentos já extraídos, prontas pra você preencher a proposta.
          </p>
        </div>

        <div className="grid md:grid-cols-[380px_1fr] gap-6">
          {/* Lista */}
          <div className="space-y-3">
            {dossies.length === 0 && (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
                Nenhum dossiê ainda. Assim que o Silvester atender um cliente novo, ele aparece aqui.
              </CardContent></Card>
            )}
            {dossies.map((d) => (
              <Card
                key={d.id}
                onClick={() => abrirDossie(d)}
                className={`cursor-pointer transition ${selected?.id === d.id ? "border-primary shadow-md" : "hover:border-primary/50"}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{d.nome_completo || "Cliente sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{d.telefone_cliente}</p>
                    </div>
                    <Badge className={`${STATUS_COLORS[d.status] ?? "bg-gray-500"} text-white text-xs shrink-0`}>
                      {d.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    {d.interesse_bem && <span className="flex items-center gap-1"><Target className="w-3 h-3" />{d.interesse_bem}</span>}
                    {d.interesse_valor_carta && <span>R$ {Number(d.interesse_valor_carta).toLocaleString("pt-BR")}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={d.completeness_score} className="h-1.5 flex-1" />
                    <span className="text-xs font-mono text-muted-foreground">{d.completeness_score}%</span>
                  </div>
                  {d.completo_notified_at ? (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Completo</p>
                  ) : d.parcial_notified_at ? (
                    <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Parcial</p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Detalhe */}
          <div>
            {!selected ? (
              <Card><CardContent className="py-16 text-center text-muted-foreground">
                Selecione um dossiê ao lado pra ver a ficha completa.
              </CardContent></Card>
            ) : (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div>
                        <CardTitle className="text-xl">{selected.nome_completo || "Cliente sem nome"}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {selected.telefone_cliente} · Completude {selected.completeness_score}%
                        </p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={copiarFicha}>
                          <Copy className="w-4 h-4 mr-1" /> Copiar ficha
                        </Button>
                        <Button size="sm" onClick={baixarTodos} disabled={!docs.length}>
                          <Download className="w-4 h-4 mr-1" /> Baixar docs ({docs.length})
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <Select value={selected.status} onValueChange={atualizarStatus}>
                        <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="coletando">Coletando</SelectItem>
                          <SelectItem value="aguardando_proposta">Aguardando proposta</SelectItem>
                          <SelectItem value="proposta_enviada">Proposta enviada</SelectItem>
                          <SelectItem value="fechado">Fechado</SelectItem>
                          <SelectItem value="descartado">Descartado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3 text-sm">
                      <Field icon={User} label="CPF" value={selected.cpf} />
                      <Field icon={User} label="RG" value={selected.rg} />
                      <Field icon={User} label="Nascimento" value={selected.data_nascimento} />
                      <Field icon={User} label="Estado civil" value={selected.estado_civil} />
                      <Field icon={Briefcase} label="Profissão" value={selected.profissao} />
                      <Field icon={DollarSign} label="Renda mensal" value={selected.renda_mensal ? `R$ ${Number(selected.renda_mensal).toLocaleString("pt-BR")}` : null} />
                      <Field icon={Phone} label="E-mail" value={selected.email} />
                      <Field icon={MapPin} label="Cidade/UF" value={selected.endereco_cidade ? `${selected.endereco_cidade}/${selected.endereco_estado ?? ""}` : null} />
                    </div>

                    <div className="pt-3 border-t">
                      <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><Target className="w-4 h-4" /> Interesse</h3>
                      <div className="grid md:grid-cols-2 gap-3 text-sm">
                        <Field label="Bem" value={selected.interesse_bem} />
                        <Field label="Valor carta" value={selected.interesse_valor_carta ? `R$ ${Number(selected.interesse_valor_carta).toLocaleString("pt-BR")}` : null} />
                        <Field label="Prazo" value={selected.interesse_prazo_meses ? `${selected.interesse_prazo_meses} meses` : null} />
                        <Field label="Aceita lance" value={selected.interesse_aceita_lance === null ? null : selected.interesse_aceita_lance ? "Sim" : "Não"} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">Documentos anexados ({docs.length})</CardTitle></CardHeader>
                  <CardContent>
                    {docs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum documento anexado ainda.</p>
                    ) : (
                      <div className="grid md:grid-cols-2 gap-3">
                        {docs.map((d) => (
                          <div key={d.id} className="border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm">{TIPO_LABEL[d.tipo] ?? d.tipo}</span>
                              {d.status_validacao === "validado" ? (
                                <Badge className="bg-green-500 text-white text-xs">✅ Validado</Badge>
                              ) : d.status_validacao === "ilegivel" ? (
                                <Badge variant="destructive" className="text-xs">⚠️ Ilegível</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">{d.status_validacao}</Badge>
                              )}
                            </div>
                            {signedUrls[d.id] && d.tipo !== "outro" && (
                              <a href={signedUrls[d.id]} target="_blank" rel="noreferrer">
                                <img src={signedUrls[d.id]} alt={d.tipo} className="w-full h-32 object-cover rounded mb-2" />
                              </a>
                            )}
                            {d.observacoes_ia && (
                              <p className="text-xs text-muted-foreground italic">{d.observacoes_ia}</p>
                            )}
                            {signedUrls[d.id] && (
                              <a href={signedUrls[d.id]} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline mt-1 block">
                                Abrir original
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, value }: { icon?: any; label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium truncate">{value ?? "—"}</p>
      </div>
    </div>
  );
}
