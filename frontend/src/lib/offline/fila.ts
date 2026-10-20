import { ApiError, mapaApi, tenantApi, type CellValue } from '../api-client';

/* ── Fila offline de ocorrências ─────────────────────────────────
   Ocorrência registrada sem internet fica guardada no aparelho
   (IndexedDB, com as fotos) e é enviada sozinha quando o sinal volta.
   O envio é retomável: se cair no meio, continua de onde parou.      */

export interface FotoFila { nome: string; tipo: string; blob: Blob }

export interface ItemFila {
  id: string;
  entityId: string;
  centroId: string;
  servico: string;
  cor: string;
  payload: { data: string; values?: Record<string, CellValue> };
  resumo: string;
  coords?: { lat: number; lng: number; label?: string };
  fotos: FotoFila[];
  criadoEm: number;
  /* progresso do envio */
  registroId?: string;
  coordsEnviadas?: boolean;
  fotosEnviadas: number;
  erro?: string;
}

export type EstadoEnvio = 'parado' | 'enviando' | 'precisa-login';

const DB = 'gdo-offline';
const STORE = 'ocorrencias';
export const EVENTO_FILA = 'gdo-fila';

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore(STORE, { keyPath: 'id' });
      s.createIndex('entityId', 'entityId');
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => falha(req.error);
  });
}

async function tx<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  try {
    return await new Promise<T>((ok, falha) => {
      const t = db.transaction(STORE, modo);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => ok(req.result);
      t.onerror = () => falha(t.error);
      t.onabort = () => falha(t.error);
    });
  } finally {
    db.close();
  }
}

function avisar(detalhe: { tipo: 'adicionado' | 'enviado' | 'mudou'; qtd?: number }) {
  window.dispatchEvent(new CustomEvent(EVENTO_FILA, { detail: detalhe }));
}

export async function adicionarNaFila(item: Omit<ItemFila, 'id' | 'criadoEm' | 'fotosEnviadas'> & { fotosEnviadas?: number }) {
  const completo: ItemFila = { fotosEnviadas: 0, ...item, id: crypto.randomUUID(), criadoEm: Date.now() };
  await tx('readwrite', s => s.put(completo));
  /* pede ao navegador para não apagar estes dados quando faltar espaço */
  void navigator.storage?.persist?.().catch(() => {});
  avisar({ tipo: 'adicionado' });
  return completo;
}

export async function listarFila(entityId: string): Promise<ItemFila[]> {
  const itens = await tx<ItemFila[]>('readonly', s => s.index('entityId').getAll(entityId));
  return itens.sort((a, b) => a.criadoEm - b.criadoEm);
}

async function salvar(item: ItemFila) { await tx('readwrite', s => s.put(item)); }
async function remover(id: string) { await tx('readwrite', s => s.delete(id)); }

export async function descartarDaFila(id: string) {
  await remover(id);
  avisar({ tipo: 'mudou' });
}

/** Erro de rede (sem sinal, servidor fora) — diferente de erro de validação */
export function ehErroDeRede(e: unknown): boolean {
  return e instanceof TypeError || (e instanceof ApiError && e.status >= 500) || !navigator.onLine;
}

/* ── envio ── */

let emAndamento: Promise<EstadoEnvio> | null = null;

/** Envia tudo que está na fila desta entidade. Seguro chamar várias vezes. */
export function sincronizarFila(entityId: string): Promise<EstadoEnvio> {
  emAndamento ??= enviar(entityId).finally(() => { emAndamento = null; });
  return emAndamento;
}

async function enviar(entityId: string): Promise<EstadoEnvio> {
  const itens = await listarFila(entityId);
  let enviados = 0;
  for (const item of itens) {
    try {
      if (!item.registroId) {
        const novo = await tenantApi.centrosCusto.createRegistro(entityId, item.centroId, item.payload);
        item.registroId = novo.id;
        await salvar(item);
      }
      if (item.coords && !item.coordsEnviadas) {
        await mapaApi.salvarCoords(entityId, item.registroId, item.coords.lat, item.coords.lng, item.coords.label);
        item.coordsEnviadas = true;
        await salvar(item);
      }
      while (item.fotosEnviadas < item.fotos.length) {
        const f = item.fotos[item.fotosEnviadas];
        await mapaApi.uploadMidia(entityId, item.registroId, new File([f.blob], f.nome, { type: f.tipo }));
        item.fotosEnviadas++;
        await salvar(item);
      }
      await remover(item.id);
      enviados++;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { avisar({ tipo: 'mudou' }); return 'precisa-login'; }
      if (ehErroDeRede(e)) break; /* tenta de novo quando o sinal voltar */
      /* erro do servidor sobre este item: guarda o motivo e segue para o próximo */
      item.erro = e instanceof Error ? e.message : 'Erro ao enviar';
      await salvar(item);
    }
  }
  avisar(enviados ? { tipo: 'enviado', qtd: enviados } : { tipo: 'mudou' });
  return 'parado';
}
