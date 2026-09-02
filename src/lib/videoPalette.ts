const TEXTO_ESCURO = '#151515';
const TEXTO_CLARO = '#f4f7fb';

function luminancia(hex: string): number {
  const valor = String(hex || '').replace('#', '').trim();
  const completo = valor.length === 3 ? valor.split('').map((c) => c + c).join('') : valor.padEnd(6, '0');
  const numero = Number.parseInt(completo.slice(0, 6), 16);
  if (Number.isNaN(numero)) return 0;

  const canais = [(numero >> 16) & 255, (numero >> 8) & 255, numero & 255].map((canal) => {
    const normalizado = canal / 255;
    return normalizado <= 0.03928
      ? normalizado / 12.92
      : Math.pow((normalizado + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2];
}

function contraste(a: string, b: string): number {
  const luminosidades = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (luminosidades[0] + 0.05) / (luminosidades[1] + 0.05);
}

function textoSobre(cor: string): string {
  return luminancia(cor) > 0.45 ? TEXTO_ESCURO : TEXTO_CLARO;
}

export function validarPaleta(cores: Record<string, string>): string | null {
  const textoDoDestaque = textoSobre(cores.destaque);
  if (contraste(cores.destaque, textoDoDestaque) < 4.5) {
    return 'A cor principal não tem contraste suficiente para o texto do vídeo.';
  }
  if (contraste(cores.bg, cores.texto) < 4.5) {
    return 'A cor do fundo e a cor do texto precisam ter mais contraste.';
  }
  if (contraste(cores.bg2, cores.texto) < 4.5) {
    return 'O segundo fundo e a cor do texto precisam ter mais contraste.';
  }
  if (contraste(cores.panel, textoSobre(cores.panel)) < 4.5) {
    return 'A cor do painel precisa ter contraste suficiente para as legendas.';
  }
  return null;
}
