"use client";

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Smartphone, Users } from 'lucide-react';
import WhatsAppConnectionPJ from '@/components/pj/WhatsAppConnectionPJ';
import ContatosListasPJ from '@/components/pj/ContatosListasPJ';

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
        <h1 className="text-2xl font-bold">📱 WhatsApp</h1>
        <p className="text-muted-foreground">
          Conecte seu celular e gerencie contatos & listas
        </p>
      </div>

      <Tabs defaultValue="conexao" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="conexao" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Conectar Celular
          </TabsTrigger>
          <TabsTrigger value="contatos" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Contatos & Listas
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="conexao" className="mt-4">
          <WhatsAppConnectionPJ />
        </TabsContent>
        
        <TabsContent value="contatos" className="mt-4">
          <ContatosListasPJ />
        </TabsContent>
      </Tabs>
    </div>
  );
}
