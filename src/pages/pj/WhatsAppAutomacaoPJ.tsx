"use client";

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
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
        <h1 className="text-2xl font-bold">📋 Contatos & Listas</h1>
        <p className="text-muted-foreground">
          Gerencie suas listas de transmissão, grupos e contatos
        </p>
      </div>

      <ContatosListasPJ />
    </div>
  );
}
