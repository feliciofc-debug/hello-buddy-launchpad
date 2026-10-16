import type { CopyStyle } from "./copy-style.ts";

export type VehiclePostInput = {
  marca: string;
  modelo: string;
  versao?: string | null;
  ano_fabricacao?: number | null;
  ano_modelo?: number | null;
  km?: number | null;
  cambio?: string | null;
  combustivel?: string | null;
  blindado?: boolean;
  nivel_blindagem?: string | null;
  cor?: string | null;
  opcionais?: string[] | null;
  nome_loja?: string | null;
};

function formatAno(v: VehiclePostInput): string {
  const af = v.ano_fabricacao;
  const am = v.ano_modelo;
  if (af && am && af !== am) return `${af}/${am}`;
  if (am) return String(am);
  if (af) return String(af);
  return "";
}

export function buildGerarPostsVehiclePrompt(
  veiculo: VehiclePostInput,
  copyStyle: CopyStyle,
): string {
  const titulo = [veiculo.marca, veiculo.modelo, veiculo.versao].filter(Boolean).join(" ");
  const ano = formatAno(veiculo);
  const km = veiculo.km != null
    ? `${veiculo.km.toLocaleString("pt-BR")} km`
    : null;
  const blindagem = veiculo.blindado
    ? `Blindado${veiculo.nivel_blindagem ? ` (${veiculo.nivel_blindagem})` : ""}`
    : null;
  const opcionais = (veiculo.opcionais || []).filter(Boolean).slice(0, 8).join(", ");
  const loja = (veiculo.nome_loja || "nossa loja").trim();

  const dados = [
    `Veículo: ${titulo}`,
    ano ? `Ano: ${ano}` : null,
    km ? `Quilometragem: ${km}` : null,
    veiculo.cambio ? `Câmbio: ${veiculo.cambio}` : null,
    veiculo.combustivel ? `Combustível: ${veiculo.combustivel}` : null,
    veiculo.cor ? `Cor: ${veiculo.cor}` : null,
    blindagem,
    opcionais ? `Opcionais/diferenciais: ${opcionais}` : null,
    `Nome da loja (use no convite final): ${loja}`,
  ].filter(Boolean).join("\n");

  return `Crie legendas de VEÍCULO SEMI-NOVO/PREMIUM para redes sociais.
${copyStyle.promptBlock}

PÚBLICO: padrão alto. Tom elegante, educado e envolvente; trate o leitor por "você".
PROIBIDO: caixa alta gritada, "IMPERDÍVEL", "PROMOÇÃO", "CORRE", excesso de exclamações, linguagem popular agressiva.
Emojis: no máximo 2 por legenda, discretos.

ESTRUTURA de cada legenda:
1) Uma frase de abertura envolvente/emocional.
2) Linha de destaque: Modelo Versão · Ano · diferenciais REAIS recebidos (ex.: blindagem, km, câmbio).
3) Uma ou duas frases sobre benefício e sensação (segurança, conforto, presença) — só com base nos dados.
4) Convite gentil ao final (visita, test drive ou WhatsApp), citando "${loja}".
5) Três a cinco hashtags discretas no final.

REGRAS ABSOLUTAS:
- Use SOMENTE os dados abaixo. Não invente itens, números, garantias, prazos ou links/URLs/domínios.
- NÃO inclua preço, valor, "R$" ou condições financeiras no texto.
- NÃO escreva http, www, .com, .com.br nem placeholders de site.

VARIAÇÃO DE ESTILO (alterne entre as opções A/B/C de cada rede):
- Opção A: linha "sofisticada e discreta".
- Opção B: linha "emocional e envolvente".
- Opção C: mistura equilibrada das duas linhas.

Exemplo de referência (adaptar aos dados reais, sem copiar literalmente se o veículo for outro):
"Presença que não pede licença. Blindagem Carbon, motor 3.0 turbo diesel e apenas 20.800 km rodados, pronto para acompanhar você com a segurança e o conforto que a sua rotina merece. Será um prazer recebê-lo na Royal 4x4 para conhecê-lo pessoalmente. 📲 Agende sua visita pelo WhatsApp."

DADOS DO VEÍCULO:
${dados}

Gere 12 variações (3 por formato):

INSTAGRAM (opcaoA, opcaoB, opcaoC)
FACEBOOK (opcaoA, opcaoB, opcaoC)
STORY INSTAGRAM — máx. 80 caracteres cada (opcaoA, opcaoB, opcaoC)
LINKEDIN (opcaoA, opcaoB, opcaoC) — tom profissional elegante

Retorne APENAS JSON:
{
  "instagram": { "opcaoA": "", "opcaoB": "", "opcaoC": "" },
  "facebook": { "opcaoA": "", "opcaoB": "", "opcaoC": "" },
  "story": { "opcaoA": "", "opcaoB": "", "opcaoC": "" },
  "linkedin": { "opcaoA": "", "opcaoB": "", "opcaoC": "" }
}`;
}
