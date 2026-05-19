import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { AppLayout, parentNavItems } from './AppLayout';
import { useAuth } from '../context/AuthContext';

const childName = (c) => `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.username;
const childInitials = (c) => ((c.first_name?.[0] || '') + (c.last_name?.[0] || '')).toUpperCase() || '?';

export const ParentChildren = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadChildren = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getParentChildren();
      setChildren(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить список детей.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChildren();
  }, []);

  const handleDownloadPdf = async (item) => {
    try {
      const { blob, filename } = await api.downloadPortfolioPdf({ studentId: item.id });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError.message || 'Не удалось скачать PDF.');
    }
  };

  return (
    <AppLayout title="КиберШкола — Дети" navItems={parentNavItems} kidMode>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h1 className="fw-semibold mb-0" style={{ fontSize: '1.75rem' }}>Мои дети</h1>
        <button
          type="button"
          className="btn btn-light border rounded-pill px-3 ms-auto"
          onClick={loadChildren}
          disabled={loading}
        >
          Обновить
        </button>
      </div>

      {error && <div className="alert alert-danger rounded-3">{error}</div>}

      {loading ? (
        <div className="d-flex flex-column gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="kid-skeleton" style={{ height: 140, borderRadius: 16 }} />
          ))}
        </div>
      ) : children.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body text-center py-5 text-muted">
            Дети пока не привязаны к этому аккаунту.
          </div>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {children.map((item) => {
            const name = childName(item);
            const init = childInitials(item);
            const groups = Array.isArray(item.groups) ? item.groups : [];
            const isPeriod = item.valid_from && item.valid_until;
            const balanceLabel = isPeriod
              ? `до ${new Date(item.valid_until).toLocaleDateString('ru-RU')}`
              : `${item.balance ?? 0} занятий`;
            const hasDebt = !isPeriod && item.balance !== null && item.balance !== undefined && item.balance < 0;

            return (
              <div key={item.id} className="card border-0 shadow-sm rounded-4" style={hasDebt ? { border: '2px solid #ef4444', background: '#fef2f2' } : {}}>
                <div className="card-body p-4">
                  <div className="d-flex flex-wrap align-items-center gap-3">
                    {/* Аватар */}
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center fw-semibold flex-shrink-0"
                      style={{ width: 56, height: 56, background: hasDebt ? '#fee2e2' : '#eef2ff', color: hasDebt ? '#dc2626' : '#3730a3', fontSize: '1.2rem' }}
                    >
                      {init}
                    </div>

                    {/* Инфо */}
                    <div className="flex-grow-1" style={{ minWidth: 180 }}>
                      <div className="fw-semibold" style={{ fontSize: '1.15rem', color: hasDebt ? '#dc2626' : undefined }}>{name}</div>
                      <div className="text-muted small">@{item.username}</div>
                      {groups.length > 0 && (
                        <div className="d-flex flex-wrap gap-1 mt-2">
                          {groups.map((g) => (
                            <span
                              key={g.id}
                              className="badge rounded-pill"
                              style={{ background: '#f8f9fb', color: '#374151', border: '1px solid #e5e7eb', fontWeight: 500 }}
                            >
                              {g.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Баланс */}
                    <div className="text-end flex-shrink-0">
                      <div className="text-muted small">Баланс</div>
                      <div className="fw-semibold" style={{ fontSize: '1.1rem', color: hasDebt ? '#dc2626' : isPeriod ? '#2563eb' : '#111827' }}>
                        {balanceLabel}
                      </div>
                    </div>
                  </div>

                  {/* Действия */}
                  <div className="d-flex flex-wrap gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #f3f4f6' }}>
                    <button
                      type="button"
                      className="btn btn-dark rounded-pill px-4"
                      onClick={() => navigate(`/parent/children/${item.id}/portfolio`)}
                    >
                      Портфолио
                    </button>
                    <button
                      type="button"
                      className="btn btn-light border rounded-pill px-4"
                      onClick={() => handleDownloadPdf(item)}
                    >
                      Скачать PDF
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
};
