// ============================================
// PIETRO DASHBOARD - ANALYTICS COMPLETO
// Monitore todas conversas do Pietro Eugenio
// ============================================

import { useState, useEffect } from 'react';
import { Users, MessageSquare, Clock, TrendingUp, Search, Download, Eye, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PietroConversation {
  id: string;
  session_id: string;
  visitor_name: string | null;
  visitor_phone: string | null;
  visitor_email: string | null;
  visitor_company: string | null;
  visitor_ip: string | null;
  interest_score: number | null;
  status: string | null;
  private_notes: string | null;
  created_at: string;
  messages?: { count: number }[];
}

interface PietroMessage {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
}

export default function PietroDashboard() {
  const [conversations, setConversations] = useState<PietroConversation[]>([]);
  const [stats, setStats] = useState({
    total_today: 0,
    total_week: 0,
    total_month: 0,
    active_now: 0,
    avg_messages: 0
  });
  const [selectedConversation, setSelectedConversation] = useState<PietroConversation | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [filter]);

  const loadData = async () => {
    setLoading(true);
    
    let query = supabase
      .from('pietro_conversations')
      .select(`
        *,
        messages:pietro_messages(count)
      `)
      .order('created_at', { ascending: false });
    
    if (filter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query = query.gte('created_at', today.toISOString());
    } else if (filter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.gte('created_at', weekAgo.toISOString());
    } else if (filter === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      query = query.gte('created_at', monthAgo.toISOString());
    }
    
    const { data: convos } = await query;
    setConversations((convos as PietroConversation[]) || []);
    calculateStats((convos as PietroConversation[]) || []);
    setLoading(false);
  };

  const calculateStats = (convos: PietroConversation[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    setStats({
      total_today: convos.filter(c => new Date(c.created_at) >= today).length,
      total_week: convos.filter(c => new Date(c.created_at) >= weekAgo).length,
      total_month: convos.length,
      active_now: convos.filter(c => c.status === 'active').length,
      avg_messages: convos.length > 0 
        ? Math.round(convos.reduce((sum, c) => sum + (c.messages?.[0]?.count || 0), 0) / convos.length)
        : 0
    });
  };

  const filteredConversations = conversations.filter(c => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      c.visitor_name?.toLowerCase().includes(searchLower) ||
      c.visitor_phone?.includes(search) ||
      c.visitor_email?.toLowerCase().includes(searchLower) ||
      c.visitor_company?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            📊 Analytics Pietro Eugenio
          </h1>
          <p className="text-gray-600 mt-2">
            Monitore todas as conversas e prepare-se para reuniões
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-500 text-sm font-medium">Hoje</span>
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {stats.total_today}
            </p>
            <p className="text-gray-500 text-sm">conversas</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-500 text-sm font-medium">Esta Semana</span>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {stats.total_week}
            </p>
            <p className="text-gray-500 text-sm">conversas</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-500 text-sm font-medium">Ativas Agora</span>
              <Clock className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {stats.active_now}
            </p>
            <p className="text-gray-500 text-sm">online</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-500 text-sm font-medium">Média Msgs</span>
              <MessageSquare className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {stats.avg_messages}
            </p>
            <p className="text-gray-500 text-sm">por conversa</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex gap-2">
            {['all', 'today', 'week', 'month'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === f
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f === 'all' ? 'Todas' : f === 'today' ? 'Hoje' : f === 'week' ? '7 dias' : '30 dias'}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, telefone, empresa..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-80"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Visitante</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Contato</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Empresa</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Mensagens</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Iniciou</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Status</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredConversations.map((convo) => (
                <tr key={convo.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                        {convo.visitor_name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {convo.visitor_name || 'Anônimo'}
                        </p>
                        {convo.interest_score && (
                          <p className="text-xs text-green-600">
                            Score: {convo.interest_score}/100
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-sm">
                      {convo.visitor_phone && (
                        <p className="text-gray-600">{convo.visitor_phone}</p>
                      )}
                      {convo.visitor_email && (
                        <p className="text-gray-500">{convo.visitor_email}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-gray-600">
                    {convo.visitor_company || '-'}
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center gap-1 text-gray-600">
                      <MessageSquare className="w-4 h-4" />
                      {convo.messages?.[0]?.count || 0}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <p className="text-sm text-gray-900">
                      {new Date(convo.created_at).toLocaleDateString('pt-BR')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(convo.created_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      convo.status === 'active' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${convo.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                      {convo.status === 'active' ? 'Ativa' : 'Finalizada'}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <button
                      onClick={() => setSelectedConversation(convo)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                    >
                      <Eye className="w-4 h-4" />
                      Ver Detalhes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredConversations.length === 0 && (
            <div className="py-12 text-center text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Nenhuma conversa encontrada</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {selectedConversation && (
        <ConversationModal
          conversation={selectedConversation}
          onClose={() => setSelectedConversation(null)}
        />
      )}
    </div>
  );
}

// ============================================
// MODAL DE DETALHES
// ============================================

function ConversationModal({ 
  conversation, 
  onClose 
}: { 
  conversation: PietroConversation; 
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<PietroMessage[]>([]);
  const [notes, setNotes] = useState(conversation.private_notes || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMessages();
    // Auto-refresh mensagens a cada 5 segundos para capturar novas respostas
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [conversation.id]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from('pietro_messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true });
    
    setMessages((data as PietroMessage[]) || []);
    setLoading(false);
  };

  const saveNotes = async () => {
    await supabase
      .from('pietro_conversations')
      .update({ private_notes: notes })
      .eq('id', conversation.id);
    alert('Notas salvas!');
  };

  const exportConversation = () => {
    const content = `CONVERSA COM PIETRO EUGENIO
=============================

VISITANTE:
Nome: ${conversation.visitor_name || 'Anônimo'}
Telefone: ${conversation.visitor_phone || '-'}
Email: ${conversation.visitor_email || '-'}
Empresa: ${conversation.visitor_company || '-'}
Data: ${new Date(conversation.created_at).toLocaleString('pt-BR')}

MENSAGENS:
${messages.map(m => `
[${m.role === 'user' ? 'VISITANTE' : 'PIETRO'}] ${new Date(m.created_at).toLocaleTimeString('pt-BR')}
${m.content}
`).join('\n---\n')}

NOTAS PRIVADAS:
${notes || 'Nenhuma nota'}`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversa-${conversation.visitor_name || 'anonimo'}.txt`;
    a.click();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              📝 Detalhes da Conversa
            </h2>
            <p className="text-gray-500 text-sm">
              {conversation.visitor_name || 'Anônimo'} • {new Date(conversation.created_at).toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportConversation}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Info */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 mb-3">👤 Informações</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Nome:</span>
                <p className="font-medium">{conversation.visitor_name || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Telefone:</span>
                <p className="font-medium">{conversation.visitor_phone || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Email:</span>
                <p className="font-medium">{conversation.visitor_email || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Empresa:</span>
                <p className="font-medium">{conversation.visitor_company || '-'}</p>
              </div>
            </div>
          </div>

          {/* Mensagens */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">💬 Histórico ({messages.length} mensagens)</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto bg-gray-50 rounded-xl p-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] rounded-xl p-3 ${
                    msg.role === 'user' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-white border border-gray-200'
                  }`}>
                    <p className={`text-xs mb-1 ${msg.role === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                      {msg.role === 'user' ? 'Visitante' : 'Pietro'} •{' '}
                      {new Date(msg.created_at).toLocaleTimeString('pt-BR')}
                    </p>
                    <p className={`text-sm ${msg.role === 'user' ? 'text-white' : 'text-gray-800'}`}>
                      {msg.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notas */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">📋 Notas Privadas</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione notas sobre esta conversa..."
              rows={6}
              className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={saveNotes}
              className="mt-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Salvar Notas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
