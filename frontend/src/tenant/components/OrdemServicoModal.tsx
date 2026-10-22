import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../styles/sisobras.css';
import '../styles/os-legado.css';
import L from 'leaflet';
import { useTenant } from '../TenantContext';
import { tenantApi, mapaApi } from '../../lib/api-client';
import type { RegistroDiarioRow, PropriedadeConfig } from '../../lib/api-client';
import type { ServicoConfig } from '../pages/servico-config';
import { SimboloSisObras } from '../../components/marca/SimboloSisObras';

interface Props {
  row: RegistroDiarioRow;
  config: ServicoConfig;
  propConfigs: PropriedadeConfig[];
  onClose: () => void;
}

interface Midia {
  id: string;
  tipo: string;
  nomeArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
  createdAt: string;
}

interface MidiaComUrl extends Midia {
  objectUrl: string;
}

function formatDataBr(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function gerarNumeroOS(id: string, data: string): string {
  const ano = data.slice(0, 4);
  return `OS-${ano}-${id.slice(0, 6).toUpperCase()}`;
}

/* Extrai campos estruturados da string de observações concatenadas pelo ModalConclusao.
   Formato esperado: "<obs>\nVistoria: <data> | Fiscal: <nome> | Qualidade: <q>"
   Retorna os campos separados + o texto livre sem a linha de vistoria. */
function parseObservacoes(obs: string | undefined) {
  if (!obs) return { texto: '', dataVistoria: '', fiscal: '', qualidade: '' };

  const linhas = obs.split('\n');
  const idxVistoria = linhas.findIndex(l => l.startsWith('Vistoria:'));

  let dataVistoria = '';
  let fiscal = '';
  let qualidade = '';
  let texto = obs;

  if (idxVistoria !== -1) {
    const linha = linhas[idxVistoria];
    const partes = linha.split('|').map(p => p.trim());
    for (const parte of partes) {
      if (parte.startsWith('Vistoria:')) dataVistoria = parte.replace('Vistoria:', '').trim();
      if (parte.startsWith('Fiscal:'))   fiscal       = parte.replace('Fiscal:', '').trim();
      if (parte.startsWith('Qualidade:')) qualidade   = parte.replace('Qualidade:', '').trim();
    }
    texto = linhas.filter((_, i) => i !== idxVistoria).join('\n').trim();
  }

  return { texto, dataVistoria, fiscal, qualidade };
}

export function OrdemServicoModal({ row, config, propConfigs, onClose }: Props) {
  const { entityId, session } = useTenant();
  const [coatOfArmsUrl, setCoatOfArmsUrl] = useState<string | null>(null);
  const [midias, setMidias] = useState<MidiaComUrl[]>([]);
  const [fotoAberta, setFotoAberta] = useState<MidiaComUrl | null>(null);
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  /* buscar brasão da entidade */
  useEffect(() => {
    tenantApi.dashboard(entityId).then(d => {
      setCoatOfArmsUrl(d.entity.coatOfArmsUrl ?? null);
    }).catch(() => {});
  }, [entityId]);

  /* buscar fotos/vídeos da vistoria e gerar object URLs autenticadas */
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];

    mapaApi.listMidias(entityId, row.id).then(async res => {
      const lista = res.midias ?? [];
      const comUrls = await Promise.all(
        lista.map(async m => {
          try {
            const objectUrl = await mapaApi.fetchMidiaBlob(entityId, m.id);
            urls.push(objectUrl);
            return { ...m, objectUrl };
          } catch {
            return { ...m, objectUrl: '' };
          }
        })
      );
      if (!cancelled) setMidias(comUrls);
    }).catch(() => {});

    return () => {
      cancelled = true;
      urls.forEach(u => URL.revokeObjectURL(u));
    };
  }, [entityId, row.id]);

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
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (fotoAberta) setFotoAberta(null); else onClose();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose, fotoAberta]);

  const getCellText = (propId: string) => row.values[propId]?.text ?? '—';

  /* campos relevantes para exibir na OS (exceto observações) */
  const camposOS = propConfigs.filter(pc =>
    !['Observações'].includes(pc.propriedade.nome)
  );

  const observacoesPid = propConfigs.find(pc => pc.propriedade.nome === 'Observações')?.propriedadeId;
  const obsRaw = observacoesPid ? row.values[observacoesPid]?.text : '';
  const { texto: obsTexto, dataVistoria, fiscal, qualidade } = parseObservacoes(obsRaw);

  const fotos  = midias.filter(m => m.tipo === 'foto' || m.mimeType.startsWith('image/'));
  const videos = midias.filter(m => m.tipo === 'video' || m.mimeType.startsWith('video/'));

  /* fotos e vídeos da ocorrência — no cadastro ou na vistoria */
  const renderMidias = () => (
    <>
        {/* Levantamento fotográfico */}
        {fotos.length > 0 && (
          <div className="os-fotos-section">
            <div className="os-fotos-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Levantamento Fotográfico ({fotos.length} {fotos.length === 1 ? 'foto' : 'fotos'})
            </div>
            <div className="os-fotos-grid">
              {fotos.map(f => (
                <div key={f.id} className="os-foto-item">
                  {f.objectUrl ? (
                    <button type="button" className="os-foto-btn" onClick={() => setFotoAberta(f)} title="Ver foto inteira">
                      <img src={f.objectUrl} alt={f.nomeArquivo} className="os-foto-img" />
                    </button>
                  ) : (
                    <div className="os-foto-img os-foto-erro">—</div>
                  )}
                  <span className="os-foto-nome">{f.nomeArquivo}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {videos.length > 0 && (
          <div className="os-fotos-section">
            <div className="os-fotos-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
              </svg>
              Vídeos ({videos.length})
            </div>
            <div className="os-fotos-lista">
              {videos.map(v => (
                <span key={v.id} className="os-video-nome">{v.nomeArquivo}</span>
              ))}
            </div>
          </div>
        )}
    </>
  );

  const numeroOS = row.numeroOS ?? gerarNumeroOS(row.id, row.data);
  const quando = (iso?: string | null) => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const andamento = [
    { nome: 'Registrada', feito: true, info: [quando(row.criadoEm), row.fiscal].filter(Boolean).join(' · ') },
    ...(row.aprovadoEm || row.etapa === 'AGUARDANDO_APROVACAO'
      ? [{ nome: 'Aprovada', feito: !!row.aprovadoEm, info: [quando(row.aprovadoEm), row.aprovadoPor].filter(Boolean).join(' · ') || 'aguardando aprovação' }]
      : []),
    { nome: 'Executada', feito: !!row.executadoEm, info: [quando(row.executadoEm), row.executadoPor].filter(Boolean).join(' · ') || 'aguardando baixa do fiscal' },
    { nome: 'Finalizada', feito: !!row.finalizadoEm, info: [quando(row.finalizadoEm), row.finalizadoPor].filter(Boolean).join(' · ') || (row.etapa === 'CANCELADA' ? 'OS cancelada' : 'aguardando conferência') },
  ];
  const municipio = session.entity.municipalityName ?? '';
  const uf = session.entity.uf ?? '';

  /* verifica se já passou pela vistoria de conclusão */
  const temVistoria = Boolean(dataVistoria || fiscal || qualidade);

  return createPortal(
    <div className="so os-backdrop so-os-imprimir" role="presentation">
      <div className="os-modal" role="dialog" aria-modal="true" aria-label={`Ordem de Serviço ${numeroOS}`}>

        {/* Cabeçalho da janela (não sai na impressão) */}
        <div className="os-toolbar so-dlg-h">
          <div className="so-selo sm" aria-hidden="true">
            <span className="cm tl" /><span className="cm tr" /><span className="cm br" /><span className="cm bl" />
            <span className="so-gsh" />
            <span className="so-sic"><svg className="i" viewBox="0 0 24 24"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg></span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="so-eyebrow" style={{ color: config.cor }}>{config.nome} · para imprimir</div>
            <h2 style={{ marginTop: 3 }}>Ordem de Serviço <span className="mono">{numeroOS}</span></h2>
            <p>A folha abaixo sai no papel com o brasão, as etapas, as fotos e os espaços para assinatura.</p>
          </div>
          <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-start' }}>
            <button type="button" className="so-btn so-primary sm os-shine" onClick={() => window.print()}>
              <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
              Imprimir
            </button>
            <button type="button" className="so-x" aria-label="Fechar" onClick={onClose}>
              <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
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

          {/* Andamento da OS */}
          <ol className="os-andamento" aria-label="Andamento da ordem de serviço">
            {andamento.map(a => (
              <li key={a.nome} className={a.feito ? 'is-feito' : undefined}>
                <i />
                <strong>{a.nome}</strong>
                <span>{a.info}</span>
              </li>
            ))}
          </ol>

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

          {/* Observações do solicitante */}
          {obsTexto && (
            <div className="os-section">
              <div className="os-section-title">Observações</div>
              <div className="os-obs">{obsTexto}</div>
            </div>
          )}

          {/* Registro fotográfico do cadastro — antes da vistoria as fotos ficam aqui */}
          {!temVistoria && midias.length > 0 && (
            <div className="os-section">
              <div className="os-section-title">Registro Fotográfico</div>
              {renderMidias()}
            </div>
          )}

          <div className="os-divider" />

          {/* Vistoria de Conclusão — só aparece se já foi realizada */}
          {temVistoria ? (
            <div className="os-section os-vistoria">
              <div className="os-section-title os-section-title--green">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ display: 'inline', marginRight: 6 }}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Vistoria de Conclusão
              </div>
              <div className="os-grid">
                {dataVistoria && (
                  <div className="os-field">
                    <span className="os-field-label">Data da vistoria</span>
                    <span className="os-field-value">{dataVistoria}</span>
                  </div>
                )}
                {fiscal && (
                  <div className="os-field">
                    <span className="os-field-label">Fiscal responsável</span>
                    <span className="os-field-value">{fiscal}</span>
                  </div>
                )}
                {qualidade && (
                  <div className="os-field">
                    <span className="os-field-label">Qualidade da execução</span>
                    <span className="os-field-value">{qualidade}</span>
                  </div>
                )}
              </div>

              {renderMidias()}
            </div>
          ) : (
            /* Bloco para preenchimento manual — se ainda não foi vistoriado */
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
          )}

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

          {/* Rodapé */}
          <div className="os-footer">
            <span className="os-footer-marca"><SimboloSisObras tamanho={14} />SisObras · Gestão de Obras — {session.entity.name}</span>
            <span>{numeroOS} · {formatDataBr(row.data)}</span>
          </div>
        </div>
      </div>

      {/* foto inteira, com o carimbo */}
      {fotoAberta && (
        <div className="os-foto-zoom" onClick={() => setFotoAberta(null)}>
          <img src={fotoAberta.objectUrl} alt={fotoAberta.nomeArquivo} />
          <div className="os-foto-zoom-barra">
            <span>{fotoAberta.nomeArquivo}</span>
            <a href={fotoAberta.objectUrl} download={fotoAberta.nomeArquivo} onClick={e => e.stopPropagation()}>Baixar</a>
            <button type="button">Fechar</button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
