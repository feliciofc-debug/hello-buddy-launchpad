import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Copy, Instagram, MessageCircle, Facebook, Film } from 'lucide-react';
import { toast } from 'sonner';

interface TesmannModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: {
    reelsScript?: string;
    instagramPost?: string;
    whatsappMessage?: string;
    facebookAdIdeas?: string;
  } | null;
  isLoading: boolean;
}

const ContentDisplay = ({ title, content, icon: Icon }: { title: string, content?: string, icon: React.ElementType }) => {
  const handleCopy = () => {
    if (content) {
      navigator.clipboard.writeText(content);
      toast.success(`${title} copiado para a área de transferência!`);
    }
  };

  return (
    <div className="relative p-4 border rounded-md bg-background/50 h-64 overflow-y-auto">
      <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={handleCopy}>
        <Copy className="h-4 w-4" />
      </Button>
      <div className="flex items-center mb-2">
        <Icon className="h-5 w-5 mr-2" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="text-sm whitespace-pre-wrap">{content || 'Nenhum conteúdo gerado.'}</p>
    </div>
  );
};

export const TesmannModal: React.FC<TesmannModalProps> = ({ isOpen, onClose, content, isLoading }) => {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-2xl">🤖 Estratégia de Conteúdo (IA-Tesmann)</DialogTitle>
          <DialogDescription>
            Sua campanha de marketing completa, gerada por IA. Use os botões para copiar.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-4 text-muted-foreground">Nossa IA está forjando sua estratégia...</p>
          </div>
         ) : (
          <Tabs defaultValue="reels" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="reels">Reels</TabsTrigger>
              <TabsTrigger value="instagram">Instagram</TabsTrigger>
              <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
              <TabsTrigger value="facebook">Facebook Ads</TabsTrigger>
            </TabsList>
            <TabsContent value="reels">
              <ContentDisplay title="Roteiro para Reels/TikTok" content={content?.reelsScript} icon={Film} />
            </TabsContent>
            <TabsContent value="instagram">
              <ContentDisplay title="Post para Instagram" content={content?.instagramPost} icon={Instagram} />
            </TabsContent>
            <TabsContent value="whatsapp">
              <ContentDisplay title="Mensagem para WhatsApp" content={content?.whatsappMessage} icon={MessageCircle} />
            </TabsContent>
            <TabsContent value="facebook">
              <ContentDisplay title="Ideias para Anúncio" content={content?.facebookAdIdeas} icon={Facebook} />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
