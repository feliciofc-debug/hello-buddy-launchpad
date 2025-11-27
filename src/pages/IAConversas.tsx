import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { ArrowLeft, Bot, User, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Conversa {
  id: string;
  phone_number: string;
  contact_name: string | null;
  modo_atendimento: string;
  last_message_at: string | null;
  metadata: any;
  origem: string;
}

interface Mensagem {
  id: string;
  content: string;
  role: string;
  created_at: string;
}

export default function IAConversas() {
  const navigate = useNavigate();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaSelecionada, setConversaSelecionada] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [filtro, setFiltro] = useState('todas');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarConversas();
    const interval = setInterval(carregarConversas, 5000);
    return () => clearInterval(interval);
  }, [filtro]);

  useEffect(() => {
    if (conversaSelecionada) {
      carregarMensagens(conversaSelecionada.id);
      const interval = setInterval(() => {
        carregarMensagens(conversaSelecionada.id);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [conversaSelecionada]);

  const carregarConversas = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('whatsapp_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false });

      if (filtro === 'ia') {
        query = query.eq('modo_atendimento', 'ia');
      } else if (filtro === 'humano') {
        query = query.eq('modo_atendimento', 'humano');
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao carregar conversas:', error);
        return;
      }

      setConversas(data || []);
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarMensagens = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('whatsapp_conversation_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao carregar mensagens:', error);
      return;
    }

    setMensagens(data || []);
  };

  const assumirConversa = async (conversa: Conversa) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({
        modo_atendimento: 'humano',
        assumido_por: user.id,
        assumido_em: new Date().toISOString()
      })
      .eq('id', conversa.id);

    if (!error) {
      toast.success('✅ Você assumiu a conversa!');
      carregarConversas();
      if (conversaSelecionada?.id === conversa.id) {
        setConversaSelecionada({ ...conversa, modo_atendimento: 'humano' });
      }
    } else {
      toast.error('Erro ao assumir conversa');
    }
  };

  const devolverParaIA = async (conversa: Conversa) => {
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({
        modo_atendimento: 'ia',
        assumido_por: null,
        assumido_em: null
      })
      .eq('id', conversa.id);

    if (!error) {
      toast.success('✅ IA voltou a atender!');
      carregarConversas();
      if (conversaSelecionada?.id === conversa.id) {
        setConversaSelecionada({ ...conversa, modo_atendimento: 'ia' });
      }
    } else {
      toast.error('Erro ao devolver para IA');
    }
  };

  const enviarMensagem = async () => {
    if (!novaMensagem.trim() || !conversaSelecionada) return;

    setEnviando(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Enviar via edge function
      const { data, error } = await supabase.functions.invoke('send-wuzapi-message', {
        body: {
          phone: conversaSelecionada.phone_number,
          message: novaMensagem
        }
      });

      if (error) {
        toast.error('Erro ao enviar: ' + error.message);
        return;
      }

      // Salvar mensagem no banco
      await supabase.from('whatsapp_conversation_messages').insert({
        conversation_id: conversaSelecionada.id,
        role: 'assistant',
        content: novaMensagem
      });

      // Atualizar última mensagem
      await supabase
        .from('whatsapp_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversaSelecionada.id);

      toast.success('✅ Mensagem enviada!');
      setNovaMensagem('');
      carregarMensagens(conversaSelecionada.id);

    } catch (error: any) {
      console.error('Erro:', error);
      toast.error('Erro: ' + error.message);
    } finally {
      setEnviando(false);
    }
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 13) {
      return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
    }
    return phone;
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold">💬 IA Conversas</h1>
        
        <div className="flex gap-2 ml-auto">
          <Button
            variant={filtro === 'todas' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltro('todas')}
          >
            Todas
          </Button>
          <Button
            variant={filtro === 'ia' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltro('ia')}
          >
            <Bot className="w-4 h-4 mr-1" /> IA Ativa
          </Button>
          <Button
            variant={filtro === 'humano' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltro('humano')}
          >
            <User className="w-4 h-4 mr-1" /> Humano
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LISTA DE CONVERSAS */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Conversas Ativas ({conversas.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              {loading ? (
                <p className="p-4 text-sm text-muted-foreground text-center">
                  Carregando...
                </p>
              ) : conversas.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">
                  Nenhuma conversa ainda
                </p>
              ) : (
                <div className="space-y-1">
                  {conversas.map(conv => (
                    <div
                      key={conv.id}
                      className={`p-4 cursor-pointer hover:bg-accent border-b transition-colors ${
                        conversaSelecionada?.id === conv.id ? 'bg-accent' : ''
                      }`}
                      onClick={() => setConversaSelecionada(conv)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {(conv.contact_name || conv.phone_number || '?')[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {conv.contact_name || formatPhone(conv.phone_number)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatPhone(conv.phone_number)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {conv.last_message_at ? 
                                new Date(conv.last_message_at).toLocaleString('pt-BR') 
                                : 'Sem mensagens'
                              }
                            </p>
                          </div>
                        </div>
                        
                        <Badge variant={conv.modo_atendimento === 'humano' ? 'default' : 'secondary'}>
                          {conv.modo_atendimento === 'humano' ? '👤' : '🤖'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* CHAT */}
        <Card className="lg:col-span-2">
          {!conversaSelecionada ? (
            <CardContent className="h-[600px] flex items-center justify-center">
              <p className="text-muted-foreground">
                Selecione uma conversa para ver as mensagens
              </p>
            </CardContent>
          ) : (
            <>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {conversaSelecionada.contact_name || formatPhone(conversaSelecionada.phone_number)}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {formatPhone(conversaSelecionada.phone_number)}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {conversaSelecionada.modo_atendimento === 'ia' ? (
                      <Button
                        onClick={() => assumirConversa(conversaSelecionada)}
                        className="bg-green-500 hover:bg-green-600"
                      >
                        <User className="w-4 h-4 mr-2" /> Assumir Conversa
                      </Button>
                    ) : (
                      <Button
                        onClick={() => devolverParaIA(conversaSelecionada)}
                        variant="outline"
                      >
                        <Bot className="w-4 h-4 mr-2" /> Devolver para IA
                      </Button>
                    )}
                  </div>
                </div>

                <Badge 
                  variant={conversaSelecionada.modo_atendimento === 'humano' ? 'default' : 'secondary'}
                  className="mt-2 w-fit"
                >
                  {conversaSelecionada.modo_atendimento === 'humano' 
                    ? '👤 Você está atendendo' 
                    : '🤖 IA está atendendo'
                  }
                </Badge>
              </CardHeader>

              <CardContent className="p-0">
                {/* MENSAGENS */}
                <ScrollArea className="h-[400px] p-4">
                  <div className="space-y-4">
                    {mensagens.length === 0 ? (
                      <p className="text-center text-muted-foreground text-sm">
                        Nenhuma mensagem ainda
                      </p>
                    ) : (
                      mensagens.map(msg => (
                        <div
                          key={msg.id}
                          className={`flex ${
                            msg.role === 'assistant' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg p-3 ${
                              msg.role === 'assistant'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            <p className={`text-xs mt-1 ${
                              msg.role === 'assistant' ? 'opacity-70' : 'text-muted-foreground'
                            }`}>
                              {new Date(msg.created_at).toLocaleTimeString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                {/* INPUT DE MENSAGEM */}
                {conversaSelecionada.modo_atendimento === 'humano' && (
                  <div className="border-t p-4">
                    <div className="flex gap-2">
                      <Input
                        value={novaMensagem}
                        onChange={(e) => setNovaMensagem(e.target.value)}
                        placeholder="Digite sua mensagem..."
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            enviarMensagem();
                          }
                        }}
                      />
                      <Button
                        onClick={enviarMensagem}
                        disabled={enviando || !novaMensagem.trim()}
                      >
                        {enviando ? '⏳' : <Send className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Enter para enviar • Você está atendendo manualmente
                    </p>
                  </div>
                )}

                {conversaSelecionada.modo_atendimento === 'ia' && (
                  <div className="border-t p-4 bg-muted/50">
                    <p className="text-sm text-center">
                      🤖 IA está respondendo automaticamente.{' '}
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 h-auto"
                        onClick={() => assumirConversa(conversaSelecionada)}
                      >
                        Clique aqui para assumir
                      </Button>
                    </p>
                  </div>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
