// src/components/NotificationCenter.tsx
// INSTRUÇÕES LOVABLE: Criar arquivo em src/components/NotificationCenter.tsx

"use client";

import { useState } from 'react';
import { Bell, X, TrendingUp, Package, DollarSign, Sparkles } from 'lucide-react';

interface Notification {
  id: string;
  type: 'launch' | 'trending' | 'new' | 'price-drop';
  title: string;
  message: string;
  time: string;
  read: boolean;
  productId?: string;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'launch',
    title: '🔥 Novo Lançamento em Eletrônicos',
    message: 'Air Fryer XYZ foi adicionado. Comissão: R$ 55,98',
    time: '2 min atrás',
    read: false,
    productId: 'shp-001'
  },
  {
    id: '2',
    type: 'trending',
    title: '📈 Produto em Alta!',
    message: 'Mouse Gamer ABC teve aumento de 150% nas vendas hoje',
    time: '15 min atrás',
    read: false,
    productId: 'amz-002'
  },
  {
    id: '3',
    type: 'new',
    title: '🌟 3 Novos Produtos em Casa e Cozinha',
    message: 'Produtos adicionados no seu nicho favorito',
    time: '1 hora atrás',
    read: false
  },
  {
    id: '4',
    type: 'price-drop',
    title: '💰 Queda de Preço',
    message: 'Smart Watch P8 Plus agora R$ 159,90 (era R$ 399,90)',
    time: '3 horas atrás',
    read: true,
    productId: 'amz-002'
  },
  {
    id: '5',
    type: 'launch',
    title: '🔥 Lançamento Hotmart',
    message: 'Mentoria: Afiliado Profissional em 60 Dias - Comissão 70%',
    time: '5 horas atrás',
    read: true,
    productId: 'hot-002'
  }
];

const NotificationCenter = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'launch':
        return <Sparkles className="w-5 h-5 text-orange-500" />;
      case 'trending':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'new':
        return <Package className="w-5 h-5 text-blue-500" />;
      case 'price-drop':
        return <DollarSign className="w-5 h-5 text-purple-500" />;
    }
  };

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-50 max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Notificações
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-500 hover:text-blue-600 font-medium"
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">
                    Nenhuma notificação
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {notifications.map(notification => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        !notification.read ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                      }`}
                    >
                      <div className="flex gap-3">
                        {/* Icon */}
                        <div className="flex-shrink-0 mt-1">
                          {getIcon(notification.type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                              {notification.title}
                            </h4>
                            <button
                              onClick={() => deleteNotification(notification.id)}
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {notification.time}
                            </span>
                            {!notification.read && (
                              <button
                                onClick={() => markAsRead(notification.id)}
                                className="text-xs text-blue-500 hover:text-blue-600 font-medium"
                              >
                                Marcar como lida
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                <button className="w-full text-sm text-blue-500 hover:text-blue-600 font-medium">
                  Ver todas as notificações
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;