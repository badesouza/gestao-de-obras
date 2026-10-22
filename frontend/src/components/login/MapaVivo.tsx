import { useEffect, useRef, type RefObject } from 'react';

/* ─── Mapa vivo da tela de entrada ────────────────────────────────────────
   Cidade desenhada (ilustrativa, não é o mapa real), equipes andando pelas
   ruas, pedidos acendendo e um fio de luz que leva cada pedido até o cartão
   de entrada. As luzes são só animação; o que é dado real vem do cartão.
   Pausa quando a aba fica escondida; com reduced-motion desenha um quadro só. */

type Pedido = { cor: string };
type Props<P extends Pedido> = {
  /** cor de cada luz que acende (sem pedido para o fio) */
  cores: string[];
  /** cartão que recebe o fio de luz; sem ele (celular) não há fio */
  alvo: RefObject<HTMLElement | null>;
  /** reserva espaço à direita para o cartão (px); 0 no celular */
  largCartao: number;
  /** próximo pedido que o fio vai levar até o cartão (null = só luz) */
  proximoPedido: () => P | null;
  aoChegar: (p: P) => void;
};

type Pt = [number, number];
type Bloco = { q: Pt[]; mx: number; my: number; i: number; j: number; praca: boolean };
type Equipe = { i: number; j: number; ni: number; nj: number; p: number; cor: string; rastro: Pt[] };
type Luz = { x: number; y: number; cor: string; nasce: number };
type Fio<P> = { x: number; y: number; tx: number; ty: number; cor: string; pedido: P; nasce: number; chegou: boolean };

function semente(s: number) {
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function MapaVivo<P extends Pedido>({ cores, alvo, largCartao, proximoPedido, aoChegar }: Props<P>) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const mira = useRef<HTMLDivElement>(null);
  const miraTag = useRef<HTMLSpanElement>(null);
  /* as funções mudam a cada render da página; o laço lê sempre a mais nova */
  const atual = useRef({ cores, largCartao, proximoPedido, aoChegar });
  useEffect(() => { atual.current = { cores, largCartao, proximoPedido, aoChegar }; });

  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const parado = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0, raf = 0, ultimo = performance.now(), t = 0;
    let base: HTMLCanvasElement | null = null;
    let blocos: Bloco[] = [], pts: Pt[][] = [];
    let anda: (i: number, j: number) => boolean = () => false;
    let equipes: Equipe[] = [];
    const luzes: Luz[] = [];
    const fios: Fio<P>[] = [];
    let prox = 700;
    const R = semente(99);

    function montar() {
      const r = cv!.getBoundingClientRect();
      if (!r.width || !r.height) return;
      W = r.width; H = r.height;
      cv!.width = Math.round(W * DPR); cv!.height = Math.round(H * DPR);
      ctx!.setTransform(DPR, 0, 0, DPR, 0, 0);
      const rr = semente(7);
      const larg = atual.current.largCartao;
      const cw = Math.max(34, W / 26), ch = cw * .82;
      const cols = Math.ceil(W / cw) + 4, rows = Math.ceil(H / ch) + 4;
      const cx = W * (larg ? .52 : .5), cy = H * .5, rad = Math.min(W, H) * (larg ? .58 : .56);
      pts = [];
      for (let i = 0; i <= cols; i++) {
        pts[i] = [];
        for (let j = 0; j <= rows; j++) pts[i][j] = [(i - 2) * cw + (rr() - .5) * cw * .35, (j - 2) * ch + (rr() - .5) * ch * .35];
      }
      /* malha levemente girada: ruas que não são perfeitamente retas */
      const ca = Math.cos(-.14), sa = Math.sin(-.14);
      for (const col of pts) for (const p of col) { const x = p[0] - cx, y = p[1] - cy; p[0] = cx + x * ca - y * sa; p[1] = cy + x * sa + y * ca; }
      const esp = W > H * 1.2 ? 1.75 : 1.2;
      const dentro = (x: number, y: number) => {
        const dx = (x - cx) / (rad * esp), dy = (y - cy) / rad, a = Math.atan2(dy, dx);
        const lim = 1 + .16 * Math.sin(a * 3 + 1) + .09 * Math.sin(a * 7);
        return dx * dx + dy * dy < lim * lim;
      };
      blocos = [];
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const q: Pt[] = [pts[i][j], pts[i + 1][j], pts[i + 1][j + 1], pts[i][j + 1]];
        const mx = (q[0][0] + q[2][0]) / 2, my = (q[0][1] + q[2][1]) / 2;
        if (dentro(mx, my)) blocos.push({ q, mx, my, i, j, praca: rr() < .06 });
      }
      /* camada fixa: desenhada uma vez por tamanho */
      base = document.createElement('canvas');
      base.width = cv!.width; base.height = cv!.height;
      const b = base.getContext('2d')!;
      b.setTransform(DPR, 0, 0, DPR, 0, 0);
      const g = b.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * .7);
      g.addColorStop(0, '#0B1130'); g.addColorStop(1, '#05081A');
      b.fillStyle = g; b.fillRect(0, 0, W, H);
      for (let k = 0; k < W * H / 700; k++) {
        const x = rr() * W, y = rr() * H;
        if (dentro(x, y)) continue;
        b.fillStyle = `rgba(61,214,166,${.04 + rr() * .08})`; b.fillRect(x, y, 1.4, 1.4);
      }
      for (const k of blocos) {
        const c = [(k.q[0][0] + k.q[2][0]) / 2, (k.q[0][1] + k.q[2][1]) / 2];
        b.beginPath();
        k.q.forEach((p, m) => {
          const dx = c[0] - p[0], dy = c[1] - p[1], d = Math.hypot(dx, dy);
          const x = p[0] + dx / d * 3.2, y = p[1] + dy / d * 3.2;
          if (m) b.lineTo(x, y); else b.moveTo(x, y);
        });
        b.closePath();
        if (k.praca) { b.fillStyle = 'rgba(25,184,138,.16)'; b.strokeStyle = 'rgba(61,214,166,.35)'; }
        else { b.fillStyle = `rgba(110,120,255,${.06 + rr() * .07})`; b.strokeStyle = 'rgba(140,150,255,.2)'; }
        b.fill(); b.lineWidth = .8; b.stroke();
        if (!k.praca && rr() < .6) {
          const [a1, e1, f1, d1] = k.q;
          b.strokeStyle = 'rgba(140,150,255,.08)'; b.beginPath();
          b.moveTo((a1[0] + e1[0]) / 2, (a1[1] + e1[1]) / 2); b.lineTo((d1[0] + f1[0]) / 2, (d1[1] + f1[1]) / 2); b.stroke();
        }
      }
      /* rodovia atravessando a cidade */
      const br: Pt[] = [[-20, H * .78], [W * .3, H * .62], [W * .55, H * .5], [W * .8, H * .33], [W + 20, H * .2]];
      const linha = () => { b.beginPath(); br.forEach((p, m) => (m ? b.lineTo(p[0], p[1]) : b.moveTo(p[0], p[1]))); b.stroke(); };
      b.lineCap = 'round'; b.lineJoin = 'round';
      b.strokeStyle = 'rgba(5,8,26,.9)'; b.lineWidth = 9; linha();
      b.strokeStyle = 'rgba(245,165,36,.45)'; b.lineWidth = 2; b.setLineDash([10, 7]); linha(); b.setLineDash([]);
      b.save(); b.translate(larg ? W * .44 : W * .7, larg ? H * .53 : H * .4); b.rotate(-.42);
      b.font = '600 10px "JetBrains Mono", monospace'; b.fillStyle = 'rgba(245,165,36,.75)'; b.fillText('BR-242', 0, -8); b.restore();
      const cxc = larg ? (W - larg) * .55 : cx;
      const cen = blocos.reduce((m, k) => (Math.hypot(k.mx - cxc, k.my - cy) < Math.hypot(m.mx - cxc, m.my - cy) ? k : m), blocos[0]);
      if (cen) { b.font = '700 10px "JetBrains Mono", monospace'; b.fillStyle = 'rgba(201,204,255,.7)'; b.fillText('CENTRO', cen.mx - 20, cen.my + 3); }
      anda = (i, j) => i > 0 && j > 0 && i < cols && j < rows && dentro(pts[i][j][0], pts[i][j][1]);
      const cs = atual.current.cores;
      equipes = cs.slice(0, larg ? 4 : 3).map(cor => {
        let k: Bloco; let n = 0;
        do { k = blocos[Math.floor(rr() * blocos.length)]; } while (!anda(k.i, k.j) && ++n < 50);
        return { i: k.i, j: k.j, ni: k.i, nj: k.j, p: 1, cor, rastro: [] };
      });
      luzes.length = 0; fios.length = 0;
      if (parado) { /* um quadro só, com algumas luzes acesas */
        for (let n = 0; n < 14; n++) { const k = blocos[Math.floor(rr() * blocos.length)]; luzes.push({ x: k.mx, y: k.my, cor: cs[n % cs.length], nasce: -20000 }); }
        quadro(16);
      }
    }

    function novaLuz() {
      const larg = atual.current.largCartao;
      /* não nasce embaixo do título, da legenda nem dos números */
      const livre = (k: Bloco) => !(k.mx < W * .42 && k.my < H * .44) && k.my < H - 150
        && !(larg && k.mx > W - larg - 240 && k.mx < W - larg && k.my < 230);
      let k: Bloco; let n = 0;
      do { k = blocos[Math.floor(R() * blocos.length)]; } while (!livre(k) && ++n < 30);
      const visivel = !larg || k.mx < W - larg - 20;
      const pedido = visivel && larg && alvo.current ? atual.current.proximoPedido() : null;
      const cs = atual.current.cores;
      const cor = pedido?.cor ?? cs[Math.floor(R() * cs.length)];
      luzes.push({ x: k.mx, y: k.my, cor, nasce: t });
      if (luzes.length > 60) luzes.shift();
      if (visivel && mira.current && miraTag.current) {
        mira.current.style.transform = `translate(${k.mx}px, ${k.my}px)`;
        mira.current.classList.add('on');
        const e = Math.round(k.mx * 3.1) % 1000, nn = ((Math.round(900 - k.my * 1.7) % 1000) + 1000) % 1000;
        miraTag.current.textContent = `E 357.${String(e).padStart(3, '0')} · N 8.614.${String(nn).padStart(3, '0')}`;
      }
      if (pedido && alvo.current) {
        const rc = alvo.current.getBoundingClientRect(), rv = cv!.getBoundingClientRect();
        fios.push({ x: k.mx, y: k.my, tx: rc.left - rv.left + 2, ty: rc.top - rv.top + 58, cor, pedido, nasce: t, chegou: false });
        if (fios.length > 6) fios.shift();
      }
    }

    function quadro(dt: number) {
      if (!base) return;
      t += dt;
      const c = ctx!;
      c.drawImage(base, 0, 0, W, H);
      const larg = atual.current.largCartao;
      const cx = larg ? (W - larg) * .5 : W * .5, cy = H * .5;
      if (!parado && c.createConicGradient) { /* varredura de radar */
        const gr = c.createConicGradient(t / 2600, cx, cy);
        gr.addColorStop(0, 'rgba(34,211,238,.10)'); gr.addColorStop(.08, 'rgba(34,211,238,0)'); gr.addColorStop(1, 'rgba(34,211,238,0)');
        c.fillStyle = gr; c.fillRect(0, 0, W, H);
      }
      c.lineCap = 'round';
      for (const e of equipes) {
        if (!parado) {
          e.p += dt / 900;
          if (e.p >= 1) {
            e.i = e.ni; e.j = e.nj; e.p = 0;
            const op = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => anda(e.i + a, e.j + b));
            const [a, b] = op[Math.floor(R() * op.length)] ?? [0, 0];
            e.ni = e.i + a; e.nj = e.j + b;
          }
        }
        const A = pts[e.i][e.j], B = pts[e.ni][e.nj];
        const x = A[0] + (B[0] - A[0]) * e.p, y = A[1] + (B[1] - A[1]) * e.p;
        e.rastro.push([x, y]); if (e.rastro.length > 40) e.rastro.shift();
        for (let k = 1; k < e.rastro.length; k++) {
          c.strokeStyle = e.cor; c.globalAlpha = k / e.rastro.length * .7; c.lineWidth = 2;
          c.beginPath(); c.moveTo(...e.rastro[k - 1]); c.lineTo(...e.rastro[k]); c.stroke();
        }
        c.globalAlpha = 1; c.fillStyle = '#fff'; c.shadowColor = e.cor; c.shadowBlur = 12;
        c.beginPath(); c.arc(x, y, 3.2, 0, 7); c.fill(); c.shadowBlur = 0;
      }
      if (!parado) { prox -= dt; if (prox <= 0) { prox = 1100 + R() * 1400; novaLuz(); } }
      /* fios de luz: o pedido viaja do mapa até o cartão */
      for (const f of fios) {
        const age = t - f.nasce, dur = 1100, pr = Math.min(1, age / dur);
        if (age > dur + 700) continue;
        const cx1 = (f.x + f.tx) / 2, cy1 = Math.min(f.y, f.ty) - 90;
        const ponto = (u: number): Pt => [(1 - u) * (1 - u) * f.x + 2 * (1 - u) * u * cx1 + u * u * f.tx, (1 - u) * (1 - u) * f.y + 2 * (1 - u) * u * cy1 + u * u * f.ty];
        const some = age > dur ? 1 - (age - dur) / 700 : 1;
        for (let k = 1; k <= 28; k++) {
          c.strokeStyle = f.cor; c.globalAlpha = some * (.12 + .7 * (k / 28)); c.lineWidth = 1.6;
          c.beginPath(); c.moveTo(...ponto(pr * (k - 1) / 28)); c.lineTo(...ponto(pr * k / 28)); c.stroke();
        }
        c.globalAlpha = some;
        if (pr < 1) { const h = ponto(pr); c.fillStyle = '#fff'; c.shadowColor = f.cor; c.shadowBlur = 16; c.beginPath(); c.arc(h[0], h[1], 3, 0, 7); c.fill(); c.shadowBlur = 0; }
        c.globalAlpha = 1;
        if (pr >= 1 && !f.chegou) { f.chegou = true; atual.current.aoChegar(f.pedido); }
      }
      for (const l of luzes) {
        const age = (t - l.nasce) / 1000, fin = age > 9;
        if (age < 1.6) {
          c.strokeStyle = l.cor; c.globalAlpha = Math.max(0, 1 - age / 1.6); c.lineWidth = 1.5;
          c.beginPath(); c.arc(l.x, l.y, 6 + age * 26, 0, 7); c.stroke(); c.globalAlpha = 1;
        }
        const queda = age < .45 ? 1 - age / .45 : 0;
        const y = l.y - 22 * queda * queda;
        c.shadowColor = fin ? '#3DD6A6' : l.cor; c.shadowBlur = 14; c.fillStyle = fin ? '#3DD6A6' : l.cor;
        c.beginPath(); c.arc(l.x, y, fin ? 3.4 : 4.6, 0, 7); c.fill(); c.shadowBlur = 0;
        if (!fin) { c.fillStyle = '#fff'; c.beginPath(); c.arc(l.x, y, 1.6, 0, 7); c.fill(); }
      }
    }

    function laco(agora: number) {
      const dt = Math.min(50, agora - ultimo); ultimo = agora;
      quadro(dt);
      raf = requestAnimationFrame(laco);
    }
    function liga() { cancelAnimationFrame(raf); ultimo = performance.now(); raf = requestAnimationFrame(laco); }
    const visivel = () => { if (document.hidden) cancelAnimationFrame(raf); else if (!parado) liga(); };

    const ro = new ResizeObserver(() => { montar(); if (parado) quadro(0); });
    ro.observe(cv);
    montar();
    if (!parado) liga();
    document.addEventListener('visibilitychange', visivel);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', visivel); };
  }, [alvo]);

  return (
    <>
      <canvas ref={canvas} className="cid-canvas" aria-hidden="true" />
      <div ref={mira} className="cid-mira" aria-hidden="true">
        <span className="h" /><span className="v" /><span className="bx" /><span ref={miraTag} className="tg">E 357.742 · N 8.614.918</span>
      </div>
    </>
  );
}
