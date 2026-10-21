import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LinkGerado } from '../../../lib/api-client';
import { useTenant } from '../../TenantContext';
import { Aviso, Ic, Selo } from './so';

function dataHora(iso: string) {
  const d = new Date(iso);
  return {
    dia: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    hora: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  };
}

/** Janela "Login criado — link para criar a senha" (copiar, WhatsApp, e-mail) */
export function LinkGeradoDialog({ dados, novo, onFechar }: { dados: LinkGerado; novo: boolean; onFechar: () => void }) {
  const { session } = useTenant();
  const [copiado, setCopiado] = useState(false);
  const url = `${window.location.origin}/acesso/${dados.link.token}`;
  const primeiro = dados.nome.split(' ')[0];
  const { dia, hora } = dataHora(dados.link.expiraEm);
  const municipio = session.entity.municipalityName ?? session.entity.name;
  const mensagem = `Olá, ${primeiro}! Seu acesso ao Gestão de Obras da Prefeitura de ${municipio} foi ${novo ? 'criado' : 'renovado'}. Toque no link para criar sua senha e entrar: ${url}\nO link vale até ${dia} às ${hora}.`;
  const tel = (dados.celular ?? '').replace(/\D/g, '');
  const zap = `https://wa.me/${tel ? `55${tel}` : ''}?text=${encodeURIComponent(mensagem)}`;
  const mail = `mailto:${dados.email}?subject=${encodeURIComponent('Seu acesso ao Gestão de Obras')}&body=${encodeURIComponent(mensagem)}`;

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar]);

  async function copiar() {
    try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2200); }
    catch { window.prompt('Copie o link:', url); }
  }

  return createPortal(
    <div className="so so-scrim fixo" role="presentation" onClick={onFechar}>
      <section className="so-dialog" role="dialog" aria-modal="true" aria-label={novo ? 'Login criado' : 'Novo link de senha'} onClick={e => e.stopPropagation()}>
        <div className="so-dlg-h">
          <Selo icone="check" tom="mint" pequeno />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="so-eyebrow" style={{ color: 'var(--mint)' }}>Pessoas · {novo ? 'login criado' : 'novo link'}</div>
            <h2 style={{ marginTop: 3 }}>{novo ? `Login criado para ${dados.nome}` : `Novo link para ${dados.nome}`}</h2>
            <p>Envie o link abaixo. Ele abre uma página onde {primeiro} cria a própria senha e já entra no sistema.</p>
          </div>
          <button type="button" className="so-x" aria-label="Fechar" style={{ alignSelf: 'flex-start' }} onClick={onFechar}><Ic n="x" /></button>
        </div>
        <div className="so-dlg-b">
          <div className="so-field">
            <span className="so-lbl">Link de acesso</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <div className="so-linkbox" title={url}>{url}</div>
              <button type="button" className="so-btn so-primary" onClick={copiar}><Ic n={copiado ? 'check' : 'copiar'} />{copiado ? 'Copiado' : 'Copiar'}</button>
            </div>
          </div>
          <div className="so-row2">
            <a className="so-btn so-mintbtn" style={{ height: 44 }} href={zap} target="_blank" rel="noreferrer"><Ic n="chat" />Enviar por WhatsApp</a>
            <a className="so-btn so-ghost" style={{ height: 44 }} href={mail}><Ic n="mail" />Enviar por e-mail</a>
          </div>
          <div className="so-field">
            <span className="so-lbl">Mensagem que vai junto</span>
            <div className="so-bubble" style={{ whiteSpace: 'pre-line' }}>{mensagem}</div>
          </div>
          <Aviso tom="amber" icone="relogio">Vale por <strong>48 horas</strong> e funciona <strong>uma vez só</strong>. Se vencer ou se a pessoa esquecer a senha, gere outro na lista de usuários.</Aviso>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="so-btn so-ghost" onClick={onFechar}>Fechar</button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
