"use client";

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import WhatsAppConnectionPJ from '@/components/pj/WhatsAppConnectionPJ';
import EnviosProgramadosPJ from '@/components/pj/EnviosProgramadosPJ';
import CriarGrupoWhatsAppPJ from '@/components/pj/CriarGrupoWhatsAppPJ';
import ListarGruposPJ from '@/components/pj/ListarGruposPJ';
import ConfigurarAssistentePJ from '@/components/pj/ConfigurarAssistentePJ';
import ImportContatosPJ from '@/components/pj/ImportContatosPJ';

export default function WhatsAppAutomacaoPJ() {
  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <Link to="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Dashboard
          </Button>
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Automação WhatsApp PJ</h1>
        <p className="text-muted-foreground">
          Gerencie sua conexão, grupos e envios automáticos
        </p>
      </div>

      <Tabs defaultValue="conexao" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="conexao">Conexão</TabsTrigger>
          <TabsTrigger value="importar">Importar</TabsTrigger>
          <TabsTrigger value="grupos">Criar Grupo</TabsTrigger>
          <TabsTrigger value="meus-grupos">Meus Grupos</TabsTrigger>
          <TabsTrigger value="assistente">Assistente</TabsTrigger>
          <TabsTrigger value="programados">Envios</TabsTrigger>
        </TabsList>

        <TabsContent value="conexao">
          <WhatsAppConnectionPJ />
          
          {/* Instruções */}
          <div className="mt-6 bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p className="font-semibold mb-2">📱 Como conectar:</p>
            <ol className="space-y-1 list-decimal list-inside">
              <li>Clique em "Conectar WhatsApp"</li>
              <li>Abra o WhatsApp no seu celular</li>
              <li>Vá em <strong>Configurações → Aparelhos conectados</strong></li>
              <li>Toque em <strong>"Conectar aparelho"</strong></li>
              <li>Escaneie o QR Code exibido</li>
            </ol>
            
            <p className="font-semibold mt-4 mb-2">ℹ️ Importante:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Use um número dedicado para atendimento</li>
              <li>Mantenha o celular com bateria e internet</li>
              <li>Não desconecte o WhatsApp Web manualmente</li>
              <li>O QR Code expira em ~60 segundos</li>
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="grupos">
          <div className="grid gap-6 md:grid-cols-2">
            <CriarGrupoWhatsAppPJ />
            
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground h-fit">
              <p className="font-semibold mb-2">💡 Dicas para Grupos:</p>
              <ul className="space-y-2 list-disc list-inside">
                <li>Use nomes descritivos (Ex: "Ofertas VIP - Eletrônicos")</li>
                <li>O link de convite é gerado automaticamente</li>
                <li>Você será admin do grupo criado</li>
                <li>Adicione uma descrição para ajudar os membros</li>
              </ul>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="meus-grupos">
          <ListarGruposPJ />
        </TabsContent>

        <TabsContent value="assistente">
          <div className="grid gap-6 md:grid-cols-2">
            <ConfigurarAssistentePJ />
            
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground h-fit">
              <p className="font-semibold mb-2">🤖 Sobre o Assistente:</p>
              <ul className="space-y-2 list-disc list-inside">
                <li>O assistente virtual responde automaticamente</li>
                <li>Use um nome amigável e profissional</li>
                <li>Ele será usado nas conversas com clientes</li>
                <li>Funciona com IA para respostas inteligentes</li>
              </ul>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="programados">
          <EnviosProgramadosPJ />
        </TabsContent>
      </Tabs>
    </div>
  );
}
