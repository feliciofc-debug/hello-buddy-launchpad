/**
 * ==============================================================
 * HOOK: useGerarReel
 * ==============================================================
 * Gera um Reel MP4 de 12-15s no navegador usando FFmpeg.wasm.
 *
 * ESTRATÉGIA: "Canvas + FFmpeg"
 * - Canvas pré-renderiza cada frame final (foto + overlays)
 * - FFmpeg só junta os frames em MP4
 */
import { useState, useCallback, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ==============================================================
// CONFIGURAÇÕES DO TEMPLATE
// ==============================================================
const W = 1080;
const H = 1920;
const FPS = 30;
const COR_FUNDO: [number, number, number] = [230, 50, 55]; // RGB vermelho AMZ
const IMG_PRODUTO_SIZE = 900;
const IMG_PRODUTO_Y = 540;
const ZOOM_FINAL = 1.08;

// @ffmpeg/ffmpeg@0.12.15 instalado → core compatível 0.12.10
// IMPORTANTE: usar /dist/esm (não /umd), pois o Vite só carrega ES Modules em runtime
// jsdelivr é mais estável que unpkg; mantemos fallbacks
const FFMPEG_CDNS = [
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm',
  'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
];

// ==============================================================
// TIPOS
// ==============================================================
export interface ProgressoReel {
  etapa: 'idle' | 'carregando_ffmpeg' | 'baixando_imagens' | 'renderizando' | 'encodando' | 'upload' | 'pronto' | 'erro';
  porcentagem: number;
  mensagem: string;
}

export interface ParametrosReel {
  produtoId: string;
  nomeProduto: string;
  imagensUrls: string[];
  preco: number;
  precoOriginal?: number;
}

// ==============================================================
// HELPER: roundRect polyfill (alguns navegadores antigos)
// ==============================================================
function ensureRoundRect(ctx: CanvasRenderingContext2D) {
  if (typeof (ctx as any).roundRect !== 'function') {
    (ctx as any).roundRect = function (x: number, y: number, w: number, h: number, r: number) {
      const radius = Math.min(r, w / 2, h / 2);
      this.beginPath();
      this.moveTo(x + radius, y);
      this.arcTo(x + w, y, x + w, y + h, radius);
      this.arcTo(x + w, y + h, x, y + h, radius);
      this.arcTo(x, y + h, x, y, radius);
      this.arcTo(x, y, x + w, y, radius);
      this.closePath();
      return this;
    };
  }
}

// ==============================================================
// HELPER: carrega imagem como HTMLImageElement
// ==============================================================
async function carregarImagem(url: string, indice: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error(`Foto ${indice + 1} bloqueou CORS. URL: ${url}`));
    img.src = url;
  });
}

// ==============================================================
// HELPER: quebra texto em até 3 linhas com fonte adaptativa
// ==============================================================
function quebrarTexto(
  ctx: CanvasRenderingContext2D,
  texto: string,
  maxWidth: number
): { linhas: string[]; fontSize: number } {
  const tamanhos = [58, 50, 44];

  for (const fontSize of tamanhos) {
    ctx.font = `bold ${fontSize}px sans-serif`;
    const palavras = texto.trim().split(/\s+/);
    const linhas: string[] = [];
    let linhaAtual: string[] = [];

    for (const palavra of palavras) {
      const teste = [...linhaAtual, palavra].join(' ');
      if (ctx.measureText(teste).width <= maxWidth) {
        linhaAtual.push(palavra);
      } else {
        if (linhaAtual.length) linhas.push(linhaAtual.join(' '));
        linhaAtual = [palavra];
      }
    }
    if (linhaAtual.length) linhas.push(linhaAtual.join(' '));

    if (linhas.length <= 3) {
      return { linhas, fontSize };
    }
  }

  // Fallback: 3 linhas na fonte menor, sem "..."
  ctx.font = 'bold 44px sans-serif';
  const palavras = texto.trim().split(/\s+/);
  const linhas: string[] = [];
  let linhaAtual: string[] = [];

  for (const palavra of palavras) {
    const teste = [...linhaAtual, palavra].join(' ');
    if (ctx.measureText(teste).width <= maxWidth) {
      linhaAtual.push(palavra);
    } else {
      if (linhaAtual.length) linhas.push(linhaAtual.join(' '));
      linhaAtual = [palavra];
      if (linhas.length >= 3) break;
    }
  }
  if (linhaAtual.length && linhas.length < 3) linhas.push(linhaAtual.join(' '));

  return { linhas: linhas.slice(0, 3), fontSize: 44 };
}

// ==============================================================
// HELPER: formata preço
// ==============================================================
const formatarPreco = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

// ==============================================================
// HELPER: calcula desconto
// ==============================================================
function calcularDesconto(original: number, atual: number): string | null {
  if (!original || original <= atual) return null;
  const pct = Math.round((1 - atual / original) * 100);
  return pct >= 10 ? `-${pct}%` : null;
}

// ==============================================================
// RENDERIZADOR: desenha 1 frame no canvas
// ==============================================================
function desenharFrame(
  canvas: HTMLCanvasElement,
  imgProduto: HTMLImageElement,
  logoAmz: HTMLImageElement,
  linhasTitulo: string[],
  fontSizeTitulo: number,
  precoOriginal: number | undefined,
  precoAtual: number,
  desconto: string | null,
  progressoZoom: number
) {
  const ctx = canvas.getContext('2d')!;
  ensureRoundRect(ctx);

  // Fundo vermelho
  ctx.fillStyle = `rgb(${COR_FUNDO.join(',')})`;
  ctx.fillRect(0, 0, W, H);

  // Imagem do produto com Ken Burns
  const zoom = 1 + progressoZoom * (ZOOM_FINAL - 1);
  const tamZoom = IMG_PRODUTO_SIZE * zoom;
  const offsetX = (W - tamZoom) / 2;
  const offsetY = IMG_PRODUTO_Y - (tamZoom - IMG_PRODUTO_SIZE) / 2;
  ctx.drawImage(imgProduto, offsetX, offsetY, tamZoom, tamZoom);

  // Topo (cobrir vazamento da imagem)
  ctx.fillStyle = `rgb(${COR_FUNDO.join(',')})`;
  ctx.fillRect(0, 0, W, 510);

  // Logo AMZ centralizada
  const logoW = 450;
  const logoH = logoAmz.height * (logoW / logoAmz.width);
  ctx.drawImage(logoAmz, (W - logoW) / 2, 30, logoW, logoH);

  // Tag de desconto
  if (desconto) {
    ctx.fillStyle = 'yellow';
    ctx.beginPath();
    (ctx as any).roundRect(W - 260, 210, 220, 100, 15);
    ctx.fill();
    ctx.fillStyle = 'rgb(200, 30, 30)';
    ctx.font = 'bold 55px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(desconto, W - 150, 260);
  }

  // Título (até 3 linhas, fonte adaptativa)
  ctx.fillStyle = 'white';
  ctx.font = `bold ${fontSizeTitulo}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lineHeight = fontSizeTitulo * 1.25;
  let yTit = 380;
  for (const linha of linhasTitulo) {
    ctx.fillText(linha, W / 2, yTit);
    yTit += lineHeight;
  }

  // Inferior
  ctx.fillStyle = `rgb(${COR_FUNDO.join(',')})`;
  ctx.fillRect(0, 1490, W, H - 1490);

  // Preço original riscado
  if (precoOriginal && precoOriginal > precoAtual) {
    ctx.fillStyle = 'rgb(255, 220, 220)';
    ctx.font = '40px sans-serif';
    const textoOrig = formatarPreco(precoOriginal);
    const wOrig = ctx.measureText(textoOrig).width;
    ctx.fillText(textoOrig, W / 2, 1555);
    ctx.strokeStyle = 'rgb(255, 200, 200)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(W / 2 - wOrig / 2 - 10, 1555);
    ctx.lineTo(W / 2 + wOrig / 2 + 10, 1555);
    ctx.stroke();
  }

  // Preço atual GRANDE
  ctx.fillStyle = 'white';
  ctx.font = 'bold 120px sans-serif';
  ctx.fillText(formatarPreco(precoAtual), W / 2, 1680);

  // Botão CTA amarelo
  ctx.fillStyle = 'yellow';
  ctx.beginPath();
  (ctx as any).roundRect(W / 2 - 280, 1790, 560, 80, 40);
  ctx.fill();
  ctx.fillStyle = 'rgb(200, 30, 30)';
  ctx.font = 'bold 55px sans-serif';
  ctx.fillText('LINK NA BIO 👇', W / 2, 1830);
}

// ==============================================================
// HOOK PRINCIPAL
// ==============================================================
export function useGerarReel() {
  const [progresso, setProgresso] = useState<ProgressoReel>({
    etapa: 'idle',
    porcentagem: 0,
    mensagem: '',
  });
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const carregadoRef = useRef(false);

  const atualizarProgresso = useCallback(
    (etapa: ProgressoReel['etapa'], pct: number, msg: string) => {
      setProgresso({ etapa, porcentagem: pct, mensagem: msg });
    },
    []
  );

  const gerarReel = useCallback(
    async (params: ParametrosReel): Promise<string | null> => {
      try {
        if (params.imagensUrls.length < 3) {
          toast.error('Selecione pelo menos 3 fotos pra gerar o Reel');
          atualizarProgresso('erro', 0, 'Mínimo de 3 fotos.');
          return null;
        }
        const imagensUrls =
          params.imagensUrls.length > 5 ? params.imagensUrls.slice(0, 5) : params.imagensUrls;

        const numFotos = imagensUrls.length;
        const duracaoCadaFoto = numFotos === 3 ? 4 : numFotos === 4 ? 3.5 : 3;
        const duracaoTotal = numFotos * duracaoCadaFoto;

        // ==== 1. Carregar FFmpeg.wasm ====
        if (!ffmpegRef.current) ffmpegRef.current = new FFmpeg();
        const ffmpeg = ffmpegRef.current;

        if (!carregadoRef.current) {
          atualizarProgresso(
            'carregando_ffmpeg',
            5,
            'Carregando gerador de vídeo (1ª vez leva ~30s)...'
          );
          let ultimoErro: unknown = null;
          let carregou = false;
          for (const cdn of FFMPEG_CDNS) {
            try {
              console.log('[REEL] Tentando carregar FFmpeg core de:', cdn);
              const coreURL = await toBlobURL(`${cdn}/ffmpeg-core.js`, 'text/javascript');
              console.log('[REEL] ffmpeg-core.js baixado, blob:', coreURL.length);
              const wasmURL = await toBlobURL(`${cdn}/ffmpeg-core.wasm`, 'application/wasm');
              console.log('[REEL] ffmpeg-core.wasm baixado, blob:', wasmURL.length);
              await ffmpeg.load({ coreURL, wasmURL });
              console.log('[REEL] FFmpeg carregado com sucesso de:', cdn);
              carregou = true;
              break;
            } catch (err) {
              console.warn('[REEL] Falha em CDN', cdn, err);
              ultimoErro = err;
            }
          }
          if (!carregou) {
            throw new Error(
              `Falha ao carregar gerador de vídeo (todos os CDNs falharam): ${
                ultimoErro instanceof Error ? ultimoErro.message : 'erro desconhecido'
              }`
            );
          }
          carregadoRef.current = true;
        }

        // ==== 2. Baixar imagens ====
        atualizarProgresso('baixando_imagens', 15, `Baixando ${numFotos} fotos do produto...`);
        const imagens = await Promise.all(
          imagensUrls.map((url, i) => carregarImagem(url, i))
        );
        const logoAmz = await carregarImagem('/logo-amz-reel.png', -1).catch(() => {
          throw new Error('Logo AMZ não encontrada em /logo-amz-reel.png');
        });

        // ==== 3. Renderizar frames ====
        atualizarProgresso('renderizando', 25, 'Renderizando frames...');
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d')!;
        const { linhas: linhasTitulo, fontSize: fontSizeTitulo } =
          quebrarTexto(ctx, params.nomeProduto, W - 80);
        const desconto = params.precoOriginal
          ? calcularDesconto(params.precoOriginal, params.preco)
          : null;

        const totalFramesKey = Math.ceil(duracaoTotal);
        let frameIdx = 0;

        for (let idx = 0; idx < numFotos; idx++) {
          const img = imagens[idx];
          const framesDestaImg = Math.ceil(duracaoCadaFoto);
          for (let f = 0; f < framesDestaImg; f++) {
            const progressoZoom = f / framesDestaImg;
            desenharFrame(
              canvas,
              img,
              logoAmz,
              linhasTitulo,
              fontSizeTitulo,
              params.precoOriginal,
              params.preco,
              desconto,
              progressoZoom
            );
            const blob = await new Promise<Blob>((r) =>
              canvas.toBlob((b) => r(b!), 'image/jpeg', 0.9)
            );
            const buffer = await blob.arrayBuffer();
            const nome = `frame_${String(frameIdx).padStart(4, '0')}.jpg`;
            await ffmpeg.writeFile(nome, new Uint8Array(buffer));
            frameIdx++;
            const pct = 25 + (frameIdx / totalFramesKey) * 40;
            atualizarProgresso(
              'renderizando',
              pct,
              `Renderizando frame ${frameIdx}/${totalFramesKey}...`
            );
          }
        }

        // ==== 4. Encodar MP4 ====
        atualizarProgresso('encodando', 70, 'Montando seu Reel...');
        await ffmpeg.exec([
          '-framerate', '1',
          '-i', 'frame_%04d.jpg',
          '-vf', `fps=${FPS},scale=${W}:${H}`,
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-preset', 'ultrafast',
          '-crf', '23',
          '-t', String(duracaoTotal),
          'output.mp4',
        ]);

        const dataMp4 = await ffmpeg.readFile('output.mp4');
        const bufMp4 = new Uint8Array(dataMp4 as Uint8Array);
        const blobMp4 = new Blob([bufMp4.buffer as ArrayBuffer], { type: 'video/mp4' });

        // ==== 5. Thumbnail ====
        atualizarProgresso('upload', 80, 'Enviando pra nuvem...');
        const dataThumb = await ffmpeg.readFile('frame_0000.jpg');
        const bufThumb = new Uint8Array(dataThumb as Uint8Array);
        const blobThumb = new Blob([bufThumb.buffer as ArrayBuffer], { type: 'image/jpeg' });

        // ==== 6. Upload Storage ====
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        const videoId = crypto.randomUUID();
        const pathVideo = `${user.id}/${videoId}.mp4`;
        const pathThumb = `${user.id}/${videoId}_thumb.jpg`;

        const { error: errVideo } = await supabase.storage
          .from('produto-videos')
          .upload(pathVideo, blobMp4, { contentType: 'video/mp4' });
        if (errVideo) throw errVideo;

        const { error: errThumb } = await supabase.storage
          .from('produto-videos')
          .upload(pathThumb, blobThumb, { contentType: 'image/jpeg' });
        if (errThumb) throw errThumb;

        const videoUrl = supabase.storage.from('produto-videos').getPublicUrl(pathVideo).data.publicUrl;
        const thumbUrl = supabase.storage.from('produto-videos').getPublicUrl(pathThumb).data.publicUrl;

        // ==== 7. INSERT no banco ====
        atualizarProgresso('upload', 95, 'Salvando...');
        const { error: errInsert } = await supabase
          .from('produto_videos' as any)
          .insert({
            id: videoId,
            produto_id: params.produtoId,
            user_id: user.id,
            video_url: videoUrl,
            thumbnail_url: thumbUrl,
            titulo: params.nomeProduto,
            duracao_segundos: Math.round(duracaoTotal),
            status: 'pronto',
            tamanho_bytes: blobMp4.size,
          });
        if (errInsert) throw errInsert;

        // ==== 8. Limpeza ====
        for (let i = 0; i < frameIdx; i++) {
          try {
            await ffmpeg.deleteFile(`frame_${String(i).padStart(4, '0')}.jpg`);
          } catch {}
        }
        try {
          await ffmpeg.deleteFile('output.mp4');
        } catch {}

        atualizarProgresso('pronto', 100, '✅ Reel pronto!');
        toast.success('Reel gerado com sucesso! Veja na aba Vídeos.');
        return videoUrl;
      } catch (err: any) {
        const msgErro = err?.message || err?.toString() || 'Erro desconhecido';
        console.error('[REEL] ==== ERRO COMPLETO ====');
        console.error('[REEL] Mensagem:', msgErro);
        console.error('[REEL] Stack:', err?.stack);
        console.error('[REEL] Objeto erro completo:', err);
        console.error('[REEL] ======================');
        atualizarProgresso('erro', 0, msgErro);
        toast.error(`Erro ao gerar Reel: ${msgErro}`);
        return null;
      }
    },
    [atualizarProgresso]
  );

  return { gerarReel, progresso };
}
