-- Cadastro do serviço em passos: campos comuns ajustados por serviço e lista única de origens da demanda
ALTER TABLE "centros_custo" ADD COLUMN IF NOT EXISTS "campos_comuns" JSONB;
ALTER TABLE "configuracoes_obras" ADD COLUMN IF NOT EXISTS "origens_demanda" TEXT[] NOT NULL DEFAULT ARRAY['Ouvidoria', 'Vistoria Própria', 'Munícipe', 'Vereador', 'Secretaria', 'Outros']::TEXT[];
