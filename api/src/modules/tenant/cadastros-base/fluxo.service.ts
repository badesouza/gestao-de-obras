import type { PrismaClient } from '../../../../generated/prisma/index.js';
import { AppError } from '../../../shared/errors.js';
import { pode, veTodosServicos } from '../../../shared/acessos.js';
import { ORIGENS_OS, obterConfig, type OrigemOS } from '../ordens/ordens.service.js';
import { writeTenantAudit } from '../audit/audit.service.js';

/**
 * Fluxo e aprovações — os passos já vêm montados; aqui se liga o que é opcional
 * e se vincula o login de quem faz cada passo. Vincular é marcar a caixa do passo
 * nos acessos da pessoa (a mesma coisa vista pela tela Acessos).
 */

export const PASSOS_FLUXO: Record<string, string[]> = {
  'os.triar': ['os.triar'],
  'os.aprovar': ['os.aprovar'],
  'os.conferir': ['os.conferir'],
  'os.cancelar': ['os.cancelar', 'os.reabrir'],
  'compras.pedir': ['compras.orcar', 'compras.lancar'],
  'compras.revisar': ['compras.revisar'],
  'compras.aprovar': ['compras.aprovar'],
  'compras.enviar': ['compras.enviar'],
  'compras.receber': ['compras.receber'],
};

const CHAVES_DOS_PASSOS = new Set(Object.values(PASSOS_FLUXO).flat());

export async function obterFluxo(prisma: PrismaClient, entityId: string) {
  const [cfg, usuarios] = await Promise.all([
    obterConfig(prisma, entityId),
    prisma.tenantUser.findMany({
      where: { entityId, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, adminGeral: true, acessos: true, role: { select: { name: true } },
        servicos: { select: { centroCusto: { select: { nome: true } } } },
      },
    }),
  ]);
  const pessoas = usuarios.filter(u => !u.adminGeral).map(u => ({
    id: u.id,
    nome: u.name,
    perfil: u.role.name,
    atende: veTodosServicos(u) ? null : u.servicos.map(s => s.centroCusto.nome).sort().join(', '),
    acessos: u.acessos.filter(c => CHAVES_DOS_PASSOS.has(c)),
  }));
  return {
    config: {
      /* sempre ligado: toda OS passa pela Central de Solicitações */
      exigeAprovacaoOS: true,
      aprovacaoOrigens: [...ORIGENS_OS],
      exigeConferencia: cfg.exigeConferencia,
      conferenciaPropriaBloqueada: cfg.conferenciaPropriaBloqueada,
      exigeRevisaoCompra: cfg.exigeRevisaoCompra,
      exigeAprovacaoCompra: cfg.exigeAprovacaoCompra,
      pedidoSoDeOrcamento: cfg.pedidoSoDeOrcamento,
      metaDias: cfg.metaDias,
    },
    pessoas,
    /* quem dá baixa não é vinculado aqui: vem dos serviços que cada um atende */
    qtdBaixa: usuarios.filter(u => !u.adminGeral && pode({ admin: false, acessos: u.acessos }, 'os.baixa')).length,
    admins: usuarios.filter(u => u.adminGeral).length,
  };
}

export interface DadosFluxo {
  config: {
    exigeAprovacaoOS: boolean; aprovacaoOrigens: OrigemOS[]; exigeConferencia: boolean; conferenciaPropriaBloqueada: boolean;
    exigeRevisaoCompra: boolean; exigeAprovacaoCompra: boolean; pedidoSoDeOrcamento: boolean; metaDias: number;
  };
  passos: Partial<Record<string, string[]>>;
}

export async function salvarFluxo(prisma: PrismaClient, entityId: string, userId: string, d: DadosFluxo) {
  /* a aprovação da abertura não se desliga: toda OS passa pelo crivo do responsável */
  const origens = [...ORIGENS_OS];
  for (const passo of Object.keys(d.passos)) {
    if (!PASSOS_FLUXO[passo]) throw new AppError(400, 'VALIDATION_ERROR', `Passo desconhecido: ${passo}`);
  }
  const usuarios = await prisma.tenantUser.findMany({
    where: { entityId, status: 'ACTIVE', adminGeral: false },
    select: { id: true, name: true, acessos: true },
  });
  const validos = new Set(usuarios.map(u => u.id));
  for (const ids of Object.values(d.passos) as string[][]) {
    if (ids.some(id => !validos.has(id))) throw new AppError(400, 'VALIDATION_ERROR', 'Pessoa não encontrada ou inativa');
  }

  /* novas caixas de cada pessoa: só os passos enviados mudam */
  const mudancas: { id: string; nome: string; antes: string[]; depois: string[] }[] = [];
  for (const u of usuarios) {
    const caixas = new Set(u.acessos);
    for (const [passo, ids] of Object.entries(d.passos) as [string, string[]][]) {
      const chaves = PASSOS_FLUXO[passo];
      if (ids.includes(u.id)) chaves.forEach(c => caixas.add(c));
      else chaves.forEach(c => caixas.delete(c));
    }
    const depois = [...caixas];
    if (depois.length !== u.acessos.length || depois.some(c => !u.acessos.includes(c))) {
      mudancas.push({ id: u.id, nome: u.name, antes: u.acessos, depois });
    }
  }

  const config = { ...d.config, exigeAprovacaoOS: true, aprovacaoOrigens: origens };
  await prisma.$transaction(async tx => {
    await tx.configuracaoObras.upsert({ where: { entityId }, update: config, create: { entityId, ...config } });
    for (const m of mudancas) await tx.tenantUser.update({ where: { id: m.id }, data: { acessos: m.depois } });
  });
  await writeTenantAudit(prisma, {
    entityId, userId, action: 'FLUXO_APROVACOES_SALVO', resource: 'configuracao_obras',
    newValue: {
      config,
      pessoas: mudancas.map(m => ({
        nome: m.nome,
        ganhou: m.depois.filter(c => !m.antes.includes(c)),
        perdeu: m.antes.filter(c => !m.depois.includes(c)),
      })),
    },
  });
  return obterFluxo(prisma, entityId);
}
