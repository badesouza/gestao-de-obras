import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { entityApi, type Entity } from '../../lib/api-client';
import { formatCnpj } from '../../lib/masks';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

/** Lists tenant entities with search and status filter */
export function EntityListPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (status) params.set('status', status);
        const result = await entityApi.list(params);
        setEntities(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [search, status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--color-ink)]">Entidades</h2>
          <p className="text-sm text-[var(--color-muted)]">
            Órgãos cadastrados como tenants
          </p>
        </div>
        <Link to="/platform/entities/new">
          <Button>Nova entidade</Button>
        </Link>
      </div>

      <Card className="flex flex-wrap gap-4">
        <input
          className="h-11 flex-1 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm"
          placeholder="Buscar por nome, CNPJ ou município"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="h-11 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          <option value="ACTIVE">Ativo</option>
          <option value="INACTIVE">Inativo</option>
        </select>
      </Card>

      {loading ? <p>Carregando…</p> : null}
      {error ? <p className="text-[var(--color-error)]">{error}</p> : null}

      {!loading && entities.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">
            Nenhuma entidade cadastrada.{' '}
            <Link to="/platform/entities/new" className="font-semibold underline">
              Criar primeira entidade
            </Link>
          </p>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {entities.map((entity) => (
          <Card key={entity.id} className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-[var(--color-ink)]">{entity.name}</h3>
              <p className="text-sm text-[var(--color-muted)]">
                {entity.cnpj ? formatCnpj(entity.cnpj) : 'Sem CNPJ'} ·{' '}
                {entity.municipalityName
                  ? `${entity.municipalityName}/${entity.uf ?? '—'}`
                  : 'Localidade não informada'}{' '}
                · {entity.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
              </p>
            </div>
            <Link to={`/platform/entities/${entity.id}`}>
              <Button variant="secondary">Detalhes</Button>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
