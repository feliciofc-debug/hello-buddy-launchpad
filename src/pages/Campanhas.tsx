import { useState } from 'react';
import { ChevronRight, ChevronLeft, Rocket, Play, Pause, Edit, Copy, Trash2, TrendingUp, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Campanhas = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [ageRange, setAgeRange] = useState([18, 65]);
  const [budget, setBudget] = useState('50');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [location, setLocation] = useState('');
  const [gender, setGender] = useState('all');
  const [interests, setInterests] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState('');

  // Mock data - biblioteca de posts
  const posts = [
    { id: '1', title: 'Fone Bluetooth JBL', image: '/placeholder.svg', type: 'Post', network: 'Instagram' },
    { id: '2', title: 'Smartwatch Xiaomi', image: '/placeholder.svg', type: 'Story', network: 'Facebook' },
    { id: '3', title: 'Câmera GoPro', image: '/placeholder.svg', type: 'Vídeo', network: 'TikTok' },
    { id: '4', title: 'Notebook Dell', image: '/placeholder.svg', type: 'Post', network: 'Instagram' },
  ];

  // Mock data - campanhas ativas
  const campaigns = [
    { id: '1', name: 'Black Friday Eletrônicos', status: 'Ativa', impressions: '12.5K', clicks: '450', ctr: '3.6%', spent: 'R$ 125,00' },
    { id: '2', name: 'Natal Tech 2024', status: 'Pausada', impressions: '8.2K', clicks: '280', ctr: '3.4%', spent: 'R$ 89,00' },
  ];

  const togglePost = (postId: string) => {
    setSelectedPosts(prev => 
      prev.includes(postId) ? prev.filter(id => id !== postId) : [...prev, postId]
    );
  };

  const addInterest = () => {
    if (newInterest.trim() && !interests.includes(newInterest.trim())) {
      setInterests([...interests, newInterest.trim()]);
      setNewInterest('');
    }
  };

  const removeInterest = (interest: string) => {
    setInterests(interests.filter(i => i !== interest));
  };

  const calculateEstimates = () => {
    const dailyBudget = parseFloat(budget) || 0;
    const days = startDate && endDate ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : 7;
    const total = dailyBudget * days;
    const estimatedReach = dailyBudget * 100;
    const costPerClick = dailyBudget / 30;
    
    return { total, days, estimatedReach, costPerClick };
  };

  const estimates = calculateEstimates();

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Selecione os Posts para a Campanha</h3>
        <p className="text-sm text-muted-foreground mb-4">{selectedPosts.length} posts selecionados</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {posts.map((post) => (
          <Card 
            key={post.id} 
            className={`cursor-pointer transition-all hover:shadow-lg ${selectedPosts.includes(post.id) ? 'ring-2 ring-primary' : ''}`}
            onClick={() => togglePost(post.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Checkbox checked={selectedPosts.includes(post.id)} />
                <div className="flex-1">
                  <img src={post.image} alt={post.title} className="w-full h-32 object-cover rounded mb-2" />
                  <h4 className="font-medium text-sm mb-1">{post.title}</h4>
                  <div className="flex gap-2">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">{post.type}</span>
                    <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">{post.network}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Configure o Público-Alvo</h3>
        <p className="text-sm text-muted-foreground mb-4">Alcance estimado: {estimates.estimatedReach.toLocaleString('pt-BR')} pessoas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <Label>Localização</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o país/estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="brasil">Brasil</SelectItem>
                <SelectItem value="sp">São Paulo</SelectItem>
                <SelectItem value="rj">Rio de Janeiro</SelectItem>
                <SelectItem value="mg">Minas Gerais</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Gênero</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="male">Masculino</SelectItem>
                <SelectItem value="female">Feminino</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Idade: {ageRange[0]} - {ageRange[1]}+ anos</Label>
            <Slider
              value={ageRange}
              onValueChange={setAgeRange}
              min={18}
              max={65}
              step={1}
              className="mt-2"
            />
          </div>

          <div>
            <Label>Interesses</Label>
            <div className="flex gap-2 mb-2">
              <Input
                placeholder="Ex: Tecnologia, Esportes..."
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addInterest()}
              />
              <Button onClick={addInterest}>Adicionar</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {interests.map((interest) => (
                <span 
                  key={interest} 
                  className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm flex items-center gap-2"
                >
                  {interest}
                  <button onClick={() => removeInterest(interest)} className="hover:text-destructive">×</button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Defina o Orçamento</h3>
        <p className="text-sm text-muted-foreground mb-4">Total estimado: R$ {estimates.total.toFixed(2)}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orçamento Diário</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Valor por dia (R$)</Label>
              <Input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="50.00"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Custo por clique estimado: R$ {estimates.costPerClick.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Duração da Campanha</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      {startDate ? format(startDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Data Fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      {endDate ? format(endDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Duração: {estimates.days} dias
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Revisão da Campanha</h3>
        <p className="text-sm text-muted-foreground mb-4">Revise todos os detalhes antes de criar</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Conteúdo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{selectedPosts.length}</p>
            <p className="text-sm text-muted-foreground">posts selecionados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Público</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{estimates.estimatedReach.toLocaleString('pt-BR')}</p>
            <p className="text-sm text-muted-foreground">pessoas estimadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Investimento</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">R$ {estimates.total.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">{estimates.days} dias</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Resumo Completo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <span className="text-muted-foreground">Localização:</span>
            <span className="font-medium">{location || 'Não definida'}</span>
            
            <span className="text-muted-foreground">Gênero:</span>
            <span className="font-medium">{gender === 'all' ? 'Todos' : gender === 'male' ? 'Masculino' : 'Feminino'}</span>
            
            <span className="text-muted-foreground">Idade:</span>
            <span className="font-medium">{ageRange[0]} - {ageRange[1]}+ anos</span>
            
            <span className="text-muted-foreground">Interesses:</span>
            <span className="font-medium">{interests.length > 0 ? interests.join(', ') : 'Nenhum'}</span>
            
            <span className="text-muted-foreground">Orçamento diário:</span>
            <span className="font-medium">R$ {parseFloat(budget).toFixed(2)}</span>
            
            <span className="text-muted-foreground">CPC estimado:</span>
            <span className="font-medium">R$ {estimates.costPerClick.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      <Button className="w-full h-14 text-lg bg-green-600 hover:bg-green-700">
        <Rocket className="mr-2" size={24} />
        Criar Campanha
      </Button>
    </div>
  );

  if (currentStep === 0) {
    // Dashboard de Campanhas
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="mr-2" size={18} />
                Voltar
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Campanhas</h1>
                <p className="text-muted-foreground">Gerencie suas campanhas de marketing</p>
              </div>
            </div>
            <Button onClick={() => setCurrentStep(1)} size="lg">
              <Rocket className="mr-2" />
              Nova Campanha
            </Button>
          </div>

          {/* Métricas Gerais */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Impressões</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">20.7K</p>
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <TrendingUp size={12} /> +12% vs. semana passada
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Cliques</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">730</p>
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <TrendingUp size={12} /> +8% vs. semana passada
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">CTR Médio</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">3.5%</p>
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <TrendingUp size={12} /> +0.3% vs. semana passada
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Gastos Total</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">R$ 214,00</p>
                <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
              </CardContent>
            </Card>
          </div>

          {/* Lista de Campanhas */}
          <Card>
            <CardHeader>
              <CardTitle>Campanhas Ativas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">{campaign.name}</h3>
                        <span className={`text-xs px-2 py-1 rounded ${campaign.status === 'Ativa' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {campaign.status}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          {campaign.status === 'Ativa' ? <Pause size={16} /> : <Play size={16} />}
                        </Button>
                        <Button size="sm" variant="outline">
                          <Edit size={16} />
                        </Button>
                        <Button size="sm" variant="outline">
                          <Copy size={16} />
                        </Button>
                        <Button size="sm" variant="outline">
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Impressões</p>
                        <p className="font-semibold">{campaign.impressions}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cliques</p>
                        <p className="font-semibold">{campaign.clicks}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">CTR</p>
                        <p className="font-semibold">{campaign.ctr}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Gastos</p>
                        <p className="font-semibold">{campaign.spent}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Wizard de Criação
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(0)}>
                <ArrowLeft className="mr-2" size={18} />
                Voltar para Dashboard
              </Button>
              <div className="text-center flex-1">
                <CardTitle className="text-2xl">Nova Campanha</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Passo {currentStep} de 4
                </p>
              </div>
              <Button onClick={() => setCurrentStep(1)}>
                <Rocket className="mr-2" />
                Nova Campanha
              </Button>
            </div>
            
            {/* Progress Bar */}
            <div className="flex gap-2 mt-6">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`flex-1 h-2 rounded ${step <= currentStep ? 'bg-primary' : 'bg-muted'}`}
                />
              ))}
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                disabled={currentStep === 1}
              >
                <ChevronLeft className="mr-2" />
                Anterior
              </Button>
              {currentStep < 4 && (
                <Button
                  onClick={() => setCurrentStep(Math.min(4, currentStep + 1))}
                >
                  Próximo
                  <ChevronRight className="ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Campanhas;