import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, entityApi } from '../../lib/api-client';
import { Card } from '../../components/ui/Card';
import {
  EntityForm,
  toEntityPayload,
  type EntityFormValues,
} from '../components/EntityForm';

/** Creates a new tenant entity */
export function EntityCreatePage() {
  const navigate = useNavigate();
  const [cnpjWarning, setCnpjWarning] = useState<string | null>(null);

  const handleSubmit = async (values: EntityFormValues) => {
    try {
      const entity = await entityApi.create(toEntityPayload(values));
      navigate(`/platform/entities/${entity.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.body.code === 'CNPJ_DUPLICATE') {
        const name = String(err.body.details?.existingEntityName ?? '');
        setCnpjWarning(`CNPJ já cadastrado para "${name}". Marque a confirmação para continuar.`);
        throw new Error('Confirme o CNPJ duplicado para continuar');
      }
      throw err;
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h2 className="text-2xl font-semibold text-[var(--color-ink)]">Nova entidade</h2>
      <Card>
        <EntityForm
          submitLabel="Cadastrar entidade"
          onSubmit={handleSubmit}
          cnpjDuplicateWarning={cnpjWarning}
        />
      </Card>
    </div>
  );
}
