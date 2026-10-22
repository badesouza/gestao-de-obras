import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient, Prisma } from '../../../../generated/prisma/index.js';
import { AppError } from '../../../shared/errors.js';
import { hashPassword } from '../../platform/auth/auth.service.js';
import { writeTenantAudit } from '../audit/audit.service.js';
import { CATALOGO_ACESSOS, MODELOS, MODELOS_SEM_EQUIPE, ORDEM_MODELOS, TODAS_CHAVES, limparChaves, veTodosServicos } from '../../../shared/acessos.js';

/**
 * Módulo 1 · Passo 3 — Pessoas: usuários (com link para criar a senha),
 * acessos por caixa e equipes (1 líder com login + membros sem login).
 */

const VALIDADE_LINK_MS = 48 * 3600_000;

export type Situacao = 'ATIVO' | 'LINK_ENVIADO' | 'LINK_VENCIDO' | 'INATIVO';

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

async function roleDoModelo(prisma: PrismaClient, modelo: string) {
  if (!MODELOS[modelo]) throw new AppError(400, 'VALIDATION_ERROR', 'Modelo de acesso inválido');
  const role = await prisma.tenantRole.findUnique({ where: { code: modelo } });
  if (!role) throw new AppError(500, 'ROLE_AUSENTE', `Perfil ${modelo} não existe no banco`);
  return role;
}

function situacaoDo(u: { status: string; senhaDefinida: boolean; linksAcesso: { expiraEm: Date; usadoEm: Date | null }[] }): Situacao {
  if (u.status !== 'ACTIVE') return 'INATIVO';
  if (u.senhaDefinida) return 'ATIVO';
  const ultimo = u.linksAcesso[0];
  return ultimo && !ultimo.usadoEm && ultimo.expiraEm > new Date() ? 'LINK_ENVIADO' : 'LINK_VENCIDO';
}

/* ───────────────────────── Lista e formulário ───────────────────────── */

export async function listarPessoas(prisma: PrismaClient, entityId: string) {
  const [usuarios, equipes, servicos, roles] = await Promise.all([
    prisma.tenantUser.findMany({
      where: { entityId },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      select: {
        id: true, name: true, email: true, celular: true, status: true, senhaDefinida: true, adminGeral: true, acessos: true,
        role: { select: { code: true, name: true } },
        equipes: { select: { equipe: { select: { id: true, nome: true } } }, orderBy: { equipe: { nome: 'asc' } } },
        equipesLideradas: { select: { cadastroId: true } },
        servicos: { select: { centroCusto: { select: { id: true, nome: true } } } },
        linksAcesso: { orderBy: { createdAt: 'desc' }, take: 1, select: { expiraEm: true, usadoEm: true } },
      },
    }),
    prisma.cadastroAuxiliar.findMany({ where: { entityId, tipo: 'EQUIPE', ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true } }),
    prisma.centroCusto.findMany({ where: { entityId, status: 'ACTIVE' }, orderBy: { nome: 'asc' }, select: { id: true, nome: true } }),
    prisma.tenantRole.findMany({ select: { code: true, name: true } }),
  ]);

  const total = TODAS_CHAVES.length;
  const lista = usuarios.map(u => ({
    id: u.id,
    nome: u.name,
    email: u.email,
    celular: u.celular,
    perfil: { code: u.role.code, nome: MODELOS[u.role.code]?.nome ?? u.role.name },
    equipes: u.equipes.map(e => e.equipe),
    /* equipe que a pessoa lidera (uma só), entre as dela */
    liderDe: u.equipesLideradas.map(e => e.cadastroId).find(id => u.equipes.some(x => x.equipe.id === id)) ?? null,
    /* null = vê todos (caixa "Ver todos os serviços"); lista vazia = nenhum */
    atende: veTodosServicos(u) ? null : u.servicos.map(s => s.centroCusto),
    situacao: situacaoDo(u),
    adminGeral: u.adminGeral,
    marcados: u.adminGeral ? total : u.acessos.length,
    total,
  }));

  const contagem = (code: string) => lista.filter(u => u.perfil.code === code).length;
  return {
    usuarios: lista,
    filtros: ORDEM_MODELOS.map(code => ({ code, nome: MODELOS[code].nome, qtd: contagem(code) })).filter(f => f.qtd > 0),
    modelos: ORDEM_MODELOS.map(code => ({
      code, nome: MODELOS[code].nome, descricao: MODELOS[code].descricao,
      marcados: MODELOS[code].chaves.length, existe: roles.some(r => r.code === code), semEquipe: MODELOS_SEM_EQUIPE.includes(code),
    })),
    equipes,
    servicos,
    totalCaixas: total,
  };
}

export interface DadosPessoa {
  nome: string;
  email: string;
  celular?: string | null;
  modelo: string;
  equipeIds?: string[];
  liderEquipeId?: string | null;
  servicoIds?: string[] | null; // vazio = nenhum (ver todos é a caixa "Ver todos os serviços")
}

/** Toda pessoa liga a 1+ equipes, menos Administrador, Secretário(a) e Coordenador */
async function validarEquipes(prisma: PrismaClient, entityId: string, d: DadosPessoa) {
  const ids = Array.from(new Set(d.equipeIds ?? []));
  if (!ids.length && !MODELOS_SEM_EQUIPE.includes(d.modelo)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Escolha pelo menos uma equipe');
  }
  const achadas = await prisma.cadastroAuxiliar.count({ where: { id: { in: ids }, entityId, tipo: 'EQUIPE', ativo: true } });
  if (achadas !== ids.length) throw new AppError(400, 'VALIDATION_ERROR', 'Equipe não encontrada');
  if (d.liderEquipeId && !ids.includes(d.liderEquipeId)) throw new AppError(400, 'VALIDATION_ERROR', 'A pessoa só lidera uma equipe da qual faz parte');
}

async function definirServicos(tx: Prisma.TransactionClient, entityId: string, userId: string, servicoIds: string[] | null | undefined) {
  await tx.usuarioServico.deleteMany({ where: { userId } });
  const ids = Array.from(new Set(servicoIds ?? []));
  if (!ids.length) return;
  const validos = await tx.centroCusto.findMany({ where: { entityId, id: { in: ids } }, select: { id: true } });
  if (validos.length !== ids.length) throw new AppError(400, 'VALIDATION_ERROR', 'Serviço não encontrado');
  await tx.usuarioServico.createMany({ data: ids.map(centroCustoId => ({ userId, centroCustoId, entityId })) });
}

/** Liga a pessoa às equipes dela e, se for o caso, faz dela a líder de uma */
async function definirEquipes(tx: Prisma.TransactionClient, entityId: string, userId: string, equipeIds: string[] | undefined, liderEquipeId: string | null | undefined) {
  const ids = Array.from(new Set(equipeIds ?? []));
  await tx.usuarioEquipe.deleteMany({ where: { userId } });
  if (ids.length) await tx.usuarioEquipe.createMany({ data: ids.map(equipeId => ({ userId, equipeId, entityId })) });
  const liderDe = liderEquipeId && ids.includes(liderEquipeId) ? liderEquipeId : null;
  // deixa de liderar equipes que não são mais a dela (ou todas, se não for mais líder)
  await tx.equipe.updateMany({
    where: { entityId, liderUserId: userId, ...(liderDe ? { NOT: { cadastroId: liderDe } } : {}) },
    data: { liderUserId: null },
  });
  // equipeId fica como a principal: a que lidera ou a primeira
  await tx.tenantUser.update({ where: { id: userId }, data: { equipeId: liderDe ?? ids[0] ?? null, isLiderEquipe: !!liderDe } });
  if (liderDe) {
    await tx.equipe.upsert({
      where: { cadastroId: liderDe },
      update: { liderUserId: userId },
      create: { entityId, cadastroId: liderDe, liderUserId: userId },
    });
  }
}

async function novoLink(prisma: PrismaClient | Prisma.TransactionClient, entityId: string, userId: string, criadoPorId: string) {
  const token = randomBytes(24).toString('base64url');
  const expiraEm = new Date(Date.now() + VALIDADE_LINK_MS);
  // um link por vez: os anteriores que não foram usados deixam de valer
  await prisma.tenantUserLink.updateMany({ where: { userId, usadoEm: null }, data: { expiraEm: new Date() } });
  await prisma.tenantUserLink.create({ data: { entityId, userId, tokenHash: hashToken(token), expiraEm, criadoPorId } });
  return { token, expiraEm };
}

export async function criarPessoa(prisma: PrismaClient, entityId: string, atorId: string, d: DadosPessoa) {
  const role = await roleDoModelo(prisma, d.modelo);
  await validarEquipes(prisma, entityId, d);
  const email = d.email.trim().toLowerCase();
  const existe = await prisma.tenantUser.findUnique({ where: { entityId_email: { entityId, email } } });
  if (existe) throw new AppError(409, 'EMAIL_DUPLICATE', 'Já existe alguém com este e-mail');
  const modelo = MODELOS[d.modelo];
  // senha aleatória que ninguém conhece: a pessoa cria a dela pelo link
  const passwordHash = await hashPassword(randomBytes(24).toString('hex'));

  const { user, link } = await prisma.$transaction(async tx => {
    const user = await tx.tenantUser.create({
      data: {
        entityId, roleId: role.id, name: d.nome.trim(), email, celular: d.celular?.replace(/\D/g, '') || null,
        passwordHash, senhaDefinida: false, acessos: modelo.admin ? TODAS_CHAVES : modelo.chaves, adminGeral: modelo.admin,
      },
    });
    await definirEquipes(tx, entityId, user.id, d.equipeIds, d.liderEquipeId);
    await definirServicos(tx, entityId, user.id, d.servicoIds);
    const link = await novoLink(tx, entityId, user.id, atorId);
    return { user, link };
  });
  await writeTenantAudit(prisma, { entityId, userId: atorId, action: 'USER_CREATED', resource: 'user', newValue: { id: user.id, nome: user.name, email, modelo: d.modelo } });
  return { id: user.id, nome: user.name, email, celular: user.celular, link };
}

export async function atualizarPessoa(prisma: PrismaClient, entityId: string, atorId: string, id: string, d: DadosPessoa) {
  const atual = await prisma.tenantUser.findFirst({ where: { id, entityId }, include: { role: true } });
  if (!atual) throw new AppError(404, 'NOT_FOUND', 'Pessoa não encontrada');
  await validarEquipes(prisma, entityId, d);
  const email = d.email.trim().toLowerCase();
  if (email !== atual.email) {
    const outro = await prisma.tenantUser.findUnique({ where: { entityId_email: { entityId, email } } });
    if (outro) throw new AppError(409, 'EMAIL_DUPLICATE', 'Já existe alguém com este e-mail');
  }
  const trocouModelo = d.modelo !== atual.role.code;
  const role = trocouModelo ? await roleDoModelo(prisma, d.modelo) : atual.role;
  if (trocouModelo && atual.adminGeral && !MODELOS[d.modelo].admin) await garantirOutroAdmin(prisma, entityId, id);

  await prisma.$transaction(async tx => {
    await tx.tenantUser.update({
      where: { id },
      data: {
        name: d.nome.trim(), email, celular: d.celular?.replace(/\D/g, '') || null, roleId: role.id,
        // trocar o modelo marca de novo as caixas dele
        ...(trocouModelo ? { acessos: MODELOS[d.modelo].admin ? TODAS_CHAVES : MODELOS[d.modelo].chaves, adminGeral: MODELOS[d.modelo].admin } : {}),
      },
    });
    await definirEquipes(tx, entityId, id, d.equipeIds, d.liderEquipeId);
    await definirServicos(tx, entityId, id, d.servicoIds);
  });
  await writeTenantAudit(prisma, { entityId, userId: atorId, action: 'USER_UPDATED', resource: 'user', newValue: { id, nome: d.nome, email, modelo: d.modelo } });
  return { id };
}

async function garantirOutroAdmin(prisma: PrismaClient, entityId: string, userId: string) {
  const outros = await prisma.tenantUser.count({ where: { entityId, adminGeral: true, status: 'ACTIVE', NOT: { id: userId } } });
  if (!outros) throw new AppError(409, 'ULTIMO_ADMIN', 'Precisa ficar pelo menos um administrador geral ativo');
}

export async function definirSituacao(prisma: PrismaClient, entityId: string, atorId: string, id: string, ativo: boolean) {
  const u = await prisma.tenantUser.findFirst({ where: { id, entityId } });
  if (!u) throw new AppError(404, 'NOT_FOUND', 'Pessoa não encontrada');
  if (!ativo && id === atorId) throw new AppError(409, 'CONFLICT', 'Você não pode desativar a si mesmo');
  if (!ativo && u.adminGeral) await garantirOutroAdmin(prisma, entityId, id);
  await prisma.tenantUser.update({ where: { id }, data: { status: ativo ? 'ACTIVE' : 'INACTIVE' } });
  await writeTenantAudit(prisma, { entityId, userId: atorId, action: ativo ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', resource: 'user', newValue: { id } });
}

export async function gerarLink(prisma: PrismaClient, entityId: string, atorId: string, id: string) {
  const u = await prisma.tenantUser.findFirst({ where: { id, entityId } });
  if (!u) throw new AppError(404, 'NOT_FOUND', 'Pessoa não encontrada');
  if (u.status !== 'ACTIVE') throw new AppError(409, 'CONFLICT', 'Ative a pessoa antes de gerar o link');
  const link = await novoLink(prisma, entityId, id, atorId);
  await writeTenantAudit(prisma, { entityId, userId: atorId, action: 'USER_LINK_GERADO', resource: 'user', newValue: { id } });
  return { id: u.id, nome: u.name, email: u.email, celular: u.celular, link };
}

/* ───────────────────────── Acessos por caixa ───────────────────────── */

export async function obterAcessos(prisma: PrismaClient, entityId: string, id: string) {
  const u = await prisma.tenantUser.findFirst({
    where: { id, entityId },
    select: {
      id: true, name: true, email: true, adminGeral: true, acessos: true,
      role: { select: { code: true } }, equipes: { select: { equipe: { select: { nome: true } } } },
      servicos: { select: { centroCusto: { select: { nome: true } } } },
    },
  });
  if (!u) throw new AppError(404, 'NOT_FOUND', 'Pessoa não encontrada');
  return {
    usuario: {
      id: u.id, nome: u.name, email: u.email, perfil: { code: u.role.code, nome: MODELOS[u.role.code]?.nome ?? u.role.code },
      equipe: u.equipes.map(e => e.equipe.nome).sort().join(', ') || null, atende: veTodosServicos(u) ? null : u.servicos.map(s => s.centroCusto.nome),
    },
    adminGeral: u.adminGeral,
    acessos: u.acessos,
    catalogo: CATALOGO_ACESSOS,
    modelos: ORDEM_MODELOS.map(code => ({ code, nome: MODELOS[code].nome, admin: MODELOS[code].admin, chaves: MODELOS[code].admin ? TODAS_CHAVES : MODELOS[code].chaves })),
  };
}

export async function salvarAcessos(prisma: PrismaClient, entityId: string, atorId: string, id: string, d: { adminGeral: boolean; acessos: string[] }) {
  const u = await prisma.tenantUser.findFirst({ where: { id, entityId } });
  if (!u) throw new AppError(404, 'NOT_FOUND', 'Pessoa não encontrada');
  if (u.adminGeral && !d.adminGeral) await garantirOutroAdmin(prisma, entityId, id);
  const acessos = limparChaves(d.acessos);
  await prisma.tenantUser.update({ where: { id }, data: { adminGeral: d.adminGeral, acessos } });
  await writeTenantAudit(prisma, {
    entityId, userId: atorId, action: 'USER_ACESSOS_UPDATED', resource: 'user',
    previousValue: { adminGeral: u.adminGeral, acessos: u.acessos }, newValue: { id, adminGeral: d.adminGeral, acessos },
  });
  return obterAcessos(prisma, entityId, id);
}

/* ───────────────────────── Link público (criar a senha) ───────────────────────── */

async function linkValido(prisma: PrismaClient, token: string) {
  const l = await prisma.tenantUserLink.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: { select: { id: true, name: true, email: true, status: true, entityId: true, role: { select: { code: true } } } },
      entity: { select: { id: true, name: true, municipalityName: true, uf: true, coatOfArmsUrl: true, status: true } },
    },
  });
  if (!l || l.usadoEm || l.expiraEm <= new Date() || l.user.status !== 'ACTIVE' || l.entity.status !== 'ACTIVE') return { link: l, valido: false as const };
  return { link: l, valido: true as const };
}

export async function consultarLink(prisma: PrismaClient, token: string) {
  const { link, valido } = await linkValido(prisma, token);
  if (!link) return { valido: false, entidade: null };
  const entidade = { id: link.entity.id, nome: link.entity.name, municipio: link.entity.municipalityName, uf: link.entity.uf, brasaoUrl: link.entity.coatOfArmsUrl };
  if (!valido) return { valido: false, entidade };
  return { valido: true, entidade, nome: link.user.name, email: link.user.email, expiraEm: link.expiraEm };
}

export async function usarLink(prisma: PrismaClient, token: string, senha: string) {
  const { link, valido } = await linkValido(prisma, token);
  if (!link || !valido) throw new AppError(410, 'LINK_VENCIDO', 'Este link não vale mais. Peça um novo para quem cadastrou você.');
  if (senha.length < 6) throw new AppError(400, 'VALIDATION_ERROR', 'A senha precisa ter pelo menos 6 caracteres');
  const passwordHash = await hashPassword(senha);
  await prisma.$transaction([
    prisma.tenantUser.update({ where: { id: link.user.id }, data: { passwordHash, senhaDefinida: true, lastLoginAt: new Date() } }),
    prisma.tenantUserLink.update({ where: { id: link.id }, data: { usadoEm: new Date() } }),
  ]);
  await writeTenantAudit(prisma, { entityId: link.entityId, userId: link.user.id, action: 'USER_SENHA_CRIADA', resource: 'auth', newValue: { via: 'link' } });
  return { userId: link.user.id, email: link.user.email, entityId: link.entityId, roleCode: link.user.role.code };
}

/* ───────────────────────── Equipes ───────────────────────── */

export async function listarEquipes(prisma: PrismaClient, entityId: string) {
  const [cadastros, usuarios, veiculos] = await Promise.all([
    prisma.cadastroAuxiliar.findMany({
      where: { entityId, tipo: 'EQUIPE', ativo: true },
      orderBy: { nome: 'asc' },
      select: {
        id: true, nome: true,
        equipe: {
          select: {
            lider: { select: { id: true, name: true } },
            veiculo: { select: { id: true, nome: true } },
            operadores: { where: { ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true, cargo: true } },
          },
        },
        usuariosEquipe: { where: { user: { status: 'ACTIVE' } }, select: { user: { select: { id: true, name: true } } }, orderBy: { user: { name: 'asc' } } },
      },
    }),
    prisma.tenantUser.findMany({
      where: { entityId, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, role: { select: { code: true } } },
    }),
    prisma.cadastroAuxiliar.findMany({ where: { entityId, tipo: 'VEICULO', ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true } }),
  ]);
  return {
    equipes: cadastros.map(c => ({
      id: c.id, nome: c.nome,
      lider: c.equipe?.lider ? { id: c.equipe.lider.id, nome: c.equipe.lider.name } : null,
      veiculo: c.equipe?.veiculo ?? null,
      membros: (c.equipe?.operadores ?? []).map(o => ({ id: o.id, nome: o.nome, funcao: o.cargo })),
      /* quem tem senha e faz parte da equipe (marcado no cadastro da pessoa) */
      pessoas: c.usuariosEquipe.map(x => ({ id: x.user.id, nome: x.user.name })),
    })),
    lideres: usuarios.map(u => ({ id: u.id, nome: u.name, perfil: MODELOS[u.role.code]?.nome ?? u.role.code })),
    veiculos,
  };
}

export async function criarEquipe(prisma: PrismaClient, entityId: string, nome: string) {
  const limpo = nome.trim();
  const existe = await prisma.cadastroAuxiliar.findFirst({ where: { entityId, tipo: 'EQUIPE', nome: { equals: limpo, mode: 'insensitive' } } });
  if (existe?.ativo) throw new AppError(409, 'CONFLICT', `"${limpo}" já existe`);
  const cad = existe
    ? await prisma.cadastroAuxiliar.update({ where: { id: existe.id }, data: { ativo: true, nome: limpo } })
    : await prisma.cadastroAuxiliar.create({ data: { entityId, tipo: 'EQUIPE', nome: limpo } });
  await prisma.equipe.upsert({ where: { cadastroId: cad.id }, update: {}, create: { entityId, cadastroId: cad.id } });
  return { id: cad.id };
}

export async function salvarEquipe(prisma: PrismaClient, entityId: string, id: string, d: { nome: string; liderUserId: string | null; veiculoId: string | null }) {
  const cad = await prisma.cadastroAuxiliar.findFirst({ where: { id, entityId, tipo: 'EQUIPE' } });
  if (!cad) throw new AppError(404, 'NOT_FOUND', 'Equipe não encontrada');
  const nome = d.nome.trim();
  if (nome.toLowerCase() !== cad.nome.toLowerCase()) {
    const dup = await prisma.cadastroAuxiliar.findFirst({ where: { entityId, tipo: 'EQUIPE', nome: { equals: nome, mode: 'insensitive' }, NOT: { id } } });
    if (dup) throw new AppError(409, 'CONFLICT', `"${nome}" já existe`);
  }
  if (d.liderUserId) {
    const u = await prisma.tenantUser.findFirst({ where: { id: d.liderUserId, entityId, status: 'ACTIVE' } });
    if (!u) throw new AppError(400, 'VALIDATION_ERROR', 'Líder não encontrado');
  }
  if (d.veiculoId) {
    const v = await prisma.cadastroAuxiliar.findFirst({ where: { id: d.veiculoId, entityId, tipo: 'VEICULO' } });
    if (!v) throw new AppError(400, 'VALIDATION_ERROR', 'Veículo não encontrado');
  }
  await prisma.$transaction(async tx => {
    await tx.cadastroAuxiliar.update({ where: { id }, data: { nome } });
    const anterior = await tx.equipe.findUnique({ where: { cadastroId: id } });
    await tx.equipe.upsert({
      where: { cadastroId: id },
      update: { liderUserId: d.liderUserId, veiculoId: d.veiculoId },
      create: { entityId, cadastroId: id, liderUserId: d.liderUserId, veiculoId: d.veiculoId },
    });
    if (anterior?.liderUserId && anterior.liderUserId !== d.liderUserId) {
      const aindaLidera = await tx.equipe.count({ where: { liderUserId: anterior.liderUserId } });
      await tx.tenantUser.update({ where: { id: anterior.liderUserId }, data: { isLiderEquipe: aindaLidera > 0 } });
    }
    if (d.liderUserId) {
      // uma pessoa lidera uma equipe só: sai da liderança das outras
      await tx.equipe.updateMany({ where: { entityId, liderUserId: d.liderUserId, NOT: { cadastroId: id } }, data: { liderUserId: null } });
      await tx.tenantUser.update({ where: { id: d.liderUserId }, data: { isLiderEquipe: true, equipeId: id } });
      await tx.usuarioEquipe.upsert({
        where: { userId_equipeId: { userId: d.liderUserId, equipeId: id } },
        update: {},
        create: { userId: d.liderUserId, equipeId: id, entityId },
      });
    }
  });
  return { id };
}

export async function removerEquipe(prisma: PrismaClient, entityId: string, id: string) {
  const cad = await prisma.cadastroAuxiliar.findFirst({ where: { id, entityId, tipo: 'EQUIPE' } });
  if (!cad) throw new AppError(404, 'NOT_FOUND', 'Equipe não encontrada');
  // fica inativa: OS antigas citam a equipe pelo nome
  await prisma.cadastroAuxiliar.update({ where: { id }, data: { ativo: false } });
  await prisma.tenantUser.updateMany({ where: { entityId, equipeId: id }, data: { equipeId: null } });
  await prisma.usuarioEquipe.deleteMany({ where: { entityId, equipeId: id } });
}

export async function adicionarMembro(prisma: PrismaClient, entityId: string, equipeId: string, d: { nome: string; funcao: string }) {
  const cad = await prisma.cadastroAuxiliar.findFirst({ where: { id: equipeId, entityId, tipo: 'EQUIPE' } });
  if (!cad) throw new AppError(404, 'NOT_FOUND', 'Equipe não encontrada');
  const equipe = await prisma.equipe.upsert({ where: { cadastroId: equipeId }, update: {}, create: { entityId, cadastroId: equipeId } });
  const m = await prisma.operador.create({ data: { entityId, equipeId: equipe.id, nome: d.nome.trim(), cargo: d.funcao.trim() } });
  return { id: m.id, nome: m.nome, funcao: m.cargo };
}

export async function removerMembro(prisma: PrismaClient, entityId: string, membroId: string) {
  const m = await prisma.operador.findFirst({ where: { id: membroId, entityId } });
  if (!m) throw new AppError(404, 'NOT_FOUND', 'Membro não encontrado');
  await prisma.operador.update({ where: { id: membroId }, data: { ativo: false } });
}

/** Excluir pessoa cadastrada por engano: some de vez se nunca fez nada no sistema;
    se já tem histórico (OS, pedidos, registros), fica inativa e o histórico continua. */
export async function excluirPessoa(prisma: PrismaClient, entityId: string, atorId: string, id: string) {
  const u = await prisma.tenantUser.findFirst({ where: { id, entityId } });
  if (!u) throw new AppError(404, 'NOT_FOUND', 'Pessoa não encontrada');
  if (id === atorId) throw new AppError(409, 'CONFLICT', 'Você não pode excluir a si mesmo');
  if (u.adminGeral) await garantirOutroAdmin(prisma, entityId, id);
  const desativar = async () => {
    await prisma.tenantUser.update({ where: { id }, data: { status: 'INACTIVE' } });
    await writeTenantAudit(prisma, { entityId, userId: atorId, action: 'USER_DEACTIVATED', resource: 'user', newValue: { id } });
    return { removido: false, desativado: true };
  };
  /* quem já entrou no sistema tem rastro (OS, pedidos, auditoria): só desativa */
  if (u.senhaDefinida || await prisma.tenantAuditLog.count({ where: { userId: id } })) return desativar();
  try {
    await prisma.$transaction(async tx => {
      await tx.equipe.updateMany({ where: { liderUserId: id }, data: { liderUserId: null } });
      await tx.tenantUser.delete({ where: { id } });
    });
    await writeTenantAudit(prisma, { entityId, userId: atorId, action: 'USER_DELETED', resource: 'user', previousValue: { id, nome: u.name, email: u.email } });
    return { removido: true, desativado: false };
  } catch (e) {
    if ((e as { code?: string }).code !== 'P2003') throw e;
    return desativar();
  }
}
