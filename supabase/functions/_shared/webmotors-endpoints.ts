export type WebmotorsAmbiente = "homolog" | "producao";

export type WebmotorsService =
  | "login"
  | "estoque_carros"
  | "estoque_motos"
  | "codigos_motos";

const PROD = {
  login: "https://integracao.webmotors.com.br/wsLoginSistemaRevendedor.asmx",
  estoque_carros:
    "https://integracao.webmotors.com.br/wsEstoqueRevendedorWebMotors.asmx",
  estoque_motos:
    "https://integracao.webmotors.com.br/Motos/wsEstoqueRevendedorMotos.asmx",
  codigos_motos:
    "https://integracao.webmotors.com.br/Motos/wsCodigosWebMotorsMotos.asmx",
} as const;

/** Homolog: espelha manual §6 (validar com credenciais reais da loja). */
const HOMOLOG = {
  login:
    "https://hportal.webmotors.com.br/IntegracaoRevendedor/wsLoginSistemaRevendedor.asmx",
  estoque_carros:
    "https://hportal.webmotors.com.br/IntegracaoRevendedor/wsEstoqueRevendedorWebMotors.asmx",
  estoque_motos:
    "https://hportal.webmotors.com.br/IntegracaoRevendedor/Motos/wsEstoqueRevendedorMotos.asmx",
  codigos_motos:
    "https://hportal.webmotors.com.br/IntegracaoRevendedor/Motos/wsCodigosWebMotorsMotos.asmx",
} as const;

export function webmotorsEndpoint(
  ambiente: WebmotorsAmbiente,
  service: WebmotorsService,
): string {
  const table = ambiente === "producao" ? PROD : HOMOLOG;
  return table[service];
}

export const WM_LOGIN_NS = "www.webmotors.com.br/wsLoginSistemaRevendedor";
export const WM_ESTOQUE_NS = "www.webmotors.com.br/wsEstoqueRevendedorWebMotors";
export const WM_ESTOQUE_MOTOS_NS = "www.webmotors.com.br/wsEstoqueRevendedorMotos";
export const WM_CODIGOS_MOTOS_NS = "www.webmotors.com.br/wsCodigosWebMotorsMotos";
