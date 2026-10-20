import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EVENTO_FILA, descartarDaFila, listarFila, sincronizarFila, type EstadoEnvio, type ItemFila,
} from '../../../lib/offline/fila';
import { rodandoComoApp, useInstalacao, useOnline, useVersaoNova } from '../../../lib/offline/pwa';
import '../../styles/offline.css';

const CHAVE_DISPENSA = 'gdo:instalar-dispensado';

function quando(ts: number) {
  const d = new Date(ts);
  const hoje = new Date().toDateString() === d.toDateString();
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return hoje ? `hoje, ${hora}` : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${hora}`;
}

/** Avisos flutuantes: sem internet, ocorrências guardadas no aparelho e convite para instalar o app */
export function CentralOffline({ entityId }: { entityId: string }) {
  const navigate = useNavigate();
  const online = useOnline();
  const { podeInstalar, instalar } = useInstalacao();
  const versaoNova = useVersaoNova();

  const [itens,   setItens]   = useState<ItemFila[]>([]);
  const [estado,  setEstado]  = useState<EstadoEnvio>('parado');
  const [aberto,  setAberto]  = useState(false);
  const [toast,   setToast]   = useState<{ tipo: 'ok' | 'guardado'; texto: string } | null>(null);
  const [dispensado, setDispensado] = useState(() => {
    try { return localStorage.getItem(CHAVE_DISPENSA) === '1'; } catch { return false; }
  });

  const recarregar = useCallback(() => {
    void listarFila(entityId).then(setItens).catch(() => {});
  }, [entityId]);

  const enviar = useCallback(async () => {
    if (!navigator.onLine) return;
    setEstado('enviando');
    const r = await sincronizarFila(entityId).catch(() => 'parado' as const);
    setEstado(r);
  }, [entityId]);

  /* reage às mudanças da fila */
  useEffect(() => {
    recarregar();
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ tipo: string; qtd?: number }>).detail;
      recarregar();
      if (d.tipo === 'enviado' && d.qtd) {
        setToast({ tipo: 'ok', texto: d.qtd === 1 ? 'Ocorrência guardada foi enviada' : `${d.qtd} ocorrências guardadas foram enviadas` });
      }
      if (d.tipo === 'adicionado') {
        setToast({ tipo: 'guardado', texto: navigator.onLine ? 'Ocorrência guardada, enviando…' : 'Sem internet: ocorrência guardada no celular' });
        void enviar();
      }
    };
    window.addEventListener(EVENTO_FILA, h);
    return () => window.removeEventListener(EVENTO_FILA, h);
  }, [recarregar, enviar]);

  /* envia ao abrir, quando o sinal volta e a cada minuto enquanto houver pendências */
  useEffect(() => {
    if (!online) return;
    const t = setTimeout(() => { void enviar(); }, 300);
    return () => clearTimeout(t);
  }, [online, enviar]);
  useEffect(() => {
    if (!itens.length) return;
    const t = setInterval(() => { if (navigator.onLine) void enviar(); }, 60000);
    return () => clearInterval(t);
  }, [itens.length, enviar]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const dispensar = () => {
    setDispensado(true);
    try { localStorage.setItem(CHAVE_DISPENSA, '1'); } catch { /* sem storage */ }
  };

  const mostrarInstalar = podeInstalar && !dispensado && !rodandoComoApp();
  const qtd = itens.length;
  const comErro = itens.filter(i => i.erro).length;

  return (
    <div className="off-dock" aria-live="polite">

      {toast && (
        <div className={`off-toast is-${toast.tipo}`}>
          {toast.tipo === 'ok' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="5" y="2" width="14" height="20" rx="2.5"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
          )}
          {toast.texto}
        </div>
      )}

      {versaoNova && (
        <div className="off-versao">
          <span className="off-versao-ponto" />
          <div className="off-instalar-texto">
            <strong>Versão nova do sistema</strong>
            <span>Termine o que está fazendo e atualize.</span>
          </div>
          <button type="button" className="off-btn-cor" onClick={() => window.location.reload()}>Atualizar</button>
        </div>
      )}

      {mostrarInstalar && (
        <div className="off-instalar">
          <img src="/icons/icon-192.png" alt="" className="off-instalar-icone" />
          <div className="off-instalar-texto">
            <strong>Instale o app no celular</strong>
            <span>Abre direto da tela inicial, mesmo sem internet.</span>
          </div>
          <button type="button" className="off-btn-cor" onClick={() => void instalar()}>Instalar</button>
          <button type="button" className="off-fechar" onClick={dispensar} aria-label="Agora não">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {aberto && qtd > 0 && (
        <div className="off-painel">
          <div className="off-painel-cab">
            <div>
              <span className="off-eyebrow">Guardadas no celular</span>
              <strong>{qtd} {qtd === 1 ? 'ocorrência' : 'ocorrências'} aguardando envio</strong>
            </div>
            <button type="button" className="off-fechar" onClick={() => setAberto(false)} aria-label="Fechar">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <ul className="off-lista">
            {itens.map(i => (
              <li key={i.id} className={i.erro ? 'is-erro' : undefined}>
                <span className="off-lista-cor" style={{ background: i.cor }} />
                <div className="off-lista-info">
                  <strong>{i.servico}</strong>
                  <span>{[i.resumo, quando(i.criadoEm)].filter(Boolean).join(' · ')}</span>
                  {i.fotos.length > 0 && (
                    <span className="off-lista-fotos">
                      {i.fotosEnviadas > 0 ? `${i.fotosEnviadas} de ${i.fotos.length} fotos enviadas` : `${i.fotos.length} ${i.fotos.length === 1 ? 'foto' : 'fotos'}`}
                    </span>
                  )}
                  {i.erro && <span className="off-lista-erro">Não aceito pelo servidor: {i.erro}</span>}
                </div>
                {i.erro && (
                  <button type="button" className="off-btn-perigo" onClick={() => void descartarDaFila(i.id)}>Descartar</button>
                )}
              </li>
            ))}
          </ul>
          {estado === 'precisa-login' ? (
            <button type="button" className="off-btn-cor off-btn-largo" onClick={() => navigate(`/t/${entityId}/login`)}>
              Entrar de novo para enviar
            </button>
          ) : (
            <button type="button" className="off-btn-cor off-btn-largo" onClick={() => void enviar()} disabled={!online || estado === 'enviando'}>
              {!online ? 'Sem internet — envia sozinho quando voltar' : estado === 'enviando' ? 'Enviando…' : 'Enviar agora'}
            </button>
          )}
        </div>
      )}

      {qtd > 0 && !aberto && (
        <button type="button" className={`off-pilula${comErro ? ' is-erro' : ''}${estado === 'enviando' ? ' is-enviando' : ''}`} onClick={() => setAberto(true)}>
          <span className="off-pilula-num">{qtd}</span>
          <span className="off-pilula-texto">
            {estado === 'enviando' ? 'Enviando…'
              : estado === 'precisa-login' ? 'Entre de novo para enviar'
              : online ? 'aguardando envio' : 'no celular · sem internet'}
          </span>
          {estado === 'enviando' && <span className="off-spinner" />}
        </button>
      )}

      {!online && qtd === 0 && (
        <div className="off-semrede">
          <span className="off-semrede-ponto" />
          Sem internet · o que registrar fica guardado no celular
        </div>
      )}
    </div>
  );
}
