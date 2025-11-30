import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { 
  MessageSquare, 
  Send, 
  Bot, 
  User, 
  LogOut, 
  Phone,
  Clock,
  CheckCircle2
} from 'lucide-react';

interface VendedorSession {
  id: string;
  nome: string;
  email: string;
  especialidade: string;
}

interface Conversa {
  id: string;
  phone_number: string;
  contact_name: string | null;
  modo_atendimento: string;
  last_message_at: string | null;
  metadata: any;
  origem: string | null;
  tipo_contato: string | null;
}

interface Mensagem {
  id: string;
  content: string;
  role: string;
  created_at: string;
}

export default function VendedorPainel() {
  const navigate = useNavigate();
  const [vendedor, setVendedor] = useState<VendedorSession | null>(null);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaSelecionada, setConversaSelecionada] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [inputMensagem, setInputMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [stats, setStats] = useState({ total: 0, ia: 0, humano: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const session = localStorage.getItem('vendedor_session');
    if (!session) {
      navigate('/vendedor-login');
      return;
    }
    
    const vendedorData = JSON.parse(session);
    setVendedor(vendedorData);
    carregarConversas(vendedorData.id);

    const interval = setInterval(() => {
      carregarConversas(vendedorData.id);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (conversaSelecionada) {
      carregarMensagens(conversaSelecionada.id);
      const interval = setInterval(() => {
        carregarMensagens(conversaSelecionada.id);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [conversaSelecionada]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  const carregarConversas = async (vendedorId: string) => {
    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select('id, phone_number, contact_name, modo_atendimento, last_message_at, metadata, origem, tipo_contato')
      .eq('vendedor_id', vendedorId)
      .order('last_message_at', { ascending: false });

    if (!error && data) {
      setConversas(data as Conversa[]);
      setStats({
        total: data.length,
        ia: data.filter(c => c.modo_atendimento === 'ia').length,
        humano: data.filter(c => c.modo_atendimento === 'humano').length
      });
    }
  };

  const carregarMensagens = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('whatsapp_conversation_messages')
      .select('id, content, role, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMensagens(data as Mensagem[]);
    }
  };

  const assumirConversa = async (conversa: Conversa) => {
    await supabase
      .from('whatsapp_conversations')
      .update({ 
        modo_atendimento: 'humano',
        updated_at: new Date().toISOString()
      })
      .eq('id', conversa.id);

    toast.success('Conversa assumida! A IA não responderá mais.');
    if (vendedor) carregarConversas(vendedor.id);
  };

  const devolverParaIA = async (conversa: Conversa) => {
    await supabase
      .from('whatsapp_conversations')
      .update({ 
        modo_atendimento: 'ia',
        updated_at: new Date().toISOString()
      })
      .eq('id', conversa.id);

    toast.success('Conversa devolvida para a IA');
    if (vendedor) carregarConversas(vendedor.id);
  };

  const enviarMensagem = async () => {
    if (!inputMensagem.trim() || !conversaSelecionada || !vendedor) return;

    setEnviando(true);
    try {
      const { error: sendError } = await supabase.functions.invoke('send-wuzapi-message', {
        body: {
          phone: conversaSelecionada.phone_number,
          message: inputMensagem,
          userId: vendedor.id
        }
      });

      if (sendError) throw sendError;

      await supabase.from('whatsapp_conversation_messages').insert({
        conversation_id: conversaSelecionada.id,
        content: inputMensagem,
        role: 'assistant',
        metadata: { sent_by_vendedor: vendedor.nome }
      });

      await supabase
        .from('whatsapp_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversaSelecionada.id);

      setInputMensagem('');
      carregarMensagens(conversaSelecionada.id);
      toast.success('Mensagem enviada!');
    } catch (err) {
      console.error('Erro ao enviar:', err);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setEnviando(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('vendedor_session');
    navigate('/vendedor-login');
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

  if (!vendedor) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
              {vendedor.nome.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-bold text-lg">{vendedor.nome}</h1>
              <p className="text-sm text-muted-foreground">{vendedor.especialidade || 'Vendedor'}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <p className="font-bold text-xl">{stats.total}</p>
                <p className="text-muted-foreground">Conversas</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-xl text-green-500">{stats.ia}</p>
                <p className="text-muted-foreground">Com IA</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-xl text-blue-500">{stats.humano}</p>
                <p className="text-muted-foreground">Assumidas</p>
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        <div className="w-80 border-r bg-card">
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Minhas Conversas
            </h2>
          </div>

          <ScrollArea className="h-[calc(100vh-140px)]">
            {conversas.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma conversa atribuída</p>
              </div>
            ) : (
              conversas.map(conversa => (
                <div
                  key={conversa.id}
                  onClick={() => setConversaSelecionada(conversa)}
                  className={`p-4 border-b cursor-pointer hover:bg-accent transition-colors ${
                    conversaSelecionada?.id === conversa.id ? 'bg-accent' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {(conversa.contact_name || conversa.phone_number).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">
                          {conversa.contact_name || formatPhone(conversa.phone_number)}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {formatPhone(conversa.phone_number)}
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant={conversa.modo_atendimento === 'ia' ? 'secondary' : 'default'}
                      className="text-xs"
                    >
                      {conversa.modo_atendimento === 'ia' ? (
                        <><Bot className="w-3 h-3 mr-1" /> IA</>
                      ) : (
                        <><User className="w-3 h-3 mr-1" /> Você</>
                      )}
                    </Badge>
                  </div>
                  {conversa.last_message_at && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(conversa.last_message_at).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
              ))
            )}
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col">
          {conversaSelecionada ? (
            <>
              <div className="p-4 border-b bg-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {(conversaSelecionada.contact_name || conversaSelecionada.phone_number).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">
                      {conversaSelecionada.contact_name || formatPhone(conversaSelecionada.phone_number)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatPhone(conversaSelecionada.phone_number)}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  {conversaSelecionada.modo_atendimento === 'ia' ? (
                    <Button size="sm" onClick={() => assumirConversa(conversaSelecionada)}>
                      <User className="w-4 h-4 mr-2" />
                      Assumir Conversa
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => devolverParaIA(conversaSelecionada)}>
                      <Bot className="w-4 h-4 mr-2" />
                      Devolver para IA
                    </Button>
                  )}
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {mensagens.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'assistant' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                          msg.role === 'assistant'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p className={`text-xs mt-1 ${
                          msg.role === 'assistant' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        }`}>
                          {new Date(msg.created_at).toLocaleTimeString('pt-BR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {conversaSelecionada.modo_atendimento === 'humano' && (
                <div className="p-4 border-t bg-card">
                  <div className="flex gap-2">
                    <Input
                      value={inputMensagem}
                      onChange={(e) => setInputMensagem(e.target.value)}
                      placeholder="Digite sua mensagem..."
                      onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && enviarMensagem()}
                      disabled={enviando}
                    />
                    <Button onClick={enviarMensagem} disabled={enviando || !inputMensagem.trim()}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    Você assumiu esta conversa. A IA não responderá automaticamente.
                  </p>
                </div>
              )}

              {conversaSelecionada.modo_atendimento === 'ia' && (
                <div className="p-4 border-t bg-muted/50 text-center">
                  <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <Bot className="w-4 h-4" />
                    A IA está respondendo automaticamente. Clique em "Assumir Conversa" para responder manualmente.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Selecione uma conversa</p>
                <p className="text-sm">Clique em uma conversa à esquerda para visualizar</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
