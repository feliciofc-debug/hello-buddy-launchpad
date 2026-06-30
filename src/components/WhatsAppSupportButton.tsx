import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, MessageCircle } from 'lucide-react';
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

// WhatsApp comercial do agente IA (exibido como contato direto no rodapé do chat)
const FOUNDER_WHATSAPP_DISPLAY = '(21) 98080-4901';
const FOUNDER_WHATSAPP_LINK = 'https://wa.me/5521980804901';

const generateSessionId = () =>
  `pietro_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

const INITIAL_MESSAGE =
  'Olá! 👋 Sou Pietro Eugênio, consultor virtual da AMZ Ofertas!\n\nComo posso te ajudar hoje?\n\n• Funcionalidades da plataforma\n• Planos e preços\n• Formas de pagamento\n• Suporte técnico';

export function WhatsAppSupportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId] = useState(generateSessionId);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: INITIAL_MESSAGE,
      isUser: false,
      timestamp: new Date(),
      showAvatar: true,
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const ensureConversation = async (): Promise<string | null> => {
    if (conversationId) return conversationId;
    try {
      const { data, error } = await supabase.functions.invoke('pietro-public', {
        body: {
          action: 'ensure',
          sessionId,
          userAgent: navigator.userAgent,
          initialMessage: INITIAL_MESSAGE,
        },
      });
      if (error) throw error;
      const id = (data as any)?.conversationId ?? null;
      if (id) setConversationId(id);
      return id;
    } catch (err) {
      console.error('[PIETRO] erro ao criar conversa', err);
      return null;
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void ensureConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const persistMessage = async (
    convId: string,
    role: 'user' | 'assistant',
    content: string
  ) => {
    try {
      await supabase.functions.invoke('pietro-public', {
        body: { action: 'message', conversationId: convId, role, content },
      });
    } catch (err) {
      console.error('[PIETRO] erro ao salvar mensagem', err);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageToSend = inputMessage;
    setInputMessage('');
    setIsLoading(true);

    const convId = await ensureConversation();
    if (convId) await persistMessage(convId, 'user', messageToSend);

    try {
      const { data, error } = await supabase.functions.invoke('atendimento-suporte', {
        body: {
          message: messageToSend,
          conversationHistory: messages.map((m) => ({
            role: m.isUser ? 'user' : 'assistant',
            content: m.content,
          })),
        },
      });

      if (error) throw error;

      const responseText =
        (data as any)?.response ||
        (data as any)?.message ||
        (typeof data === 'string' ? data : null);

      if (!responseText) throw new Error('Resposta vazia');

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: responseText,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);

      if (convId) await persistMessage(convId, 'assistant', responseText);
    } catch (err) {
      console.error('[CHAT] erro', err);
      const fallback: Message = {
        id: (Date.now() + 1).toString(),
        content:
          'Ops! Tive um problema técnico. Por favor, tente novamente em instantes.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, fallback]);
      if (convId) await persistMessage(convId, 'assistant', fallback.content);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Botão Chat com Pietro Eugênio */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-[9999] w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110"
        aria-label={isOpen ? 'Fechar chat' : 'Falar com Pietro Eugênio'}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <MessageCircle className="w-7 h-7 text-white" />
        )}
      </button>

      {/* Janela do chat */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[9999] w-96 max-w-[calc(100vw-48px)] bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-white">
            <div className="flex items-center gap-3">
              <img
                src={pietroImage}
                alt="Pietro Eugênio"
                className="w-12 h-12 rounded-full object-cover border-2 border-white bg-white"
              />
              <div>
                <h3 className="font-bold text-lg">Pietro Eugênio</h3>
                <p className="text-sm text-blue-100">Consultor AMZ Ofertas • Online</p>
              </div>
            </div>
          </div>

          {/* Faixa de contato direto via WhatsApp pessoal */}
          <a
            href={FOUNDER_WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-green-50 hover:bg-green-100 border-b border-green-200 py-2 text-sm text-green-800 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            <span>
              Prefere falar direto? WhatsApp{' '}
              <strong>{FOUNDER_WHATSAPP_DISPLAY}</strong>
            </span>
          </a>

          <div className="h-80 overflow-y-auto p-4 bg-gray-50">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {message.showAvatar && !message.isUser && (
                    <div className="flex-shrink-0 mr-2">
                      <img
                        src={pietroImage}
                        alt="Pietro Eugênio"
                        className="w-10 h-10 rounded-full object-cover border-2 border-blue-500 bg-white"
                      />
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] p-3 rounded-2xl ${
                      message.isUser
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-white text-gray-800 rounded-bl-md shadow-sm border border-gray-100'
                    }`}
                  >
                    {message.showAvatar && !message.isUser && (
                      <p className="text-xs font-semibold text-blue-600 mb-1">
                        Pietro Eugênio
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-line">{message.content}</p>
                    <p
                      className={`text-xs mt-1 ${
                        message.isUser ? 'text-blue-100' : 'text-gray-400'
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white p-3 rounded-2xl rounded-bl-md shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span className="text-sm text-gray-500">Digitando...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="p-4 bg-white border-t border-gray-100">
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
                className="flex-1 h-10 px-3 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                disabled={isLoading}
                autoComplete="off"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full w-10 h-10 p-0"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
