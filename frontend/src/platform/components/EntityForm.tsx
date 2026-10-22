import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  entityApi,
  localitiesApi,
  type MunicipalityOption,
  type StateOption,
} from '../../lib/api-client';
import { digitsOnly, formatCnpj, formatPhone, matchMunicipalityId } from '../../lib/masks';
import { Aviso, Ic, Janela } from '../../tenant/components/sisobras/so';

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

const Chev = () => <svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;

/** Janela de cadastrar/editar entidade: CNPJ busca na Receita, UF e município do IBGE, brasão */
export function EntityJanela({
  initialValues,
  editando,
  onSubmit,
  onFechar,
  cnpjDuplicateWarning,
}: {
  initialValues?: Partial<EntityFormValues>;
  editando?: string;
  onSubmit: (values: EntityFormValues) => Promise<void>;
  onFechar: () => void;
  cnpjDuplicateWarning?: string | null;
}) {
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
  const [cnpjMessage, setCnpjMessage] = useState<{ ok: boolean; texto: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [erroNome, setErroNome] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  const handleChange = (field: keyof EntityFormValues, value: string | boolean | number | null) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const loadMunicipalities = useCallback(async (uf: string, preferredName?: string | null) => {
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
        const match = result.data.find((m) => m.id === municipalityId);
        setValues((prev) => ({
          ...prev,
          municipalityId: municipalityId ?? null,
          municipalityName: match?.nome ?? preferredName,
        }));
      }
      return result.data;
    } finally {
      setLoadingMunicipalities(false);
    }
  }, []);

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
        legalRepresentativeName: data.legalRepresentativeName ?? prev.legalRepresentativeName,
        uf: data.uf ?? prev.uf,
        address: data.address ?? prev.address,
      }));
      if (data.name) setErroNome(false);
      if (data.uf) await loadMunicipalities(data.uf, data.municipalityName);
      setCnpjMessage({ ok: true, texto: 'Dados trazidos da Receita Federal. Confira antes de salvar.' });
    } catch (err) {
      setCnpjMessage({ ok: false, texto: err instanceof ApiError ? err.message : 'Não foi possível consultar o CNPJ' });
    } finally {
      setLoadingCnpj(false);
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setPreviewError(false);
    setUploading(true);
    try {
      const result = await entityApi.uploadCoatOfArms(file);
      handleChange('coatOfArmsUrl', result.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao enviar imagem');
    } finally {
      setUploading(false);
      if (arquivo.current) arquivo.current.value = '';
    }
  };

  const salvar = async () => {
    setError('');
    if (!values.name.trim()) { setErroNome(true); setError('Informe o nome / razão social'); return; }
    setLoading(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const bloqueado = loading || uploading || (Boolean(cnpjDuplicateWarning) && !values.acknowledgeCnpjDuplicate);

  return (
    <Janela
      icone={editando ? 'editar' : 'orgao'}
      eyebrow="Plataforma · entidades"
      titulo={editando ? `Editar ${editando}` : 'Nova entidade'}
      sub="A prefeitura ou o órgão que vai usar o sistema. Digite o CNPJ: o resto vem da Receita."
      ajuda="Ajuda: Entidade"
      largura={720}
      onFechar={onFechar}
      rodape={<>
        <button type="button" className="so-btn so-ghost" onClick={onFechar}>Cancelar</button>
        <button type="button" className="so-btn so-primary" disabled={bloqueado} onClick={() => void salvar()}>
          <Ic n="check" />{loading ? 'Salvando…' : editando ? 'Salvar alterações' : 'Cadastrar entidade'}
        </button>
      </>}
    >
      <div className="pf-ent-form">
        <div className="pf-ent-campos">
          <label className="so-field"><span className="so-lbl">CNPJ <span className="req">*</span></span>
            <span className="so-ctrl mono">
              <input
                type="text"
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
                value={values.cnpj}
                onChange={(e) => handleChange('cnpj', formatCnpj(e.target.value))}
                onBlur={() => void handleCnpjLookup()}
              />
              {loadingCnpj && <span className="pf-buscando">consultando…</span>}
            </span>
            {cnpjMessage && <span className="so-help" style={cnpjMessage.ok ? { color: 'var(--mint)' } : { color: 'var(--coral)' }}>{cnpjMessage.texto}</span>}
          </label>

          {cnpjDuplicateWarning && (
            <div className="so-note amber">
              <Ic n="alerta" />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cnpjDuplicateWarning}
                <label className="so-ckrow" style={{ padding: 0, minHeight: 0 }}>
                  <input type="checkbox" className="so-ck" checked={values.acknowledgeCnpjDuplicate} onChange={(e) => handleChange('acknowledgeCnpjDuplicate', e.target.checked)} />
                  Confirmo o cadastro com CNPJ repetido
                </label>
              </span>
            </div>
          )}

          <label className="so-field"><span className="so-lbl">Nome / razão social <span className="req">*</span></span>
            <span className={`so-ctrl${erroNome ? ' invalid' : ''}`}><Ic n="orgao" />
              <input type="text" placeholder="Município de …" value={values.name} onChange={(e) => { handleChange('name', e.target.value); if (e.target.value.trim()) setErroNome(false); }} />
            </span>
          </label>

          <label className="so-field"><span className="so-lbl">Representante legal</span>
            <span className="so-ctrl"><Ic n="user" />
              <input type="text" placeholder="Nome completo do prefeito ou responsável" value={values.legalRepresentativeName} onChange={(e) => handleChange('legalRepresentativeName', e.target.value)} />
            </span>
          </label>

          <div className="so-row2">
            <label className="so-field"><span className="so-lbl">E-mail</span>
              <span className="so-ctrl"><Ic n="mail" />
                <input type="email" placeholder="gabinete@prefeitura.gov.br" value={values.email} onChange={(e) => handleChange('email', e.target.value)} />
              </span>
            </label>
            <label className="so-field"><span className="so-lbl">Telefone</span>
              <span className="so-ctrl mono">
                <input type="tel" placeholder="(75) 0000-0000" value={values.phone} onChange={(e) => handleChange('phone', formatPhone(e.target.value))} />
              </span>
            </label>
          </div>

          <div className="pf-uf-mun">
            <label className="so-field"><span className="so-lbl">UF</span>
              <span className="so-ctrl">
                <select
                  value={values.uf}
                  onChange={(e) => setValues((prev) => ({ ...prev, uf: e.target.value, municipalityId: null, municipalityName: '' }))}
                >
                  <option value="">UF</option>
                  {states.map((s) => <option key={s.id} value={s.sigla}>{s.sigla} — {s.nome}</option>)}
                </select>
                <Chev />
              </span>
            </label>
            <label className="so-field"><span className="so-lbl">Município</span>
              <span className={`so-ctrl${!values.uf ? ' off' : ''}`}><Ic n="pin" />
                <select
                  value={values.municipalityId ?? ''}
                  disabled={!values.uf || loadingMunicipalities}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    const m = municipalities.find((x) => x.id === id);
                    setValues((prev) => ({ ...prev, municipalityId: id || null, municipalityName: m?.nome ?? '' }));
                  }}
                >
                  <option value="">{loadingMunicipalities ? 'Carregando…' : values.uf ? 'Escolha o município' : 'Escolha a UF primeiro'}</option>
                  {municipalities.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
                <Chev />
              </span>
            </label>
          </div>

          <label className="so-field"><span className="so-lbl">Endereço</span>
            <span className="so-ctrl">
              <input type="text" placeholder="Rua, número, bairro" value={values.address} onChange={(e) => handleChange('address', e.target.value)} />
            </span>
          </label>
        </div>

        <div className="pf-ent-brasao">
          <span className="so-lbl">Brasão</span>
          <div className="pf-brasao-quadro">
            {values.coatOfArmsUrl && !previewError
              ? <img src={values.coatOfArmsUrl} alt="Brasão da entidade" onError={() => setPreviewError(true)} />
              : <svg role="img" aria-label="Sem brasão" width="64" height="74" viewBox="0 0 84 96" fill="none" stroke="#635BFF" strokeWidth="2.5" strokeLinejoin="round"><path d="M42 4L76 14V46C76 68 60 84 42 92C24 84 8 68 8 46V14Z" fill="rgba(99,91,255,0.08)" /><path d="M42 24V72M24 44H60" /></svg>}
            <span className="so-badge brand" style={{ position: 'absolute', left: 8, bottom: 8 }}>PNG · JPG</span>
          </div>
          <input ref={arquivo} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => void handleFile(e.target.files?.[0])} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button type="button" className="so-btn so-ghost" disabled={uploading} onClick={() => arquivo.current?.click()}>
              <Ic n="image" />{uploading ? 'Enviando…' : values.coatOfArmsUrl ? 'Trocar' : 'Enviar imagem'}
            </button>
            {values.coatOfArmsUrl && (
              <button type="button" className="so-btn so-danger" onClick={() => { handleChange('coatOfArmsUrl', ''); setPreviewError(false); }}>Remover</button>
            )}
          </div>
          {previewError && <span className="so-help" style={{ color: 'var(--coral)' }}>A imagem não abriu. Envie outro arquivo.</span>}
          <span className="so-help">Sai no carimbo das fotos e no cabeçalho dos PDFs.</span>
        </div>
      </div>

      {error && <Aviso tom="amber">{error}</Aviso>}
    </Janela>
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

/** Valores da janela a partir de uma entidade salva */
export function valoresDaEntidade(entity: {
  name: string; cnpj: string | null; email: string | null; phone: string | null; legalRepresentativeName: string | null;
  uf: string | null; municipalityId: number | null; municipalityName: string | null; address: string | null; coatOfArmsUrl: string | null;
}): Partial<EntityFormValues> {
  return {
    name: entity.name,
    cnpj: entity.cnpj ?? '',
    email: entity.email ?? '',
    phone: entity.phone ?? '',
    legalRepresentativeName: entity.legalRepresentativeName ?? '',
    uf: entity.uf ?? '',
    municipalityId: entity.municipalityId,
    municipalityName: entity.municipalityName ?? '',
    address: entity.address ?? '',
    coatOfArmsUrl: entity.coatOfArmsUrl ?? '',
  };
}
