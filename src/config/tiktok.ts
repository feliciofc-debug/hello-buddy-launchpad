// ============================================================
// TikTok — ponto ÚNICO de configuração (sandbox | producao)
// ------------------------------------------------------------
// Para virar de ambiente, mude APENAS a constante TIKTOK_ENV
// abaixo (ou defina VITE_TIKTOK_ENV no ambiente de build).
// Quando o review de produção do TikTok for aprovado:
//   TIKTOK_ENV = 'producao'
// ============================================================

export type TikTokEnv = 'sandbox' | 'producao';

const ENV_OVERRIDE = (import.meta.env.VITE_TIKTOK_ENV as TikTokEnv | undefined);

// App aprovado pelo TikTok (LIVE em 10/09/2026) -> produção é o padrão.
// Para voltar a testar em sandbox: VITE_TIKTOK_ENV=sandbox
export const TIKTOK_ENV: TikTokEnv = ENV_OVERRIDE === 'sandbox' ? 'sandbox' : 'producao';

// Enquanto a auditoria do Direct Post não for concluída pelo TikTok:
//  - máximo de 5 usuários publicando via Direct Post em 24h
//  - a conta precisa estar em modo privado
//  - o conteúdo sai como SELF_ONLY (privado)
// O modo RASCUNHO não tem nenhuma dessas restrições.
export const TIKTOK_DIRECT_POST_AUDITADO = false;

// client_key é PÚBLICA (aparece na URL de OAuth) — pode ficar no código.
// O client_secret NUNCA fica aqui: vive nos secrets do backend.
const CLIENT_KEYS: Record<TikTokEnv, string> = {
  sandbox: 'sbawx08s3trep7gfvg',
  producao: 'aw2ouo90dyp4ju9w',
};

export const TIKTOK_CLIENT_KEY = CLIENT_KEYS[TIKTOK_ENV];

// Deve estar cadastrada nos DOIS apps (sandbox e produção), sem barra final.
export const TIKTOK_REDIRECT_URI = 'https://amzofertas.com.br/tiktok/callback';

export const TIKTOK_SCOPES = 'user.info.basic,user.info.profile,video.upload,video.publish';

/** Monta a URL de autorização do TikTok. `state` = user_id do usuário logado. */
export function buildTikTokAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_key: TIKTOK_CLIENT_KEY,
    response_type: 'code',
    scope: TIKTOK_SCOPES,
    redirect_uri: TIKTOK_REDIRECT_URI,
    state,
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
}
