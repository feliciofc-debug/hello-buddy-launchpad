import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Download, Loader2, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface Message {
  id: string;
  mensagem_professional: string;
  mensagem_friendly: string;
  mensagem_enthusiast: string;
  mensagem_selecionada: string | null;
  mensagem_final: string | null;
  aprovada: boolean;
  agendado_para: string;
  prospect: {
    score: number;
    socio: {
      nome: string;
      empresa: {
        nome_fantasia: string;
        telefone: string;
      };
    };
  };
}

interface MessagesReviewProps {
  concessionariaId: string;
}

export default function MessagesReview({ concessionariaId }: MessagesReviewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [editedMessage, setEditedMessage] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadMessages();
  }, [concessionariaId]);

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('mensagens_personalizadas')
        .select(`
          *,
          prospect:prospects_qualificados(
            score,
            socio:socios(
              nome,
              empresa:empresas(nome_fantasia, telefone)
            )
          )
        `)
        .eq('concessionaria_id', concessionariaId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      console.error("Error loading messages:", error);
      toast.error("Erro ao carregar mensagens");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (messageId: string, variant: string) => {
    try {
      const { error } = await supabase
        .from('mensagens_personalizadas')
        .update({
          mensagem_selecionada: variant,
          aprovada: true,
        })
        .eq('id', messageId);

      if (error) throw error;

      toast.success("✅ Mensagem aprovada!");
      loadMessages();
    } catch (error: any) {
      console.error("Error approving message:", error);
      toast.error("Erro ao aprovar mensagem");
    }
  };

  const handleExport = async () => {
    setExporting(true);
    console.log("📤 Exporting approved messages...");

    try {
      const { data, error } = await supabase.functions.invoke('export-zapi', {
        body: { concessionaria_id: concessionariaId }
      });

      if (error) throw error;

      // Download CSV
      const blob = new Blob([data.csv_content], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zapi_export_${new Date().getTime()}.csv`;
      a.click();

      toast.success(`✅ ${data.total_messages} mensagens exportadas!`);
    } catch (error: any) {
      console.error("Error exporting:", error);
      toast.error(error.message || "Erro ao exportar");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const approvedCount = messages.filter(m => m.aprovada).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Revisar Mensagens ({messages.length})</CardTitle>
              <CardDescription>
                {approvedCount} mensagens aprovadas e prontas para envio
              </CardDescription>
            </div>
            <Button
              onClick={handleExport}
              disabled={exporting || approvedCount === 0}
            >
              {exporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar ZAPI
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4">
        {messages.map((message) => (
          <Card key={message.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {message.prospect.socio.nome}
                  </CardTitle>
                  <CardDescription>
                    {message.prospect.socio.empresa.nome_fantasia} • Score: {message.prospect.score}
                  </CardDescription>
                </div>
                {message.aprovada && (
                  <Badge variant="default">
                    <Check className="mr-1 h-3 w-3" />
                    Aprovada
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs defaultValue="professional">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="professional">Profissional</TabsTrigger>
                  <TabsTrigger value="friendly">Amigável</TabsTrigger>
                  <TabsTrigger value="enthusiast">Entusiasta</TabsTrigger>
                </TabsList>
                <TabsContent value="professional" className="space-y-2">
                  <Textarea
                    value={message.mensagem_professional}
                    readOnly
                    rows={6}
                    className="resize-none"
                  />
                  {!message.aprovada && (
                    <Button
                      onClick={() => handleApprove(message.id, 'professional')}
                      className="w-full"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Aprovar Profissional
                    </Button>
                  )}
                </TabsContent>
                <TabsContent value="friendly" className="space-y-2">
                  <Textarea
                    value={message.mensagem_friendly}
                    readOnly
                    rows={6}
                    className="resize-none"
                  />
                  {!message.aprovada && (
                    <Button
                      onClick={() => handleApprove(message.id, 'friendly')}
                      className="w-full"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Aprovar Amigável
                    </Button>
                  )}
                </TabsContent>
                <TabsContent value="enthusiast" className="space-y-2">
                  <Textarea
                    value={message.mensagem_enthusiast}
                    readOnly
                    rows={6}
                    className="resize-none"
                  />
                  {!message.aprovada && (
                    <Button
                      onClick={() => handleApprove(message.id, 'enthusiast')}
                      className="w-full"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Aprovar Entusiasta
                    </Button>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}