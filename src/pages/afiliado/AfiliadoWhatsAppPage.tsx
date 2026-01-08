"use client";

import { useState, useEffect } from 'react';
import { MessageCircle, Users, Send, Clock, TrendingUp, CheckCircle, AlertCircle, Settings, ArrowLeft, Upload, Eye, Calendar, BarChart3, Trash2, Copy, Activity } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { WhatsAppDiagnostics } from '@/components/WhatsAppDiagnostics';
import { AddGroupModal } from '@/components/AddGroupModal';
import WhatsAppContactManager from '@/components/WhatsAppContactManager';

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

const AfiliadoWhatsAppPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Receber dados do IA Marketing (se vier de lá)
  const iaMarketingData = location.state as {
    messageTemplate?: string;
    productImage?: string;
    productTitle?: string;
    campaignName?: string;
    fromIAMarketing?: boolean;
  } | null;
  
  // State para envio em massa
  const [campaignName, setCampaignName] = useState('');
  const [messageTemplate, setMessageTemplate] = useState(
    'Olá {nome}! 👋\n\nTenho uma novidade incrível para você!'
  );
  const [csvText, setCsvText] = useState('');
  const [phoneNumbers, setPhoneNumbers] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [previewMessage, setPreviewMessage] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [productImage, setProductImage] = useState<string | null>(null);

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
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [reloadContactsTrigger, setReloadContactsTrigger] = useState(0);
  
  // State para contatos selecionados no manager
  const [selectedContactPhones, setSelectedContactPhones] = useState<string[]>([]);
  
  // State para campo de números direto
  const [directPhoneNumbers, setDirectPhoneNumbers] = useState<string>('');

  // Estados para modais de lista
  const [viewListData, setViewListData] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [editListData, setEditListData] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNumbers, setEditNumbers] = useState('');

  // Carregar dados ao montar componente
  useEffect(() => {
    loadBulkSends();
    loadGroups();
    calculateStats();
    
    // Se vier do IA Marketing, preencher automaticamente
    if (iaMarketingData?.fromIAMarketing) {
      if (iaMarketingData.messageTemplate) {
        setMessageTemplate(iaMarketingData.messageTemplate);
      }
      if (iaMarketingData.campaignName) {
        setCampaignName(iaMarketingData.campaignName);
      }
      if (iaMarketingData.productImage) {
        setProductImage(iaMarketingData.productImage);
      }
      
      toast.success('✅ Mensagem do IA Marketing carregada! Agora escolha os grupos ou contatos.');
    }
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
    setIsLoadingGroups(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsLoadingGroups(false);
      return;
    }

    // Buscar listas da tabela whatsapp_groups (listas manuais)
    const { data: manualGroups, error: manualError } = await supabase
      .from('whatsapp_groups')
      .select('*')
      .eq('user_id', user.id)
      .order('member_count', { ascending: false });

    if (manualError) {
      console.error('Erro ao carregar grupos manuais:', manualError);
    }

    // Buscar listas automáticas por categoria
    const { data: autoListas, error: autoError } = await supabase
      .from('afiliado_listas_categoria')
      .select('*')
      .eq('ativa', true)
      .order('total_membros', { ascending: false });

    if (autoError) {
      console.error('Erro ao carregar listas automáticas:', autoError);
    }

    // Para cada lista automática, buscar os telefones dos membros
    const listasComTelefones = await Promise.all(
      (autoListas || []).map(async (lista) => {
        const { data: membros } = await supabase
          .from('afiliado_lista_membros')
          .select('lead_id')
          .eq('lista_id', lista.id);
        
        // Buscar telefones dos leads
        const leadIds = membros?.map(m => m.lead_id) || [];
        let phoneNumbers: string[] = [];
        
        if (leadIds.length > 0) {
          const { data: leads } = await supabase
            .from('leads_ebooks')
            .select('phone')
            .in('id', leadIds);
          
          phoneNumbers = leads?.map(l => l.phone) || [];
        }
        
        return {
          id: lista.id,
          group_id: lista.id,
          group_name: `📂 ${lista.nome}`,
          member_count: lista.total_membros || 0,
          phone_numbers: phoneNumbers,
          is_auto_list: true,
          cor: lista.cor,
          icone: lista.icone,
          descricao: lista.descricao
        };
      })
    );

    // Combinar listas manuais + automáticas
    const todasListas = [
      ...listasComTelefones.filter(l => l.member_count > 0), // Só mostrar listas com membros
      ...(manualGroups || []).map(g => ({
        ...g,
        is_auto_list: false
      }))
    ];

    setGroups(todasListas);
    setIsLoadingGroups(false);
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

  const handlePhoneNumbersChange = async (text: string) => {
    setPhoneNumbers(text);
    const lines = text.split('\n').filter(l => l.trim());
    const parsed = lines.map(line => {
      const [name, phone] = line.split(',').map(s => s.trim());
      return { name: name || 'Contato', phone: phone || line };
    });
    setContacts(parsed);
  };

  // Funções de seleção de contatos
  const toggleContact = (phone: string) => {
    setSelectedContacts(prev => {
      if (prev.includes(phone)) {
        return prev.filter(p => p !== phone);
      }
      return [...prev, phone];
    });
  };

  const selectAllContacts = () => {
    setSelectedContacts(contacts.map(c => c.phone));
  };

  const clearContactSelection = () => {
    setSelectedContacts([]);
  };

  // Funções de seleção de grupos
  const toggleGroup = (groupId: string) => {
    setSelectedGroups(prev => {
      if (prev.includes(groupId)) {
        return prev.filter(id => id !== groupId);
      }
      return [...prev, groupId];
    });
  };

  const selectAllGroups = () => {
    setSelectedGroups(groups.map(g => g.group_id));
  };

  const clearGroupSelection = () => {
    setSelectedGroups([]);
  };

  // Selecionar todos (contatos + grupos)
  const selectAll = () => {
    setSelectedContacts(contacts.map(c => c.phone));
    setSelectedGroups(groups.map(g => g.group_id));
  };

  const clearAllSelections = () => {
    setSelectedContacts([]);
    setSelectedGroups([]);
  };

  // Funções para gerenciar listas
  const handleViewList = (list: any) => {
    setViewListData(list);
    setIsViewModalOpen(true);
  };

  const handleEditList = (list: any) => {
    setEditListData(list);
    setEditName(list.group_name);
    setEditNumbers(list.phone_numbers?.join('\n') || '');
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    try {
      const numbers = editNumbers
        .split(/[\s,;\n]+/)
        .map(n => n.replace(/\D/g, ''))
        .filter(n => n.length >= 10)
        .map(n => n.length < 13 ? '55' + n : n);

      const { error } = await supabase
        .from('whatsapp_groups')
        .update({
          group_name: editName,
          phone_numbers: numbers,
          member_count: numbers.length
        })
        .eq('id', editListData.id);

      if (error) throw error;

      toast.success('Lista atualizada!');
      setIsEditModalOpen(false);
      loadGroups();

    } catch (error) {
      console.error('Erro ao atualizar lista:', error);
      toast.error('Erro ao atualizar lista');
    }
  };

  const handleDeleteList = async (listId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta lista?')) return;

    try {
      const { error } = await supabase
        .from('whatsapp_groups')
        .delete()
        .eq('id', listId);

      if (error) throw error;

      toast.success('Lista excluída!');
      loadGroups();

    } catch (error) {
      console.error('Erro ao excluir lista:', error);
      toast.error('Erro ao excluir lista');
    }
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
    // Processar números do campo direto
    const directPhones = directPhoneNumbers
      .split(/[,\n]/)
      .map(p => p.trim().replace(/\D/g, ''))
      .filter(p => p.length >= 10);

    // Combinar todas as fontes de números
    const allPhones = [
      ...selectedContacts,
      ...selectedContactPhones,
      ...directPhones
    ];

    // Remover duplicatas
    const uniquePhones = [...new Set(allPhones)];

    console.log('📱 NÚMEROS PARA ENVIAR:', uniquePhones);

    if (uniquePhones.length === 0 && selectedGroups.length === 0) {
      toast.error('Selecione pelo menos um contato ou grupo, ou digite um número');
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

      // 🔥 SE IMAGEM É BASE64, FAZER UPLOAD PARA STORAGE PRIMEIRO
      let finalImageUrl: string | null = productImage;
      
      if (productImage && productImage.startsWith('data:')) {
        console.log('📸 Detectado base64, fazendo upload para storage...');
        toast.info('📤 Enviando imagem para o servidor...');
        
        try {
          // Extrair tipo e dados do base64
          const matches = productImage.match(/^data:(.+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const mimeType = matches[1];
            const base64Data = matches[2];
            const extension = mimeType.split('/')[1] || 'png';
            const fileName = `whatsapp-images/${user.id}/${Date.now()}.${extension}`;
            
            // Converter base64 para Blob
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });
            
            // Upload para storage público
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('produtos')
              .upload(fileName, blob, {
                contentType: mimeType,
                upsert: true,
              });

            if (uploadError) {
              console.error('❌ Erro no upload:', uploadError);
              toast.error('Erro ao enviar imagem, enviando só texto');
              finalImageUrl = null;
            } else {
              // Gerar URL pública
              const { data: publicUrlData } = supabase.storage
                .from('produtos')
                .getPublicUrl(fileName);
              
              finalImageUrl = publicUrlData?.publicUrl || null;
              console.log('✅ Imagem uploaded:', finalImageUrl);
            }
          }
        } catch (uploadErr) {
          console.error('❌ Erro ao processar base64:', uploadErr);
          finalImageUrl = null;
        }
      }

      // VERIFICAR SE É AGENDAMENTO
      if (scheduledDate) {
        const { error: scheduleError } = await supabase
          .from('whatsapp_bulk_sends')
          .insert({
            user_id: user.id,
            campaign_name: campaignName || 'Campanha sem nome',
            message_template: messageTemplate,
            total_contacts: uniquePhones.length + selectedGroups.length,
            scheduled_at: scheduledDate,
            status: 'scheduled',
            sent_count: 0,
            delivered_count: 0,
            read_count: 0,
            response_count: 0
          });

        if (scheduleError) throw scheduleError;

        toast.success(`✅ Envio agendado para ${new Date(scheduledDate).toLocaleString('pt-BR')}!`);
        
        setCampaignName('');
        setMessageTemplate('Olá {nome}! 👋\n\nTenho uma novidade incrível para você!');
        setContacts([]);
        setCsvText('');
        setPhoneNumbers('');
        setDirectPhoneNumbers('');
        setScheduledDate('');
        setPreviewMessage('');
        clearAllSelections();
        setSelectedContactPhones([]);
        setProductImage(null);
        
        await loadBulkSends();
        setLoading(false);
        return;
      }

      const results = [];
      
      // Coletar números das listas selecionadas
      let listPhones: string[] = [];
      if (selectedGroups.length > 0) {
        const { data: lists, error: listError } = await supabase
          .from('whatsapp_groups')
          .select('phone_numbers, group_name')
          .in('group_id', selectedGroups);

        if (!listError && lists) {
          lists.forEach(list => {
            if (list.phone_numbers) {
              listPhones.push(...list.phone_numbers);
            }
          });
        }
      }

      // Combinar números de todas as fontes
      const allNumbers = [...new Set([...uniquePhones, ...listPhones])];
      
      // Enviar para TODOS os números únicos
      for (const phone of allNumbers) {
        try {
          const { data: savedContact } = await supabase
            .from('whatsapp_contacts')
            .select('nome')
            .eq('phone', phone)
            .eq('user_id', user.id)
            .maybeSingle();

          const contact = contacts.find(c => c.phone === phone);
          const contactName = savedContact?.nome || contact?.name || `Contato ${phone.slice(-4)}`;

          let personalizedMessage = messageTemplate;
          personalizedMessage = personalizedMessage.replace(/{nome}/g, contactName);
          personalizedMessage = personalizedMessage.replace(/{telefone}/g, phone);
          
          // Usa wuzapi-send que busca token na tabela clientes_afiliados
          const { data, error } = await supabase.functions.invoke('wuzapi-send', {
            body: {
              phone: phone,
              message: personalizedMessage,
              ...(finalImageUrl && { imageUrl: finalImageUrl })
            }
          });

          results.push({
            phone: phone,
            success: !error && data?.success,
            error: error?.message
          });

          await new Promise(r => setTimeout(r, 500));

        } catch (err) {
          results.push({
            phone: phone,
            success: false,
            error: err instanceof Error ? err.message : 'Erro'
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;
      
      if (successCount > 0) {
        toast.success(`✅ ${successCount} enviadas${failCount > 0 ? `, ${failCount} falharam` : ''}!`);
        
        try {
          for (const phone of allNumbers) {
            await supabase
              .from('whatsapp_contacts')
              .upsert({
                user_id: user.id,
                phone: phone,
                nome: `Contato ${phone.slice(-4)}`,
                origem: 'envio_mensagem',
                last_interaction: new Date().toISOString()
              }, {
                onConflict: 'user_id,phone',
                ignoreDuplicates: true
              });
          }
          
          setReloadContactsTrigger(prev => prev + 1);
        } catch (error) {
          console.error('Erro ao salvar contatos:', error);
        }
      } else {
        toast.error('Nenhuma mensagem enviada');
      }
      
      setCampaignName('');
      setContacts([]);
      setCsvText('');
      setPhoneNumbers('');
      setDirectPhoneNumbers('');
      setPreviewMessage('');
      clearAllSelections();
      setSelectedContactPhones([]);
      
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
          onClick={() => navigate('/afiliado/dashboard')}
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
          <TabsList className="grid w-full grid-cols-4">
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
            <TabsTrigger value="diagnostics">
              <Activity className="w-4 h-4 mr-2" />
              Diagnóstico
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

                {/* Gerenciador de Contatos */}
                <Card className="border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-base">
                      📞 Seus Contatos
                      {selectedContactPhones.length > 0 && (
                        <span className="ml-2 text-sm font-normal text-primary">
                          ({selectedContactPhones.length} selecionados)
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Marque os contatos que deseja incluir na campanha
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <WhatsAppContactManager
                      selectedContacts={selectedContactPhones}
                      onContactsChange={setSelectedContactPhones}
                      reloadTrigger={reloadContactsTrigger}
                    />
                  </CardContent>
                </Card>

                {/* TABS: Selecionar Destinatários */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Destinatários
                      </span>
                      <span className="text-sm font-normal text-muted-foreground">
                        {selectedContacts.length + selectedGroups.length} selecionados
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="contacts" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="contacts">
                          Contatos ({contacts.length})
                        </TabsTrigger>
                        <TabsTrigger value="groups">
                          Grupos ({groups.length})
                        </TabsTrigger>
                        <TabsTrigger value="all">
                          Todos
                        </TabsTrigger>
                      </TabsList>

                      {/* TAB: Contatos */}
                      <TabsContent value="contacts" className="space-y-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={selectAllContacts} className="flex-1">
                            Selecionar Todos
                          </Button>
                          <Button size="sm" variant="outline" onClick={clearContactSelection} className="flex-1">
                            Limpar
                          </Button>
                        </div>

                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {contacts.length === 0 ? (
                            <div className="text-center py-8">
                              <Users className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-50" />
                              <p className="text-sm text-muted-foreground">
                                Nenhum contato carregado. Adicione contatos acima.
                              </p>
                            </div>
                          ) : (
                            contacts.map((contact, idx) => {
                              const isSelected = selectedContacts.includes(contact.phone);
                              return (
                                <div 
                                  key={`${contact.phone}-${idx}`}
                                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent cursor-pointer"
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedContacts(selectedContacts.filter(p => p !== contact.phone));
                                    } else {
                                      setSelectedContacts([...selectedContacts, contact.phone]);
                                    }
                                  }}
                                >
                                  <div className={`w-5 h-5 border-2 rounded flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-input'}`}>
                                    {isSelected && (
                                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>

                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{contact.name}</p>
                                    <p className="text-xs text-muted-foreground">{contact.phone}</p>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </TabsContent>

                      {/* TAB: Listas de Transmissão */}
                      <TabsContent value="groups" className="space-y-3">
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="default" 
                            onClick={() => setShowAddGroupModal(true)} 
                            className="flex-1"
                          >
                            ➕ Criar Lista
                          </Button>
                          <Button size="sm" variant="outline" onClick={selectAllGroups} className="flex-1">
                            Selecionar Todas
                          </Button>
                          <Button size="sm" variant="outline" onClick={clearGroupSelection} className="flex-1">
                            Limpar
                          </Button>
                        </div>

                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {isLoadingGroups ? (
                            <div className="text-center py-8">
                              <div className="h-6 w-6 animate-spin mx-auto border-4 border-primary border-t-transparent rounded-full" />
                            </div>
                          ) : groups.length === 0 ? (
                            <div className="text-center py-8">
                              <Users className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-50" />
                              <p className="text-sm font-medium text-muted-foreground mb-2">
                                Nenhuma lista cadastrada
                              </p>
                              <p className="text-xs text-muted-foreground mb-3">
                                Clique em "➕ Criar Lista" acima para criar sua primeira lista de transmissão
                              </p>
                              <Button size="sm" variant="outline" onClick={loadGroups}>
                                🔄 Atualizar
                              </Button>
                            </div>
                          ) : (
                            groups.map((group) => {
                              const isSelected = selectedGroups.includes(group.group_id);
                              return (
                                <div
                                  key={`${group.group_id}-${group.id}`}
                                  className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent/50"
                                >
                                  <div 
                                    className={`w-5 h-5 border-2 rounded flex items-center justify-center cursor-pointer ${isSelected ? 'bg-primary border-primary' : 'border-input'}`}
                                    onClick={() => toggleGroup(group.group_id)}
                                  >
                                    {isSelected && (
                                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>

                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{group.group_name}</p>
                                    <p className="text-xs text-muted-foreground">{group.member_count} contatos</p>
                                  </div>

                                  <div className="flex gap-1">
                                    <Button size="sm" variant="ghost" onClick={() => handleViewList(group)}>
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => handleEditList(group)}>
                                      ✏️
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => handleDeleteList(group.id)}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </TabsContent>

                      {/* TAB: Resumo de todos */}
                      <TabsContent value="all" className="space-y-3">
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <h4 className="font-medium mb-3">📊 Resumo</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span>👤 Contatos</span>
                              <span className="font-bold">{contacts.length}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>👥 Grupos</span>
                              <span className="font-bold">{groups.length}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-primary/10 rounded font-bold">
                              <span>📨 Total de destinatários</span>
                              <span className="text-primary">{contacts.length + groups.length}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button 
                            onClick={selectAll}
                            className="flex-1"
                            variant="outline"
                          >
                            Selecionar Todos
                          </Button>
                          <Button 
                            onClick={clearAllSelections}
                            className="flex-1"
                            variant="outline"
                          >
                            Limpar Tudo
                          </Button>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>

                {/* Template de Mensagem */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Template de Mensagem</label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Use <code className="bg-muted px-2 py-1 rounded">{'{nome}'}</code> para personalizar com o nome do contato
                  </p>
                  <Textarea
                    value={messageTemplate}
                    onChange={(e) => setMessageTemplate(e.target.value)}
                    rows={8}
                    placeholder="Digite sua mensagem..."
                    className="font-mono text-sm"
                  />
                </div>

                {/* Imagem do Produto */}
                {productImage && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">📷 Imagem do Produto</label>
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <img 
                        src={productImage} 
                        alt="Produto"
                        className="w-full max-w-xs h-48 object-cover rounded-md mx-auto"
                      />
                      <p className="text-xs text-muted-foreground mt-3 text-center">
                        💡 Esta imagem será enviada junto com a mensagem no WhatsApp
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Button
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(productImage);
                            toast.success('Link da imagem copiado!');
                          }}
                          className="flex-1"
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copiar Link da Imagem
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setProductImage(null)}
                          className="flex-1"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remover
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview e Agendamento */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                {/* CAMPO DE NÚMEROS SELECIONADOS / DIGITAR */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    📱 Números Selecionados
                    <span className="text-xs text-muted-foreground font-normal">
                      (adicione mais separados por vírgula ou linha)
                    </span>
                  </label>
                  <Textarea
                    value={directPhoneNumbers}
                    onChange={(e) => setDirectPhoneNumbers(e.target.value)}
                    placeholder="Digite números aqui (ex: 5521999998888) ou selecione contatos acima"
                    rows={3}
                    className="font-mono text-sm"
                  />
                  {directPhoneNumbers.trim() && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span className="text-sm font-medium">
                        {directPhoneNumbers.split(/[,\n]/).filter(p => p.trim()).length} número(s) digitado(s) - serão salvos automaticamente
                      </span>
                    </div>
                  )}
                </div>

                {/* Botão Enviar */}
                <Button
                  onClick={handleBulkSend}
                  disabled={loading || (
                    selectedContacts.length === 0 && 
                    selectedContactPhones.length === 0 &&
                    selectedGroups.length === 0 && 
                    !directPhoneNumbers.trim()
                  )}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    'Enviando...'
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Enviar para {
                        selectedContacts.length + 
                        selectedContactPhones.length +
                        selectedGroups.length + 
                        (directPhoneNumbers.trim() ? directPhoneNumbers.split(/[,\n]/).filter(p => p.trim()).length : 0)
                      } destinatário(s)
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
                  <Button size="sm" onClick={() => setShowAddGroupModal(true)}>
                    + Adicionar Grupo
                  </Button>
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

          {/* DIAGNÓSTICO */}
          <TabsContent value="diagnostics" className="space-y-6">
            <WhatsAppDiagnostics />
          </TabsContent>
        </Tabs>

        {/* Modal Adicionar Grupo */}
        <AddGroupModal
          open={showAddGroupModal}
          onOpenChange={setShowAddGroupModal}
          onGroupAdded={loadGroups}
        />

        {/* Modal Ver Detalhes */}
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{viewListData?.group_name}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">Total de contatos:</p>
                <p className="text-2xl font-bold">{viewListData?.member_count}</p>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Números cadastrados:</p>
                <div className="bg-muted p-3 rounded-lg max-h-64 overflow-y-auto">
                  {viewListData?.phone_numbers?.map((phone: string, idx: number) => (
                    <div key={idx} className="text-sm py-1 font-mono">
                      {idx + 1}. {phone}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal Editar */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar Lista</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label>Nome da Lista</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nome da lista"
                />
              </div>

              <div>
                <Label>Números (um por linha)</Label>
                <Textarea
                  value={editNumbers}
                  onChange={(e) => setEditNumbers(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                  placeholder="5521999998888&#10;5521999997777"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {editNumbers.split(/[\s,;\n]+/).filter(n => n.replace(/\D/g, '').length >= 10).length} números válidos
                </p>
              </div>

              <Button onClick={handleSaveEdit} className="w-full">
                Salvar Alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AfiliadoWhatsAppPage;
