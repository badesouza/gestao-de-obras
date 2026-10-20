import { useEffect, useState } from 'react';

/* ── Aplicativo instalável + modo offline ─────────────────────── */

interface EventoInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let pedidoInstalacao: EventoInstalacao | null = null;
const ouvintes = new Set<() => void>();
const notificar = () => ouvintes.forEach(f => f());

/** Liga o service worker (só no site publicado) e captura o convite de instalação do Android */
export function iniciarPwa() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    pedidoInstalacao = e as EventoInstalacao;
    notificar();
  });
  window.addEventListener('appinstalled', () => {
    pedidoInstalacao = null;
    notificar();
  });
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => { void registrar(); });
  }
}

/* ── atualização: versão nova publicada chega sozinha ── */

let versaoNova = false;
const abertoEm = Date.now();

async function registrar() {
  const sw = navigator.serviceWorker;
  const tinhaVersao = !!sw.controller;
  sw.addEventListener('controllerchange', () => {
    if (!tinhaVersao) return; /* primeira instalação: nada a trocar */
    /* logo ao abrir o app ninguém está preenchendo nada: atualiza direto */
    if (Date.now() - abertoEm < 15000) { window.location.reload(); return; }
    versaoNova = true;
    notificar();
  });
  const reg = await sw.register('/sw.js');
  const checar = () => { void reg.update().catch(() => {}); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checar(); });
  setInterval(checar, 30 * 60 * 1000);
}

/** Há uma versão nova pronta (o app estava em uso quando ela chegou) */
export function useVersaoNova() {
  const [nova, setNova] = useState(versaoNova);
  useEffect(() => {
    const f = () => setNova(versaoNova);
    ouvintes.add(f);
    return () => { ouvintes.delete(f); };
  }, []);
  return nova;
}

export function rodandoComoApp(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/** Botão de instalar: disponível quando o navegador oferece a instalação */
export function useInstalacao() {
  const [pode, setPode] = useState(() => !!pedidoInstalacao);
  useEffect(() => {
    const f = () => setPode(!!pedidoInstalacao);
    ouvintes.add(f);
    return () => { ouvintes.delete(f); };
  }, []);

  const instalar = async () => {
    if (!pedidoInstalacao) return false;
    await pedidoInstalacao.prompt();
    const { outcome } = await pedidoInstalacao.userChoice;
    pedidoInstalacao = null;
    notificar();
    return outcome === 'accepted';
  };

  return { podeInstalar: pode, instalar };
}

/** Ao sair: apaga as respostas guardadas do servidor (a fila de ocorrências fica) */
export function limparDadosOffline() {
  navigator.serviceWorker?.controller?.postMessage('limpar-dados');
  void caches?.delete('gdo-api').catch(() => {});
}

/** Atalho do app instalado: abre direto na última prefeitura usada */
const CHAVE_ULTIMO = 'gdo:ultimo-tenant';
export function lembrarTenant(entityId: string) {
  try { localStorage.setItem(CHAVE_ULTIMO, entityId); } catch { /* sem storage */ }
}
export function ultimoTenant(): string | null {
  try { return localStorage.getItem(CHAVE_ULTIMO); } catch { return null; }
}

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}
