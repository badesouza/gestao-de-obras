import { tenantApi, type BairroCoord } from '../../../lib/api-client';

/* ── Carimbo fotográfico (estilo Timemark) ───────────────────────
   Tudo aqui roda no aparelho, sem internet: desenho do carimbo,
   código de verificação e bairro mais próximo.                   */

export interface DadosCarimbo {
  quando: Date;
  lat: number | null;
  lng: number | null;
  precisao: number | null;
  bairro?: string;
  logradouro?: string;
  servico: string;
  cor: string;
  fiscal: string;
  entidade: string;
  brasao?: CanvasImageSource | null;
  codigo: string;
}

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const pad = (n: number) => String(n).padStart(2, '0');

export const formatarHora = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const formatarData = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
export const formatarCoord = (lat: number, lng: number) => `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

/** Cor da precisão do GPS: verde ótimo, âmbar bom, laranja fraco */
export function corPrecisao(m: number | null): string {
  if (m == null) return '#fb923c';
  if (m <= 15) return '#4ade80';
  if (m <= 40) return '#fbbf24';
  return '#fb923c';
}

const FONTE = 'Rajdhani, "Segoe UI", sans-serif';
const MONO  = '"JetBrains Mono", ui-monospace, monospace';

let fontesProntas: Promise<unknown> | null = null;
/** Garante que as fontes do carimbo estão carregadas antes de desenhar */
export function prepararFontes() {
  fontesProntas ??= Promise.all([
    document.fonts.load(`700 40px Rajdhani`),
    document.fonts.load(`600 20px Rajdhani`),
    document.fonts.load(`500 20px "JetBrains Mono"`),
  ]).catch(() => {});
  return fontesProntas;
}

function caber(ctx: CanvasRenderingContext2D, texto: string, max: number): string {
  if (ctx.measureText(texto).width <= max) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

function espacamento(ctx: CanvasRenderingContext2D, px: number) {
  if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
}

/** Desenha o carimbo na parte de baixo de uma imagem W×H */
export function desenharCarimbo(ctx: CanvasRenderingContext2D, W: number, H: number, d: DadosCarimbo) {
  /* em pé: proporcional à largura; deitado: limitado pela altura para não cobrir a foto */
  const u = Math.min(W / 100, H / 160);
  const p = 3.4 * u;
  const larguraUtil = W - 2 * p;

  const linhas: { rotulo: string; desenhar: (x: number, y: number, max: number) => void }[] = [];

  const local = [d.bairro, d.logradouro].filter(Boolean).join(' · ');
  if (local) {
    linhas.push({
      rotulo: 'LOCAL',
      desenhar: (x, y, max) => {
        ctx.font = `600 ${3.4 * u}px ${FONTE}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(caber(ctx, local, max), x, y);
      },
    });
  }

  linhas.push({
    rotulo: 'GPS',
    desenhar: (x, y, max) => {
      if (d.lat == null || d.lng == null) {
        ctx.font = `600 ${3.1 * u}px ${FONTE}`;
        ctx.fillStyle = '#fb923c';
        ctx.fillText('sem sinal de GPS no momento da foto', x, y);
        return;
      }
      ctx.font = `500 ${2.9 * u}px ${MONO}`;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      const coord = caber(ctx, formatarCoord(d.lat, d.lng), max * 0.75);
      ctx.fillText(coord, x, y);
      if (d.precisao != null) {
        const xp = x + ctx.measureText(coord).width + 1.6 * u;
        ctx.font = `700 ${3.1 * u}px ${FONTE}`;
        ctx.fillStyle = corPrecisao(d.precisao);
        ctx.fillText(`±${Math.round(d.precisao)} m`, xp, y);
      }
    },
  });

  linhas.push({
    rotulo: 'SERV.',
    desenhar: (x, y, max) => {
      ctx.font = `600 ${3.1 * u}px ${FONTE}`;
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.fillText(caber(ctx, `${d.servico}  ·  ${d.fiscal}`, max), x, y);
    },
  });

  const hCab = 12 * u, gap = 1.8 * u, hLinha = 4.6 * u, hRod = 6.6 * u;
  const total = hCab + gap + linhas.length * hLinha + 2.6 * u + hRod + p;
  const y0 = H - total;

  /* fundo: degradê escuro só onde há texto */
  const grad = ctx.createLinearGradient(0, y0 - 10 * u, 0, H);
  grad.addColorStop(0, 'rgba(4,10,12,0)');
  grad.addColorStop(0.35, 'rgba(4,10,12,0.55)');
  grad.addColorStop(1, 'rgba(4,10,12,0.86)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, y0 - 10 * u, W, total + 10 * u);

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 0.8 * u;
  espacamento(ctx, 0);

  /* cabeçalho: hora grande + barra na cor do serviço + data */
  ctx.font = `700 ${14 * u}px ${FONTE}`;
  ctx.fillStyle = '#ffffff';
  const hora = formatarHora(d.quando);
  ctx.fillText(hora, p - 0.4 * u, y0 + hCab / 2 + 0.6 * u);
  const xBarra = p + ctx.measureText(hora).width + 2 * u;

  ctx.shadowBlur = 0;
  ctx.fillStyle = d.cor;
  ctx.fillRect(xBarra, y0 + 1.8 * u, 0.9 * u, hCab - 3.6 * u);
  ctx.shadowBlur = 0.8 * u;

  const xData = xBarra + 2.6 * u;
  ctx.font = `700 ${4.2 * u}px ${FONTE}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(formatarData(d.quando), xData, y0 + 4.2 * u);
  ctx.font = `500 ${3.2 * u}px ${FONTE}`;
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.fillText(`${DIAS[d.quando.getDay()]} · ${pad(d.quando.getSeconds())}s`, xData, y0 + 8.6 * u);

  /* linhas de informação com rótulo em coluna */
  const colRotulo = 9.5 * u;
  let y = y0 + hCab + gap + hLinha / 2;
  for (const l of linhas) {
    ctx.font = `500 ${2.1 * u}px ${MONO}`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    espacamento(ctx, 0.25 * u);
    ctx.fillText(l.rotulo, p, y);
    espacamento(ctx, 0);
    l.desenhar(p + colRotulo, y, larguraUtil - colRotulo);
    y += hLinha;
  }

  /* divisória */
  const yDiv = y0 + hCab + gap + linhas.length * hLinha + 1.1 * u;
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(p, yDiv, larguraUtil, Math.max(1, 0.15 * u));

  /* rodapé: brasão pequeno + entidade | código de verificação */
  const yRod = yDiv + 1.5 * u;
  let xTexto = p;
  if (d.brasao) {
    const lado = hRod;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(p, yRod, lado, lado, 1.2 * u);
    ctx.fill();
    const img = d.brasao as HTMLImageElement;
    const iw = img.width || lado, ih = img.height || lado;
    const esc = Math.min((lado - 0.9 * u) / iw, (lado - 0.9 * u) / ih);
    const bw = iw * esc, bh = ih * esc;
    ctx.drawImage(d.brasao, p + (lado - bw) / 2, yRod + (lado - bh) / 2, bw, bh);
    xTexto = p + lado + 1.8 * u;
  }

  ctx.shadowBlur = 0.8 * u;
  ctx.font = `500 ${1.9 * u}px ${MONO}`;
  const cod = `CÓD. ${d.codigo}`;
  espacamento(ctx, 0.15 * u);
  const wCod = ctx.measureText(cod).width;
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.fillText(cod, W - p, yRod + hRod / 2);
  ctx.textAlign = 'left';

  ctx.font = `700 ${2.7 * u}px ${FONTE}`;
  espacamento(ctx, 0.3 * u);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(caber(ctx, d.entidade.toUpperCase(), W - p - wCod - 3 * u - xTexto), xTexto, yRod + hRod * 0.34);
  ctx.font = `500 ${2.1 * u}px ${FONTE}`;
  espacamento(ctx, 0.12 * u);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('Registro fotográfico de campo', xTexto, yRod + hRod * 0.74);

  ctx.restore();
}

/* ── Geração do arquivo final ─────────────────────────────────── */

const LADO_MAX = 2048;

async function renderizar(fonte: CanvasImageSource, w: number, h: number, d: DadosCarimbo): Promise<File> {
  await prepararFontes();
  const esc = Math.min(1, LADO_MAX / Math.max(w, h));
  const W = Math.round(w * esc), H = Math.round(h * esc);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(fonte, 0, 0, W, H);
  desenharCarimbo(ctx, W, H, d);
  const blob = await new Promise<Blob>((ok, falha) =>
    canvas.toBlob(b => (b ? ok(b) : falha(new Error('Falha ao gerar a foto'))), 'image/jpeg', 0.9),
  );
  const q = d.quando;
  const nome = `foto_${q.getFullYear()}${pad(q.getMonth() + 1)}${pad(q.getDate())}_${pad(q.getHours())}${pad(q.getMinutes())}${pad(q.getSeconds())}_${d.codigo.replace('-', '')}.jpg`;
  return new File([blob], nome, { type: 'image/jpeg', lastModified: q.getTime() });
}

/** Captura o quadro atual da câmera já com o carimbo */
export function capturarDoVideo(video: HTMLVideoElement, d: DadosCarimbo) {
  return renderizar(video, video.videoWidth, video.videoHeight, d);
}

/** Carimba uma foto tirada pelo app de câmera do celular (plano B) */
export async function carimbarArquivo(file: File, d: DadosCarimbo) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    return await renderizar(bmp, bmp.width, bmp.height, d);
  } finally {
    bmp.close();
  }
}

/* ── Código de verificação ────────────────────────────────────── */

/** Código curto (XXXX-XXXX) derivado de local, hora, fiscal e entidade */
export async function gerarCodigo(partes: (string | number | null)[]): Promise<string> {
  const texto = partes.map(p => p ?? '').join('|');
  let hex: string;
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
    hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } else {
    let h = 0x811c9dc5;
    for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 0x01000193);
    hex = (h >>> 0).toString(16).padStart(8, '0');
  }
  const c = hex.slice(0, 8).toUpperCase();
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

/* ── Bairro mais próximo, sem internet ────────────────────────── */

function distanciaM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Usa os pontos de bairro já cadastrados; ignora se o mais próximo estiver longe demais */
export function bairroMaisProximoLocal(lat: number, lng: number, bairros: BairroCoord[], limiteM = 2500): string | null {
  let melhor: { nome: string; d: number } | null = null;
  for (const b of bairros) {
    if (b.lat == null || b.lng == null) continue;
    const d = distanciaM(lat, lng, b.lat, b.lng);
    if (!melhor || d < melhor.d) melhor = { nome: b.nome, d };
  }
  return melhor && melhor.d <= limiteM ? melhor.nome : null;
}

/* ── Brasão (guardado no aparelho para funcionar offline) ─────── */

const chaveBrasao = (entityId: string) => `gdo:brasao:${entityId}`;

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = falha;
    img.src = src;
  });
}

export async function carregarBrasao(entityId: string): Promise<HTMLImageElement | null> {
  let guardado: string | null = null;
  try { guardado = localStorage.getItem(chaveBrasao(entityId)); } catch { /* sem storage */ }

  if (navigator.onLine) {
    try {
      const { entity } = await tenantApi.dashboard(entityId);
      if (entity.coatOfArmsUrl) {
        const blob = await (await fetch(entity.coatOfArmsUrl)).blob();
        const dataUrl = await new Promise<string>(ok => {
          const r = new FileReader();
          r.onload = () => ok(r.result as string);
          r.readAsDataURL(blob);
        });
        try { localStorage.setItem(chaveBrasao(entityId), dataUrl); } catch { /* cheio */ }
        guardado = dataUrl;
      }
    } catch { /* usa o guardado */ }
  }

  if (!guardado) return null;
  try { return await carregarImagem(guardado); } catch { return null; }
}
