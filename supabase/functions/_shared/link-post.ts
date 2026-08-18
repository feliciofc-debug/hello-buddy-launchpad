// Aplica o estilo de copy do tenant na legenda no momento da publicação:
//  - link de atendimento no INÍCIO da legenda (Instagram corta em ~125 chars)
//  - assinatura pessoal no fim, quando voz_copy = 'pessoa'
// Multi-tenant: SEMPRE filtrado por user_id. Sem link salvo → texto original.

import { aplicarEstiloCopy, getCopyStyle } from "./copy-style.ts";

export async function appendLinkPost(
  supabase: any,
  userId: string | null | undefined,
  text: string | null | undefined,
): Promise<string> {
  const base = (text || '').trim()
  if (!userId) return base

  try {
    const style = await getCopyStyle(supabase, userId)
    return aplicarEstiloCopy(base, style)
  } catch (e) {
    console.warn('⚠️ appendLinkPost falhou, publicando sem link:', e)
    return base
  }
}
