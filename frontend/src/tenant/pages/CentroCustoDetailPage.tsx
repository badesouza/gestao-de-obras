import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, tenantApi, type CentroCustoDetail, type Licitacao } from '../../lib/api-client';
import { Button } from '../../components/ui/Button';
import { useTenant, useTenantPermission } from '../TenantContext';
import { TenantPageHeader } from '../components/TenantPageHeader';
import { CentroCustoHeader } from '../components/centros-custo/CentroCustoHeader';
import { CentroCustoHomePanel } from '../components/centros-custo/CentroCustoHomePanel';
import { CentroCustoTabs } from '../components/centros-custo/CentroCustoTabs';
import { DailyRegisterGrid } from '../components/centros-custo/DailyRegisterGrid';
import { PerformancePanelPlaceholder } from '../components/centros-custo/PerformancePanelPlaceholder';
import { ProductionDailyPanel } from '../components/centros-custo/ProductionDailyPanel';
import { useCentroCustoMonthNav } from '../hooks/useCentroCustoMonthNav';

/** Centro de custo detail with tabs and settings */
export function CentroCustoDetailPage() {
  const { centroId } = useParams<{ centroId: string }>();
  const { entityId } = useTenant();
  const canManage = useTenantPermission('centros_custo.manage');
  const canEditRegistros = useTenantPermission('centros_custo.registros.edit');
  const { tab, year, month, monthLabel, setTab, goPrevMonth, goNextMonth } =
    useCentroCustoMonthNav();

  const [centro, setCentro] = useState<CentroCustoDetail | null>(null);
  const [licitacoesCatalog, setLicitacoesCatalog] = useState<Licitacao[]>([]);
  const [selectedLicitacaoId, setSelectedLicitacaoId] = useState<string | null>(null);
  const [dataPrevistaInicio, setDataPrevistaInicio] = useState('');
  const [dataPrevistaFim, setDataPrevistaFim] = useState('');
  const [dataRealizadaInicio, setDataRealizadaInicio] = useState('');
  const [dataRealizadaFim, setDataRealizadaFim] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const syncFormFromCentro = useCallback((detail: CentroCustoDetail) => {
    setSelectedLicitacaoId(detail.licitacoes[0]?.id ?? null);
    setDataPrevistaInicio(detail.dataPrevistaInicio ?? '');
    setDataPrevistaFim(detail.dataPrevistaFim ?? '');
    setDataRealizadaInicio(detail.dataRealizadaInicio ?? '');
    setDataRealizadaFim(detail.dataRealizadaFim ?? '');
  }, []);

  const loadCentro = useCallback(async (silent = false) => {
    if (!centroId) return;
    if (!silent) setLoading(true);
    setError('');
    try {
      const detail = await tenantApi.centrosCusto.get(entityId, centroId);
      setCentro(detail);
      syncFormFromCentro(detail);
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [centroId, entityId, syncFormFromCentro]);

  useEffect(() => {
    void loadCentro();
  }, [loadCentro]);

  useEffect(() => {
    if (tab === 'registro') {
      void loadCentro(true);
    }
  }, [tab, year, month, loadCentro]);

  useEffect(() => {
    const loadLicitacoes = async () => {
      try {
        const result = await tenantApi.licitacoes.list(
          entityId,
          new URLSearchParams({ status: 'ACTIVE', pageSize: '100' }),
        );
        setLicitacoesCatalog(result.items);
      } catch {
        /* optional */
      }
    };
    void loadLicitacoes();
  }, [entityId]);

  const linkedLicitacaoInitial = useMemo((): Licitacao | null => {
    if (!centro || centro.licitacoes.length === 0) return null;
    const linked = centro.licitacoes[0];
    const full = licitacoesCatalog.find((l) => l.id === linked.id);
    if (full) return full;
    return {
      id: linked.id,
      identificacao: linked.identificacao,
      objeto: '—',
      status: linked.status as Licitacao['status'],
      fornecedor: null,
      createdAt: centro.createdAt,
      createdBy: centro.createdBy,
      activeItemCount: 0,
    };
  }, [centro, licitacoesCatalog]);

  const handleDateChange = (field: string, value: string) => {
    if (field === 'dataPrevistaInicio') setDataPrevistaInicio(value);
    if (field === 'dataPrevistaFim') setDataPrevistaFim(value);
    if (field === 'dataRealizadaInicio') setDataRealizadaInicio(value);
    if (field === 'dataRealizadaFim') setDataRealizadaFim(value);
  };

  const saveEdit = async () => {
    if (!centroId) return;
    setSavingEdit(true);
    setError('');
    try {
      await tenantApi.centrosCusto.update(entityId, centroId, {
        dataPrevistaInicio: dataPrevistaInicio || null,
        dataPrevistaFim: dataPrevistaFim || null,
        dataRealizadaInicio: dataRealizadaInicio || null,
        dataRealizadaFim: dataRealizadaFim || null,
        licitacaoIds: selectedLicitacaoId ? [selectedLicitacaoId] : [],
      });
      await loadCentro();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar alterações');
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) return <p className="text-sm text-[var(--color-muted)]">Carregando…</p>;
  if (error && !centro) return <p className="text-[var(--color-error)]">{error}</p>;
  if (!centro || !centroId) return null;

  return (
    <div className="space-y-6">
      <TenantPageHeader
        title="Centro de custo"
        actions={
          <Link to={`/t/${entityId}/centros-custo`}>
            <Button variant="secondary">Voltar</Button>
          </Link>
        }
      />

      <CentroCustoHeader centro={centro} />

      <CentroCustoTabs
        tab={tab}
        monthLabel={monthLabel}
        onTabChange={setTab}
        onPrevMonth={goPrevMonth}
        onNextMonth={goNextMonth}
      />

      {tab === 'home' ? (
        <CentroCustoHomePanel
          entityId={entityId}
          centroId={centroId}
          centro={centro}
          selectedLicitacaoId={selectedLicitacaoId}
          linkedLicitacaoInitial={linkedLicitacaoInitial}
          dataPrevistaInicio={dataPrevistaInicio}
          dataPrevistaFim={dataPrevistaFim}
          dataRealizadaInicio={dataRealizadaInicio}
          dataRealizadaFim={dataRealizadaFim}
          error={error}
          savingEdit={savingEdit}
          canManage={canManage}
          onLicitacaoChange={setSelectedLicitacaoId}
          onDateChange={handleDateChange}
          onSave={() => void saveEdit()}
          onReload={() => void loadCentro()}
        />
      ) : null}

      {tab === 'registro' ? (
        <DailyRegisterGrid
          entityId={entityId}
          centroId={centroId}
          year={year}
          month={month}
          configs={centro.propriedadesConfig}
          canEdit={canEditRegistros && centro.status === 'ACTIVE'}
          onConfigureProperties={() => setTab('home')}
        />
      ) : null}

      {tab === 'desempenho' ? <PerformancePanelPlaceholder /> : null}

      {tab === 'producao' ? (
        <ProductionDailyPanel entityId={entityId} centroId={centroId} year={year} month={month} />
      ) : null}
    </div>
  );
}
