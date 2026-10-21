-- CreateEnum
CREATE TYPE "SolicitacaoMunicipeStatus" AS ENUM ('NOVA', 'CONVERTIDA', 'RECUSADA');

-- CreateTable
CREATE TABLE "sequencias" (
    "entity_id" TEXT NOT NULL,
    "chave" VARCHAR(40) NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sequencias_pkey" PRIMARY KEY ("entity_id","chave")
);

-- CreateTable
CREATE TABLE "solicitacoes_municipe" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "protocolo" VARCHAR(20) NOT NULL,
    "categoria" VARCHAR(80) NOT NULL,
    "categoria_nome" VARCHAR(160) NOT NULL,
    "descricao" VARCHAR(2000) NOT NULL,
    "bairro" VARCHAR(150) NOT NULL,
    "logradouro" VARCHAR(300) NOT NULL,
    "referencia" VARCHAR(300),
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "precisao_m" DOUBLE PRECISION,
    "nome" VARCHAR(160) NOT NULL,
    "telefone" VARCHAR(30) NOT NULL,
    "cpf" VARCHAR(14),
    "email" VARCHAR(160),
    "status" "SolicitacaoMunicipeStatus" NOT NULL DEFAULT 'NOVA',
    "motivo_recusa" VARCHAR(1000),
    "registro_diario_id" TEXT,
    "analisado_por_id" TEXT,
    "analisado_em" TIMESTAMP(3),
    "origem_ip" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitacoes_municipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitacao_municipe_fotos" (
    "id" TEXT NOT NULL,
    "solicitacao_id" TEXT NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "dados" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacao_municipe_fotos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "solicitacoes_municipe_registro_diario_id_key" ON "solicitacoes_municipe"("registro_diario_id");

-- CreateIndex
CREATE INDEX "solicitacoes_municipe_entity_id_status_created_at_idx" ON "solicitacoes_municipe"("entity_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "solicitacoes_municipe_entity_id_protocolo_key" ON "solicitacoes_municipe"("entity_id", "protocolo");

-- CreateIndex
CREATE INDEX "solicitacao_municipe_fotos_solicitacao_id_idx" ON "solicitacao_municipe_fotos"("solicitacao_id");

-- AddForeignKey
ALTER TABLE "sequencias" ADD CONSTRAINT "sequencias_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_municipe" ADD CONSTRAINT "solicitacoes_municipe_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_municipe" ADD CONSTRAINT "solicitacoes_municipe_registro_diario_id_fkey" FOREIGN KEY ("registro_diario_id") REFERENCES "registros_diarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_municipe" ADD CONSTRAINT "solicitacoes_municipe_analisado_por_id_fkey" FOREIGN KEY ("analisado_por_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_municipe_fotos" ADD CONSTRAINT "solicitacao_municipe_fotos_solicitacao_id_fkey" FOREIGN KEY ("solicitacao_id") REFERENCES "solicitacoes_municipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
