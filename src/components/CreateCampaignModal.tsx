import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Sparkles, Calendar, Instagram, Facebook, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Product {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number | null;
  link: string | null;
}

interface GeneratedPosts {
  instagram: string;
  facebook: string;
  whatsapp: string;
  story: string;
}

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

export default function CreateCampaignModal({ isOpen, onClose, product }: CreateCampaignModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPosts | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>(['instagram', 'facebook', 'whatsapp']);

  const handleGeneratePosts = async () => {
    if (!product) return;

    setIsGenerating(true);
    try {
      const prompt = `Crie posts promocionais para o seguinte produto:

Nome: ${product.nome}
Descrição: ${product.descricao || 'Sem descrição'}
Preço: R$ ${product.preco?.toFixed(2) || '0.00'}
Link: ${product.link || 'Sem link'}

Gere 4 versões diferentes:
1. Post para Instagram (texto curto, com emojis e hashtags)
2. Post para Facebook (texto médio, mais descritivo)
3. Mensagem para WhatsApp (texto direto e persuasivo)
4. Story (texto curtíssimo e impactante)

Retorne APENAS um JSON válido neste formato exato:
{
  "instagram": "texto aqui",
  "facebook": "texto aqui",
  "whatsapp": "texto aqui",
  "story": "texto aqui"
}`;

      const { data, error } = await supabase.functions.invoke('gerar-conteudo-ia', {
        body: { 
          prompt,
          produto: product.nome 
        }
      });

      if (error) throw error;

      // Parse the generated content
      let posts: GeneratedPosts;
      
      if (typeof data.conteudo === 'string') {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = data.conteudo.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || 
                         data.conteudo.match(/(\{[\s\S]*\})/);
        
        if (jsonMatch) {
          posts = JSON.parse(jsonMatch[1]);
        } else {
          // Fallback: use the same text for all platforms
          posts = {
            instagram: data.conteudo,
            facebook: data.conteudo,
            whatsapp: data.conteudo,
            story: data.conteudo.slice(0, 100)
          };
        }
      } else {
        posts = data.conteudo;
      }

      setGeneratedPosts(posts);
      toast.success('Posts gerados com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar posts:', error);
      toast.error('Erro ao gerar posts. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveAndSchedule = async () => {
    if (!product || !generatedPosts) return;

    if (selectedNetworks.length === 0) {
      toast.error('Selecione pelo menos uma rede social');
      return;
    }

    if (!scheduleDate || !scheduleTime) {
      toast.error('Defina data e hora do agendamento');
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      // Create post
      const { data: postData, error: postError } = await (supabase as any)
        .from('posts')
        .insert({
          user_id: user.id,
          titulo: `Campanha: ${product.nome}`,
          texto_instagram: generatedPosts.instagram,
          texto_facebook: generatedPosts.facebook,
          texto_whatsapp: generatedPosts.whatsapp,
          texto_story: generatedPosts.story,
          link_produto: product.link,
          status: 'agendado'
        })
        .select()
        .single();

      if (postError) throw postError;

      // Schedule post
      const { error: scheduleError } = await (supabase as any)
        .from('scheduled_posts')
        .insert({
          user_id: user.id,
          post_id: postData.id,
          data: scheduleDate,
          hora: scheduleTime,
          redes: selectedNetworks,
          status: 'agendado'
        });

      if (scheduleError) throw scheduleError;

      toast.success('Campanha criada e agendada com sucesso!');
      onClose();
      resetForm();
    } catch (error) {
      console.error('Erro ao salvar campanha:', error);
      toast.error('Erro ao salvar campanha. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleNetwork = (network: string) => {
    setSelectedNetworks(prev => 
      prev.includes(network) 
        ? prev.filter(n => n !== network)
        : [...prev, network]
    );
  };

  const resetForm = () => {
    setGeneratedPosts(null);
    setScheduleDate('');
    setScheduleTime('');
    setSelectedNetworks(['instagram', 'facebook', 'whatsapp']);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            Criar Campanha com IA
          </DialogTitle>
          <DialogDescription>
            Produto: <strong>{product.nome}</strong> - R$ {product.preco?.toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!generatedPosts ? (
            <div className="text-center py-12">
              <Sparkles className="w-16 h-16 mx-auto mb-4 text-purple-500" />
              <h3 className="text-lg font-semibold mb-2">Gerar Posts com IA</h3>
              <p className="text-muted-foreground mb-6">
                A IA irá criar posts otimizados para Instagram, Facebook, WhatsApp e Stories
              </p>
              <Button
                onClick={handleGeneratePosts}
                disabled={isGenerating}
                size="lg"
                className="gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando posts...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Gerar Posts Agora
                  </>
                )}
              </Button>
            </div>
          ) : (
            <>
              {/* Generated Posts Preview */}
              <Tabs defaultValue="instagram" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="instagram" className="gap-2">
                    <Instagram className="w-4 h-4" />
                    Instagram
                  </TabsTrigger>
                  <TabsTrigger value="facebook" className="gap-2">
                    <Facebook className="w-4 h-4" />
                    Facebook
                  </TabsTrigger>
                  <TabsTrigger value="whatsapp" className="gap-2">
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </TabsTrigger>
                  <TabsTrigger value="story" className="gap-2">
                    <Instagram className="w-4 h-4" />
                    Story
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="instagram" className="space-y-2">
                  <Label>Post Instagram</Label>
                  <Textarea
                    value={generatedPosts.instagram}
                    onChange={(e) => setGeneratedPosts({ ...generatedPosts, instagram: e.target.value })}
                    rows={6}
                    className="resize-none"
                  />
                </TabsContent>

                <TabsContent value="facebook" className="space-y-2">
                  <Label>Post Facebook</Label>
                  <Textarea
                    value={generatedPosts.facebook}
                    onChange={(e) => setGeneratedPosts({ ...generatedPosts, facebook: e.target.value })}
                    rows={6}
                    className="resize-none"
                  />
                </TabsContent>

                <TabsContent value="whatsapp" className="space-y-2">
                  <Label>Mensagem WhatsApp</Label>
                  <Textarea
                    value={generatedPosts.whatsapp}
                    onChange={(e) => setGeneratedPosts({ ...generatedPosts, whatsapp: e.target.value })}
                    rows={6}
                    className="resize-none"
                  />
                </TabsContent>

                <TabsContent value="story" className="space-y-2">
                  <Label>Story</Label>
                  <Textarea
                    value={generatedPosts.story}
                    onChange={(e) => setGeneratedPosts({ ...generatedPosts, story: e.target.value })}
                    rows={4}
                    className="resize-none"
                  />
                </TabsContent>
              </Tabs>

              {/* Scheduling Section */}
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  <h3 className="font-semibold">Agendar Publicação</h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>Redes Sociais</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {[
                        { id: 'instagram', label: 'Instagram', icon: Instagram },
                        { id: 'facebook', label: 'Facebook', icon: Facebook },
                        { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle }
                      ].map(({ id, label, icon: Icon }) => (
                        <Badge
                          key={id}
                          variant={selectedNetworks.includes(id) ? 'default' : 'outline'}
                          className="cursor-pointer px-3 py-1.5"
                          onClick={() => toggleNetwork(id)}
                        >
                          <Icon className="w-3 h-3 mr-1" />
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="schedule-date">Data</Label>
                      <Input
                        id="schedule-date"
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="schedule-time">Hora</Label>
                      <Input
                        id="schedule-time"
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end border-t pt-4">
                <Button variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button
                  variant="outline"
                  onClick={handleGeneratePosts}
                  disabled={isGenerating}
                >
                  Gerar Novamente
                </Button>
                <Button
                  onClick={handleSaveAndSchedule}
                  disabled={isSaving}
                  className="gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4" />
                      Salvar e Agendar
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
