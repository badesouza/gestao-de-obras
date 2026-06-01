import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, platformApi, setPlatformToken } from '../../lib/api-client';

/* ─── Blueprint canvas ────────────────────────────────────────────────────── */

function BlueprintCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;
    let t = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const teal  = 'rgba(42,74,74,';
    const cyan  = 'rgba(56,189,248,';
    const white = 'rgba(255,255,255,';

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      /* Fine grid */
      ctx.strokeStyle = `${teal} 0.3)`;
      ctx.lineWidth = 0.5;
      const gs = 40;
      for (let x = 0; x < W; x += gs) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += gs) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      /* Accent grid (every 5) */
      ctx.strokeStyle = `${teal} 0.55)`;
      ctx.lineWidth = 0.8;
      for (let x = 0; x < W; x += gs * 5) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += gs * 5) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      /* Animated horizontal scan */
      const scanX = (Math.sin(t * 0.3) * 0.5 + 0.5) * W;
      const gradV = ctx.createLinearGradient(scanX - 80, 0, scanX + 80, 0);
      gradV.addColorStop(0, `${cyan} 0)`);
      gradV.addColorStop(0.5, `${cyan} 0.08)`);
      gradV.addColorStop(1, `${cyan} 0)`);
      ctx.fillStyle = gradV;
      ctx.fillRect(scanX - 80, 0, 160, H);

      /* Corner brackets */
      const corners: [number, number][] = [
        [50, 50], [W - 50, 50], [50, H - 50], [W - 50, H - 50],
      ];
      const pulse = Math.sin(t * 1.5) * 0.5 + 0.5;
      corners.forEach(([cx, cy]) => {
        const len = 18 + pulse * 5;
        ctx.strokeStyle = `${cyan} ${0.4 + pulse * 0.35})`;
        ctx.lineWidth = 1.5;
        const sx = cx < W / 2 ? 1 : -1;
        const sy = cy < H / 2 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(cx + sx * len, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + sy * len);
        ctx.stroke();
      });

      /* Network node connections */
      const nodes = [
        { x: W * 0.1,  y: H * 0.2 },
        { x: W * 0.25, y: H * 0.6 },
        { x: W * 0.15, y: H * 0.85 },
        { x: W * 0.8,  y: H * 0.15 },
        { x: W * 0.9,  y: H * 0.55 },
        { x: W * 0.75, y: H * 0.9 },
      ];
      const links = [[0,1],[1,2],[3,4],[4,5],[0,3]];
      links.forEach(([a, b]) => {
        const alpha = 0.08 + Math.sin(t * 0.7 + a) * 0.04;
        ctx.strokeStyle = `${cyan} ${alpha})`;
        ctx.lineWidth = 0.8;
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        ctx.moveTo(nodes[a].x, nodes[a].y);
        ctx.lineTo(nodes[b].x, nodes[b].y);
        ctx.stroke();
        ctx.setLineDash([]);
      });
      nodes.forEach(({ x, y }, i) => {
        const r = 3 + Math.sin(t + i) * 1;
        const alpha = 0.25 + Math.sin(t * 0.8 + i) * 0.12;
        ctx.strokeStyle = `${cyan} ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = `${cyan} ${alpha * 0.4})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      });

      /* Status indicators */
      const indicators = [
        { x: W * 0.08, y: H * 0.42, label: 'SYS: ONLINE',  ok: true },
        { x: W * 0.08, y: H * 0.46, label: 'DB:  CONNECTED', ok: true },
        { x: W * 0.75, y: H * 0.38, label: 'AUTH: SECURE', ok: true },
        { x: W * 0.75, y: H * 0.42, label: 'API:  v2.0.0', ok: true },
      ];
      indicators.forEach(({ x, y, label, ok }) => {
        const blink = ok ? (Math.sin(t * 2 + x) > 0.8 ? 0.6 : 0.3) : 0.7;
        ctx.font = '9px monospace';
        ctx.fillStyle = ok ? `rgba(34,197,94,${blink})` : `rgba(239,68,68,${blink})`;
        ctx.fillText('●', x, y);
        ctx.fillStyle = `${white} 0.15)`;
        ctx.fillText(label, x + 12, y);
      });

      t += 0.016;
      animFrame = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────────── */

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  .pl-root {
    min-height: 100svh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #060d0d;
    position: relative;
    overflow: hidden;
    font-family: 'Rajdhani', system-ui, sans-serif;
  }

  .pl-root::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 50% 60% at 50% 50%, rgba(26,58,58,0.6) 0%, transparent 70%),
      radial-gradient(ellipse 80% 40% at 10% 90%, rgba(56,189,248,0.04) 0%, transparent 60%),
      radial-gradient(ellipse 60% 40% at 90% 10%, rgba(56,189,248,0.04) 0%, transparent 60%);
    pointer-events: none;
  }

  .pl-card {
    position: relative;
    z-index: 1;
    width: 420px;
    background: rgba(8, 18, 18, 0.85);
    border: 1px solid rgba(42,74,74,0.5);
    border-radius: 16px;
    padding: 40px;
    backdrop-filter: blur(12px);
    box-shadow:
      0 0 0 1px rgba(56,189,248,0.06),
      0 24px 64px rgba(0,0,0,0.5),
      inset 0 1px 0 rgba(255,255,255,0.04);
    animation: pl-in 0.65s cubic-bezier(0.22,1,0.36,1) both;
  }

  @keyframes pl-in {
    from { opacity: 0; transform: translateY(20px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* Top accent bar */
  .pl-card::before {
    content: '';
    position: absolute;
    top: 0; left: 20%; right: 20%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(56,189,248,0.5), transparent);
    border-radius: 1px;
  }

  /* Logomark */
  .pl-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 32px;
  }

  .pl-logo-icon {
    width: 38px; height: 38px;
    background: linear-gradient(135deg, #1a3a3a, #0d2020);
    border: 1px solid rgba(56,189,248,0.25);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 12px rgba(56,189,248,0.1);
  }

  .pl-logo-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .pl-logo-name {
    font-size: 13px;
    font-weight: 700;
    color: rgba(255,255,255,0.85);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .pl-logo-sub {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.15em;
    color: rgba(56,189,248,0.6);
    text-transform: uppercase;
  }

  /* Header */
  .pl-eyebrow {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(56,189,248,0.6);
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pl-eyebrow::before {
    content: '';
    display: block;
    width: 16px; height: 1px;
    background: rgba(56,189,248,0.5);
  }

  .pl-title {
    font-size: 26px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.01em;
    margin: 0 0 6px 0;
  }

  .pl-subtitle {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: rgba(255,255,255,0.3);
    letter-spacing: 0.04em;
    margin: 0 0 28px 0;
  }

  .pl-divider {
    height: 1px;
    background: linear-gradient(90deg, rgba(42,74,74,0.6), rgba(42,74,74,0.2));
    margin-bottom: 24px;
  }

  /* Form */
  .pl-form { display: flex; flex-direction: column; gap: 16px; }

  .pl-field { display: flex; flex-direction: column; gap: 6px; }

  .pl-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.4);
  }

  .pl-input {
    background: rgba(26,58,58,0.25);
    border: 1px solid rgba(42,74,74,0.55);
    border-radius: 8px;
    padding: 11px 14px;
    font-size: 15px;
    font-family: 'Rajdhani', system-ui, sans-serif;
    font-weight: 500;
    color: #ffffff;
    outline: none;
    transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
    width: 100%;
    box-sizing: border-box;
  }

  .pl-input::placeholder { color: rgba(255,255,255,0.18); }

  .pl-input:focus {
    border-color: rgba(56,189,248,0.6);
    background: rgba(26,58,58,0.4);
    box-shadow: 0 0 0 3px rgba(56,189,248,0.08), inset 0 0 16px rgba(56,189,248,0.03);
  }

  .pl-input:-webkit-autofill {
    -webkit-box-shadow: 0 0 0 1000px #0a1f1f inset;
    -webkit-text-fill-color: #ffffff;
  }

  .pl-error {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.2);
    border-radius: 6px;
    padding: 9px 12px;
    font-size: 13px;
    color: #fca5a5;
    font-family: 'JetBrains Mono', monospace;
  }

  .pl-btn {
    margin-top: 6px;
    background: linear-gradient(135deg, #1a4a4a 0%, #0d3030 100%);
    color: #ffffff;
    border: 1px solid rgba(56,189,248,0.3);
    border-radius: 8px;
    height: 50px;
    font-size: 14px;
    font-weight: 700;
    font-family: 'Rajdhani', system-ui, sans-serif;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
    overflow: hidden;
  }

  .pl-btn::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(56,189,248,0.08) 0%, transparent 50%);
    pointer-events: none;
  }

  .pl-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #1f5a5a 0%, #103838 100%);
    border-color: rgba(56,189,248,0.55);
    box-shadow: 0 4px 20px rgba(56,189,248,0.12), 0 0 0 1px rgba(56,189,248,0.15);
    transform: translateY(-1px);
  }

  .pl-btn:active:not(:disabled) { transform: translateY(0); }
  .pl-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .pl-btn-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }

  .pl-spinner {
    width: 15px; height: 15px;
    border: 2px solid rgba(255,255,255,0.2);
    border-top-color: rgba(56,189,248,0.8);
    border-radius: 50%;
    animation: pl-spin 0.7s linear infinite;
  }

  @keyframes pl-spin { to { transform: rotate(360deg); } }

  /* Footer */
  .pl-footer {
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid rgba(42,74,74,0.3);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .pl-footer-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.2);
  }

  .pl-footer-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: rgba(34,197,94,0.6);
    box-shadow: 0 0 4px rgba(34,197,94,0.4);
    animation: pl-pulse 2s ease-in-out infinite;
  }

  @keyframes pl-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .pl-footer-version {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: rgba(255,255,255,0.15);
    letter-spacing: 0.08em;
  }

  @media (max-width: 480px) {
    .pl-card { width: 100%; margin: 16px; padding: 28px 24px; }
  }
`;

function StyleTag() {
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

/* ─── Page ────────────────────────────────────────────────────────────────── */

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@plataforma.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await platformApi.login(email, password);
      setPlatformToken(result.token);
      navigate('/platform/entities');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Não foi possível autenticar. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pl-root">
      <StyleTag />
      <BlueprintCanvas />

      <div className="pl-card">
        <div className="pl-logo">
          <div className="pl-logo-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L2 7V18H7V13H13V18H18V7L10 2Z" fill="rgba(56,189,248,0.9)" />
              <rect x="7" y="13" width="6" height="5" fill="rgba(56,189,248,0.3)" />
            </svg>
          </div>
          <div className="pl-logo-text">
            <span className="pl-logo-name">Gestão de Obras</span>
            <span className="pl-logo-sub">Painel da Plataforma</span>
          </div>
        </div>

        <p className="pl-eyebrow">Acesso restrito</p>
        <h1 className="pl-title">Área da Plataforma</h1>
        <p className="pl-subtitle">Gestão de entidades · Operadores · Configurações</p>

        <div className="pl-divider" />

        <form className="pl-form" onSubmit={handleSubmit}>
          <div className="pl-field">
            <label className="pl-label" htmlFor="pl-email">E-mail</label>
            <input
              id="pl-email"
              className="pl-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operador@plataforma.com"
              required
              autoComplete="username"
            />
          </div>

          <div className="pl-field">
            <label className="pl-label" htmlFor="pl-password">Senha</label>
            <input
              id="pl-password"
              className="pl-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="pl-error" role="alert">
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="pl-btn" disabled={loading}>
            <span className="pl-btn-inner">
              {loading && <span className="pl-spinner" />}
              {loading ? 'Autenticando…' : 'Acessar plataforma'}
            </span>
          </button>
        </form>

        <div className="pl-footer">
          <div className="pl-footer-badge">
            <span className="pl-footer-dot" />
            <span>Sistema online</span>
          </div>
          <span className="pl-footer-version">v2.0.0 · 2024</span>
        </div>
      </div>
    </div>
  );
}
