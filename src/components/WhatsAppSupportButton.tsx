import React from 'react';
import { MessageCircle } from 'lucide-react';

// Bolinha azul = link direto pro WhatsApp pessoal do fundador.
// Número: 21 96752-0706 (formato internacional 5521967520706)
const FOUNDER_WHATSAPP = '5521967520706';
const DEFAULT_MESSAGE = encodeURIComponent(
  'Olá! Vim pelo site da AMZ Ofertas e gostaria de falar com você.'
);

export function WhatsAppSupportButton() {
  const href = `https://wa.me/${FOUNDER_WHATSAPP}?text=${DEFAULT_MESSAGE}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-6 right-6 z-[9999] w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110"
    >
      <MessageCircle className="w-7 h-7 text-white" />
    </a>
  );
}
