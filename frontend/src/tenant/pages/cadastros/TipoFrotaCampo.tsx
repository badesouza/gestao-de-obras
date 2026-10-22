import { useState } from 'react';
import { frotaApi } from '../../../lib/api-client';
import type { TipoFrotaItem } from '../../../lib/api-client';
import { useTenant } from '../../TenantContext';
import { AcoesLinha, Ic, msgErro } from '../../components/sisobras/so';
import type { PedidoExclusao } from '../../components/sisobras/so';

type Toast = (msg: string, tipo?: 'success' | 'error' | 'warning') => void;

/**
 * Campo "Tipo" de veículos e equipamentos: escolhe da lista do órgão
 * (Veículos, Máquinas, Equipamentos, Móveis…) e, ali mesmo, cria, renomeia e exclui tipos.
 * A lista abre dentro da janela, empurrando os campos de baixo (não tampa nada).
 */
export function TipoFrotaCampo({ tipos, valor, invalido, onEscolher, onTipos, showToast, confirmar }: {
  tipos: TipoFrotaItem[];
  valor: string;
  invalido?: boolean;
  onEscolher: (id: string) => void;
  onTipos: (t: TipoFrotaItem[]) => void;
  showToast: Toast;
  confirmar: (p: PedidoExclusao) => void;
}) {
  const { entityId } = useTenant();
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null);
  const [novo, setNovo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const escolhido = tipos.find(t => t.id === valor);

  function escolher(id: string) { onEscolher(id); setAberto(false); setEditando(null); }

  async function adicionar() {
    const nome = novo.trim();
    if (nome.length < 2) { showToast('Escreva o nome do tipo', 'warning'); return; }
    setOcupado(true);
    try {
      const t = await frotaApi.criarTipo(entityId, nome);
      onTipos([...tipos, t]);
      setNovo('');
      escolher(t.id);
      showToast(`Tipo "${t.nome}" criado`);
    } catch (e) { showToast(msgErro(e), 'error'); }
    finally { setOcupado(false); }
  }

  async function renomear() {
    if (!editando) return;
    const nome = editando.nome.trim();
    if (nome.length < 2) { showToast('Escreva o nome do tipo', 'warning'); return; }
    setOcupado(true);
    try {
      await frotaApi.renomearTipo(entityId, editando.id, nome);
      onTipos(tipos.map(t => (t.id === editando.id ? { ...t, nome } : t)));
      setEditando(null);
      showToast('Tipo renomeado');
    } catch (e) { showToast(msgErro(e), 'error'); }
    finally { setOcupado(false); }
  }

  function excluir(t: TipoFrotaItem) {
    if (t.usos > 0) {
      showToast(`"${t.nome}" está em ${t.usos} ${t.usos === 1 ? 'cadastro' : 'cadastros'}. Troque o tipo deles antes de excluir.`, 'warning');
      return;
    }
    confirmar({
      oque: 'tipo', nome: t.nome,
      texto: 'Nenhum veículo ou equipamento usa este tipo. Ele sai da lista.',
      acao: async () => {
        try {
          await frotaApi.removerTipo(entityId, t.id);
          onTipos(tipos.filter(x => x.id !== t.id));
          if (valor === t.id) onEscolher('');
          showToast('Tipo excluído');
        } catch (e) { showToast(msgErro(e), 'error'); }
      },
    });
  }

  /* Enter confirma; Esc só cancela a edição (não fecha a janela) */
  const teclas = (ok: () => void, cancelar: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); ok(); }
    if (e.key === 'Escape') { e.stopPropagation(); cancelar(); }
  };

  return (
    <div className="so-field so-tf">
      <span className="so-lbl">Tipo <span className="req">*</span><span className="opt">Veículos, Máquinas, Equipamentos, Móveis…</span></span>
      <button type="button" className={`so-ctrl so-tf-gatilho${aberto ? ' on' : ''}${invalido ? ' invalid' : ''}`} aria-expanded={aberto} onClick={() => setAberto(a => !a)}>
        {escolhido
          ? <span className="so-tf-valor"><i />{escolhido.nome}</span>
          : <span className="so-tf-vazio">Escolha o tipo</span>}
        <svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {aberto && (
        <div className="so-tf-lista" role="listbox" aria-label="Tipos">
          {tipos.map(t => (editando?.id === t.id ? (
            <div key={t.id} className="so-tf-item editando">
              <span className="so-ctrl"><input autoFocus aria-label="Novo nome do tipo" value={editando.nome} maxLength={80}
                onChange={e => setEditando({ id: t.id, nome: e.target.value })} onKeyDown={teclas(renomear, () => setEditando(null))} /></span>
              <button type="button" className="so-btn so-primary sm" disabled={ocupado} onClick={renomear}><Ic n="check" />Salvar</button>
              <button type="button" className="so-btn so-ghost sm" onClick={() => setEditando(null)}>Cancelar</button>
            </div>
          ) : (
            <div key={t.id} className={`so-tf-item${t.id === valor ? ' sel' : ''}`}>
              <button type="button" role="option" aria-selected={t.id === valor} className="so-tf-escolher" onClick={() => escolher(t.id)}>
                <span className="so-tf-radio" />
                <b>{t.nome}</b>
                <span className="so-tf-usos mono">{t.usos} {t.usos === 1 ? 'cadastro' : 'cadastros'}</span>
              </button>
              <AcoesLinha nome={t.nome} onEditar={() => setEditando({ id: t.id, nome: t.nome })} onExcluir={() => excluir(t)} />
            </div>
          )))}
          {!tipos.length && <p className="so-help" style={{ padding: '6px 10px' }}>Nenhum tipo ainda. Crie o primeiro abaixo.</p>}
          <div className="so-tf-novo">
            <span className="so-ctrl"><Ic n="plus" /><input aria-label="Novo tipo" placeholder="Novo tipo (ex.: Móveis)" value={novo} maxLength={80}
              onChange={e => setNovo(e.target.value)} onKeyDown={teclas(adicionar, () => setAberto(false))} /></span>
            <button type="button" className="so-btn so-primary sm" disabled={ocupado || novo.trim().length < 2} onClick={adicionar}><Ic n="plus" />Adicionar</button>
          </div>
        </div>
      )}
    </div>
  );
}
