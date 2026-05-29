import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ApiError,
  entityApi,
  entityBootstrapApi,
  type AuditLog,
  type Entity,
} from '../../lib/api-client';
import { formatCnpj, formatPhone } from '../../lib/masks';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import {
  EntityForm,
  toEntityPayload,
  type EntityFormValues,
} from '../components/EntityForm';
import { TenantLinkBadge } from '../components/TenantLinkBadge';
import { BootstrapAdminForm } from '../components/BootstrapAdminForm';

/** Entity detail with edit, status toggle and audit logs */
export function EntityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [entity, setEntity] = useState<Entity | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cnpjWarning, setCnpjWarning] = useState<string | null>(null);
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [entityData, logsData, adminStatus] = await Promise.all([
        entityApi.get(id),
        entityApi.auditLogs(id),
        entityBootstrapApi.adminStatus(id),
      ]);
      setEntity(entityData);
      setAuditLogs(logsData.data);
      setHasAdmin(adminStatus.hasAdmin);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpdate = async (values: EntityFormValues) => {
    if (!id) return;
    try {
      const updated = await entityApi.update(id, toEntityPayload(values));
      setEntity(updated);
      setCnpjWarning(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.body.code === 'CNPJ_DUPLICATE') {
        const name = String(err.body.details?.existingEntityName ?? '');
        setCnpjWarning(`CNPJ já cadastrado para "${name}". Marque a confirmação para continuar.`);
        throw new Error('Confirme o CNPJ duplicado para continuar');
      }
      throw err;
    }
  };

  const handleToggleStatus = async () => {
    if (!entity) return;
    const next = entity.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const updated = await entityApi.updateStatus(entity.id, next);
    setEntity(updated);
    await load();
  };

  if (loading) return <p>Carregando…</p>;
  if (error || !entity) {
    return (
      <Card>
        <p className="text-[var(--color-error)]">{error || 'Entidade não encontrada'}</p>
        <Link to="/platform/entities" className="mt-4 inline-block underline">
          Voltar
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/platform/entities" className="text-sm text-[var(--color-muted)] underline">
            ← Entidades
          </Link>
          <h2 className="text-2xl font-semibold text-[var(--color-ink)]">{entity.name}</h2>
          <p className="text-sm text-[var(--color-muted)]">
            Status: {entity.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
          </p>
        </div>
        <Button variant="secondary" type="button" onClick={handleToggleStatus}>
          {entity.status === 'ACTIVE' ? 'Desativar' : 'Reativar'}
        </Button>
      </div>

      <TenantLinkBadge entityId={entity.id} tenantAccessUrl={entity.tenantAccessUrl} />

      {hasAdmin === false && id ? (
        <BootstrapAdminForm
          entityId={id}
          onCreated={() => {
            setHasAdmin(true);
          }}
        />
      ) : null}

      <Card>
        <h3 className="mb-4 font-semibold text-[var(--color-ink)]">Editar cadastro</h3>
        <EntityForm
          submitLabel="Salvar alterações"
          initialValues={{
            name: entity.name,
            cnpj: entity.cnpj ? formatCnpj(entity.cnpj) : '',
            email: entity.email ?? '',
            phone: entity.phone ? formatPhone(entity.phone) : '',
            legalRepresentativeName: entity.legalRepresentativeName ?? '',
            uf: entity.uf ?? '',
            municipalityId: entity.municipalityId,
            municipalityName: entity.municipalityName ?? '',
            address: entity.address ?? '',
            coatOfArmsUrl: entity.coatOfArmsUrl ?? '',
          }}
          onSubmit={handleUpdate}
          cnpjDuplicateWarning={cnpjWarning}
        />
      </Card>

      <Card>
        <h3 className="mb-4 font-semibold text-[var(--color-ink)]">Auditoria</h3>
        {auditLogs.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">Nenhum registro ainda.</p>
        ) : (
          <ul className="space-y-3">
            {auditLogs.map((log) => (
              <li
                key={log.id}
                className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] p-3 text-sm"
              >
                <p className="font-semibold text-[var(--color-ink)]">{log.action}</p>
                <p className="text-[var(--color-muted)]">
                  {new Date(log.createdAt).toLocaleString('pt-BR')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
