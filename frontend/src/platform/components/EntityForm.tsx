import { useCallback, useEffect, useState } from 'react';
import { Input } from '../../components/ui/Input';
import {
  ApiError,
  entityApi,
  localitiesApi,
  type MunicipalityOption,
  type StateOption,
} from '../../lib/api-client';
import {
  digitsOnly,
  formatCnpj,
  formatPhone,
  matchMunicipalityId,
} from '../../lib/masks';
import { CoatOfArmsField } from './CoatOfArmsField';

export interface EntityFormValues {
  name: string;
  cnpj: string;
  email: string;
  phone: string;
  legalRepresentativeName: string;
  uf: string;
  municipalityId: number | null;
  municipalityName: string;
  address: string;
  coatOfArmsUrl: string;
  acknowledgeCnpjDuplicate: boolean;
}

interface EntityFormProps {
  initialValues?: Partial<EntityFormValues>;
  submitLabel: string;
  onSubmit: (values: EntityFormValues) => Promise<void>;
  cnpjDuplicateWarning?: string | null;
}

const defaultValues: EntityFormValues = {
  name: '',
  cnpj: '',
  email: '',
  phone: '',
  legalRepresentativeName: '',
  uf: '',
  municipalityId: null,
  municipalityName: '',
  address: '',
  coatOfArmsUrl: '',
  acknowledgeCnpjDuplicate: false,
};

const selectClassName =
  'h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm';

/** Reusable entity cadastral form with CNPJ lookup and IBGE localities */
export function EntityForm({
  initialValues,
  submitLabel,
  onSubmit,
  cnpjDuplicateWarning,
}: EntityFormProps) {
  const [values, setValues] = useState<EntityFormValues>({
    ...defaultValues,
    ...initialValues,
    cnpj: initialValues?.cnpj ? formatCnpj(initialValues.cnpj) : '',
    phone: initialValues?.phone ? formatPhone(initialValues.phone) : '',
  });
  const [states, setStates] = useState<StateOption[]>([]);
  const [municipalities, setMunicipalities] = useState<MunicipalityOption[]>([]);
  const [loadingMunicipalities, setLoadingMunicipalities] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [cnpjMessage, setCnpjMessage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (
    field: keyof EntityFormValues,
    value: string | boolean | number | null,
  ) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const loadMunicipalities = useCallback(
    async (uf: string, preferredName?: string | null) => {
      if (!uf) {
        setMunicipalities([]);
        return [];
      }

      setLoadingMunicipalities(true);
      try {
        const result = await localitiesApi.municipalities(uf);
        setMunicipalities(result.data);

        if (preferredName) {
          const municipalityId = matchMunicipalityId(result.data, preferredName);
          if (municipalityId) {
            const match = result.data.find((m) => m.id === municipalityId);
            setValues((prev) => ({
              ...prev,
              municipalityId,
              municipalityName: match?.nome ?? preferredName,
            }));
          } else {
            setValues((prev) => ({
              ...prev,
              municipalityId: null,
              municipalityName: preferredName,
            }));
          }
        }

        return result.data;
      } finally {
        setLoadingMunicipalities(false);
      }
    },
    [],
  );

  useEffect(() => {
    void localitiesApi.states().then((result) => setStates(result.data));
  }, []);

  useEffect(() => {
    if (!values.uf) {
      setMunicipalities([]);
      return;
    }
    void loadMunicipalities(values.uf);
  }, [values.uf, loadMunicipalities]);

  const handleCnpjLookup = async () => {
    const cnpjDigits = digitsOnly(values.cnpj);
    if (cnpjDigits.length !== 14) return;

    setLoadingCnpj(true);
    setCnpjMessage(null);
    try {
      const data = await entityApi.lookupCnpj(cnpjDigits);
      setValues((prev) => ({
        ...prev,
        name: data.name || prev.name,
        cnpj: formatCnpj(data.cnpj),
        email: data.email ?? prev.email,
        phone: data.phone ? formatPhone(data.phone) : prev.phone,
        legalRepresentativeName:
          data.legalRepresentativeName ?? prev.legalRepresentativeName,
        uf: data.uf ?? prev.uf,
        address: data.address ?? prev.address,
      }));

      if (data.uf) {
        await loadMunicipalities(data.uf, data.municipalityName);
      }

      setCnpjMessage('Dados importados da Receita Federal.');
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Não foi possível consultar o CNPJ';
      setCnpjMessage(message);
    } finally {
      setLoadingCnpj(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Input
          label="CNPJ"
          value={values.cnpj}
          onChange={(e) => handleChange('cnpj', formatCnpj(e.target.value))}
          onBlur={() => void handleCnpjLookup()}
          placeholder="00.000.000/0000-00"
          required
        />
        {loadingCnpj ? (
          <p className="text-xs text-[var(--color-muted)]">Consultando CNPJ…</p>
        ) : null}
        {cnpjMessage ? (
          <p className="text-xs text-[var(--color-muted)]">{cnpjMessage}</p>
        ) : null}
      </div>

      <Input
        label="Nome / Razão social"
        value={values.name}
        onChange={(e) => handleChange('name', e.target.value)}
        required
      />

      <Input
        label="Representante legal"
        value={values.legalRepresentativeName}
        onChange={(e) => handleChange('legalRepresentativeName', e.target.value)}
        placeholder="Nome completo do representante"
      />

      {cnpjDuplicateWarning ? (
        <div className="rounded-[var(--radius-md)] border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p>{cnpjDuplicateWarning}</p>
          <label className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={values.acknowledgeCnpjDuplicate}
              onChange={(e) =>
                handleChange('acknowledgeCnpjDuplicate', e.target.checked)
              }
            />
            Confirmo cadastro com CNPJ duplicado
          </label>
        </div>
      ) : null}

      <Input
        label="E-mail institucional"
        type="email"
        value={values.email}
        onChange={(e) => handleChange('email', e.target.value)}
      />

      <Input
        label="Telefone"
        value={values.phone}
        onChange={(e) => handleChange('phone', formatPhone(e.target.value))}
        placeholder="(00) 00000-0000"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[var(--color-ink)]">UF</span>
          <select
            className={selectClassName}
            value={values.uf}
            onChange={(e) => {
              const nextUf = e.target.value;
              setValues((prev) => ({
                ...prev,
                uf: nextUf,
                municipalityId: null,
                municipalityName: '',
              }));
            }}
          >
            <option value="">Selecione a UF</option>
            {states.map((state) => (
              <option key={state.id} value={state.sigla}>
                {state.sigla} — {state.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[var(--color-ink)]">Município</span>
          <select
            className={selectClassName}
            value={values.municipalityId ?? ''}
            disabled={!values.uf || loadingMunicipalities}
            onChange={(e) => {
              const selectedId = Number(e.target.value);
              const selected = municipalities.find((m) => m.id === selectedId);
              handleChange('municipalityId', selectedId || null);
              handleChange('municipalityName', selected?.nome ?? '');
            }}
          >
            <option value="">
              {loadingMunicipalities ? 'Carregando…' : 'Selecione o município'}
            </option>
            {municipalities.map((municipality) => (
              <option key={municipality.id} value={municipality.id}>
                {municipality.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Input
        label="Endereço"
        value={values.address}
        onChange={(e) => handleChange('address', e.target.value)}
      />

      <CoatOfArmsField
        value={values.coatOfArmsUrl}
        onChange={(url) => handleChange('coatOfArmsUrl', url)}
      />

      {error ? <p className="text-sm text-[var(--color-error)]">{error}</p> : null}
      <button
        type="submit"
        disabled={
          loading ||
          (Boolean(cnpjDuplicateWarning) && !values.acknowledgeCnpjDuplicate)
        }
        className="h-11 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? 'Salvando…' : submitLabel}
      </button>
    </form>
  );
}

/** Builds API payload from form values */
export function toEntityPayload(values: EntityFormValues) {
  return {
    name: values.name,
    cnpj: digitsOnly(values.cnpj) || null,
    email: values.email || null,
    phone: digitsOnly(values.phone) || null,
    legalRepresentativeName: values.legalRepresentativeName || null,
    uf: values.uf || null,
    municipalityId: values.municipalityId,
    municipalityName: values.municipalityName || null,
    address: values.address || null,
    coatOfArmsUrl: values.coatOfArmsUrl || null,
    acknowledgeCnpjDuplicate: values.acknowledgeCnpjDuplicate,
  };
}
