// Anexa o "Link do post" configurado pelo tenant (empresa_config.link_post)
// ao final da legenda. Multi-tenant: SEMPRE filtrado por user_id.
// Se não houver link salvo, retorna o texto original sem alterações.

export async function appendLinkPost(
  supabase: any,
  userId: string | null | undefined,
  text: string | null | undefined,
): Promise<string> {
  const base = (text || '').trim()
  if (!userId) return base

  try {
    const { data } = await supabase
      .from('empresa_config')
      .select('link_post')
      .eq('user_id', userId)
      .maybeSingle()

    const link = (data?.link_post || '').trim()
    if (!link) return base
    if (!/^https?:\/\//i.test(link)) return base
    if (base.includes(link)) return base

    return base ? `${base}\n\n${link}` : link
  } catch (e) {
    console.warn('⚠️ appendLinkPost falhou, publicando sem link:', e)
    return base
  }
}
