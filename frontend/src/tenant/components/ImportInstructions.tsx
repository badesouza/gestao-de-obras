import { useState } from 'react';
import { ApiError, tenantApi } from '../../lib/api-client';
import { useTenant } from '../TenantContext';

interface ImportInstructionsProps {
  onDownload: (format: 'csv' | 'xlsx') => void;
}

export function ImportInstructions({ onDownload }: ImportInstructionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fafafa' }}>

      {/* cabeçalho clicável */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <span style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: '#eff6ff', border: '1px solid #bfdbfe',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#334155' }}>
          Como importar itens
        </span>
        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginRight: 4 }}>
          {open ? 'Ocultar' : 'Ver instruções'}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"
          style={{ flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* conteúdo colapsável */}
      <div style={{
        maxHeight: open ? 600 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.3s cubic-bezier(.22,1,.36,1)',
      }}>
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: 12, color: '#64748b', margin: '12px 0 14px', lineHeight: 1.6 }}>
            Use planilha <strong style={{ color: '#334155' }}>.csv UTF-8</strong> ou <strong style={{ color: '#334155' }}>.xlsx</strong>, ou cole colunas nos campos de texto.
            Cada linha representa um item (produto ou serviço).
          </p>

          {/* colunas aceitas */}
          <p style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Colunas aceitas</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {[
              { nome: 'categoria',  tipo: 'opcional',     detalhe: '' },
              { nome: 'descricao',  tipo: 'obrigatório',  detalhe: '' },
              { nome: 'unidade',    tipo: 'obrigatório',  detalhe: 'ex.: un, m², kg' },
              { nome: 'valor',      tipo: 'opcional',     detalhe: 'formato decimal, ex.: 32,50' },
            ].map(col => (
              <div key={col.nome} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{ fontSize: 11, fontWeight: 800, color: '#2563eb', background: '#eff6ff', borderRadius: 6, padding: '2px 7px', border: '1px solid #bfdbfe', minWidth: 72 }}>{col.nome}</code>
                <span style={{ fontSize: 10, fontWeight: 700, color: col.tipo === 'obrigatório' ? '#dc2626' : '#94a3b8', minWidth: 70 }}>{col.tipo}</span>
                {col.detalhe && <span style={{ fontSize: 11, color: '#94a3b8' }}>{col.detalhe}</span>}
              </div>
            ))}
          </div>

          {/* tabela exemplo */}
          <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['categoria', 'descricao', 'unidade', 'valor'].map(h => (
                    <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 700, color: '#475569', fontFamily: 'monospace' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Material', 'Cimento CP II', 'saco 50kg', '32,50'],
                  ['Serviço', 'Execução de alvenaria', 'm²', '85,00'],
                ].map((row, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                    {row.map((cell, j) => (
                      <td key={j} style={{ padding: '6px 12px', color: '#64748b' }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14, lineHeight: 1.5 }}>
            No modo <strong style={{ color: '#475569' }}>colunas</strong>, cada textarea deve ter o mesmo número de linhas. Linhas vazias no final são ignoradas.
          </p>

          {/* botões download */}
          <div style={{ display: 'flex', gap: 8 }}>
            {(['csv', 'xlsx'] as const).map(fmt => (
              <button key={fmt} type="button" onClick={() => onDownload(fmt)}
                className="tn-btn-secondary"
                style={{ fontSize: 11, height: 32 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Modelo {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Triggers template download and saves file locally */
export function useImportTemplateDownload() {
  const { entityId } = useTenant();

  return async (format: 'csv' | 'xlsx') => {
    try {
      const blob = await tenantApi.licitacoes.downloadTemplate(entityId, format);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `modelo-itens-licitacao.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      throw err instanceof ApiError ? err : new Error('Erro ao baixar modelo');
    }
  };
}
