import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AdminLayout } from './AdminLayout';

const RISK_LABELS = {
  high: { text: 'Высокий', cls: 'badge bg-danger' },
  medium: { text: 'Средний', cls: 'badge bg-warning text-dark' },
  low: { text: 'Низкий', cls: 'badge bg-success' },
};

const FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'risk', label: 'Только high + medium' },
  { value: 'high', label: 'Только high' },
];

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ru-RU');
  } catch {
    return value;
  }
};

const formatRate = (value) => {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value * 100)}%`;
};

export default function AdminChurnRisk() {
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
    <AdminLayout title="KiberOne — Риск оттока">
      <div>
        {error && <div className="alert alert-danger">{error}</div>}

        <div className="card mb-3">
          <div className="card-body d-flex flex-wrap gap-3 align-items-center justify-content-between">
            <div className="d-flex gap-3 flex-wrap">
              <div>
                <span className="badge bg-danger">Высокий: {counts.high}</span>
              </div>
              <div>
                <span className="badge bg-warning text-dark">Средний: {counts.medium}</span>
              </div>
              <div>
                <span className="badge bg-success">Низкий: {counts.low}</span>
              </div>
              <div className="text-muted small align-self-center">
                Всего учеников: {rows.length}
              </div>
            </div>
            <div className="d-flex gap-2 align-items-center">
              <select
                className="form-select form-select-sm"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                disabled={loading}
                style={{ minWidth: 200 }}
              >
                {FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <button className="btn btn-outline-secondary btn-sm" onClick={load} disabled={loading}>
                Обновить
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Ученик</th>
                    <th>Группа</th>
                    <th>Риск</th>
                    <th className="text-end">Подряд пропусков</th>
                    <th className="text-end">Посещаемость 30д</th>
                    <th className="text-end">Остаток уроков</th>
                    <th>Оплата</th>
                    <th>Последний урок</th>
                    <th>Причины</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={9} className="text-center text-muted py-4">Загрузка…</td>
                    </tr>
                  )}
                  {!loading && filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center text-muted py-4">
                        Нет учеников по выбранному фильтру.
                      </td>
                    </tr>
                  )}
                  {!loading && filteredRows.map((row) => {
                    const risk = RISK_LABELS[row.risk_level] || RISK_LABELS.low;
                    return (
                      <tr key={row.student_id}>
                        <td>
                          <div className="fw-semibold">{row.student_name}</div>
                          <div className="text-muted small">{row.username}{row.email ? ` · ${row.email}` : ''}</div>
                        </td>
                        <td>{row.group_name || '—'}</td>
                        <td><span className={risk.cls}>{risk.text}</span></td>
                        <td className="text-end">{row.consecutive_absences}</td>
                        <td className="text-end">{formatRate(row.attendance_rate_30d)}</td>
                        <td className="text-end">{row.remaining_lessons}</td>
                        <td>
                          {row.has_active_subscription
                            ? <span className="badge bg-success-subtle text-success">Оплачено</span>
                            : <span className="badge bg-danger-subtle text-danger">Не оплачено</span>}
                        </td>
                        <td>{formatDate(row.last_lesson_at)}</td>
                        <td>
                          {row.reasons && row.reasons.length
                            ? <ul className="mb-0 ps-3 small">{row.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                            : <span className="text-muted small">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
