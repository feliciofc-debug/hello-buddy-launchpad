import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Send, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function WhatsAppConversations() {
  const navigate = useNavigate();
  const [tipoConversa, setTipoConversa] = useState<'campanha' | 'prospeccao'>('campanha');
  const [conversas, setConversas] = useState<any[]>([]);
  const [conversaSelecionada, setConversaSelecionada] = useState<any>(null);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);

  const carregarConversas = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('origem', tipoConversa)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setConversas(data || []);
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    }
  };

  const carregarMensagens = async (phone: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('user_id', user.id)
        .eq('phone', phone)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      setMensagens(data || []);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const enviarMensagem = async () => {
    if (!novaMensagem.trim() || !conversaSelecionada) return;

    setEnviando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Enviar via edge function
      const { error: sendError } = await supabase.functions.invoke('send-wuzapi-message', {
        body: {
          phoneNumbers: [conversaSelecionada.phone_number],
          message: novaMensagem
        }
      });

      if (sendError) throw sendError;

      // Salvar no histórico
      await supabase.from('whatsapp_messages').insert({
        user_id: user.id,
        phone: conversaSelecionada.phone_number,
        direction: 'sent',
        message: novaMensagem,
        origem: conversaSelecionada.origem
      });

      toast.success('Mensagem enviada!');
      setNovaMensagem('');
      carregarMensagens(conversaSelecionada.phone_number);
    } catch (error: any) {
      console.error('Erro ao enviar:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setEnviando(false);
    }
  };

  useEffect(() => {
    carregarConversas();
    const interval = setInterval(carregarConversas, 10000);
    return () => clearInterval(interval);
  }, [tipoConversa]);

  useEffect(() => {
    if (conversaSelecionada) {
      carregarMensagens(conversaSelecionada.phone_number);
      const interval = setInterval(() => carregarMensagens(conversaSelecionada.phone_number), 5000);
      return () => clearInterval(interval);
    }
  }, [conversaSelecionada]);

  const conversasCampanha = conversas.filter(c => c.origem === 'campanha');
  const conversasProspeccao = conversas.filter(c => c.origem === 'prospeccao');

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* HEADER COM TABS */}
      <div className="p-4 border-b bg-card">
        <div className="mb-4 flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold">💬 IA Conversas</h1>
        </div>
        
        <Tabs value={tipoConversa} onValueChange={(v) => setTipoConversa(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="campanha" className="gap-2">
              🛒 Base de Clientes
              <Badge variant="outline">
                {conversasCampanha.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="prospeccao" className="gap-2">
              🔍 Prospects/Leads
              <Badge variant="outline">
                {conversasProspeccao.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* CONTEÚDO */}
      <div className="flex flex-1 overflow-hidden">
        {/* LISTA DE CONVERSAS */}
        <aside className="w-80 border-r bg-muted/30 overflow-y-auto">
          <div className="p-4 border-b bg-card sticky top-0">
            <p className="text-sm text-muted-foreground">
              {conversas.length} conversas ativas
            </p>
          </div>
          
          {conversas.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>Nenhuma conversa ainda</p>
            </div>
          ) : (
            conversas.map(conv => (
              <div
                key={conv.phone_number}
                className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                  conversaSelecionada?.phone_number === conv.phone_number ? 'bg-primary/10' : ''
                }`}
                onClick={() => setConversaSelecionada(conv)}
              >
                <div className="flex justify-between items-start mb-1">
                  <p className="font-medium">{conv.phone_number}</p>
                  <span className="text-xs text-muted-foreground">
                    {new Date(conv.updated_at).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                
                {/* BADGE DE TIPO */}
                <Badge 
                  variant="outline" 
                  className={`text-xs mb-2 ${
                    conv.origem === 'campanha' 
                      ? 'bg-blue-500/10 text-blue-700 border-blue-200' 
                      : 'bg-green-500/10 text-green-700 border-green-200'
                  }`}
                >
                  {conv.origem === 'campanha' ? '🛒 Cliente' : '🔍 Lead'}
                </Badge>
                
                {/* CONTEXTO ESPECÍFICO */}
                {conv.origem === 'campanha' && conv.last_message_context && (
                  <p className="text-xs text-muted-foreground mb-1">
                    📦 {conv.last_message_context.produto_nome}
                  </p>
                )}
                
                {conv.origem === 'prospeccao' && conv.last_message_context && (
                  <p className="text-xs text-muted-foreground mb-1">
                    🏢 {conv.last_message_context.empresa || 'Prospecção'}
                  </p>
                )}
              </div>
            ))
          )}
        </aside>

        {/* CHAT */}
        <main className="flex-1 flex flex-col">
          {conversaSelecionada ? (
            <>
              {/* Header diferenciado por tipo */}
              <div className="p-4 border-b bg-card">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold">{conversaSelecionada.phone_number}</p>
                      <Badge 
                        className={
                          conversaSelecionada.origem === 'campanha'
                            ? 'bg-blue-500'
                            : 'bg-green-500'
                        }
                      >
                        {conversaSelecionada.origem === 'campanha' ? '🛒 Cliente' : '🔍 Lead'}
                      </Badge>
                    </div>
                    
                    {conversaSelecionada.origem === 'campanha' && conversaSelecionada.last_message_context && (
                      <p className="text-sm text-muted-foreground">
                        Produto: {conversaSelecionada.last_message_context.produto_nome}
                      </p>
                    )}
                    
                    {conversaSelecionada.origem === 'prospeccao' && conversaSelecionada.last_message_context && (
                      <p className="text-sm text-muted-foreground">
                        Empresa: {conversaSelecionada.last_message_context.empresa || 'N/A'}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`https://wa.me/${conversaSelecionada.phone_number}`, '_blank')}
                  >
                    💬 Abrir WhatsApp
                  </Button>
                </div>
              </div>

              {/* CONTEXTO DIFERENCIADO */}
              {conversaSelecionada.origem === 'campanha' && conversaSelecionada.last_message_context && (
                <div className="p-3 bg-blue-500/10 border-b">
                  <div className="flex gap-3">
                    {conversaSelecionada.last_message_context.produto_imagens?.[0] && (
                      <img
                        src={conversaSelecionada.last_message_context.produto_imagens[0]}
                        className="w-12 h-12 object-cover rounded"
                        alt="Produto"
                      />
                    )}
                    <div className="flex-1 text-xs">
                      <p className="font-medium">
                        {conversaSelecionada.last_message_context.produto_nome}
                      </p>
                      <p className="text-green-600 font-bold">
                        R$ {conversaSelecionada.last_message_context.produto_preco}
                      </p>
                      <p className="text-muted-foreground">
                        Estoque: {conversaSelecionada.last_message_context.produto_estoque}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {conversaSelecionada.origem === 'prospeccao' && conversaSelecionada.last_message_context && (
                <div className="p-3 bg-green-500/10 border-b">
                  <div className="text-xs space-y-1">
                    <p><strong>Empresa:</strong> {conversaSelecionada.last_message_context.empresa || 'N/A'}</p>
                    <p><strong>Cargo:</strong> {conversaSelecionada.last_message_context.cargo || 'N/A'}</p>
                    {conversaSelecionada.last_message_context.linkedin_url && (
                      <p><strong>LinkedIn:</strong> <a href={conversaSelecionada.last_message_context.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Ver perfil</a></p>
                    )}
                  </div>
                </div>
              )}

              {/* MENSAGENS */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20">
                {mensagens.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>Nenhuma mensagem ainda</p>
                  </div>
                ) : (
                  mensagens.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.direction === 'sent' ? 'justify-end' : 'justify-start'}`}
                    >
                      <Card className={`max-w-[70%] p-3 ${
                        msg.direction === 'sent' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-card'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        <span className={`text-xs mt-1 block ${
                          msg.direction === 'sent' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        }`}>
                          {new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </Card>
                    </div>
                  ))
                )}
              </div>

              {/* CAMPO DE RESPOSTA */}
              <div className="p-4 border-t bg-card">
                <div className="flex gap-2">
                  <Textarea
                    value={novaMensagem}
                    onChange={(e) => setNovaMensagem(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="resize-none"
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        enviarMensagem();
                      }
                    }}
                  />
                  <Button
                    onClick={enviarMensagem}
                    disabled={!novaMensagem.trim() || enviando}
                    size="icon"
                    className="h-full"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Enter para enviar, Shift+Enter para nova linha
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-lg mb-2">
                  {tipoConversa === 'campanha' 
                    ? '🛒 Base de Clientes' 
                    : '🔍 Prospects/Leads'}
                </p>
                <p className="text-sm">Selecione uma conversa para visualizar</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
