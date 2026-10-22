import type { FastifyRequest } from 'fastify';
import type { PrismaClient } from '../../generated/prisma/index.js';
import { consultarLink } from '../modules/tenant/pessoas/pessoas.service.js';

/* Prévia do link de acesso no WhatsApp (og:*): o robô do WhatsApp não roda o
   React, então o servidor já entrega título, descrição e imagem dentro do HTML. */

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function origem(req: FastifyRequest) {
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol ?? 'https').split(',')[0];
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '').split(',')[0];
  return `${proto}://${host}`;
}

export async function htmlDoLinkDeAcesso(prisma: PrismaClient, req: FastifyRequest, token: string, indexHtml: string) {
  let titulo = 'Seu acesso ao SisObras';
  let descricao = 'Crie sua senha e entre no sistema.';
  try {
    const l = await consultarLink(prisma, token);
    const primeiro = l.valido && 'nome' in l ? (l.nome ?? '').trim().split(/\s+/)[0] : '';
    if (primeiro) titulo = `${primeiro}, seu acesso ao SisObras está pronto`;
    if (l.entidade?.nome) descricao += ` ${l.entidade.nome}.`;
  } catch { /* sem prévia personalizada: segue a genérica */ }

  const base = origem(req);
  const tags = [
    `<meta name="description" content="${esc(descricao)}" />`,
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="SisObras" />',
    `<meta property="og:title" content="${esc(titulo)}" />`,
    `<meta property="og:description" content="${esc(descricao)}" />`,
    `<meta property="og:url" content="${esc(base + req.url)}" />`,
    `<meta property="og:image" content="${esc(base)}/marca/og-acesso.jpg" />`,
    '<meta property="og:image:type" content="image/jpeg" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />',
    '<meta property="og:image:alt" content="SisObras: seu acesso está pronto" />',
    '<meta name="twitter:card" content="summary_large_image" />',
  ].join('\n    ');
  return indexHtml
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(titulo)}</title>\n    ${tags}`);
}
