import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Loader2, Copy, Calendar, Rocket, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number | null;
  imagem_url: string | null;
  categoria: string;
}

interface Cliente {
  nome: string;
  tipo_negocio: string | null;
}

interface CriarCampanhaModalProps {
  isOpen: boolean;
  onClose: () => void;
  produto: Produto;
  cliente?: Cliente | null;
}

interface PostsGerados {
  instagram: { opcaoA: string; opcaoB: string; opcaoC: string };
  facebook: { opcaoA: string; opcaoB: string; opcaoC: string };
  story: { opcaoA: string; opcaoB: string; opcaoC: string };
}

export function CriarCampanhaModal({ isOpen, onClose, produto, cliente }: CriarCampanhaModalProps) {
  const [loading, setLoading] = useState(false);
  const [postsGerados, setPostsGerados] = useState<PostsGerados | null>(null);
  const [instagramSelecionado, setInstagramSelecionado] = useState('A');
  const [facebookSelecionado, setFacebookSelecionado] = useState('A');
  const [storySelecionado, setStorySelecionado] = useState('A');

  const gerarPostsComIA = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('gerar-posts', {
        body: {
          produto: {
            nome: produto.nome,
            descricao: produto.descricao,
            preco: produto.preco,
            categoria: produto.categoria
          },
          cliente: cliente ? {
            nome: cliente.nome,
            tipo: cliente.tipo_negocio
          } : null
        }
      });

      if (error) throw error;
      setPostsGerados(data.posts);
      toast.success('Posts gerados com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar posts:', error);
      toast.error('Erro ao gerar posts');
    } finally {
      setLoading(false);
    }
  };

  const copiarTodos = () => {
    if (!postsGerados) return;

    const textoInstagram = postsGerados.instagram[`opcao${instagramSelecionado}` as keyof typeof postsGerados.instagram];
    const textoFacebook = postsGerados.facebook[`opcao${facebookSelecionado}` as keyof typeof postsGerados.facebook];
    const textoStory = postsGerados.story[`opcao${storySelecionado}` as keyof typeof postsGerados.story];

    const textoCompleto = `📱 INSTAGRAM:\n${textoInstagram}\n\n📘 FACEBOOK:\n${textoFacebook}\n\n📖 STORY:\n${textoStory}`;
    
    navigator.clipboard.writeText(textoCompleto);
    toast.success('Posts copiados para a área de transferência!');
  };

  const abrirModalAgendamento = () => {
    toast.info('Funcionalidade de agendamento em desenvolvimento');
  };

  const publicarAgora = () => {
    toast.info('Funcionalidade de publicação em desenvolvimento');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            🚀 Criar Campanha - {produto.nome}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {cliente ? `Cliente: ${cliente.nome}` : 'Minha Empresa'}
          </p>
        </DialogHeader>

        {/* Preview do Produto */}
        <div className="bg-accent/50 p-4 rounded-lg mb-4">
          <div className="flex gap-4">
            {produto.imagem_url ? (
              <img 
                src={produto.imagem_url} 
                alt={produto.nome}
                className="w-32 h-32 object-cover rounded"
              />
            ) : (
              <div className="w-32 h-32 bg-muted rounded flex items-center justify-center">
                <ImageIcon className="w-12 h-12 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-bold text-lg">{produto.nome}</h3>
              <p className="text-sm text-muted-foreground">{produto.descricao}</p>
              {produto.preco && (
                <p className="text-2xl text-primary font-bold mt-2">
                  R$ {produto.preco.toFixed(2)}
                </p>
              )}
            </div>
          </div>
        </div>

        {!postsGerados ? (
          <div className="text-center py-12">
            <Button 
              size="lg" 
              onClick={gerarPostsComIA}
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Gerando Posts com IA...
                </>
              ) : (
                <>✨ GERAR POSTS COM IA</>
              )}
            </Button>
          </div>
        ) : (
          <>
            {/* Posts Gerados */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Instagram */}
              <Card>
                <CardHeader>
                  <h4 className="font-semibold">📱 Post Instagram</h4>
                </CardHeader>
                <CardContent className="space-y-3">
                  <RadioGroup value={instagramSelecionado} onValueChange={setInstagramSelecionado}>
                    {['A', 'B', 'C'].map((opcao) => (
                      <div key={opcao} className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value={opcao} id={`insta-${opcao}`} />
                          <Label htmlFor={`insta-${opcao}`}>Opção {opcao}</Label>
                        </div>
                        <Textarea 
                          value={postsGerados.instagram[`opcao${opcao}` as keyof typeof postsGerados.instagram]} 
                          readOnly
                          rows={5}
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>

              {/* Facebook */}
              <Card>
                <CardHeader>
                  <h4 className="font-semibold">📘 Post Facebook</h4>
                </CardHeader>
                <CardContent className="space-y-3">
                  <RadioGroup value={facebookSelecionado} onValueChange={setFacebookSelecionado}>
                    {['A', 'B', 'C'].map((opcao) => (
                      <div key={opcao} className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value={opcao} id={`fb-${opcao}`} />
                          <Label htmlFor={`fb-${opcao}`}>Opção {opcao}</Label>
                        </div>
                        <Textarea 
                          value={postsGerados.facebook[`opcao${opcao}` as keyof typeof postsGerados.facebook]} 
                          readOnly
                          rows={5}
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>

              {/* Story */}
              <Card>
                <CardHeader>
                  <h4 className="font-semibold">📖 Story Instagram</h4>
                </CardHeader>
                <CardContent className="space-y-3">
                  <RadioGroup value={storySelecionado} onValueChange={setStorySelecionado}>
                    {['A', 'B', 'C'].map((opcao) => (
                      <div key={opcao} className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value={opcao} id={`story-${opcao}`} />
                          <Label htmlFor={`story-${opcao}`}>Opção {opcao}</Label>
                        </div>
                        <Textarea 
                          value={postsGerados.story[`opcao${opcao}` as keyof typeof postsGerados.story]} 
                          readOnly
                          rows={5}
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>
            </div>

            {/* Ações */}
            <div className="flex gap-4 justify-center">
              <Button 
                variant="outline" 
                size="lg"
                onClick={copiarTodos}
                className="gap-2"
              >
                <Copy className="w-4 h-4" />
                Copiar Todos
              </Button>
              <Button 
                size="lg"
                onClick={abrirModalAgendamento}
                className="gap-2"
              >
                <Calendar className="w-4 h-4" />
                Agendar Postagens
              </Button>
              <Button 
                size="lg" 
                variant="default"
                onClick={publicarAgora}
                className="gap-2"
              >
                <Rocket className="w-4 h-4" />
                Publicar Agora
              </Button>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
