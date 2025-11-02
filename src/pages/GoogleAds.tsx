import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Megaphone, DollarSign, Target, Globe, Calendar, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export default function GoogleAds() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [campaignData, setCampaignData] = useState({
    nome: "",
    objetivo: "",
    orcamentoDiario: "",
    publico: {
      localizacao: "",
      idade: "",
      genero: "",
      interesses: ""
    },
    palavrasChave: "",
    anuncios: {
      titulo1: "",
      titulo2: "",
      titulo3: "",
      descricao1: "",
      descricao2: "",
      urlFinal: ""
    }
  });

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = () => {
    toast.success("Campanha criada! (Integração Google Ads em desenvolvimento)");
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Button
          onClick={() => step === 1 ? navigate('/dashboard') : handleBack()}
          variant="ghost"
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            🎯 Criar Campanha Google Ads
          </h1>
          <p className="text-muted-foreground">
            Configure sua campanha passo a passo
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-2 w-16 rounded-full transition-colors ${
                s <= step ? 'bg-blue-500' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Informações Básicas */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="w-5 h-5" />
                Informações Básicas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nome da Campanha</Label>
                <Input
                  value={campaignData.nome}
                  onChange={(e) => setCampaignData({...campaignData, nome: e.target.value})}
                  placeholder="Ex: Lançamento Produto X"
                />
              </div>

              <div>
                <Label>Objetivo da Campanha</Label>
                <Select 
                  value={campaignData.objetivo}
                  onValueChange={(value) => setCampaignData({...campaignData, objetivo: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vendas">Vendas</SelectItem>
                    <SelectItem value="leads">Geração de Leads</SelectItem>
                    <SelectItem value="trafego">Tráfego do Site</SelectItem>
                    <SelectItem value="reconhecimento">Reconhecimento de Marca</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Orçamento Diário (R$)</Label>
                <Input
                  type="number"
                  value={campaignData.orcamentoDiario}
                  onChange={(e) => setCampaignData({...campaignData, orcamentoDiario: e.target.value})}
                  placeholder="50.00"
                />
              </div>

              <Button onClick={handleNext} className="w-full">
                Próximo
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Público-Alvo */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Público-Alvo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Localização</Label>
                <Input
                  value={campaignData.publico.localizacao}
                  onChange={(e) => setCampaignData({
                    ...campaignData,
                    publico: {...campaignData.publico, localizacao: e.target.value}
                  })}
                  placeholder="Ex: São Paulo, Brasil"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Faixa Etária</Label>
                  <Select 
                    value={campaignData.publico.idade}
                    onValueChange={(value) => setCampaignData({
                      ...campaignData,
                      publico: {...campaignData.publico, idade: value}
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="18-24">18-24 anos</SelectItem>
                      <SelectItem value="25-34">25-34 anos</SelectItem>
                      <SelectItem value="35-44">35-44 anos</SelectItem>
                      <SelectItem value="45-54">45-54 anos</SelectItem>
                      <SelectItem value="55+">55+ anos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Gênero</Label>
                  <Select 
                    value={campaignData.publico.genero}
                    onValueChange={(value) => setCampaignData({
                      ...campaignData,
                      publico: {...campaignData.publico, genero: value}
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Interesses</Label>
                <Textarea
                  value={campaignData.publico.interesses}
                  onChange={(e) => setCampaignData({
                    ...campaignData,
                    publico: {...campaignData.publico, interesses: e.target.value}
                  })}
                  placeholder="Ex: Tecnologia, Esportes, Moda"
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleBack} variant="outline" className="flex-1">
                  Voltar
                </Button>
                <Button onClick={handleNext} className="flex-1">
                  Próximo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Palavras-Chave */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Palavras-Chave
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Palavras-Chave (uma por linha)</Label>
                <Textarea
                  value={campaignData.palavrasChave}
                  onChange={(e) => setCampaignData({...campaignData, palavrasChave: e.target.value})}
                  placeholder="comprar produto X&#10;melhor produto X&#10;produto X barato"
                  rows={8}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  💡 Dica: Use palavras relacionadas ao seu produto
                </p>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleBack} variant="outline" className="flex-1">
                  Voltar
                </Button>
                <Button onClick={handleNext} className="flex-1">
                  Próximo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Anúncios */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Criar Anúncios
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Título 1 (máx. 30 caracteres)</Label>
                <Input
                  value={campaignData.anuncios.titulo1}
                  onChange={(e) => setCampaignData({
                    ...campaignData,
                    anuncios: {...campaignData.anuncios, titulo1: e.target.value}
                  })}
                  maxLength={30}
                  placeholder="Produto Incrível"
                />
              </div>

              <div className="space-y-2">
                <Label>Título 2 (máx. 30 caracteres)</Label>
                <Input
                  value={campaignData.anuncios.titulo2}
                  onChange={(e) => setCampaignData({
                    ...campaignData,
                    anuncios: {...campaignData.anuncios, titulo2: e.target.value}
                  })}
                  maxLength={30}
                  placeholder="Melhor Preço"
                />
              </div>

              <div className="space-y-2">
                <Label>Título 3 (máx. 30 caracteres)</Label>
                <Input
                  value={campaignData.anuncios.titulo3}
                  onChange={(e) => setCampaignData({
                    ...campaignData,
                    anuncios: {...campaignData.anuncios, titulo3: e.target.value}
                  })}
                  maxLength={30}
                  placeholder="Frete Grátis"
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição 1 (máx. 90 caracteres)</Label>
                <Textarea
                  value={campaignData.anuncios.descricao1}
                  onChange={(e) => setCampaignData({
                    ...campaignData,
                    anuncios: {...campaignData.anuncios, descricao1: e.target.value}
                  })}
                  maxLength={90}
                  rows={2}
                  placeholder="Descrição atraente do produto"
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição 2 (máx. 90 caracteres)</Label>
                <Textarea
                  value={campaignData.anuncios.descricao2}
                  onChange={(e) => setCampaignData({
                    ...campaignData,
                    anuncios: {...campaignData.anuncios, descricao2: e.target.value}
                  })}
                  maxLength={90}
                  rows={2}
                  placeholder="Benefícios e diferenciais"
                />
              </div>

              <div className="space-y-2">
                <Label>URL Final</Label>
                <Input
                  value={campaignData.anuncios.urlFinal}
                  onChange={(e) => setCampaignData({
                    ...campaignData,
                    anuncios: {...campaignData.anuncios, urlFinal: e.target.value}
                  })}
                  placeholder="https://seusite.com/produto"
                />
              </div>

              {/* Preview */}
              <div className="border rounded-lg p-4 bg-muted/30">
                <p className="text-xs text-muted-foreground mb-2">Preview do Anúncio:</p>
                <div className="space-y-1">
                  <div className="text-blue-600 font-semibold">
                    {campaignData.anuncios.titulo1 || "Título 1"} | {campaignData.anuncios.titulo2 || "Título 2"}
                  </div>
                  <div className="text-xs text-green-700">{campaignData.anuncios.urlFinal || "seusite.com"}</div>
                  <div className="text-sm">{campaignData.anuncios.descricao1 || "Descrição do anúncio..."}</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleBack} variant="outline" className="flex-1">
                  Voltar
                </Button>
                <Button onClick={handleSubmit} className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600">
                  🚀 Criar Campanha
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}