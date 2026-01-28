"use client";

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import WhatsAppConnectionPJ from '@/components/pj/WhatsAppConnectionPJ';
import EnviosProgramadosPJ from '@/components/pj/EnviosProgramadosPJ';

export default function WhatsAppAutomacaoPJ() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
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
          Gerencie sua conexão e envios automáticos para grupos
        </p>
      </div>

      <Tabs defaultValue="conexao" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="conexao">Conexão</TabsTrigger>
          <TabsTrigger value="programados">Envios Programados</TabsTrigger>
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

        <TabsContent value="programados">
          <EnviosProgramadosPJ />
        </TabsContent>
      </Tabs>
    </div>
  );
}
