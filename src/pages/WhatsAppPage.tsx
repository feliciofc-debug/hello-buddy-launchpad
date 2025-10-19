"use client";

import { useState } from 'react';
import { MessageCircle, Users, Send, Clock, TrendingUp, CheckCircle, AlertCircle, Settings, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface WhatsAppGroup {
  id: string;
  name: string;
  contactCount: number;
  lastMessageSent: string;
  isActive: boolean;
}

interface WhatsAppConfig {
  apiToken: string;
  phoneNumber: string;
  isConnected: boolean;
}

const WhatsAppPage = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<WhatsAppConfig>({
    apiToken: '',
    phoneNumber: '',
    isConnected: false
  });

  const [autoSend, setAutoSend] = useState({
    enabled: false,
    frequency: 'daily' as 'daily' | 'twice-daily' | 'weekly',
    preferredTimes: [] as string[]
  });

  const [messageTemplate, setMessageTemplate] = useState(
    'Olá! 👋\n\nConfira esta oferta incrível:\n\n🔥 {{NomeProduto}}\n💰 R$ {{Preco}}\n⭐ Avaliação excelente!\n\n🔗 {{LinkAfiliado}}\n\nNão perca!'
  );

  const [groups, setGroups] = useState<WhatsAppGroup[]>([
    {
      id: '1',
      name: 'Ofertas Eletrônicos VIP',
      contactCount: 234,
      lastMessageSent: 'Há 2 horas',
      isActive: true
    },
    {
      id: '2',
      name: 'Grupo Moda & Beleza',
      contactCount: 156,
      lastMessageSent: 'Há 5 horas',
      isActive: true
    },
    {
      id: '3',
      name: 'Casa & Cozinha Premium',
      contactCount: 89,
      lastMessageSent: 'Ontem',
      isActive: false
    }
  ]);

  const [saved, setSaved] = useState(false);

  const handleTestConnection = async () => {
    // TODO: Implementar teste de conexão real com WhatsApp API
    if (config.apiToken && config.phoneNumber) {
      alert('Testando conexão...\n\nEm breve: Integração com Evolution API / Baileys / Z-API');
      setConfig({ ...config, isConnected: true });
    } else {
      alert('Preencha o Token e o Número de Telefone');
    }
  };

  const handleSaveConfig = () => {
    // TODO: Salvar configuração no banco de dados
    console.log('Salvando configuração WhatsApp:', config, autoSend, messageTemplate);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const toggleTime = (time: string) => {
    setAutoSend(prev => ({
      ...prev,
      preferredTimes: prev.preferredTimes.includes(time)
        ? prev.preferredTimes.filter(t => t !== time)
        : [...prev.preferredTimes, time]
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Voltar ao Dashboard</span>
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
            <MessageCircle className="w-8 h-8 text-green-500" />
            WhatsApp Business Integration
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure envios automáticos e gerencie seus grupos de WhatsApp
          </p>
        </div>

        {/* Alert - API Integration Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                APIs Recomendadas para Integração
              </h3>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>• <strong>Evolution API</strong> - API oficial brasileira (recomendado)</li>
                <li>• <strong>Baileys</strong> - Biblioteca open-source para Node.js</li>
                <li>• <strong>Z-API</strong> - Solução comercial com suporte</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Configuração WhatsApp API */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Settings className="w-6 h-6 text-green-500" />
            Configuração WhatsApp Business API
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                WhatsApp API Token
              </label>
              <input
                type="password"
                value={config.apiToken}
                onChange={(e) => setConfig({ ...config, apiToken: e.target.value })}
                placeholder="Cole seu token de API aqui"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Número de Telefone (WhatsApp)
              </label>
              <input
                type="tel"
                value={config.phoneNumber}
                onChange={(e) => setConfig({ ...config, phoneNumber: e.target.value })}
                placeholder="+55 11 99999-9999"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleTestConnection}
              className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              Testar Conexão
            </button>
            
            {config.isConnected && (
              <span className="text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Conectado
              </span>
            )}
          </div>
        </div>

        {/* Métricas WhatsApp */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <Send className="w-8 h-8 opacity-80" />
              <span className="text-3xl font-bold">127</span>
            </div>
            <p className="text-green-100">Mensagens Hoje</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 opacity-80" />
              <span className="text-3xl font-bold">23.5%</span>
            </div>
            <p className="text-blue-100">Taxa de Cliques</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-8 h-8 opacity-80" />
              <span className="text-3xl font-bold">{groups.filter(g => g.isActive).length}</span>
            </div>
            <p className="text-purple-100">Grupos Ativos</p>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <MessageCircle className="w-8 h-8 opacity-80" />
              <span className="text-3xl font-bold">89</span>
            </div>
            <p className="text-orange-100">Leads Gerados</p>
          </div>
        </div>

        {/* Grupos e Contatos */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-500" />
              Grupos e Contatos
            </h2>
            <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors text-sm">
              + Adicionar Grupo
            </button>
          </div>

          <div className="space-y-3">
            {groups.map(group => (
              <div
                key={group.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    group.isActive ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-200 dark:bg-gray-600'
                  }`}>
                    <Users className={`w-6 h-6 ${
                      group.isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-500'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{group.name}</h3>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {group.contactCount} contatos
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Última mensagem: {group.lastMessageSent}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-3 py-1 rounded-full ${
                    group.isActive
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                  }`}>
                    {group.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                  <button className="px-4 py-2 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors">
                    Gerenciar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Envios Automáticos */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="w-6 h-6 text-purple-500" />
            Envios Automáticos
          </h2>

          {/* Toggle Ativar */}
          <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg mb-4 cursor-pointer">
            <div>
              <span className="font-semibold text-gray-900 dark:text-white">Ativar envio automático</span>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Envie ofertas automaticamente para seus grupos
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoSend.enabled}
              onChange={(e) => setAutoSend({ ...autoSend, enabled: e.target.checked })}
              className="w-5 h-5 text-purple-500 rounded focus:ring-2 focus:ring-purple-500"
            />
          </label>

          {/* Frequência */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Frequência de Envio:
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'daily', label: '📅 Diária' },
                { value: 'twice-daily', label: '📅📅 2x ao Dia' },
                { value: 'weekly', label: '📆 Semanal' }
              ].map(freq => (
                <button
                  key={freq.value}
                  onClick={() => setAutoSend({ ...autoSend, frequency: freq.value as any })}
                  className={`py-3 px-4 rounded-lg font-medium transition-all ${
                    autoSend.frequency === freq.value
                      ? 'bg-purple-500 text-white shadow-lg'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {freq.label}
                </button>
              ))}
            </div>
          </div>

          {/* Horários Preferenciais */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Horários Preferenciais:
            </label>
            <div className="grid grid-cols-4 gap-2">
              {['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'].map(time => (
                <button
                  key={time}
                  onClick={() => toggleTime(time)}
                  className={`py-2 px-4 rounded-lg font-medium transition-all ${
                    autoSend.preferredTimes.includes(time)
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>

          {/* Template de Mensagem */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Template de Mensagem:
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Use as variáveis: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{'{{NomeProduto}}'}</code>,{' '}
              <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{'{{Preco}}'}</code>,{' '}
              <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{'{{LinkAfiliado}}'}</code>
            </p>
            <textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
              placeholder="Digite seu template de mensagem..."
            />
          </div>
        </div>

        {/* Botão Salvar */}
        <div className="flex justify-end">
          <button
            onClick={handleSaveConfig}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
              saved
                ? 'bg-green-500 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            <CheckCircle className="w-5 h-5" />
            {saved ? '✓ Salvo com sucesso!' : 'Salvar Configurações'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppPage;
