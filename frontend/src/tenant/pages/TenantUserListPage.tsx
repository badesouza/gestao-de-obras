import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tenantApi, type TenantUser } from '../../lib/api-client';
import { useTenant, useTenantPermission } from '../TenantContext';

const ROLE_META: Record<string, { label: string; color: string }> = {
  ADMIN:    { label: 'Admin',      color: '#2563eb' },
  ENGINEER: { label: 'Engenheiro', color: '#16a34a' },
  OPERATOR: { label: 'Operador',   color: '#7c3aed' },
};

export function TenantUserListPage() {
  const { entityId } = useTenant();
  const canManage    = useTenantPermission('users.manage');
  const [users, setUsers]   = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true); setError('');
      try {
        const result = await tenantApi.users.list(entityId, new URLSearchParams());
        setUsers(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar');
      } finally { setLoading(false); }
    })();
  }, [entityId]);

  const ativos    = users.filter(u => u.status === 'ACTIVE').length;
  const inativos  = users.filter(u => u.status === 'INACTIVE').length;
  const lideres   = users.filter(u => u.isLiderEquipe).length;
  const admins    = users.filter(u => u.role.code === 'ADMIN').length;

  return (
    <div className="cp-page">

      {/* ── HERO ── */}
      <section className="cp-hero">
        <div className="cp-hero-grid" />
        <div className="cp-hero-left">
          <div className="cp-eyebrow">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Gestão de acesso
          </div>
          <h2>Usuarios e permissoes do sistema.</h2>
          <p>Gerencie as contas com acesso administrativo e operacional nesta entidade. Defina perfis, ative lideres de equipe e controle acessos.</p>
          <div className="cp-hero-badges">
            <span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              {loading ? '...' : ativos} ativos
            </span>
            <span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              {loading ? '...' : lideres} lideres
            </span>
            <span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              {loading ? '...' : admins} administradores
            </span>
          </div>
        </div>

        {/* flow-board lateral com ações rápidas */}
        <div className="cp-flow-board" style={{ position: 'relative', zIndex: 1 }}>
          {canManage && (
            <Link
              to={`/t/${entityId}/users/new`}
              className="cp-flow-step"
              style={{ '--step-delay': '0.05s' } as React.CSSProperties}
            >
              <span style={{ background: '#2563eb' }}>+</span>
              Novo usuario
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </Link>
          )}
          <div className="cp-flow-step" style={{ '--step-delay': '0.10s', cursor: 'default' } as React.CSSProperties}>
            <span style={{ background: '#16a34a' }}>✓</span>
            {loading ? '...' : ativos} contas ativas
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
          <div className="cp-flow-step" style={{ '--step-delay': '0.15s', cursor: 'default' } as React.CSSProperties}>
            <span style={{ background: '#94a3b8' }}>–</span>
            {loading ? '...' : inativos} inativas
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>
      </section>

      {/* ── KPI CARDS ── */}
      <div className="cp-kpi-grid">
        <div className="cp-kpi-card tone-blue">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span>Total de usuarios</span>
          <strong>{loading ? '—' : users.length}</strong>
          <small>Cadastros na entidade</small>
        </div>
        <div className="cp-kpi-card tone-green">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>Ativos</span>
          <strong>{loading ? '—' : ativos}</strong>
          <small>Com acesso habilitado</small>
        </div>
        <div className="cp-kpi-card tone-amber">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          <span>Lideres de equipe</span>
          <strong>{loading ? '—' : lideres}</strong>
          <small>Podem liderar equipes</small>
        </div>
        <div className="cp-kpi-card tone-cyan">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span>Administradores</span>
          <strong>{loading ? '—' : admins}</strong>
          <small>Acesso total ao sistema</small>
        </div>
      </div>

      {/* ── PAINEL DE LISTA ── */}
      <div style={{
        background: '#fff',
        border: '1px solid rgba(10,26,26,.08)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(12,24,33,.07)',
        overflow: 'hidden',
      }}>
        {/* cabeçalho do painel */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(10,26,26,.07)',
          background: 'rgba(248,250,252,.8)',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--tn-mono)', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: 'var(--tn-muted)', letterSpacing: '0.06em' }}>
              Gestao de acesso
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tn-ink)', marginTop: 2 }}>
              Contas cadastradas
            </div>
          </div>
          {canManage && (
            <Link
              to={`/t/${entityId}/users/new`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 36, padding: '0 16px', borderRadius: 7,
                background: '#2563eb', color: '#fff',
                fontSize: 13, fontWeight: 700, textDecoration: 'none',
                boxShadow: '0 4px 12px rgba(37,99,235,.35)',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Novo usuario
            </Link>
          )}
        </div>

        {/* estados */}
        {loading && (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div className="tn-spinner" />
          </div>
        )}
        {error && (
          <div style={{ padding: '16px 20px', color: 'var(--tn-danger)', fontSize: 13 }}>{error}</div>
        )}

        {/* lista */}
        {!loading && !error && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {users.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--tn-muted)', fontSize: 13 }}>
                Nenhum usuario cadastrado.
              </div>
            )}
            {users.map((user, idx) => {
              const meta    = ROLE_META[user.role.code] ?? ROLE_META.OPERATOR;
              const isActive = user.status === 'ACTIVE';
              const initials = user.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
              return (
                <div
                  key={user.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 20px',
                    borderBottom: idx < users.length - 1 ? '1px solid rgba(10,26,26,.06)' : 'none',
                    transition: 'background .15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(37,99,235,.025)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* avatar */}
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: `linear-gradient(135deg, ${meta.color}cc, ${meta.color})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 14, fontWeight: 800,
                    boxShadow: `0 4px 10px ${meta.color}44`,
                  }}>
                    {initials}
                  </div>

                  {/* info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tn-ink)' }}>{user.name}</span>
                      {user.isLiderEquipe && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 10, fontWeight: 800, borderRadius: 99, padding: '2px 8px',
                          background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a',
                          fontFamily: 'var(--tn-mono)', textTransform: 'uppercase',
                        }}>
                          ★ Lider
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--tn-muted)', marginTop: 2 }}>{user.email}</div>
                  </div>

                  {/* badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '3px 10px',
                      color: meta.color,
                      background: `${meta.color}18`,
                      border: `1px solid ${meta.color}33`,
                    }}>
                      {meta.label}
                    </span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '3px 10px',
                      color: isActive ? '#15803d' : '#94a3b8',
                      background: isActive ? '#f0fdf4' : '#f8fafc',
                      border: `1px solid ${isActive ? '#bbf7d0' : '#e2e8f0'}`,
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: isActive ? '#22c55e' : '#cbd5e1',
                        display: 'inline-block',
                      }} />
                      {isActive ? 'Ativo' : 'Inativo'}
                    </span>

                    <Link
                      to={`/t/${entityId}/users/${user.id}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        height: 32, padding: '0 14px', borderRadius: 7,
                        background: '#f8fafc', border: '1px solid rgba(10,26,26,.1)',
                        color: 'var(--tn-ink)', fontSize: 12, fontWeight: 700,
                        textDecoration: 'none', transition: 'all .15s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLAnchorElement).style.background = '#2563eb';
                        (e.currentTarget as HTMLAnchorElement).style.color = '#fff';
                        (e.currentTarget as HTMLAnchorElement).style.borderColor = '#2563eb';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLAnchorElement).style.background = '#f8fafc';
                        (e.currentTarget as HTMLAnchorElement).style.color = 'var(--tn-ink)';
                        (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(10,26,26,.1)';
                      }}
                    >
                      Detalhes
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
