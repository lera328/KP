import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AdminLayout } from './AdminLayout';
import { IconRefresh, IconChart } from './KidIcons';
import { SearchableSelect } from './SearchableSelect';

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

const KPI_CONFIG = [
  { key: 'students_total', label: 'Учеников', accent: '#111827', bg: '#f8f9fb' },
  { key: 'students_at_risk', label: 'Риск оттока', accent: '#b45309', bg: '#fef3c7', hintKey: 'students_high_risk', hintLabel: 'высокий' },
  { key: 'lessons_count', label: 'Уроков', accent: '#1d4ed8', bg: '#eff6ff', hintKey: 'attendance_records_total', hintLabel: 'отметок' },
  { key: 'attendance_rate', label: 'Посещаемость', accent: '#16a34a', bg: '#ecfdf5', fmt: formatRate, hintKey: 'absences', hintLabel: 'пропусков' },
  { key: 'average_grade', label: 'Ср. оценка', accent: '#6d28d9', bg: '#f5f3ff', fmt: formatGrade },
  { key: 'payments_count', label: 'Платежей', accent: '#111827', bg: '#f8f9fb' },
  { key: 'revenue_total', label: 'Выручка', accent: '#16a34a', bg: '#ecfdf5', fmt: formatMoney },
];

export default function AdminAnalytics() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [groupId, setGroupId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [breakdownGroupId, setBreakdownGroupId] = useState('');

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
    <AdminLayout title="КиберШкола — Аналитика">
      {error && <div className="alert alert-danger rounded-3">{error}</div>}

      {/* Header */}
      <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
        <div className="flex-grow-1">
          <div className="text-muted small">Метрики и разбивка по группам</div>
          <h3 className="fw-semibold mb-0">Аналитика</h3>
        </div>
        <button
          type="button"
          className="btn btn-light border rounded-pill px-3 d-flex align-items-center gap-2"
          onClick={handleExport}
          disabled={exporting || loading}
        >
          <IconChart width={16} height={16} />
          {exporting ? 'Готовлю...' : 'Экспорт CSV'}
        </button>
      </div>

      {/* Filters */}
      <div className="card border-0 shadow-sm rounded-4 mb-4">
        <form className="card-body p-3" onSubmit={handleApply}>
          <div className="row g-3 align-items-end">
            <div className="col-md-3 col-6">
              <label className="form-label text-muted small mb-1">Период с</label>
              <input type="date" className="form-control rounded-3" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="col-md-3 col-6">
              <label className="form-label text-muted small mb-1">по</label>
              <input type="date" className="form-control rounded-3" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label text-muted small mb-1">Группа</label>
              <SearchableSelect
                options={groupsOptions.map((g) => ({ value: g.id, label: g.name }))}
                value={groupId}
                onChange={setGroupId}
                allowClear
                clearLabel="Все группы"
                placeholder="Все группы"
              />
            </div>
            <div className="col-md-2">
              <button type="submit" className="btn btn-dark rounded-pill w-100 d-flex align-items-center justify-content-center gap-2" disabled={loading}>
                <IconRefresh width={14} height={14} />
                {loading ? '...' : 'Применить'}
              </button>
            </div>
          </div>
          {data?.period && (
            <div className="text-muted small mt-2">Период: {data.period.from} — {data.period.to}</div>
          )}
        </form>
      </div>

      {loading && !data && (
        <div className="text-muted text-center py-5">Загрузка…</div>
      )}

      {kpi && (
        <>
          {/* KPI */}
          <div className="row g-3 mb-4">
            {KPI_CONFIG.map((cfg) => {
              const raw = kpi[cfg.key];
              const display = cfg.fmt ? cfg.fmt(raw) : (raw ?? '—');
              const hint = cfg.hintKey ? `${cfg.hintLabel}: ${kpi[cfg.hintKey] ?? 0}` : undefined;
              return (
                <div className="col-md-4 col-lg-3" key={cfg.key}>
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body p-3">
                      <div className="text-muted small">{cfg.label}</div>
                      <div className="fw-semibold" style={{ fontSize: 22, color: cfg.accent }}>{display}</div>
                      {hint && <div className="text-muted small">{hint}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Groups breakdown */}
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-0">
              <div className="px-3 py-2 border-bottom d-flex align-items-center justify-content-between gap-2 flex-wrap">
                <div className="fw-semibold">Разбивка по группам</div>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <div style={{ minWidth: 220 }}>
                    <SearchableSelect
                      size="sm"
                      options={groups.map((g) => ({ value: g.group_id, label: g.group_name }))}
                      value={breakdownGroupId}
                      onChange={setBreakdownGroupId}
                      allowClear
                      clearLabel="Все группы"
                      placeholder="Выберите группу"
                    />
                  </div>
                  <div className="text-muted small">Уроков: {totalLessons}</div>
                </div>
              </div>
              <div className="table-responsive">
                <table className="table table-hover mb-0 align-middle">
                  <thead>
                    <tr className="text-muted small">
                      <th className="fw-normal">Группа</th>
                      <th className="fw-normal text-end">Уроков</th>
                      <th className="fw-normal text-end">Учеников</th>
                      <th className="fw-normal text-end">Посещаемость</th>
                      <th className="fw-normal text-end">Ср. оценка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const visible = breakdownGroupId
                        ? groups.filter((g) => String(g.group_id) === String(breakdownGroupId))
                        : groups;
                      if (visible.length === 0) {
                        return (
                          <tr>
                            <td colSpan={5} className="text-center text-muted py-4">
                              За выбранный период данных нет.
                            </td>
                          </tr>
                        );
                      }
                      return visible.map((row) => (
                        <tr key={row.group_id}>
                          <td className="fw-semibold">{row.group_name}</td>
                          <td className="text-end">{row.lessons_count}</td>
                          <td className="text-end">{row.students_count}</td>
                          <td className="text-end">{formatRate(row.attendance_rate)}</td>
                          <td className="text-end">{formatGrade(row.average_grade)}</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
