-- ajuste da classificação inicial pelo nome (havia caminhão e máquina cadastrados como equipamento)
UPDATE "cadastros_auxiliares" a SET "tipo_frota_id" = t."id"
FROM "tipos_frota" t
WHERE t."entity_id" = a."entity_id" AND a."tipo" IN ('VEICULO', 'EQUIPAMENTO')
  AND t."nome" = CASE
    WHEN (COALESCE(a."subtipo", '') || ' ' || a."nome") ~* '(retro|escavadeira|patrol|motoniveladora|trator|carregadeira|rolo compactador)' THEN 'Máquinas'
    WHEN (COALESCE(a."subtipo", '') || ' ' || a."nome") ~* '(caminh|carro|moto |motocicleta|ônibus|onibus|van|kombi|pick-?up|camionete)' THEN 'Veículos'
    WHEN a."tipo" = 'VEICULO' THEN 'Veículos'
    ELSE 'Equipamentos'
  END;
