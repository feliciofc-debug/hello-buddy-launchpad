import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, User, Clock, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  phone_number: string;
  status: string;
  last_message_at: string;
  transferred_to_human: boolean;
  transferred_at: string | null;
  campanhas_prospeccao: {
    nome: string;
  } | null;
  messages?: Message[];
}

export default function WhatsAppConversations() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['whatsapp-conversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select(`
          *,
          campanhas_prospeccao(nome)
        `)
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      return data as Conversation[];
    },
    refetchInterval: 5000, // Atualizar a cada 5 segundos
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['conversation-messages', selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return [];

      const { data, error } = await supabase
        .from('whatsapp_conversation_messages')
        .select('*')
        .eq('conversation_id', selectedConversation)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!selectedConversation,
    refetchInterval: 3000, // Atualizar mensagens a cada 3 segundos
  });

  // Inscrever-se em novos eventos de mensagens
  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_conversation_messages'
        },
        () => {
          // Forçar atualização das queries
          console.log('Nova mensagem recebida');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'transferred':
        return 'bg-blue-500';
      case 'closed':
        return 'bg-gray-500';
      default:
        return 'bg-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Ativa (IA)';
      case 'transferred':
        return 'Humano';
      case 'closed':
        return 'Fechada';
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>Carregando conversas...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6">
        <h1 className="text-4xl font-bold mb-2">💬 Conversas WhatsApp</h1>
        <p className="text-muted-foreground">
          Acompanhe as conversas com seus leads em tempo real
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Conversas */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Conversas ({conversations?.length || 0})
            </CardTitle>
            <CardDescription>
              Clique em uma conversa para ver os detalhes
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              {conversations?.map((conv) => (
                <div
                  key={conv.id}
                  className={`p-4 cursor-pointer hover:bg-accent transition-colors border-b ${
                    selectedConversation === conv.id ? 'bg-accent' : ''
                  }`}
                  onClick={() => setSelectedConversation(conv.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">{conv.phone_number}</p>
                        <Badge variant="outline" className={`${getStatusColor(conv.status)} text-white text-xs mt-1`}>
                          {getStatusLabel(conv.status)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  {conv.campanhas_prospeccao && (
                    <p className="text-xs text-muted-foreground mb-2">
                      📋 {conv.campanhas_prospeccao.nome}
                    </p>
                  )}

                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {format(new Date(conv.last_message_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </div>

                  {conv.transferred_to_human && conv.transferred_at && (
                    <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                      <ArrowRight className="w-3 h-3" />
                      Transferido {format(new Date(conv.transferred_at), "dd/MM HH:mm", { locale: ptBR })}
                    </div>
                  )}
                </div>
              ))}

              {!conversations?.length && (
                <div className="p-8 text-center text-muted-foreground">
                  Nenhuma conversa encontrada
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Área de Mensagens */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Mensagens</CardTitle>
            <CardDescription>
              {selectedConversation 
                ? 'Acompanhe a conversa em tempo real' 
                : 'Selecione uma conversa para ver as mensagens'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedConversation ? (
              <div className="h-[600px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p>Selecione uma conversa para começar</p>
                </div>
              </div>
            ) : messagesLoading ? (
              <div className="h-[600px] flex items-center justify-center">
                <p className="text-muted-foreground">Carregando mensagens...</p>
              </div>
            ) : (
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-4">
                  {messages?.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-4 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : message.role === 'assistant'
                            ? 'bg-accent'
                            : 'bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {message.role === 'user' ? 'Cliente' : message.role === 'assistant' ? '🤖 IA' : 'Sistema'}
                          </Badge>
                          <span className="text-xs opacity-70">
                            {format(new Date(message.created_at), "HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </div>
                  ))}

                  {!messages?.length && (
                    <div className="text-center text-muted-foreground py-8">
                      Nenhuma mensagem ainda
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
