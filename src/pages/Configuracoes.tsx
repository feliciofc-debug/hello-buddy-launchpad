import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, Settings, Target, MessageSquare, Clock, DollarSign, MapPin, Briefcase, TrendingUp, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Estados brasileiros
const ESTADOS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

// Setores de negócio
const SETORES = [
  'TECNOLOGIA',
  'FINANCAS',
  'SAUDE',
  'VAREJO',
  'INDUSTRIA',
  'SERVICOS',
  'CONSTRUCAO',
  'EDUCACAO',
  'AGRICULTURA',
  'ENTRETENIMENTO',
  'TURISMO',
  'IMOBILIARIO',
  'AUTOMOVEIS',
  'CONSULTORIA',
  'ADVOCACIA',
  'CONTABILIDADE',
  'MARKETING',
  'OUTROS'
];

// Cargos-alvo
const CARGOS = [
  'CEO',
  'Diretor',
  'Sócio-Administrador',
  'Presidente',
  'Vice-Presidente',
  'Gerente',
  'Coordenador',
  'Proprietário',
  'Fundador'
];

export default function Configuracoes() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // ============================================
  // ESTADO: Perfil do Negócio
  // ============================================
  const [negocio, setNegocio] = useState({
    nome_empresa: '',
    tipo_negocio: 'CARROS_LUXO', // DEFAULT
    segmento: '',
    produto_servico: '',
    ticket_medio: '',
    descricao: '',
    website: '',
    telefone: '',
    email: '',
  });

  // ============================================
  // ESTADO: ICP (Ideal Customer Profile)
  // ============================================
  const [icp, setIcp] = useState({
    // Geografia
    estados: ['SP'],
    municipios_especificos: '',
    raio_atuacao_km: 50,

    // Empresa
    setores: ['TECNOLOGIA', 'FINANCAS', 'SAUDE'],
    capital_social_minimo: 10000000,
    faturamento_minimo: 50000000,
    idade_empresa_minima: 0,
    portes: ['MEDIA', 'GRANDE'],

    // Decisor
    cargos_alvo: ['CEO', 'Diretor', 'Sócio-Administrador'],
    patrimonio_minimo: 1000000,
    idade_minima: 30,
    idade_maxima: 65,

    // Qualificação
    score_minimo: 80,
    
    // Sinais de compra (personalizável)
    sinais_compra: [
      'Promoção recente',
      'Empresa crescendo',
      'Mudou de cargo',
      'Recebeu investimento',
      'Notícias positivas'
    ]
  });

  // ============================================
  // ESTADO: Mensagens
  // ============================================
  const [mensagens, setMensagens] = useState({
    // Template base (variáveis: {nome}, {empresa}, {cargo}, {conquista})
    template_base: `Oi {nome}!

Vi que {conquista}. Parabéns! 🎉

{contexto_negocio}

{call_to_action}

Abs,
{nome_vendedor} - {nome_empresa}`,

    // Contextos por negócio
    contexto_carros: 'Temos um veículo que seria perfeito para seu novo momento.',
    contexto_imoveis: 'Tenho alguns imóveis exclusivos que combinam com seu perfil.',
    contexto_servicos: 'Gostaria de apresentar nossos serviços premium.',
    contexto_produtos: 'Temos produtos exclusivos que podem te interessar.',

    // CTAs
    cta_testdrive: 'Que tal agendar um test-drive esta semana?',
    cta_reuniao: 'Podemos marcar um café para conversar?',
    cta_visita: 'Quer conhecer pessoalmente?',
    cta_proposta: 'Posso enviar uma proposta personalizada?',

    // Personalização
    tom_padrao: 'professional', // professional | friendly | enthusiast
    usar_emojis: true,
    max_caracteres: 150,
    idioma: 'pt-BR'
  });

  // ============================================
  // ESTADO: Automação
  // ============================================
  const [automacao, setAutomacao] = useState({
    // Horários
    horario_envio_inicio: '09:00',
    horario_envio_fim: '18:00',
    dias_ativos: [1, 2, 3, 4, 5], // 0=Dom, 6=Sáb

    // Limites
    mensagens_por_dia: 50,
    mensagens_por_hora: 10,
    delay_entre_mensagens_seg: 90,

    // Enriquecimento
    enriquecer_automaticamente: true,
    qualificar_automaticamente: true,
    gerar_mensagens_automaticamente: false,

    // Notificações
    notificar_leads_quentes: true,
    notificar_respostas: true,
    email_notificacoes: '',
    whatsapp_notificacoes: ''
  });

  // ============================================
  // CARREGAR CONFIGURAÇÕES
  // ============================================
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('icp_configs')
        .select('*')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setIcp({
          estados: data.estados || ['SP'],
          municipios_especificos: '',
          raio_atuacao_km: data.raio_atuacao_km || 50,
          setores: data.setores || ['TECNOLOGIA'],
          capital_social_minimo: data.capital_social_minimo || 10000000,
          faturamento_minimo: data.faturamento_minimo || 50000000,
          idade_empresa_minima: data.idade_empresa_minima || 0,
          portes: data.portes || ['MEDIA', 'GRANDE'],
          cargos_alvo: data.cargos_alvo || ['CEO', 'Diretor'],
          patrimonio_minimo: data.patrimonio_minimo || 1000000,
          idade_minima: data.idade_minima || 30,
          idade_maxima: data.idade_maxima || 65,
          score_minimo: data.score_minimo || 80,
          sinais_compra: data.sinais_compra || []
        });

        setAutomacao({
          horario_envio_inicio: data.horario_envio_inicio || '09:00',
          horario_envio_fim: data.horario_envio_fim || '18:00',
          dias_ativos: data.dias_ativos || [1,2,3,4,5],
          mensagens_por_dia: data.mensagens_por_dia || 50,
          mensagens_por_hora: 10,
          delay_entre_mensagens_seg: 90,
          enriquecer_automaticamente: true,
          qualificar_automaticamente: true,
          gerar_mensagens_automaticamente: false,
          notificar_leads_quentes: true,
          notificar_respostas: true,
          email_notificacoes: '',
          whatsapp_notificacoes: ''
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar configurações',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // SALVAR CONFIGURAÇÕES
  // ============================================
  const saveConfig = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('icp_configs')
        .upsert({
          concessionaria_id: 'default', // Substituir por ID real
          estados: icp.estados,
          setores: icp.setores,
          capital_social_minimo: icp.capital_social_minimo,
          faturamento_minimo: icp.faturamento_minimo,
          cargos_alvo: icp.cargos_alvo,
          patrimonio_minimo: icp.patrimonio_minimo,
          idade_minima: icp.idade_minima,
          idade_maxima: icp.idade_maxima,
          score_minimo: icp.score_minimo,
          sinais_compra: icp.sinais_compra,
          horario_envio_inicio: automacao.horario_envio_inicio,
          horario_envio_fim: automacao.horario_envio_fim,
          dias_ativos: automacao.dias_ativos,
          mensagens_por_dia: automacao.mensagens_por_dia,
          portes: icp.portes,
          raio_atuacao_km: icp.raio_atuacao_km,
          idade_empresa_minima: icp.idade_empresa_minima
        });

      if (error) throw error;

      toast({
        title: 'Configurações salvas!',
        description: 'As mudanças foram aplicadas com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Configurações do Sistema</h1>
            <p className="text-muted-foreground">Configure o perfil do seu negócio e critérios de qualificação</p>
          </div>
        </div>
        <Button onClick={saveConfig} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar Tudo
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue="negocio" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="negocio">
            <Briefcase className="mr-2 h-4 w-4" />
            Seu Negócio
          </TabsTrigger>
          <TabsTrigger value="icp">
            <Target className="mr-2 h-4 w-4" />
            Perfil Cliente Ideal
          </TabsTrigger>
          <TabsTrigger value="mensagens">
            <MessageSquare className="mr-2 h-4 w-4" />
            Mensagens
          </TabsTrigger>
          <TabsTrigger value="automacao">
            <Settings className="mr-2 h-4 w-4" />
            Automação
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Negócio */}
        <TabsContent value="negocio" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Negócio</CardTitle>
              <CardDescription>
                Defina o tipo de negócio e produto/serviço que oferece
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome_empresa">Nome da Empresa</Label>
                  <Input
                    id="nome_empresa"
                    placeholder="Ex: Porsche São Paulo"
                    value={negocio.nome_empresa}
                    onChange={(e) => setNegocio({ ...negocio, nome_empresa: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo_negocio">Tipo de Negócio</Label>
                  <Select
                    value={negocio.tipo_negocio}
                    onValueChange={(value) => setNegocio({ ...negocio, tipo_negocio: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CARROS_LUXO">🚗 Carros de Luxo</SelectItem>
                      <SelectItem value="IMOVEIS_LUXO">🏠 Imóveis de Luxo</SelectItem>
                      <SelectItem value="CLINICA_MEDICA">⚕️ Clínica Médica</SelectItem>
                      <SelectItem value="CONSULTORIA">💼 Consultoria</SelectItem>
                      <SelectItem value="ACADEMIA_PREMIUM">🏋️ Academia Premium</SelectItem>
                      <SelectItem value="RESTAURANTE_PREMIUM">🍽️ Restaurante Premium</SelectItem>
                      <SelectItem value="JOALHERIA">💍 Joalheria</SelectItem>
                      <SelectItem value="AGENCIA_VIAGEM">✈️ Agência de Viagem</SelectItem>
                      <SelectItem value="ESCOLA_PREMIUM">🎓 Escola Premium</SelectItem>
                      <SelectItem value="TECNOLOGIA_B2B">💻 Tecnologia B2B</SelectItem>
                      <SelectItem value="OUTRO">🔧 Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="produto_servico">Produto/Serviço Principal</Label>
                <Input
                  id="produto_servico"
                  placeholder="Ex: Porsche Cayenne, 911, Taycan"
                  value={negocio.produto_servico}
                  onChange={(e) => setNegocio({ ...negocio, produto_servico: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ticket_medio">Ticket Médio</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="ticket_medio"
                      type="number"
                      className="pl-10"
                      placeholder="500000"
                      value={negocio.ticket_medio}
                      onChange={(e) => setNegocio({ ...negocio, ticket_medio: e.target.value })}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    R$ {Number(negocio.ticket_medio || 0).toLocaleString('pt-BR')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone Comercial</Label>
                  <Input
                    id="telefone"
                    placeholder="(11) 99999-9999"
                    value={negocio.telefone}
                    onChange={(e) => setNegocio({ ...negocio, telefone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição do Negócio</Label>
                <Textarea
                  id="descricao"
                  placeholder="Descreva seu negócio, diferenciais e público-alvo..."
                  rows={4}
                  value={negocio.descricao}
                  onChange={(e) => setNegocio({ ...negocio, descricao: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: ICP */}
        <TabsContent value="icp" className="space-y-4">
          {/* Geografia */}
          <Card>
            <CardHeader>
              <CardTitle>
                <MapPin className="inline mr-2 h-5 w-5" />
                Geografia
              </CardTitle>
              <CardDescription>Onde seus clientes ideais estão localizados</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Estados de Atuação</Label>
                <div className="flex flex-wrap gap-2">
                  {ESTADOS.map(estado => (
                    <Badge
                      key={estado}
                      variant={icp.estados.includes(estado) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        if (icp.estados.includes(estado)) {
                          setIcp({ ...icp, estados: icp.estados.filter(e => e !== estado) });
                        } else {
                          setIcp({ ...icp, estados: [...icp.estados, estado] });
                        }
                      }}
                    >
                      {estado}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="raio">Raio de Atuação (km)</Label>
                <Input
                  id="raio"
                  type="number"
                  value={icp.raio_atuacao_km}
                  onChange={(e) => setIcp({ ...icp, raio_atuacao_km: Number(e.target.value) })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Empresa */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Briefcase className="inline mr-2 h-5 w-5" />
                Perfil da Empresa
              </CardTitle>
              <CardDescription>Características das empresas dos prospects</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Setores</Label>
                <div className="flex flex-wrap gap-2">
                  {SETORES.map(setor => (
                    <Badge
                      key={setor}
                      variant={icp.setores.includes(setor) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        if (icp.setores.includes(setor)) {
                          setIcp({ ...icp, setores: icp.setores.filter(s => s !== setor) });
                        } else {
                          setIcp({ ...icp, setores: [...icp.setores, setor] });
                        }
                      }}
                    >
                      {setor}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="capital_min">Capital Social Mínimo</Label>
                  <Input
                    id="capital_min"
                    type="number"
                    value={icp.capital_social_minimo}
                    onChange={(e) => setIcp({ ...icp, capital_social_minimo: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    R$ {icp.capital_social_minimo.toLocaleString('pt-BR')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="faturamento_min">Faturamento Mínimo Anual</Label>
                  <Input
                    id="faturamento_min"
                    type="number"
                    value={icp.faturamento_minimo}
                    onChange={(e) => setIcp({ ...icp, faturamento_minimo: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    R$ {icp.faturamento_minimo.toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Decisor */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Target className="inline mr-2 h-5 w-5" />
                Perfil do Decisor
              </CardTitle>
              <CardDescription>Características da pessoa que toma a decisão</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Cargos-Alvo</Label>
                <div className="flex flex-wrap gap-2">
                  {CARGOS.map(cargo => (
                    <Badge
                      key={cargo}
                      variant={icp.cargos_alvo.includes(cargo) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        if (icp.cargos_alvo.includes(cargo)) {
                          setIcp({ ...icp, cargos_alvo: icp.cargos_alvo.filter(c => c !== cargo) });
                        } else {
                          setIcp({ ...icp, cargos_alvo: [...icp.cargos_alvo, cargo] });
                        }
                      }}
                    >
                      {cargo}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="patrimonio_min">Patrimônio Mínimo</Label>
                  <Input
                    id="patrimonio_min"
                    type="number"
                    value={icp.patrimonio_minimo}
                    onChange={(e) => setIcp({ ...icp, patrimonio_minimo: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    R$ {icp.patrimonio_minimo.toLocaleString('pt-BR')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="idade_min">Idade Mínima</Label>
                  <Input
                    id="idade_min"
                    type="number"
                    value={icp.idade_minima}
                    onChange={(e) => setIcp({ ...icp, idade_minima: Number(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="idade_max">Idade Máxima</Label>
                  <Input
                    id="idade_max"
                    type="number"
                    value={icp.idade_maxima}
                    onChange={(e) => setIcp({ ...icp, idade_maxima: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="score_min">Score Mínimo para Contato</Label>
                <Input
                  id="score_min"
                  type="number"
                  min="0"
                  max="100"
                  value={icp.score_minimo}
                  onChange={(e) => setIcp({ ...icp, score_minimo: Number(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                  Só contactar prospects com score {icp.score_minimo}+
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Mensagens */}
        <TabsContent value="mensagens" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Template de Mensagem</CardTitle>
              <CardDescription>
                Configure o modelo base das mensagens. A IA vai personalizar para cada prospect.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  <strong>Variáveis disponíveis:</strong> {'{nome}'}, {'{empresa}'}, {'{cargo}'}, {'{conquista}'}, {'{contexto_negocio}'}, {'{call_to_action}'}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="template">Template Base</Label>
                <Textarea
                  id="template"
                  rows={8}
                  value={mensagens.template_base}
                  onChange={(e) => setMensagens({ ...mensagens, template_base: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tom">Tom Padrão</Label>
                  <Select
                    value={mensagens.tom_padrao}
                    onValueChange={(value) => setMensagens({ ...mensagens, tom_padrao: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Profissional</SelectItem>
                      <SelectItem value="friendly">Amigável</SelectItem>
                      <SelectItem value="enthusiast">Entusiasta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_chars">Máximo de Caracteres</Label>
                  <Input
                    id="max_chars"
                    type="number"
                    value={mensagens.max_caracteres}
                    onChange={(e) => setMensagens({ ...mensagens, max_caracteres: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Usar Emojis</Label>
                  <p className="text-sm text-muted-foreground">Adicionar emojis às mensagens</p>
                </div>
                <Switch
                  checked={mensagens.usar_emojis}
                  onCheckedChange={(checked) => setMensagens({ ...mensagens, usar_emojis: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: Automação */}
        <TabsContent value="automacao" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                <Clock className="inline mr-2 h-5 w-5" />
                Horários e Limites
              </CardTitle>
              <CardDescription>Configure quando e quantas mensagens enviar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hora_inicio">Horário Início</Label>
                  <Input
                    id="hora_inicio"
                    type="time"
                    value={automacao.horario_envio_inicio}
                    onChange={(e) => setAutomacao({ ...automacao, horario_envio_inicio: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hora_fim">Horário Fim</Label>
                  <Input
                    id="hora_fim"
                    type="time"
                    value={automacao.horario_envio_fim}
                    onChange={(e) => setAutomacao({ ...automacao, horario_envio_fim: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Dias Ativos</Label>
                <div className="flex gap-2">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia, index) => (
                    <Badge
                      key={index}
                      variant={automacao.dias_ativos.includes(index) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        if (automacao.dias_ativos.includes(index)) {
                          setAutomacao({
                            ...automacao,
                            dias_ativos: automacao.dias_ativos.filter(d => d !== index)
                          });
                        } else {
                          setAutomacao({
                            ...automacao,
                            dias_ativos: [...automacao.dias_ativos, index]
                          });
                        }
                      }}
                    >
                      {dia}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="msgs_dia">Mensagens por Dia</Label>
                  <Input
                    id="msgs_dia"
                    type="number"
                    value={automacao.mensagens_por_dia}
                    onChange={(e) => setAutomacao({ ...automacao, mensagens_por_dia: Number(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delay">Delay entre mensagens (seg)</Label>
                  <Input
                    id="delay"
                    type="number"
                    value={automacao.delay_entre_mensagens_seg}
                    onChange={(e) => setAutomacao({ ...automacao, delay_entre_mensagens_seg: Number(e.target.value) })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <TrendingUp className="inline mr-2 h-5 w-5" />
                Automações
              </CardTitle>
              <CardDescription>O que o sistema faz automaticamente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enriquecer Automaticamente</Label>
                  <p className="text-sm text-muted-foreground">Buscar dados no Google após descobrir sócio</p>
                </div>
                <Switch
                  checked={automacao.enriquecer_automaticamente}
                  onCheckedChange={(checked) => setAutomacao({ ...automacao, enriquecer_automaticamente: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Qualificar Automaticamente</Label>
                  <p className="text-sm text-muted-foreground">Analisar com IA após enriquecimento</p>
                </div>
                <Switch
                  checked={automacao.qualificar_automaticamente}
                  onCheckedChange={(checked) => setAutomacao({ ...automacao, qualificar_automaticamente: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Gerar Mensagens Automaticamente</Label>
                  <p className="text-sm text-muted-foreground">Criar mensagens para prospects qualificados</p>
                </div>
                <Switch
                  checked={automacao.gerar_mensagens_automaticamente}
                  onCheckedChange={(checked) => setAutomacao({ ...automacao, gerar_mensagens_automaticamente: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notificar Leads Quentes</Label>
                  <p className="text-sm text-muted-foreground">Avisar quando encontrar prospect score 90+</p>
                </div>
                <Switch
                  checked={automacao.notificar_leads_quentes}
                  onCheckedChange={(checked) => setAutomacao({ ...automacao, notificar_leads_quentes: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
