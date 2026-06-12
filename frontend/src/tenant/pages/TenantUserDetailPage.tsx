import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, tenantApi, type TenantUser } from '../../lib/api-client';
import { useTenant, useTenantPermission } from '../TenantContext';

const ROLES = [
  { code: 'ADMIN',    name: 'Administrador' },
  { code: 'ENGINEER', name: 'Engenheiro / Fiscal' },
  { code: 'OPERATOR', name: 'Operador' },
] as const;

const ROLE_META: Record<string, { label: string; color: string; grad: string }> = {
  ADMIN:    { label: 'Administrador', color: '#2563eb', grad: 'linear-gradient(135deg,#1e40af,#2563eb)' },
  ENGINEER: { label: 'Engenheiro',    color: '#16a34a', grad: 'linear-gradient(135deg,#065f46,#16a34a)' },
  OPERATOR: { label: 'Operador',      color: '#7c3aed', grad: 'linear-gradient(135deg,#4c1d95,#7c3aed)' },
};

/* ─── campo do formulário ─────────────────────────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{
        fontFamily: 'var(--tn-mono)', fontSize: 9, fontWeight: 800,
        textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--tn-muted)',
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  height: 42, padding: '0 14px', borderRadius: 7, fontSize: 14,
  border: '1px solid rgba(10,26,26,.12)', background: '#f8fafc',
  color: 'var(--tn-ink)', outline: 'none',
  transition: 'border-color .15s, box-shadow .15s',
};

export function TenantUserDetailPage() {
  const { entityId } = useTenant();
  const { userId }   = useParams<{ userId: string }>();
  const canManage    = useTenantPermission('users.manage');

  const [user, setUser]           = useState<TenantUser | null>(null);
  const [name, setName]           = useState('');
  const [roleCode, setRoleCode]   = useState('OPERATOR');
  const [isLider, setIsLider]     = useState(false);
  const [password, setPassword]   = useState('');
  const [error, setError]         = useState('');
  const [pwError, setPwError]     = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [savingPw, setSavingPw]   = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true); setError('');
    try {
      const data = await tenantApi.users.get(entityId, userId);
      setUser(data); setName(data.name);
      setRoleCode(data.role.code); setIsLider(data.isLiderEquipe);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
    } finally { setLoading(false); }
  }, [entityId, userId]);

  useEffect(() => { void load(); }, [load]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault(); if (!userId) return;
    setError(''); setSaving(true);
    try {
      const updated = await tenantApi.users.update(entityId, userId, { name, roleCode, isLiderEquipe: isLider });
      setUser(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar');
    } finally { setSaving(false); }
  };

  const handleToggleStatus = async () => {
    if (!user) return;
    const next    = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const updated = await tenantApi.users.updateStatus(entityId, user.id, next);
    setUser(updated);
  };

  const handleResetPassword = async () => {
    if (!userId || !password) return;
    setPwError(''); setSavingPw(true); setPwSuccess(false);
    try {
      await tenantApi.users.resetPassword(entityId, userId, password);
      setPassword(''); setPwSuccess(true);
    } catch (err) {
      setPwError(err instanceof ApiError ? err.message : 'Erro ao redefinir senha');
    } finally { setSavingPw(false); }
  };

  /* ── loading / error ── */
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 64 }}>
      <div className="tn-spinner" />
    </div>
  );
  if (error && !user) return (
    <div style={{ padding: 32, color: 'var(--tn-danger)', fontSize: 13 }}>
      {error} — <Link to={`/t/${entityId}/users`} style={{ textDecoration: 'underline' }}>Voltar</Link>
    </div>
  );
  if (!user) return null;

  const isActive = user.status === 'ACTIVE';
  const meta     = ROLE_META[user.role.code] ?? ROLE_META.OPERATOR;
  const initials = user.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="cp-page" style={{ maxWidth: 760 }}>

      {/* ── BREADCRUMB ── */}
      <Link
        to={`/t/${entityId}/users`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 12, color: 'var(--tn-muted)', textDecoration: 'none',
          fontFamily: 'var(--tn-mono)', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Usuarios
      </Link>

      {/* ══════════════════════════════════════════
          HERO  — mesmo padrão cp-hero
      ══════════════════════════════════════════ */}
      <section className="cp-hero" style={{ minHeight: 200 }}>
        {/* grid de fundo — reusa a classe mas com cor do perfil */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `linear-gradient(${meta.color}18 1px, transparent 1px), linear-gradient(90deg, ${meta.color}18 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
          maskImage: 'linear-gradient(90deg, #000, rgba(0,0,0,.2), transparent)',
          pointerEvents: 'none',
        }} />
        {/* barra colorida no fundo */}
        <div style={{
          position: 'absolute', inset: 'auto 0 0', height: 4,
          background: `linear-gradient(90deg, ${meta.color}, #16a34a, #f97316, #0891b2)`,
        }} />

        {/* coluna esquerda */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="cp-eyebrow" style={{ color: meta.color }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            Perfil do usuario
          </div>

          {/* nome + avatar lado a lado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
              background: meta.grad,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 22, fontWeight: 800,
              boxShadow: `0 8px 20px ${meta.color}50`,
              border: `2px solid ${meta.color}40`,
            }}>
              {initials}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#17202a', lineHeight: 1, letterSpacing: '-0.5px' }}>
                {user.name}
              </h2>
              <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13, lineHeight: 1 }}>{user.email}</p>
            </div>
          </div>

          {/* badges */}
          <div className="cp-hero-badges">
            <span style={{ color: meta.color }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              {meta.label}
            </span>
            <span style={{ color: isActive ? '#15803d' : '#94a3b8' }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: isActive ? '#22c55e' : '#94a3b8',
                display: 'inline-block',
              }} />
              {isActive ? 'Ativo' : 'Inativo'}
            </span>
            {isLider && (
              <span style={{ color: '#b45309' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                Lider de equipe
              </span>
            )}
          </div>
        </div>

        {/* coluna direita — KPI mini + botão */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
          {canManage && (
            <button
              type="button"
              onClick={handleToggleStatus}
              style={{
                height: 36, padding: '0 18px', borderRadius: 7, fontSize: 13, fontWeight: 700,
                cursor: 'pointer',
                background: isActive ? 'rgba(239,68,68,.08)' : 'rgba(34,197,94,.08)',
                color: isActive ? '#dc2626' : '#16a34a',
                border: `1.5px solid ${isActive ? 'rgba(239,68,68,.3)' : 'rgba(34,197,94,.3)'}`,
                transition: 'all .15s',
              }}
            >
              {isActive ? 'Desativar conta' : 'Reativar conta'}
            </button>
          )}

          {/* mini stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', maxWidth: 260 }}>
            {[
              { label: 'Perfil',  value: meta.label,            color: meta.color },
              { label: 'Status',  value: isActive ? 'Ativo' : 'Inativo', color: isActive ? '#16a34a' : '#94a3b8' },
              { label: 'Lider',   value: isLider ? 'Sim' : 'Nao',   color: isLider ? '#d97706' : '#94a3b8' },
              { label: 'Acesso',  value: isActive ? 'Liberado' : 'Bloqueado', color: isActive ? '#16a34a' : '#dc2626' },
            ].map(k => (
              <div key={k.label} style={{
                padding: '9px 12px', borderRadius: 7,
                background: 'rgba(255,255,255,.75)',
                border: '1px solid rgba(10,26,26,.08)',
                backdropFilter: 'blur(4px)',
              }}>
                <div style={{ fontFamily: 'var(--tn-mono)', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}>
                  {k.label}
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: k.color, marginTop: 3 }}>{k.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FORMULÁRIO
      ══════════════════════════════════════════ */}
      {canManage ? (
        <>
          {/* editar cadastro */}
          <div style={{
            background: '#fff',
            border: '1px solid rgba(10,26,26,.08)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(12,24,33,.07)',
            overflow: 'hidden',
          }}>
            {/* header do painel */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '14px 20px',
              borderBottom: '1px solid rgba(10,26,26,.07)',
              background: 'rgba(248,250,252,.8)',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: `${meta.color}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--tn-mono)', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tn-muted)' }}>
                  Cadastro
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tn-ink)' }}>Editar dados do usuario</div>
              </div>
            </div>

            <form onSubmit={handleUpdate} style={{ padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Nome completo">
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = meta.color; e.target.style.boxShadow = `0 0 0 3px ${meta.color}18`; }}
                    onBlur={e  => { e.target.style.borderColor = 'rgba(10,26,26,.12)'; e.target.style.boxShadow = 'none'; }}
                  />
                </Field>
                <Field label="Perfil de acesso">
                  <select
                    value={roleCode}
                    onChange={e => setRoleCode(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    onFocus={e => { e.target.style.borderColor = meta.color; e.target.style.boxShadow = `0 0 0 3px ${meta.color}18`; }}
                    onBlur={e  => { e.target.style.borderColor = 'rgba(10,26,26,.12)'; e.target.style.boxShadow = 'none'; }}
                  >
                    {ROLES.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
                  </select>
                </Field>
              </div>

              {/* toggle líder — card destacado */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setIsLider(v => !v)}
                onKeyDown={e => e.key === ' ' && setIsLider(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 8, cursor: 'pointer',
                  border: `1.5px solid ${isLider ? '#fbbf24' : 'rgba(10,26,26,.1)'}`,
                  background: isLider ? '#fffbeb' : '#f8fafc',
                  boxShadow: isLider ? '0 0 0 3px rgba(251,191,36,.12)' : 'none',
                  transition: 'all .18s',
                  position: 'relative', overflow: 'hidden',
                }}
              >
                {isLider && (
                  <div style={{
                    position: 'absolute', inset: 'auto 0 0', height: 3,
                    background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                  }} />
                )}
                <div style={{
                  width: 42, height: 42, borderRadius: 9, flexShrink: 0,
                  background: isLider ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#e2e8f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isLider ? '0 4px 12px rgba(245,158,11,.4)' : 'none',
                  transition: 'all .18s',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={isLider ? '#fff' : '#94a3b8'}>
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: isLider ? '#b45309' : 'var(--tn-ink)' }}>
                    Lider de equipe
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--tn-muted)', marginTop: 2 }}>
                    {isLider
                      ? 'Este usuario pode ser atribuido como lider de equipes de campo'
                      : 'Ative para permitir que este usuario lidere equipes de campo'}
                  </div>
                </div>
                {/* switch pill */}
                <div style={{
                  width: 46, height: 24, borderRadius: 12, flexShrink: 0,
                  background: isLider ? '#f59e0b' : '#cbd5e1',
                  position: 'relative', transition: 'background .2s',
                  boxShadow: isLider ? '0 2px 8px rgba(245,158,11,.45)' : 'none',
                }}>
                  <div style={{
                    position: 'absolute', top: 3,
                    left: isLider ? 24 : 3,
                    width: 18, height: 18, borderRadius: '50%',
                    background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.25)',
                    transition: 'left .2s',
                  }} />
                </div>
              </div>

              {error && (
                <div style={{
                  padding: '10px 14px', borderRadius: 7,
                  background: '#fff1f2', border: '1px solid rgba(239,68,68,.25)',
                  fontSize: 13, color: '#dc2626',
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                style={{
                  height: 42, borderRadius: 7, fontSize: 14, fontWeight: 700,
                  cursor: saving ? 'default' : 'pointer',
                  background: saving ? '#94a3b8' : meta.grad,
                  color: '#fff', border: 'none',
                  boxShadow: saving ? 'none' : `0 4px 14px ${meta.color}50`,
                  transition: 'all .15s',
                }}
              >
                {saving ? 'Salvando…' : 'Salvar alteracoes'}
              </button>
            </form>
          </div>

          {/* redefinir senha */}
          <div style={{
            background: '#fff',
            border: '1px solid rgba(10,26,26,.08)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(12,24,33,.07)',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '14px 20px',
              borderBottom: '1px solid rgba(10,26,26,.07)',
              background: 'rgba(248,250,252,.8)',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: 'rgba(100,116,139,.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--tn-mono)', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tn-muted)' }}>
                  Seguranca
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tn-ink)' }}>Redefinir senha</div>
              </div>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <Field label="Nova senha">
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      style={inputStyle}
                      onFocus={e => { e.target.style.borderColor = '#64748b'; e.target.style.boxShadow = '0 0 0 3px rgba(100,116,139,.12)'; }}
                      onBlur={e  => { e.target.style.borderColor = 'rgba(10,26,26,.12)'; e.target.style.boxShadow = 'none'; }}
                    />
                  </Field>
                </div>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={savingPw || !password}
                  style={{
                    height: 42, padding: '0 20px', borderRadius: 7,
                    fontSize: 13, fontWeight: 700,
                    cursor: savingPw || !password ? 'default' : 'pointer',
                    background: savingPw || !password ? '#f1f5f9' : '#1e293b',
                    color: savingPw || !password ? '#94a3b8' : '#fff',
                    border: `1px solid ${savingPw || !password ? 'rgba(10,26,26,.1)' : '#1e293b'}`,
                    whiteSpace: 'nowrap', transition: 'all .15s',
                  }}
                >
                  {savingPw ? 'Salvando…' : 'Redefinir'}
                </button>
              </div>

              {pwError && (
                <div style={{ padding: '10px 14px', borderRadius: 7, background: '#fff1f2', border: '1px solid rgba(239,68,68,.25)', fontSize: 13, color: '#dc2626' }}>
                  {pwError}
                </div>
              )}
              {pwSuccess && (
                <div style={{
                  padding: '10px 14px', borderRadius: 7,
                  background: '#f0fdf4', border: '1px solid rgba(34,197,94,.25)',
                  fontSize: 13, color: '#15803d',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Senha redefinida com sucesso.
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div style={{
          background: '#fff', border: '1px solid rgba(10,26,26,.08)',
          borderRadius: 8, padding: '20px',
        }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--tn-muted)' }}>{user.email}</p>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--tn-muted)' }}>Perfil: {user.role.name}</p>
        </div>
      )}
    </div>
  );
}
