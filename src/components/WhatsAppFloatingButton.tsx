import React from 'react';

// Botão flutuante de WhatsApp oficial — abre conversa direto com o agente Pietro (Cloud API)
// Posicionado no canto INFERIOR ESQUERDO pra não brigar com o WhatsAppSupportButton (bottom-right).
const WHATSAPP_NUMBER = '5521980804901'; // Pietro automático (modo AMZ)
const PREFILL_MESSAGE = 'Olá! Quero saber mais sobre a AMZ Ofertas.';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(PREFILL_MESSAGE)}`;

export function WhatsAppFloatingButton() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-6 left-6 z-[9999] w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-2xl"
      style={{ backgroundColor: '#25D366' }}
    >
      {/* Ícone oficial do WhatsApp (SVG) */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        className="w-8 h-8"
        fill="white"
        aria-hidden="true"
      >
        <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.93 2.708.93.46 0 2.06-.387 2.435-.788.187-.215.358-.616.358-.917 0-.13-.03-.244-.058-.358-.085-.144-2.32-1.16-2.708-1.247zm-2.21 9.392c-1.673 0-3.31-.466-4.74-1.323l-.34-.2-3.523.92.94-3.438-.214-.353a8.94 8.94 0 0 1-1.376-4.78c0-4.928 4.014-8.942 8.943-8.942 2.39 0 4.63.93 6.32 2.62 1.69 1.689 2.62 3.93 2.621 6.32 0 4.93-4.014 8.944-8.943 8.944zm0-19.59c-5.84 0-10.59 4.75-10.59 10.59 0 1.866.486 3.687 1.413 5.293L6 30l5.298-1.39a10.575 10.575 0 0 0 5.06 1.288h.004c5.84 0 10.59-4.75 10.593-10.59 0-2.829-1.101-5.488-3.1-7.49a10.524 10.524 0 0 0-7.494-3.1z" />
      </svg>
    </a>
  );
}

export default WhatsAppFloatingButton;
