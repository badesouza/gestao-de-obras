import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import { useTenant } from '../TenantContext';
import { tenantApi } from '../../lib/api-client';
import type { RegistroDiarioRow, PropriedadeConfig } from '../../lib/api-client';
import type { ServicoConfig } from '../pages/servico-config';

interface Props {
  row: RegistroDiarioRow;
  config: ServicoConfig;
  propConfigs: PropriedadeConfig[];
  onClose: () => void;
}

function formatDataBr(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function gerarNumeroOS(id: string, data: string): string {
  const ano = data.slice(0, 4);
  return `OS-${ano}-${id.slice(0, 6).toUpperCase()}`;
}

export function OrdemServicoModal({ row, config, propConfigs, onClose }: Props) {
  const { entityId, session } = useTenant();
  const [coatOfArmsUrl, setCoatOfArmsUrl] = useState<string | null>(null);
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  /* buscar brasão da entidade */
  useEffect(() => {
    tenantApi.dashboard(entityId).then(d => {
      setCoatOfArmsUrl(d.entity.coatOfArmsUrl ?? null);
    }).catch(() => {});
  }, [entityId]);

  /* mini-mapa da OS — somente leitura */
  useEffect(() => {
    if (!mapDiv.current || mapRef.current || !row.lat || !row.lng) return;

    const map = L.map(mapDiv.current, {
      center: [row.lat, row.lng],
      zoom: 16,
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    const pinIcon = L.divIcon({
      className: '',
      html: `<div style="width:20px;height:20px;border-radius:50% 50% 50% 0;background:${config.cor};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);transform:rotate(-45deg)"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 20],
    });

    L.marker([row.lat, row.lng], { icon: pinIcon }).addTo(map);
    setTimeout(() => map.invalidateSize(), 100);
    mapRef.current = map;

    return () => { map.remove(); mapRef.current = null; };
  }, [row.lat, row.lng, config.cor]);

  /* fechar com ESC */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const getCellText = (propId: string) => row.values[propId]?.text ?? '—';

  /* campos relevantes para exibir na OS (exceto foto e observações) */
  const camposOS = propConfigs.filter(pc =>
    !['Foto Registrada?', 'Observações'].includes(pc.propriedade.nome)
  );

  const observacoesPid = propConfigs.find(pc => pc.propriedade.nome === 'Observações')?.propriedadeId;
  const observacoes = observacoesPid ? row.values[observacoesPid]?.text : '';

  const numeroOS = gerarNumeroOS(row.id, row.data);
  const municipio = session.entity.municipalityName ?? '';
  const uf = session.entity.uf ?? '';

  return createPortal(
    <div className="os-backdrop" onClick={onClose}>
      <div className="os-modal" onClick={e => e.stopPropagation()}>

        {/* Toolbar */}
        <div className="os-toolbar">
          <span className="os-toolbar-title">Ordem de Serviço — {numeroOS}</span>
          <div className="os-toolbar-actions">
            <button type="button" className="os-btn-print" onClick={() => window.print()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Imprimir
            </button>
            <button type="button" className="os-btn-close" onClick={onClose}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Conteúdo imprimível */}
        <div className="os-print-area" id="os-print-area">

          {/* Cabeçalho */}
          <div className="os-header">
            <div className="os-header-left">
              {coatOfArmsUrl ? (
                <img src={coatOfArmsUrl} alt="Brasão" className="os-brasao" />
              ) : (
                <div className="os-brasao-placeholder">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
              )}
              <div>
                <div className="os-prefeitura">Prefeitura Municipal{municipio ? ` de ${municipio}` : ''}{uf ? `/${uf}` : ''}</div>
                <div className="os-secretaria">Secretaria Municipal de Obras e Serviços Urbanos</div>
              </div>
            </div>
            <div className="os-header-right">
              <div className="os-numero">{numeroOS}</div>
              <div className="os-tipo" style={{ color: config.cor }}>{config.nome}</div>
              <div className="os-data-emissao">Emitida em {formatDataBr(new Date().toISOString().slice(0,10))}</div>
            </div>
          </div>

          <div className="os-divider" />

          {/* Dados da ocorrência */}
          <div className="os-section">
            <div className="os-section-title">Dados do Serviço</div>
            <div className="os-grid">
              <div className="os-field">
                <span className="os-field-label">Data do registro</span>
                <span className="os-field-value">{formatDataBr(row.data)}</span>
              </div>
              {camposOS.map(pc => {
                const val = getCellText(pc.propriedadeId);
                if (val === '—' || !val) return null;
                return (
                  <div key={pc.propriedadeId} className="os-field">
                    <span className="os-field-label">{pc.propriedade.nome}</span>
                    <span className="os-field-value">{val}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Localização + Mapa */}
          {(row.lat || row.lng) && (
            <div className="os-section">
              <div className="os-section-title">Localização</div>
              <div className="os-localizacao">
                <div ref={mapDiv} className="os-mapa" />
                <div className="os-coords">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  Lat: {row.lat?.toFixed(6)}, Lng: {row.lng?.toFixed(6)}
                </div>
              </div>
            </div>
          )}

          {/* Observações */}
          {observacoes && (
            <div className="os-section">
              <div className="os-section-title">Observações</div>
              <div className="os-obs">{observacoes}</div>
            </div>
          )}

          <div className="os-divider" />

          {/* Assinaturas */}
          <div className="os-assinaturas">
            <div className="os-assinatura">
              <div className="os-assinatura-linha" />
              <div className="os-assinatura-label">Responsável pela execução</div>
              <div className="os-assinatura-data">Data: ____/____/________</div>
            </div>
            <div className="os-assinatura">
              <div className="os-assinatura-linha" />
              <div className="os-assinatura-label">Fiscal / Vistoriador</div>
              <div className="os-assinatura-data">Data: ____/____/________</div>
            </div>
            <div className="os-assinatura">
              <div className="os-assinatura-linha" />
              <div className="os-assinatura-label">Aprovação / Chefia</div>
              <div className="os-assinatura-data">Data: ____/____/________</div>
            </div>
          </div>

          {/* Resultado da execução (campo para preencher a mão) */}
          <div className="os-section os-resultado">
            <div className="os-section-title">Resultado da Execução (preenchido pelo fiscal)</div>
            <div className="os-resultado-grid">
              <div className="os-field">
                <span className="os-field-label">Status final</span>
                <div className="os-field-blank" />
              </div>
              <div className="os-field">
                <span className="os-field-label">Qualidade</span>
                <div className="os-field-blank" />
              </div>
              <div className="os-field os-field-full">
                <span className="os-field-label">Observações do fiscal</span>
                <div className="os-field-blank os-field-blank-tall" />
              </div>
            </div>
          </div>

          {/* Rodapé */}
          <div className="os-footer">
            <span>Sistema de Gestão de Obras — {session.entity.name}</span>
            <span>{numeroOS} · {formatDataBr(row.data)}</span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
