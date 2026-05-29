-- Tenant RBAC and users (Spec 02)

CREATE TYPE "TenantUserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "tenant_roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "module" TEXT NOT NULL,

    CONSTRAINT "tenant_permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "tenant_role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

CREATE TABLE "tenant_users" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" "TenantUserStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_audit_logs" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "previous_value" JSONB,
    "new_value" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_roles_code_key" ON "tenant_roles"("code");
CREATE UNIQUE INDEX "tenant_permissions_code_key" ON "tenant_permissions"("code");
CREATE UNIQUE INDEX "tenant_users_entity_id_email_key" ON "tenant_users"("entity_id", "email");
CREATE INDEX "tenant_users_entity_id_idx" ON "tenant_users"("entity_id");
CREATE INDEX "tenant_users_status_idx" ON "tenant_users"("status");
CREATE INDEX "tenant_audit_logs_entity_id_idx" ON "tenant_audit_logs"("entity_id");
CREATE INDEX "tenant_audit_logs_user_id_idx" ON "tenant_audit_logs"("user_id");
CREATE INDEX "tenant_audit_logs_created_at_idx" ON "tenant_audit_logs"("created_at");

ALTER TABLE "tenant_role_permissions" ADD CONSTRAINT "tenant_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "tenant_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_role_permissions" ADD CONSTRAINT "tenant_role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "tenant_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "tenant_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenant_audit_logs" ADD CONSTRAINT "tenant_audit_logs_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenant_audit_logs" ADD CONSTRAINT "tenant_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
