import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { AdminLayout } from './AdminLayout';
import { IconRefresh, IconAlert } from './KidIcons';

const RISK_META = {
  high: { label: 'Высокий', bg: '#fef2f2', color: '#dc2626' },
  medium: { label: 'Средний', bg: '#fef3c7', color: '#b45309' },
  low: { label: 'Низкий', bg: '#ecfdf5', color: '#16a34a' },
};

const FILTER_PILLS = [
  { value: 'all', label: 'Все' },
  { value: 'risk', label: 'Высокий + Средний' },
  { value: 'high', label: 'Только высокий' },
];

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return value;
  }
};

const formatRate = (value) => {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value * 100)}%`;
};

export default function AdminChurnRisk() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('risk');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getChurnRisk();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Не удалось загрузить отчёт');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredRows = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'high') return rows.filter((r) => r.risk_level === 'high');
    return rows.filter((r) => r.risk_level !== 'low');
  }, [rows, filter]);

  const counts = useMemo(() => ({
    high: rows.filter((r) => r.risk_level === 'high').length,
    medium: rows.filter((r) => r.risk_level === 'medium').length,
    low: rows.filter((r) => r.risk_level === 'low').length,
  }), [rows]);

  return (
    <AdminLayout title="КиберШкола — Риск оттока">
      {error && <div className="alert alert-danger rounded-3">{error}</div>}

      {/* Header */}
      <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
        <div className="flex-grow-1">
          <div className="text-muted small">Мониторинг риска оттока учеников</div>
          <h3 className="fw-semibold mb-0">Риск оттока</h3>
        </div>
        <button
          type="button"
          className="btn btn-light border rounded-pill px-3 d-flex align-items-center gap-2"
          onClick={load}
          disabled={loading}
        >
          <IconRefresh width={16} height={16} />
          Обновить
        </button>
      </div>

      {/* Summary + filter pills */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-3 d-flex flex-wrap align-items-center gap-3">
          <div className="d-flex gap-2 flex-wrap">
            {Object.entries(RISK_META).map(([key, meta]) => (
              <span
                key={key}
                className="badge rounded-pill d-flex align-items-center gap-1"
                style={{ background: meta.bg, color: meta.color, fontWeight: 500, fontSize: 13 }}
              >
                <IconAlert width={12} height={12} />
                {meta.label}: {counts[key] || 0}
              </span>
            ))}
            <span className="text-muted small align-self-center ms-2">Всего: {rows.length}</span>
          </div>
          <div className="d-flex gap-2 flex-wrap ms-auto">
            {FILTER_PILLS.map((pill) => {
              const active = filter === pill.value;
              return (
                <button
                  type="button"
                  key={pill.value}
                  className="btn btn-sm rounded-pill px-3"
                  style={{
                    background: active ? '#111827' : '#f1f3f5',
                    color: active ? '#fff' : '#374151',
                    border: 'none',
                  }}
                  onClick={() => setFilter(pill.value)}
                  disabled={loading}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Student risk cards */}
      {loading ? (
        <div className="text-muted text-center py-4">Загрузка…</div>
      ) : filteredRows.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-4 text-center text-muted">Нет учеников по выбранному фильтру.</div>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {filteredRows.map((row) => {
            const meta = RISK_META[row.risk_level] || RISK_META.low;
            return (
              <div
                key={row.student_id}
                className="card border-0 shadow-sm rounded-4"
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/admin/students/${row.student_id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/admin/students/${row.student_id}`);
                  }
                }}
              >
                <div className="card-body p-3">
                  <div className="d-flex flex-wrap align-items-start gap-3">
                    {/* Name */}
                    <div className="flex-grow-1" style={{ minWidth: 180 }}>
                      <div className="fw-semibold">{row.student_name}</div>
                      <div className="text-muted small">{row.username}{row.email ? ` · ${row.email}` : ''}</div>
                      <div className="text-muted small">Группа: {row.group_name || '—'}</div>
                    </div>

                    {/* Stats */}
                    <div className="d-flex flex-wrap gap-3" style={{ minWidth: 260 }}>
                      <div className="text-center">
                        <div className="text-muted small">Подряд</div>
                        <div className="fw-semibold">{row.consecutive_absences}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted small">Посещ. 30д</div>
                        <div className="fw-semibold">{formatRate(row.attendance_rate_30d)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted small">Остаток</div>
                        <div className="fw-semibold">{row.remaining_lessons}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted small">Оплата</div>
                        <div className="fw-semibold">
                          {row.has_active_subscription
                            ? <span style={{ color: '#16a34a' }}>Да</span>
                            : <span style={{ color: '#dc2626' }}>Нет</span>}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted small">Посл. урок</div>
                        <div className="fw-semibold">{formatDate(row.last_lesson_at)}</div>
                      </div>
                    </div>

                    {/* Risk + reasons */}
                    <div className="d-flex flex-column align-items-end gap-2" style={{ minWidth: 120 }}>
                      <span
                        className="badge rounded-pill"
                        style={{ background: meta.bg, color: meta.color, fontWeight: 500 }}
                      >
                        {meta.label}
                      </span>
                      {row.reasons && row.reasons.length > 0 ? (
                        <div className="text-muted small text-end">
                          {row.reasons.map((r, i) => <div key={i}>{r}</div>)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
