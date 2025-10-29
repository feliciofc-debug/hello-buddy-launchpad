"use client";

import { useState, useEffect } from 'react';
import { MessageCircle, Users, Send, Clock, TrendingUp, CheckCircle, AlertCircle, Settings, ArrowLeft, Upload, Eye, Calendar, BarChart3, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Contact {
  name: string;
  phone: string;
  customFields?: Record<string, string>;
}

interface BulkSend {
  id: string;
  campaign_name: string;
  message_template: string;
  total_contacts: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  response_count: number;
  status: string;
  created_at: string;
}

interface GroupMessage {
  id: string;
  message: string;
  sent_at: string;
  status: string;
}

const WhatsAppPage = () => {
  const navigate = useNavigate();
  
  // State para envio em massa
  const [campaignName, setCampaignName] = useState('');
  const [messageTemplate, setMessageTemplate] = useState(
    'Olá {nome}! 👋\n\nConfira esta oferta:\n\n🔥 {produto}\n💰 {preco}\n\n🔗 {link}\n\nNão perca!'
  );
  const [csvText, setCsvText] = useState('');
  const [phoneNumbers, setPhoneNumbers] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [previewMessage, setPreviewMessage] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [loading, setLoading] = useState(false);

  // State para histórico e estatísticas
  const [bulkSends, setBulkSends] = useState<BulkSend[]>([]);
  const [stats, setStats] = useState({
    messagesToday: 0,
    responseRate: 0,
    peakHour: '19h-21h',
    leadsGenerated: 0
  });

  // State para grupos
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);

  // Carregar dados ao montar componente
  useEffect(() => {
    loadBulkSends();
    loadGroups();
    calculateStats();
  }, []);

  const loadBulkSends = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('whatsapp_bulk_sends')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Erro ao carregar envios:', error);
      return;
    }

    setBulkSends(data || []);
  };

  const loadGroups = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('whatsapp_groups')
      .select('*')
      .eq('user_id', user.id)
      .order('member_count', { ascending: false });

    if (error) {
      console.error('Erro ao carregar grupos:', error);
      return;
    }

    setGroups(data || []);
  };

  const calculateStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Mensagens enviadas hoje
    const today = new Date().toISOString().split('T')[0];
    const { data: todayData } = await supabase
      .from('whatsapp_bulk_sends')
      .select('sent_count')
      .eq('user_id', user.id)
      .gte('created_at', today);

    const messagesToday = todayData?.reduce((sum, item) => sum + item.sent_count, 0) || 0;

    // Taxa de resposta (simulado)
    const { data: allSends } = await supabase
      .from('whatsapp_bulk_sends')
      .select('sent_count, response_count')
      .eq('user_id', user.id);

    const totalSent = allSends?.reduce((sum, item) => sum + item.sent_count, 0) || 1;
    const totalResponses = allSends?.reduce((sum, item) => sum + item.response_count, 0) || 0;
    const responseRate = ((totalResponses / totalSent) * 100).toFixed(1);

    setStats({
      messagesToday,
      responseRate: parseFloat(responseRate),
      peakHour: '19h-21h',
      leadsGenerated: totalResponses
    });
  };

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');
    const parsed: Contact[] = [];

    lines.forEach((line, index) => {
      if (index === 0) return; // Skip header
      const [name, phone, ...customFields] = line.split(',').map(s => s.trim());
      if (name && phone) {
        parsed.push({ name, phone });
      }
    });

    return parsed;
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      setContacts(parsed);
      toast.success(`${parsed.length} contatos carregados do CSV`);
    };
    reader.readAsText(file);
  };

  const handlePhoneNumbersChange = (text: string) => {
    setPhoneNumbers(text);
    const lines = text.split('\n').filter(l => l.trim());
    const parsed = lines.map(line => {
      const [name, phone] = line.split(',').map(s => s.trim());
      return { name: name || 'Contato', phone: phone || line };
    });
    setContacts(parsed);
  };

  const generatePreview = () => {
    if (contacts.length === 0) {
      toast.error('Adicione contatos primeiro');
      return;
    }

    const sample = contacts[0];
    let preview = messageTemplate;
    preview = preview.replace(/{nome}/g, sample.name);
    preview = preview.replace(/{telefone}/g, sample.phone);
    
    // Substituir campos customizados de exemplo
    preview = preview.replace(/{produto}/g, 'Produto Exemplo');
    preview = preview.replace(/{preco}/g, 'R$ 99,90');
    preview = preview.replace(/{link}/g, 'https://exemplo.com/produto');

    setPreviewMessage(preview);
    toast.success('Preview gerado!');
  };

  const handleBulkSend = async () => {
    if (contacts.length === 0) {
      toast.error('Adicione contatos para enviar');
      return;
    }

    if (!messageTemplate) {
      toast.error('Defina um template de mensagem');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase.functions.invoke('whatsapp-bulk-send', {
        body: {
          campaignName: campaignName || `Campanha ${new Date().toLocaleDateString()}`,
          messageTemplate,
          contacts,
          scheduledAt: scheduledDate || null
        }
      });

      if (error) throw error;

      toast.success(data.message);
      
      // Limpar formulário
      setCampaignName('');
      setContacts([]);
      setCsvText('');
      setPhoneNumbers('');
      setPreviewMessage('');
      
      // Recarregar histórico
      await loadBulkSends();
      await calculateStats();
    } catch (error: any) {
      console.error('Erro ao enviar:', error);
      toast.error(error.message || 'Erro ao enviar mensagens');
    } finally {
      setLoading(false);
    }
  };

  const loadGroupMessages = async (groupId: string) => {
    const { data, error } = await supabase
      .from('whatsapp_group_messages')
      .select('*')
      .eq('group_id', groupId)
      .order('sent_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Erro ao carregar mensagens:', error);
      return;
    }

    setGroupMessages(data || []);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao Dashboard
        </Button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
              <MessageCircle className="w-7 h-7 text-white" />
            </div>
            WhatsApp Marketing
          </h1>
          <p className="text-muted-foreground">
            Envios em massa e gestão de campanhas WhatsApp
          </p>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>Mensagens Hoje</span>
                <Send className="w-4 h-4 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.messagesToday}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>Taxa de Resposta</span>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.responseRate}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>Horário Pico</span>
                <Clock className="w-4 h-4 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.peakHour}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>Leads Gerados</span>
                <Users className="w-4 h-4 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.leadsGenerated}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="bulk-send" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bulk-send">
              <Send className="w-4 h-4 mr-2" />
              Envio em Massa
            </TabsTrigger>
            <TabsTrigger value="groups">
              <Users className="w-4 h-4 mr-2" />
              Grupos
            </TabsTrigger>
            <TabsTrigger value="history">
              <BarChart3 className="w-4 h-4 mr-2" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* ENVIO EM MASSA */}
          <TabsContent value="bulk-send" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Nova Campanha</CardTitle>
                <CardDescription>
                  Envie mensagens personalizadas para múltiplos contatos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Nome da Campanha */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Nome da Campanha (opcional)
                  </label>
                  <Input
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="Ex: Black Friday Novembro"
                  />
                </div>

                {/* Upload de Contatos */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Adicionar Contatos</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Upload CSV */}
                    <div className="space-y-2">
                      <label className="cursor-pointer">
                        <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-accent transition-colors">
                          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm font-medium">Upload CSV</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Formato: Nome, Telefone
                          </p>
                        </div>
                        <input
                          type="file"
                          accept=".csv"
                          onChange={handleCSVUpload}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Cola números */}
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Ou cole números (um por linha)&#10;João, 11999999999&#10;Maria, 11988888888"
                        rows={6}
                        value={phoneNumbers}
                        onChange={(e) => handlePhoneNumbersChange(e.target.value)}
                      />
                    </div>
                  </div>

                  {contacts.length > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium">
                        {contacts.length} contatos carregados
                      </span>
                    </div>
                  )}
                </div>

                {/* Template de Mensagem */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Template de Mensagem</label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Variáveis disponíveis:{' '}
                    <code className="bg-muted px-2 py-1 rounded">{'{nome}'}</code>{' '}
                    <code className="bg-muted px-2 py-1 rounded">{'{telefone}'}</code>{' '}
                    <code className="bg-muted px-2 py-1 rounded">{'{produto}'}</code>{' '}
                    <code className="bg-muted px-2 py-1 rounded">{'{preco}'}</code>{' '}
                    <code className="bg-muted px-2 py-1 rounded">{'{link}'}</code>
                  </p>
                  <Textarea
                    value={messageTemplate}
                    onChange={(e) => setMessageTemplate(e.target.value)}
                    rows={8}
                    placeholder="Digite sua mensagem..."
                    className="font-mono text-sm"
                  />
                </div>

                {/* Preview e Agendamento */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Preview */}
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      onClick={generatePreview}
                      className="w-full"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Ver Preview
                    </Button>
                    {previewMessage && (
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-xs font-medium mb-2">Preview:</p>
                        <p className="text-sm whitespace-pre-wrap">{previewMessage}</p>
                      </div>
                    )}
                  </div>

                  {/* Agendamento */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Agendamento (opcional)
                    </label>
                    <Input
                      type="datetime-local"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Botão Enviar */}
                <Button
                  onClick={handleBulkSend}
                  disabled={loading || contacts.length === 0}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    'Enviando...'
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Enviar para {contacts.length} contatos
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* GRUPOS */}
          <TabsContent value="groups" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Grupos do WhatsApp</span>
                  <Button size="sm">+ Adicionar Grupo</Button>
                </CardTitle>
                <CardDescription>
                  Gerencie seus grupos e envie mensagens
                </CardDescription>
              </CardHeader>
              <CardContent>
                {groups.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum grupo cadastrado ainda</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {groups.map((group) => (
                      <Card key={group.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                <Users className="w-6 h-6 text-green-600" />
                              </div>
                              <div>
                                <h3 className="font-semibold">{group.group_name}</h3>
                                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                                  <span>{group.member_count} membros</span>
                                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                                    group.status === 'active'
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
                                  }`}>
                                    {group.status === 'active' ? 'Ativo' : 'Inativo'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedGroup(group);
                                  loadGroupMessages(group.id);
                                }}
                              >
                                Ver Mensagens
                              </Button>
                              <Button size="sm">
                                <Send className="w-4 h-4 mr-2" />
                                Enviar
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Últimas mensagens do grupo selecionado */}
            {selectedGroup && groupMessages.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Últimas Mensagens - {selectedGroup.group_name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {groupMessages.map((msg) => (
                      <div key={msg.id} className="p-3 bg-muted rounded-lg">
                        <p className="text-sm">{msg.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(msg.sent_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* HISTÓRICO */}
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Envios</CardTitle>
                <CardDescription>
                  Acompanhe suas campanhas anteriores
                </CardDescription>
              </CardHeader>
              <CardContent>
                {bulkSends.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma campanha enviada ainda</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bulkSends.map((send) => (
                      <Card key={send.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold">
                                {send.campaign_name || 'Sem nome'}
                              </h3>
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                <span>{send.total_contacts} contatos</span>
                                <span>Enviados: {send.sent_count}</span>
                                <span>Respostas: {send.response_count}</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs ${
                                  send.status === 'completed'
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700'
                                    : send.status === 'sending'
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700'
                                    : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {send.status}
                                </span>
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(send.created_at).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default WhatsAppPage;
