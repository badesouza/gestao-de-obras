import 'dotenv/config';
import { createPrismaClient } from '../src/lib/prisma-client.js';
import { hashPassword } from '../src/modules/platform/auth/auth.service.js';
import {
  PERMISSION_CENTROS_CUSTO_MANAGE,
  PERMISSION_CENTROS_CUSTO_PROPRIEDADES_MANAGE,
  PERMISSION_CENTROS_CUSTO_REGISTROS_EDIT,
  PERMISSION_CENTROS_CUSTO_VIEW,
  PERMISSION_DASHBOARD_VIEW,
  PERMISSION_LICITACOES_ITEMS_DEACTIVATE,
  PERMISSION_LICITACOES_ITEMS_IMPORT,
  PERMISSION_LICITACOES_MANAGE,
  PERMISSION_LICITACOES_VIEW,
  PERMISSION_USERS_MANAGE,
  PERMISSION_USERS_VIEW,
  TENANT_ROLE_ADMIN,
  TENANT_ROLE_ENGINEER,
  TENANT_ROLE_OPERATOR,
} from '../src/shared/constants.js';

const prisma = createPrismaClient();

const ROLES = [
  {
    code: TENANT_ROLE_ADMIN,
    name: 'Administrador',
    description: 'Gestão de usuários e configurações da entidade',
    permissions: [
      PERMISSION_DASHBOARD_VIEW,
      PERMISSION_USERS_VIEW,
      PERMISSION_USERS_MANAGE,
      PERMISSION_LICITACOES_VIEW,
      PERMISSION_LICITACOES_MANAGE,
      PERMISSION_LICITACOES_ITEMS_IMPORT,
      PERMISSION_LICITACOES_ITEMS_DEACTIVATE,
      PERMISSION_CENTROS_CUSTO_VIEW,
      PERMISSION_CENTROS_CUSTO_MANAGE,
      PERMISSION_CENTROS_CUSTO_PROPRIEDADES_MANAGE,
      PERMISSION_CENTROS_CUSTO_REGISTROS_EDIT,
    ],
  },
  {
    code: TENANT_ROLE_ENGINEER,
    name: 'Engenheiro/Fiscal',
    description: 'Módulos operacionais e fiscais',
    permissions: [
      PERMISSION_DASHBOARD_VIEW,
      PERMISSION_LICITACOES_VIEW,
      PERMISSION_LICITACOES_ITEMS_IMPORT,
      PERMISSION_CENTROS_CUSTO_VIEW,
      PERMISSION_CENTROS_CUSTO_REGISTROS_EDIT,
    ],
  },
  {
    code: TENANT_ROLE_OPERATOR,
    name: 'Operador',
    description: 'Operações básicas do tenant',
    permissions: [
      PERMISSION_DASHBOARD_VIEW,
      PERMISSION_LICITACOES_VIEW,
      PERMISSION_CENTROS_CUSTO_VIEW,
    ],
  },
] as const;

const PERMISSIONS = [
  {
    code: PERMISSION_DASHBOARD_VIEW,
    description: 'Visualizar dashboard',
    module: 'dashboard',
  },
  {
    code: PERMISSION_USERS_VIEW,
    description: 'Listar usuários da entidade',
    module: 'users',
  },
  {
    code: PERMISSION_USERS_MANAGE,
    description: 'Gerenciar usuários da entidade',
    module: 'users',
  },
  {
    code: PERMISSION_LICITACOES_VIEW,
    description: 'Visualizar licitações e itens',
    module: 'licitacoes',
  },
  {
    code: PERMISSION_LICITACOES_MANAGE,
    description: 'Cadastrar e desativar licitações',
    module: 'licitacoes',
  },
  {
    code: PERMISSION_LICITACOES_ITEMS_IMPORT,
    description: 'Importar itens de licitação',
    module: 'licitacoes',
  },
  {
    code: PERMISSION_LICITACOES_ITEMS_DEACTIVATE,
    description: 'Desativar itens de licitação',
    module: 'licitacoes',
  },
  {
    code: PERMISSION_CENTROS_CUSTO_VIEW,
    description: 'Visualizar centros de custo',
    module: 'centros_custo',
  },
  {
    code: PERMISSION_CENTROS_CUSTO_MANAGE,
    description: 'Gerenciar centros de custo',
    module: 'centros_custo',
  },
  {
    code: PERMISSION_CENTROS_CUSTO_PROPRIEDADES_MANAGE,
    description: 'Gerenciar catálogo de propriedades',
    module: 'centros_custo',
  },
  {
    code: PERMISSION_CENTROS_CUSTO_REGISTROS_EDIT,
    description: 'Editar registro diário',
    module: 'centros_custo',
  },
] as const;

/** Seeds platform operator, tenant roles and permissions */
async function main() {
  const email = process.env.PLATFORM_ADMIN_EMAIL ?? 'admin@plataforma.local';
  const password = process.env.PLATFORM_ADMIN_PASSWORD ?? 'Admin@1234';
  const name = process.env.PLATFORM_ADMIN_NAME ?? 'Operador Plataforma';

  const passwordHash = await hashPassword(password);

  await prisma.platformOperator.upsert({
    where: { email: email.toLowerCase() },
    update: { name, passwordHash, status: 'ACTIVE' },
    create: {
      email: email.toLowerCase(),
      name,
      passwordHash,
      status: 'ACTIVE',
    },
  });

  for (const permission of PERMISSIONS) {
    await prisma.tenantPermission.upsert({
      where: { code: permission.code },
      update: {
        description: permission.description,
        module: permission.module,
      },
      create: permission,
    });
  }

  for (const role of ROLES) {
    const dbRole = await prisma.tenantRole.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description },
      create: {
        code: role.code,
        name: role.name,
        description: role.description,
      },
    });

    for (const permissionCode of role.permissions) {
      const permission = await prisma.tenantPermission.findUnique({
        where: { code: permissionCode },
      });
      if (!permission) continue;

      await prisma.tenantRolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: dbRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: dbRole.id,
          permissionId: permission.id,
        },
      });
    }
  }

  console.log(`Platform operator seeded: ${email}`);
  console.log('Tenant roles and permissions seeded');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
