import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import pietroImage from '@/assets/pietro-eugenio.png';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  showAvatar?: boolean;
}

// Gerar ID único para sessão
const generateSessionId = () => {
  return `pietro_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

const extractPhone = (text: string) => {
  const digits = text.replace(/\D/g, '');
  // BR: 10-13 dígitos (com/sem 55)
  if (digits.length >= 10 && digits.length <= 13) return digits;
  return null;
};

const extractName = (text: string) => {
  const cleaned = text.trim();
  if (!cleaned) return null;
  // Heurística simples: nome curto, sem muitos números
  if (cleaned.length > 2 && cleaned.length <= 40 && !/\d{2,}/.test(cleaned)) return cleaned;
  return null;
};

export function WhatsAppSupportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId] = useState(() => generateSessionId());
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Olá! 👋 Sou Pietro Eugenio, consultor virtual da AMZ Ofertas!\n\nComo posso te ajudar hoje?\n\n• Funcionalidades da plataforma\n• Planos e preços\n• Formas de pagamento\n• Suporte técnico',
      isUser: false,
      timestamp: new Date(),
      showAvatar: true
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Criar conversa no banco quando chat abre pela primeira vez
  const ensureConversation = async (): Promise<string | null> => {
    if (conversationId) return conversationId;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Para visitante deslogado, a forma mais confiável é via função pública
      const { data, error } = await supabase.functions.invoke('pietro-public', {
        body: {
          action: 'ensure',
          sessionId,
          userAgent: navigator.userAgent,
          visitor_name: (user?.user_metadata as any)?.nome ?? null,
          visitor_email: user?.email ?? null,
          visitor_phone: (user?.user_metadata as any)?.whatsapp ?? null,
          visitor_company: (user?.user_metadata as any)?.empresa ?? null,
          initialMessage: messages[0]?.content ?? null,
        },
      });

      if (error) {
        console.error('[PIETRO] Erro ao criar conversa (public):', error);
        return null;
      }

      const convId = (data as any)?.conversationId as string | undefined;
      if (!convId) {
        console.error('[PIETRO] Função pietro-public não retornou conversationId:', data);
        return null;
      }

      setConversationId(convId);
      return convId;
    } catch (err) {
      console.error('[PIETRO] Erro ao criar conversa:', err);
      return null;
    }
  };

  // Garantir que a conversa exista assim que o chat abrir (para não perder conversas)
  useEffect(() => {
    if (!isOpen) return;
    void ensureConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Salvar mensagem no banco
  const saveMessage = async (convId: string, role: 'user' | 'assistant', content: string) => {
    try {
      const extracted = role === 'user'
        ? { name: extractName(content), phone: extractPhone(content) }
        : undefined;

      const { error } = await supabase.functions.invoke('pietro-public', {
        body: {
          action: 'message',
          conversationId: convId,
          role,
          content,
          extracted,
        },
      });

      if (error) {
        console.error('[PIETRO] Erro ao salvar mensagem (public):', error);
      }
    } catch (err) {
      console.error('[PIETRO] Erro ao salvar mensagem:', err);
    }
  };
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageToSend = inputMessage;
    setInputMessage('');
    setIsLoading(true);

    // Garantir que conversa existe
    const convId = await ensureConversation();
    
    // Salvar mensagem do usuário
    if (convId) {
      await saveMessage(convId, 'user', messageToSend);
    }

    try {
      console.log('[CHAT] Enviando mensagem:', messageToSend);
      
      const { data, error } = await supabase.functions.invoke('atendimento-suporte', {
        body: { 
          message: messageToSend,
          conversationHistory: messages.map(m => ({
            role: m.isUser ? 'user' : 'assistant',
            content: m.content
          }))
        }
      });

      console.log('[CHAT] Resposta recebida:', data);
      console.log('[CHAT] Erro:', error);

      if (error) throw error;

      const responseText = data?.response || data?.message || (typeof data === 'string' ? data : null);
      
      if (!responseText) {
        console.error('[CHAT] Resposta vazia ou inválida:', data);
        throw new Error('Resposta vazia');
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: responseText,
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);

      // Salvar resposta do Pietro
      if (convId) {
        await saveMessage(convId, 'assistant', responseText);
      }
    } catch (error) {
      console.error('[CHAT] Erro ao enviar mensagem:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Ops! Tive um problema técnico. Por favor, tente novamente ou entre em contato pelo WhatsApp: (21) 99537-9550',
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);

      // Salvar erro também
      if (convId) {
        await saveMessage(convId, 'assistant', errorMessage.content);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Botão flutuante do WhatsApp */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-[9999] w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110"
        aria-label="Abrir chat de suporte"
      >
        {isOpen ? (
          <X className="w-7 h-7 text-white" />
        ) : (
          <svg viewBox="0 0 24 24" className="w-9 h-9 text-white fill-current">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[9999] w-96 max-w-[calc(100vw-48px)] bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-lg">AMZ Ofertas</h3>
                <p className="text-sm text-green-100">Suporte Online • Resposta imediata</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="h-80 overflow-y-auto p-4 bg-gray-50">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Avatar do Pietro na primeira mensagem */}
                  {message.showAvatar && !message.isUser && (
                    <div className="flex-shrink-0 mr-2">
                      <img 
                        src={pietroImage} 
                        alt="Pietro Eugenio" 
                        className="w-12 h-12 rounded-full object-cover border-2 border-green-500 bg-white"
                      />
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] p-3 rounded-2xl ${
                      message.isUser
                        ? 'bg-green-500 text-white rounded-br-md'
                        : 'bg-white text-gray-800 rounded-bl-md shadow-sm border border-gray-100'
                    }`}
                  >
                    {message.showAvatar && !message.isUser && (
                      <p className="text-xs font-semibold text-green-600 mb-1">Pietro Eugenio</p>
                    )}
                    <p className="text-sm whitespace-pre-line">{message.content}</p>
                    <p className={`text-xs mt-1 ${message.isUser ? 'text-green-100' : 'text-gray-400'}`}>
                      {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white p-3 rounded-2xl rounded-bl-md shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-green-500" />
                      <span className="text-sm text-gray-500">Digitando...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t border-gray-100 relative z-[10000]">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Digite sua dúvida..."
                className="flex-1 h-10 px-3 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-md focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 disabled:opacity-50"
                disabled={isLoading}
                autoComplete="off"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="bg-green-500 hover:bg-green-600 text-white rounded-full w-10 h-10 p-0"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              WhatsApp: (21) 99537-9550
            </p>
            <p className="text-xs text-gray-400 text-center">
              Email: amzofertas@amzofertas.com.br
            </p>
          </div>
        </div>
      )}
    </>
  );
}
