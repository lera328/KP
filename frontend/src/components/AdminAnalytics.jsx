import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AdminLayout } from './AdminLayout';

const today = () => new Date().toISOString().slice(0, 10);

const firstOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};

const formatRate = (value) => {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value * 100)}%`;
};

const formatGrade = (value) => {
  if (value === null || value === undefined) return '—';
  return Number(value).toFixed(2);
};

const formatMoney = (value) => {
  if (value === null || value === undefined) return '0 ₽';
  const num = Number(value);
  if (Number.isNaN(num)) return `${value} ₽`;
  return `${num.toLocaleString('ru-RU')} ₽`;
};

const KpiCard = ({ title, value, hint, tone = 'primary' }) => (
  <div className="col-md-4 col-lg-3 mb-3">
    <div className={`card border-${tone}`}>
      <div className="card-body">
        <div className="text-muted small">{title}</div>
        <div className="fs-3 fw-semibold">{value}</div>
        {hint && <div className="text-muted small">{hint}</div>}
      </div>
    </div>
  </div>
);

export default function AdminAnalytics() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [groupId, setGroupId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.getDashboardMetrics({ from, to, groupId });
      setData(result);
    } catch (err) {
      setError(err.message || 'Не удалось загрузить метрики');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApply = (event) => {
    event?.preventDefault();
    load();
  };

  const handleExport = async () => {
    setExporting(true);
    setError('');
    try {
      const result = await api.downloadDashboardCsv({ from, to, groupId });
      if (!result) return;
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Не удалось скачать отчёт');
    } finally {
      setExporting(false);
    }
  };

  const kpi = data?.kpi;
  const groups = data?.groups || [];
  const groupsOptions = data?.groups_options || [];

  const totalLessons = useMemo(
    () => groups.reduce((acc, g) => acc + (g.lessons_count || 0), 0),
    [groups],
  );

  return (
    <AdminLayout title="KiberOne — Аналитика">
      <div>
        {error && <div className="alert alert-danger">{error}</div>}

        <form className="card mb-4" onSubmit={handleApply}>
          <div className="card-body">
            <div className="row g-3 align-items-end">
              <div className="col-md-3">
                <label className="form-label small">Период с</label>
                <input
                  type="date"
                  className="form-control"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label small">по</label>
                <input
                  type="date"
                  className="form-control"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label small">Группа</label>
                <select
                  className="form-select"
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                >
                  <option value="">Все группы</option>
                  {groupsOptions.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-2 d-flex gap-2">
                <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                  {loading ? '...' : 'Применить'}
                </button>
              </div>
            </div>
            <div className="d-flex gap-2 mt-3">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={handleExport}
                disabled={exporting || loading}
              >
                {exporting ? 'Готовлю...' : 'Экспорт CSV'}
              </button>
              {data?.period && (
                <span className="text-muted small align-self-center">
                  Период: {data.period.from} — {data.period.to}
                </span>
              )}
            </div>
          </div>
        </form>

        {loading && !data && (
          <div className="text-muted text-center py-5">Загрузка…</div>
        )}

        {kpi && (
          <>
            <div className="row">
              <KpiCard
                title="Учеников активных"
                value={kpi.students_total}
                tone="primary"
              />
              <KpiCard
                title="С риском оттока"
                value={kpi.students_at_risk}
                hint={`из них высокий: ${kpi.students_high_risk}`}
                tone={kpi.students_high_risk > 0 ? 'danger' : 'warning'}
              />
              <KpiCard
                title="Уроков проведено"
                value={kpi.lessons_count}
                hint={`всего отметок: ${kpi.attendance_records_total}`}
                tone="info"
              />
              <KpiCard
                title="Посещаемость"
                value={formatRate(kpi.attendance_rate)}
                hint={`пропусков: ${kpi.absences}`}
                tone="success"
              />
              <KpiCard
                title="Средняя оценка"
                value={formatGrade(kpi.average_grade)}
                tone="secondary"
              />
              <KpiCard
                title="Платежей"
                value={kpi.payments_count}
                tone="dark"
              />
              <KpiCard
                title="Выручка за период"
                value={formatMoney(kpi.revenue_total)}
                tone="success"
              />
            </div>

            <div className="card mt-3">
              <div className="card-header d-flex justify-content-between align-items-center">
                <strong>Разбивка по группам</strong>
                <span className="text-muted small">
                  Всего уроков в выборке: {totalLessons}
                </span>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Группа</th>
                        <th className="text-end">Уроков</th>
                        <th className="text-end">Учеников</th>
                        <th className="text-end">Посещаемость</th>
                        <th className="text-end">Средняя оценка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center text-muted py-4">
                            За выбранный период данных нет.
                          </td>
                        </tr>
                      )}
                      {groups.map((row) => (
                        <tr key={row.group_id}>
                          <td>{row.group_name}</td>
                          <td className="text-end">{row.lessons_count}</td>
                          <td className="text-end">{row.students_count}</td>
                          <td className="text-end">{formatRate(row.attendance_rate)}</td>
                          <td className="text-end">{formatGrade(row.average_grade)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
