/**
 * Cinturão (linha 9): o tipo de um arquivo enviado sai do CONTEÚDO, não do que o navegador
 * (ou quem ataca) declarou. Uma página HTML enviada como "image/png" ou "video/mp4" deixa de
 * ser aceita, e o que é entregue de volta leva o tipo verdadeiro.
 */

export const TIPOS_IMAGEM = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/avif']);
export const TIPOS_VIDEO = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp']);
export const TIPOS_PDF = new Set(['application/pdf']);

const ascii = (buf: Buffer, ini: number, fim: number) => buf.subarray(ini, fim).toString('latin1');

/** Tipo pelo começo do arquivo (assinatura). null = não é foto, vídeo nem PDF conhecido. */
export function tipoPeloConteudo(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 12) === 'WEBP') return 'image/webp';
  if (ascii(buf, 0, 6) === 'GIF87a' || ascii(buf, 0, 6) === 'GIF89a') return 'image/gif';
  if (ascii(buf, 0, 5) === '%PDF-') return 'application/pdf';
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'video/webm';
  /* família ISO (MP4, MOV, 3GP, HEIC, AVIF): "ftyp" + marca nos bytes 4..12 */
  if (ascii(buf, 4, 8) === 'ftyp') {
    const marca = ascii(buf, 8, 12);
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(marca)) return 'image/heic';
    if (marca === 'avif' || marca === 'avis') return 'image/avif';
    if (marca === 'qt  ') return 'video/quicktime';
    if (marca.startsWith('3g')) return 'video/3gpp';
    return 'video/mp4';
  }
  return null;
}

/** Tipo verdadeiro, se estiver entre os permitidos; senão null (recusar o arquivo) */
export function conferirConteudo(buf: Buffer, permitidos: ReadonlySet<string>): string | null {
  const tipo = tipoPeloConteudo(buf);
  return tipo && permitidos.has(tipo) ? tipo : null;
}

/**
 * Para ENTREGAR um arquivo guardado (inclusive os enviados antes desta conferência):
 * tipo pelo conteúdo quando é permitido; qualquer outra coisa sai como download genérico,
 * que o navegador nunca abre como página.
 */
export function comoEntregar(buf: Buffer, permitidos: ReadonlySet<string>): { tipo: string; disposicao: 'inline' | 'attachment' } {
  const tipo = conferirConteudo(buf, permitidos);
  return tipo ? { tipo, disposicao: 'inline' } : { tipo: 'application/octet-stream', disposicao: 'attachment' };
}

/** Nome de arquivo seguro para o cabeçalho Content-Disposition */
export function nomeParaCabecalho(nome: string, padrao = 'arquivo') {
  const limpo = (nome || padrao).replace(/[\r\n"\\]/g, '').slice(0, 150) || padrao;
  return `filename*=UTF-8''${encodeURIComponent(limpo)}`;
}
