import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ApiError,
  publicApi,
  setTenantToken,
  tenantApi,
} from '../../lib/api-client';

/* ─── Blueprint canvas animation ─────────────────────────────────────────── */

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

    const blue = 'rgba(91, 141, 184,';
    const teal = 'rgba(42, 74, 74,';
    const white = 'rgba(255,255,255,';

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      /* Grid lines */
      const gridSize = 48;
      ctx.strokeStyle = `${teal} 0.35)`;
      ctx.lineWidth = 0.5;
      for (let x = 0; x < W; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      /* Diagonal structural lines */
      ctx.strokeStyle = `${teal} 0.2)`;
      ctx.lineWidth = 0.8;
      const diag = [
        [0, H * 0.2, W * 0.6, 0],
        [0, H * 0.7, W * 0.9, 0],
        [W * 0.3, H, W, H * 0.1],
        [W * 0.7, H, W, H * 0.5],
      ];
      diag.forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      });

      /* Animated scanning line */
      const scanY = (Math.sin(t * 0.4) * 0.5 + 0.5) * H;
      const grad = ctx.createLinearGradient(0, scanY - 60, 0, scanY + 60);
      grad.addColorStop(0, `${blue} 0)`);
      grad.addColorStop(0.5, `${blue} 0.12)`);
      grad.addColorStop(1, `${blue} 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, scanY - 60, W, 120);

      /* Animated corner marks */
      const corners = [
        [60, 60], [W - 60, 60], [60, H - 60], [W - 60, H - 60],
      ] as [number, number][];
      const pulse = Math.sin(t * 1.2) * 0.5 + 0.5;
      corners.forEach(([cx, cy]) => {
        const len = 20 + pulse * 6;
        ctx.strokeStyle = `${blue} ${0.5 + pulse * 0.4})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - len, cy); ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy - len); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + len, cy); ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + len); ctx.stroke();
      });

      /* Floating dimension annotations */
      const annotations = [
        { x: W * 0.12, y: H * 0.3, label: '24.50m', angle: -Math.PI / 2 },
        { x: W * 0.5, y: H * 0.88, label: '18.20m', angle: 0 },
        { x: W * 0.82, y: H * 0.55, label: '12.80m', angle: -Math.PI / 2 },
      ];
      annotations.forEach(({ x, y, label, angle }) => {
        const alpha = 0.25 + Math.sin(t * 0.6 + x) * 0.1;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.strokeStyle = `${white} ${alpha})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(30, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-30, -5); ctx.lineTo(-30, 5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(30, -5); ctx.lineTo(30, 5); ctx.stroke();
        ctx.fillStyle = `${white} ${alpha + 0.1})`;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, 0, -8);
        ctx.restore();
      });

      /* Cross-hair circles */
      const circles = [
        { x: W * 0.15, y: H * 0.72, r: 18 },
        { x: W * 0.85, y: H * 0.25, r: 14 },
        { x: W * 0.5, y: H * 0.12, r: 22 },
      ];
      circles.forEach(({ x, y, r }) => {
        const alpha = 0.15 + Math.sin(t * 0.8 + x) * 0.08;
        ctx.strokeStyle = `${blue} ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - r - 8, y); ctx.lineTo(x + r + 8, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y - r - 8); ctx.lineTo(x, y + r + 8); ctx.stroke();
      });

      /* Data readouts */
      const readouts = [
        { x: W * 0.08, y: H * 0.15, lines: ['PROJ: OB-2024-089', 'STATUS: ATIVO'] },
        { x: W * 0.72, y: H * 0.82, lines: ['AREA: 1.240m²', 'ETAPA: 3/6'] },
      ];
      readouts.forEach(({ x, y, lines }) => {
        const alpha = 0.18 + Math.sin(t * 0.5 + y) * 0.06;
        ctx.fillStyle = `${white} ${alpha})`;
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        lines.forEach((line, i) => {
          ctx.fillText(line, x, y + i * 14);
        });
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
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}

/* ─── Coat of arms ────────────────────────────────────────────────────────── */

function TenantCoatOfArms({ url, alt }: { url: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
      <img
        src={url} alt={alt}
        style={{ maxHeight: 64, maxWidth: '100%', objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.9 }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

/* ─── Main page ───────────────────────────────────────────────────────────── */

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  .tl-root {
    min-height: 100svh;
    display: flex;
    background: #060d0d;
    position: relative;
    overflow: hidden;
    font-family: 'Rajdhani', system-ui, sans-serif;
  }

  /* Radial glow behind card */
  .tl-root::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 60% 50% at 65% 50%, rgba(26,58,58,0.55) 0%, transparent 70%),
      radial-gradient(ellipse 30% 40% at 30% 80%, rgba(91,141,184,0.06) 0%, transparent 60%);
    pointer-events: none;
  }

  /* Left info panel */
  .tl-panel-left {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 56px 48px;
    position: relative;
    z-index: 1;
  }

  .tl-tagline {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(91,141,184,0.7);
    margin-bottom: 16px;
  }

  .tl-headline {
    font-size: clamp(32px, 4vw, 52px);
    font-weight: 700;
    line-height: 1.05;
    color: #ffffff;
    letter-spacing: -0.02em;
    margin: 0 0 20px 0;
  }

  .tl-headline span {
    color: #5b8db8;
  }

  .tl-desc {
    font-size: 15px;
    color: rgba(255,255,255,0.38);
    line-height: 1.6;
    max-width: 320px;
    margin: 0 0 40px 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    letter-spacing: 0.03em;
  }

  .tl-stats {
    display: flex;
    gap: 32px;
  }

  .tl-stat {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .tl-stat strong {
    font-size: 28px;
    font-weight: 700;
    color: #5b8db8;
    letter-spacing: -0.02em;
  }

  .tl-stat span {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.35);
  }

  /* Right login panel */
  .tl-panel-right {
    width: 480px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 48px;
    position: relative;
    z-index: 1;
  }

  .tl-panel-right::before {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(6, 13, 13, 0.7);
    backdrop-filter: blur(2px);
    border-left: 1px solid rgba(42,74,74,0.4);
  }

  .tl-card {
    width: 100%;
    position: relative;
    z-index: 1;
    animation: tl-card-in 0.7s cubic-bezier(0.22,1,0.36,1) both;
  }

  @keyframes tl-card-in {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* Logo mark */
  .tl-logomark {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 40px;
  }

  .tl-logomark-icon {
    width: 36px;
    height: 36px;
    background: #5b8db8;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tl-logomark-icon svg {
    width: 20px;
    height: 20px;
  }

  .tl-logomark-text {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,255,255,0.5);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-family: 'JetBrains Mono', monospace;
  }

  /* Entity name */
  .tl-entity-tag {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #5b8db8;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tl-entity-tag::before {
    content: '';
    display: block;
    width: 20px;
    height: 1px;
    background: #5b8db8;
  }

  .tl-entity-name {
    font-size: clamp(18px, 2.5vw, 26px);
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.01em;
    margin: 0 0 32px 0;
    line-height: 1.2;
    min-height: 32px;
  }

  /* Form */
  .tl-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .tl-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tl-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.45);
  }

  .tl-input {
    background: rgba(26,58,58,0.3);
    border: 1px solid rgba(42,74,74,0.6);
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 15px;
    font-family: 'Rajdhani', system-ui, sans-serif;
    font-weight: 500;
    color: #ffffff;
    outline: none;
    transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
    width: 100%;
    box-sizing: border-box;
  }

  .tl-input::placeholder { color: rgba(255,255,255,0.2); }

  .tl-input:focus {
    border-color: #5b8db8;
    background: rgba(26,58,58,0.5);
    box-shadow: 0 0 0 3px rgba(91,141,184,0.1), inset 0 0 20px rgba(91,141,184,0.03);
  }

  .tl-input:-webkit-autofill {
    -webkit-box-shadow: 0 0 0 1000px #0f2020 inset;
    -webkit-text-fill-color: #ffffff;
  }

  .tl-error {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(239,68,68,0.1);
    border: 1px solid rgba(239,68,68,0.25);
    border-radius: 6px;
    padding: 10px 14px;
    font-size: 13px;
    color: #fca5a5;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 0.02em;
  }

  .tl-btn {
    margin-top: 8px;
    background: #5b8db8;
    color: #060d0d;
    border: none;
    border-radius: 8px;
    height: 52px;
    font-size: 15px;
    font-weight: 700;
    font-family: 'Rajdhani', system-ui, sans-serif;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
    position: relative;
    overflow: hidden;
  }

  .tl-btn::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%);
    pointer-events: none;
  }

  .tl-btn:hover:not(:disabled) {
    background: #f0c85a;
    box-shadow: 0 4px 20px rgba(91,141,184,0.35);
    transform: translateY(-1px);
  }

  .tl-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .tl-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .tl-btn-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }

  .tl-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(6,13,13,0.25);
    border-top-color: #060d0d;
    border-radius: 50%;
    animation: tl-spin 0.7s linear infinite;
  }

  @keyframes tl-spin {
    to { transform: rotate(360deg); }
  }

  /* Footer */
  .tl-footer {
    margin-top: 28px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: rgba(255,255,255,0.2);
    letter-spacing: 0.1em;
  }

  .tl-footer-dot {
    width: 4px; height: 4px;
    border-radius: 50%;
    background: rgba(91,141,184,0.4);
    flex-shrink: 0;
  }

  /* Divider */
  .tl-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(42,74,74,0.5), transparent);
    margin: 24px 0;
  }

  /* Error / inactive states */
  .tl-state-card {
    width: 100%;
    position: relative;
    z-index: 1;
    text-align: center;
    animation: tl-card-in 0.7s cubic-bezier(0.22,1,0.36,1) both;
  }

  .tl-state-icon {
    width: 56px; height: 56px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20px;
    font-size: 24px;
  }

  .tl-state-icon--error { background: rgba(239,68,68,0.15); color: #fca5a5; }
  .tl-state-icon--warn  { background: rgba(234,179,8,0.15); color: #fde047; }

  .tl-state-title {
    font-size: 22px;
    font-weight: 700;
    color: #ffffff;
    margin: 0 0 10px 0;
  }

  .tl-state-desc {
    font-size: 13px;
    color: rgba(255,255,255,0.38);
    font-family: 'JetBrains Mono', monospace;
    line-height: 1.6;
  }

  /* Responsive */
  @media (max-width: 860px) {
    .tl-panel-left { display: none; }
    .tl-panel-right {
      width: 100%;
      padding: 32px 24px;
    }
    .tl-panel-right::before { border-left: none; }
  }
`;

function StyleTag() {
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

export function TenantLoginPage() {
  const { id: entityId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [entityName, setEntityName] = useState('');
  const [entityStatus, setEntityStatus] = useState<string | null>(null);
  const [coatOfArmsUrl, setCoatOfArmsUrl] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!entityId) return;
    publicApi
      .getTenant(entityId)
      .then((tenant) => {
        setEntityName(tenant.name);
        setEntityStatus(tenant.status);
        setCoatOfArmsUrl(tenant.coatOfArmsUrl);
      })
      .catch(() => setNotFound(true));
  }, [entityId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!entityId) return;
    setError('');
    setLoading(true);
    try {
      const result = await tenantApi.login(entityId, email, password);
      setTenantToken(entityId, result.token);
      navigate(`/t/${entityId}/dashboard`);
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

  /* ── Shared chrome ── */
  const chrome = (children: React.ReactNode) => (
    <div className="tl-root">
      <StyleTag />
      <BlueprintCanvas />
      <div className="tl-panel-left">
        <p className="tl-tagline">// Gestão de Obras · v2.0</p>
        <h1 className="tl-headline">
          Controle total<br />da sua <span>obra.</span>
        </h1>
        <p className="tl-desc">
          Licitações · Centros de custo<br />
          Registros diários · Relatórios
        </p>
        <div className="tl-stats">
          <div className="tl-stat">
            <strong>98%</strong>
            <span>Uptime</span>
          </div>
          <div className="tl-stat">
            <strong>+240</strong>
            <span>Obras ativas</span>
          </div>
          <div className="tl-stat">
            <strong>R$2.1B</strong>
            <span>Em contratos</span>
          </div>
        </div>
      </div>
      <div className="tl-panel-right">
        {children}
      </div>
    </div>
  );

  /* ── Not found ── */
  if (notFound) {
    return chrome(
      <div className="tl-state-card">
        <div className="tl-state-icon tl-state-icon--error">⚠</div>
        <h2 className="tl-state-title">Entidade não encontrada</h2>
        <p className="tl-state-desc">Verifique o link de acesso<br />com o administrador.</p>
      </div>
    );
  }

  /* ── Inactive ── */
  if (entityStatus === 'INACTIVE') {
    return chrome(
      <div className="tl-state-card">
        <TenantCoatOfArms url={coatOfArmsUrl} alt={`Brasão de ${entityName}`} />
        <div className="tl-state-icon tl-state-icon--warn">⛔</div>
        <h2 className="tl-state-title">{entityName}</h2>
        <p className="tl-state-desc">Esta entidade está suspensa.<br />Contate o administrador da plataforma.</p>
      </div>
    );
  }

  /* ── Login ── */
  return chrome(
    <div className="tl-card">
      <div className="tl-logomark">
        <div className="tl-logomark-icon">
          <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 17L3 8L10 3L17 8V17H12V13H8V17H3Z" fill="#060d0d" />
            <rect x="8" y="13" width="4" height="4" fill="#060d0d" opacity="0.4"/>
          </svg>
        </div>
        <span className="tl-logomark-text">Gestão de Obras</span>
      </div>

      <TenantCoatOfArms url={coatOfArmsUrl} alt={`Brasão de ${entityName}`} />

      <p className="tl-entity-tag">Acesso da entidade</p>
      <h2 className="tl-entity-name">
        {entityName || <span style={{ opacity: 0.3 }}>Carregando…</span>}
      </h2>

      <div className="tl-divider" />

      <form className="tl-form" onSubmit={handleSubmit}>
        <div className="tl-field">
          <label className="tl-label" htmlFor="tl-email">E-mail</label>
          <input
            id="tl-email"
            className="tl-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@empresa.com"
            required
            autoComplete="username"
          />
        </div>

        <div className="tl-field">
          <label className="tl-label" htmlFor="tl-password">Senha</label>
          <input
            id="tl-password"
            className="tl-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="tl-error" role="alert">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        <button type="submit" className="tl-btn" disabled={loading}>
          {loading ? (
            <span className="tl-btn-loading">
              <span className="tl-spinner" />
              Autenticando…
            </span>
          ) : (
            'Entrar no sistema'
          )}
        </button>
      </form>

      <div className="tl-footer">
        <span className="tl-footer-dot" />
        <span>Conexão segura</span>
        <span className="tl-footer-dot" />
        <span>TLS 1.3</span>
        <span className="tl-footer-dot" />
        <span>2024</span>
      </div>
    </div>
  );
}
