import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Building2, User, Plus, X } from "lucide-react";

export default function ConfigurarICP() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState<'b2b' | 'b2c'>('b2b');
  
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  
  // B2B Config
  const [setores, setSetores] = useState<string[]>([]);
  const [setorInput, setSetorInput] = useState("");
  const [portes, setPortes] = useState<string[]>([]);
  const [estados, setEstados] = useState<string[]>([]);
  const [estadoInput, setEstadoInput] = useState("");
  const [cidades, setCidades] = useState<string[]>([]);
  const [cidadeInput, setCidadeInput] = useState("");
  const [capitalMinimo, setCapitalMinimo] = useState("");
  
  // B2C Config
  const [profissoes, setProfissoes] = useState<string[]>([]);
  const [profissaoInput, setProfissaoInput] = useState("");
  const [especialidades, setEspecialidades] = useState<string[]>([]);
  const [especialidadeInput, setEspecialidadeInput] = useState("");
  const [bairrosNobres, setBairrosNobres] = useState<string[]>([]);
  const [bairroInput, setBairroInput] = useState("");
  const [sinaisPoder, setSinaisPoder] = useState<string[]>([]);
  const [sinalInput, setSinalInput] = useState("");

  const PORTES_OPTIONS = ["MEI", "ME", "EPP", "Grande"];

  const handleAddTag = (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>, inputSetter: React.Dispatch<React.SetStateAction<string>>) => {
    if (value.trim()) {
      setter(prev => [...prev, value.trim()]);
      inputSetter("");
    }
  };

  const handleRemoveTag = (index: number, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error("Nome do ICP é obrigatório");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const b2bConfig = tipo === 'b2b' ? {
        setores,
        portes,
        estados,
        cidades,
        capital_minimo: capitalMinimo ? parseInt(capitalMinimo) : 0,
        capital_maximo: null,
        idade_empresa_min: null,
        idade_empresa_max: null,
        situacao: ["ATIVA"],
        natureza_juridica: []
      } : {};

      const b2cConfig = tipo === 'b2c' ? {
        profissoes,
        especialidades,
        estados,
        cidades,
        bairros_nobres: bairrosNobres,
        sinais_poder_aquisitivo: sinaisPoder,
        idade_minima: 30,
        idade_maxima: 65,
        patrimonio_minimo: 0
      } : {};

      const { error } = await supabase
        .from('icp_configs')
        .insert({
          user_id: user.id,
          nome,
          descricao,
          tipo,
          b2b_config: b2bConfig,
          b2c_config: b2cConfig,
          ativo: true
        });

      if (error) throw error;

      toast.success("ICP configurado com sucesso!");
      navigate('/campanhas-prospeccao');

    } catch (error: any) {
      console.error("Erro ao salvar ICP:", error);
      toast.error(error.message || "Erro ao salvar ICP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/campanhas-prospeccao')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Configurar Perfil Cliente Ideal (ICP)</CardTitle>
            <CardDescription>
              Defina os critérios do seu cliente ideal para gerar leads automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome do ICP</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Médicos RJ 2025"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  placeholder="Descreva o perfil..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </div>

              <div>
                <Label>Tipo de Prospecção</Label>
                <Tabs value={tipo} onValueChange={(v) => setTipo(v as 'b2b' | 'b2c')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="b2b">
                      <Building2 className="mr-2 h-4 w-4" />
                      B2B (Empresas)
                    </TabsTrigger>
                    <TabsTrigger value="b2c">
                      <User className="mr-2 h-4 w-4" />
                      B2C (Profissionais)
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="b2b" className="space-y-4 mt-6">
                    {/* Setores */}
                    <div>
                      <Label>Setores</Label>
                      <div className="flex gap-2 mb-2">
                        <Input
                          placeholder="Ex: Tecnologia, Saúde..."
                          value={setorInput}
                          onChange={(e) => setSetorInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddTag(setorInput, setSetores, setSetorInput)}
                        />
                        <Button onClick={() => handleAddTag(setorInput, setSetores, setSetorInput)} size="icon">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {setores.map((setor, i) => (
                          <Badge key={i} variant="secondary">
                            {setor}
                            <X className="ml-2 h-3 w-3 cursor-pointer" onClick={() => handleRemoveTag(i, setSetores)} />
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Porte */}
                    <div>
                      <Label>Porte da Empresa</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {PORTES_OPTIONS.map((porte) => (
                          <Badge
                            key={porte}
                            variant={portes.includes(porte) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => {
                              setPortes(prev =>
                                prev.includes(porte) ? prev.filter(p => p !== porte) : [...prev, porte]
                              );
                            }}
                          >
                            {porte}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Capital Mínimo */}
                    <div>
                      <Label htmlFor="capital">Capital Social Mínimo (R$)</Label>
                      <Input
                        id="capital"
                        type="number"
                        placeholder="100000"
                        value={capitalMinimo}
                        onChange={(e) => setCapitalMinimo(e.target.value)}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="b2c" className="space-y-4 mt-6">
                    {/* Profissões */}
                    <div>
                      <Label>Profissões</Label>
                      <div className="flex gap-2 mb-2">
                        <Input
                          placeholder="Ex: Médico, Advogado..."
                          value={profissaoInput}
                          onChange={(e) => setProfissaoInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddTag(profissaoInput, setProfissoes, setProfissaoInput)}
                        />
                        <Button onClick={() => handleAddTag(profissaoInput, setProfissoes, setProfissaoInput)} size="icon">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {profissoes.map((prof, i) => (
                          <Badge key={i} variant="secondary">
                            {prof}
                            <X className="ml-2 h-3 w-3 cursor-pointer" onClick={() => handleRemoveTag(i, setProfissoes)} />
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Especialidades */}
                    <div>
                      <Label>Especialidades</Label>
                      <div className="flex gap-2 mb-2">
                        <Input
                          placeholder="Ex: Ortopedista, Cardiologista..."
                          value={especialidadeInput}
                          onChange={(e) => setEspecialidadeInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddTag(especialidadeInput, setEspecialidades, setEspecialidadeInput)}
                        />
                        <Button onClick={() => handleAddTag(especialidadeInput, setEspecialidades, setEspecialidadeInput)} size="icon">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {especialidades.map((esp, i) => (
                          <Badge key={i} variant="secondary">
                            {esp}
                            <X className="ml-2 h-3 w-3 cursor-pointer" onClick={() => handleRemoveTag(i, setEspecialidades)} />
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Sinais de Poder Aquisitivo */}
                    <div>
                      <Label>Sinais de Poder Aquisitivo</Label>
                      <div className="flex gap-2 mb-2">
                        <Input
                          placeholder="Ex: consultório próprio, clínica..."
                          value={sinalInput}
                          onChange={(e) => setSinalInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddTag(sinalInput, setSinaisPoder, setSinalInput)}
                        />
                        <Button onClick={() => handleAddTag(sinalInput, setSinaisPoder, setSinalInput)} size="icon">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sinaisPoder.map((sinal, i) => (
                          <Badge key={i} variant="secondary">
                            {sinal}
                            <X className="ml-2 h-3 w-3 cursor-pointer" onClick={() => handleRemoveTag(i, setSinaisPoder)} />
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Bairros Nobres */}
                    <div>
                      <Label>Bairros Nobres</Label>
                      <div className="flex gap-2 mb-2">
                        <Input
                          placeholder="Ex: Leblon, Ipanema..."
                          value={bairroInput}
                          onChange={(e) => setBairroInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddTag(bairroInput, setBairrosNobres, setBairroInput)}
                        />
                        <Button onClick={() => handleAddTag(bairroInput, setBairrosNobres, setBairroInput)} size="icon">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {bairrosNobres.map((bairro, i) => (
                          <Badge key={i} variant="secondary">
                            {bairro}
                            <X className="ml-2 h-3 w-3 cursor-pointer" onClick={() => handleRemoveTag(i, setBairrosNobres)} />
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Localização (comum para ambos) */}
              <div>
                <Label>Estados</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="Ex: RJ, SP, MG..."
                    value={estadoInput}
                    onChange={(e) => setEstadoInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag(estadoInput, setEstados, setEstadoInput)}
                  />
                  <Button onClick={() => handleAddTag(estadoInput, setEstados, setEstadoInput)} size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {estados.map((estado, i) => (
                    <Badge key={i} variant="secondary">
                      {estado}
                      <X className="ml-2 h-3 w-3 cursor-pointer" onClick={() => handleRemoveTag(i, setEstados)} />
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Cidades</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="Ex: Rio de Janeiro, São Paulo..."
                    value={cidadeInput}
                    onChange={(e) => setCidadeInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag(cidadeInput, setCidades, setCidadeInput)}
                  />
                  <Button onClick={() => handleAddTag(cidadeInput, setCidades, setCidadeInput)} size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {cidades.map((cidade, i) => (
                    <Badge key={i} variant="secondary">
                      {cidade}
                      <X className="ml-2 h-3 w-3 cursor-pointer" onClick={() => handleRemoveTag(i, setCidades)} />
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => navigate('/campanhas-prospeccao')}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? "Salvando..." : "Salvar ICP"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
