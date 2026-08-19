// Helpers compartilhados da integração LinkedIn (Fase 1 — perfil pessoal)
export const LINKEDIN_VERSION = '202601';
export const LINKEDIN_SCOPES = 'openid profile email w_member_social';

export const linkedinRedirectUri = () =>
  `${Deno.env.get('SUPABASE_URL')}/functions/v1/linkedin-oauth-callback`;

export function linkedinHeaders(accessToken: string, extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'LinkedIn-Version': LINKEDIN_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
    ...extra,
  };
}

export async function liFetch(
  path: string,
  accessToken: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
) {
  const res = await fetch(`https://api.linkedin.com${path}`, {
    ...init,
    headers: linkedinHeaders(accessToken, init.headers || {}),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LinkedIn ${path} [${res.status}]: ${body}`);
  }
  return res;
}

/** Faz upload de uma imagem a partir de uma URL pública e devolve o URN da imagem. */
export async function uploadImagem(accessToken: string, ownerUrn: string, imageUrl: string) {
  const initRes = await liFetch('/rest/images?action=initializeUpload', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initializeUploadRequest: { owner: ownerUrn } }),
  });
  const init = await initRes.json();
  const uploadUrl = init?.value?.uploadUrl;
  const imageUrn = init?.value?.image;
  if (!uploadUrl || !imageUrn) throw new Error('LinkedIn não devolveu uploadUrl da imagem');

  const bin = await fetch(imageUrl);
  if (!bin.ok) throw new Error(`Falha ao baixar imagem (${bin.status})`);
  const bytes = new Uint8Array(await bin.arrayBuffer());

  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: bytes,
  });
  if (!put.ok) throw new Error(`Upload de imagem falhou [${put.status}]: ${await put.text()}`);
  return imageUrn as string;
}

/** Upload de vídeo (single-part) a partir de uma URL pública; devolve o URN do vídeo. */
export async function uploadVideo(accessToken: string, ownerUrn: string, videoUrl: string) {
  const bin = await fetch(videoUrl);
  if (!bin.ok) throw new Error(`Falha ao baixar vídeo (${bin.status})`);
  const bytes = new Uint8Array(await bin.arrayBuffer());

  const initRes = await liFetch('/rest/videos?action=initializeUpload', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initializeUploadRequest: { owner: ownerUrn, fileSizeBytes: bytes.byteLength, uploadCaptions: false, uploadThumbnail: false },
    }),
  });
  const init = await initRes.json();
  const videoUrn = init?.value?.video;
  const instructions = init?.value?.uploadInstructions || [];
  if (!videoUrn || instructions.length === 0) throw new Error('LinkedIn não devolveu uploadInstructions do vídeo');

  const etags: string[] = [];
  for (const inst of instructions) {
    const first = Number(inst.firstByte ?? 0);
    const last = Number(inst.lastByte ?? bytes.byteLength - 1);
    const chunk = bytes.slice(first, last + 1);
    const put = await fetch(inst.uploadUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: chunk,
    });
    if (!put.ok) throw new Error(`Upload de vídeo falhou [${put.status}]: ${await put.text()}`);
    etags.push(put.headers.get('etag') || '');
  }

  await liFetch('/rest/videos?action=finalizeUpload', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      finalizeUploadRequest: { video: videoUrn, uploadToken: '', uploadedPartIds: etags },
    }),
  });

  return videoUrn as string;
}

/** Publica um post no perfil pessoal. Devolve o URN do post. */
export async function criarPost(opts: {
  accessToken: string;
  authorUrn: string;
  texto: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
}) {
  const { accessToken, authorUrn, texto } = opts;
  const body: Record<string, unknown> = {
    author: authorUrn,
    commentary: texto,
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };

  if (opts.videoUrl) {
    const urn = await uploadVideo(accessToken, authorUrn, opts.videoUrl);
    body.content = { media: { id: urn } };
  } else if (opts.imageUrl) {
    const urn = await uploadImagem(accessToken, authorUrn, opts.imageUrl);
    body.content = { media: { id: urn } };
  }

  const res = await liFetch('/rest/posts', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const urn = res.headers.get('x-restli-id') || res.headers.get('x-linkedin-id');
  if (!urn) throw new Error('LinkedIn não devolveu o URN do post');
  return urn;
}

/** Comenta no próprio post (usado para colocar o link no 1º comentário). */
export async function comentarNoPost(
  accessToken: string,
  actorUrn: string,
  postUrn: string,
  mensagem: string,
) {
  await liFetch(`/rest/socialActions/${encodeURIComponent(postUrn)}/comments`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor: actorUrn, object: postUrn, message: { text: mensagem } }),
  });
}

// NOTA: não existe edição de post (PARTIAL_UPDATE) neste fluxo. O escopo
// w_member_social só permite CRIAR post — editar ou comentar retorna
// 403 ACCESS_DENIED. Por isso o link é montado no commentary antes do POST.




/** Separa o link do corpo da copy (usado na tentativa de 1º comentário). */
export function separarLink(texto: string): { corpo: string; link: string | null } {
  const match = texto.match(/https?:\/\/[^\s]+/);
  if (!match) return { corpo: texto.trim(), link: null };
  const link = match[0];
  const corpo = texto.split(link).join('').replace(/\n{3,}/g, '\n\n').trim();
  return { corpo, link };
}

/**
 * Coloca o link no FIM do texto, depois do raciocínio e ANTES das hashtags.
 * Regra do LinkedIn Fase 1: link nunca na primeira linha e nunca depois das hashtags.
 */
export function posicionarLinkLinkedIn(texto: string, link: string): string {
  const base = texto.replace(link, '').replace(/\n{3,}/g, '\n\n').trim();
  const linhas = base.split('\n');
  const hashtagsIdx = linhas.findIndex((l) => /^\s*#[^\s]/.test(l.trim()));
  if (hashtagsIdx === -1) return `${base}\n\n${link}`.trim();
  const antes = linhas.slice(0, hashtagsIdx).join('\n').trim();
  const hashtags = linhas.slice(hashtagsIdx).join('\n').trim();
  return `${antes}\n\n${link}\n\n${hashtags}`.trim();
}

