-- CreateEnum
CREATE TYPE "CadastroAuxiliarTipo" AS ENUM ('BAIRRO', 'EQUIPE', 'VEICULO', 'EQUIPAMENTO');

-- AlterTable
ALTER TABLE "licitacoes" ADD COLUMN     "fornecedor_id" TEXT;

-- AlterTable
ALTER TABLE "registros_diarios" ADD COLUMN     "endereco_geocodificado" TEXT,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "tenant_users" ADD COLUMN     "is_lider_equipe" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "cadastros_auxiliares" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "tipo" "CadastroAuxiliarTipo" NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cadastros_auxiliares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipes" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "cadastro_id" TEXT NOT NULL,
    "lider_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operadores" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "equipe_id" TEXT NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "cargo" VARCHAR(100) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fornecedores" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "razao_social" VARCHAR(250) NOT NULL,
    "cnpj" VARCHAR(18),
    "contato" VARCHAR(150),
    "telefone" VARCHAR(30),
    "email" VARCHAR(150),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_midias" (
    "id" TEXT NOT NULL,
    "registro_diario_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "tipo" VARCHAR(10) NOT NULL,
    "nome_arquivo" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "dados" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registro_midias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enderecos_descobertos" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "bairro" VARCHAR(150) NOT NULL,
    "logradouro" VARCHAR(300) NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enderecos_descobertos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cadastros_auxiliares_entity_id_tipo_ativo_idx" ON "cadastros_auxiliares"("entity_id", "tipo", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "cadastros_auxiliares_entity_id_tipo_nome_key" ON "cadastros_auxiliares"("entity_id", "tipo", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "equipes_cadastro_id_key" ON "equipes"("cadastro_id");

-- CreateIndex
CREATE INDEX "equipes_entity_id_idx" ON "equipes"("entity_id");

-- CreateIndex
CREATE INDEX "operadores_equipe_id_ativo_idx" ON "operadores"("equipe_id", "ativo");

-- CreateIndex
CREATE INDEX "operadores_entity_id_idx" ON "operadores"("entity_id");

-- CreateIndex
CREATE INDEX "fornecedores_entity_id_ativo_idx" ON "fornecedores"("entity_id", "ativo");

-- CreateIndex
CREATE INDEX "registro_midias_registro_diario_id_idx" ON "registro_midias"("registro_diario_id");

-- CreateIndex
CREATE INDEX "enderecos_descobertos_entity_id_bairro_idx" ON "enderecos_descobertos"("entity_id", "bairro");

-- CreateIndex
CREATE UNIQUE INDEX "enderecos_descobertos_entity_id_bairro_logradouro_key" ON "enderecos_descobertos"("entity_id", "bairro", "logradouro");

-- CreateIndex
CREATE INDEX "registros_diarios_entity_id_lat_lng_idx" ON "registros_diarios"("entity_id", "lat", "lng");

-- AddForeignKey
ALTER TABLE "cadastros_auxiliares" ADD CONSTRAINT "cadastros_auxiliares_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipes" ADD CONSTRAINT "equipes_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipes" ADD CONSTRAINT "equipes_cadastro_id_fkey" FOREIGN KEY ("cadastro_id") REFERENCES "cadastros_auxiliares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipes" ADD CONSTRAINT "equipes_lider_user_id_fkey" FOREIGN KEY ("lider_user_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operadores" ADD CONSTRAINT "operadores_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operadores" ADD CONSTRAINT "operadores_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fornecedores" ADD CONSTRAINT "fornecedores_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licitacoes" ADD CONSTRAINT "licitacoes_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_midias" ADD CONSTRAINT "registro_midias_registro_diario_id_fkey" FOREIGN KEY ("registro_diario_id") REFERENCES "registros_diarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_midias" ADD CONSTRAINT "registro_midias_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enderecos_descobertos" ADD CONSTRAINT "enderecos_descobertos_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
