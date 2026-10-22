-- Código do centro de custo passa a ser automático: CC-001, CC-002…
-- Renumera os centros existentes na ordem da árvore (pai antes dos filhos) e
-- deixa a sequência "CC" de cada órgão no último número usado.

WITH RECURSIVE arvore AS (
  SELECT id, entity_id, ARRAY[codigo]::text[] AS caminho, (NOT ativo) AS inativo
  FROM centros_de_custo
  WHERE pai_id IS NULL
  UNION ALL
  SELECT c.id, c.entity_id, a.caminho || c.codigo, a.inativo
  FROM centros_de_custo c
  JOIN arvore a ON a.id = c.pai_id
),
ordem AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY entity_id ORDER BY inativo, caminho) AS n
  FROM arvore
)
UPDATE centros_de_custo c SET codigo = '~' || o.n
FROM ordem o WHERE o.id = c.id;

-- centro que tenha ficado fora da árvore (pai em ciclo) vai para o fim
WITH resto AS (
  SELECT c.id, c.entity_id,
    (SELECT COUNT(*) FROM centros_de_custo x WHERE x.entity_id = c.entity_id AND x.codigo LIKE '~%')
      + ROW_NUMBER() OVER (PARTITION BY c.entity_id ORDER BY c.codigo) AS n
  FROM centros_de_custo c
  WHERE c.codigo NOT LIKE '~%'
)
UPDATE centros_de_custo c SET codigo = '~' || r.n
FROM resto r WHERE r.id = c.id;

UPDATE centros_de_custo SET codigo = 'CC-' || LPAD(SUBSTRING(codigo FROM 2), 3, '0');

INSERT INTO sequencias (entity_id, chave, ultimo, updated_at)
SELECT entity_id, 'CC', COUNT(*), now() FROM centros_de_custo GROUP BY entity_id
ON CONFLICT (entity_id, chave) DO UPDATE SET ultimo = GREATEST(sequencias.ultimo, EXCLUDED.ultimo), updated_at = now();
