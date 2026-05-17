import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AdminLayout } from './AdminLayout';
import { AdminScheduleOverview } from './AdminScheduleOverview';
import {
  IconUsers,
  IconLayers,
  IconCalendar,
  IconCheck,
  IconWallet,
  IconAlert,
  IconClock,
  IconBell,
  IconPlus,
  IconArrowRight,
  IconChart,
} from './KidIcons';

const firstOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};

const today = () => new Date().toISOString().slice(0, 10);

const formatMoney = (value) => {
  const num = Number(value || 0);
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(num);
};

const formatPercent = (value) => {
  if (value == null) return '—';
  return `${Math.round(value * 100)}%`;
};

const formatDateTime = (v) => {
  if (!v) return '';
  return new Date(v).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [pendingMakeups, setPendingMakeups] = useState(0);
  const [pendingPayments, setPendingPayments] = useState(0);
  const [highRiskCount, setHighRiskCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [metricsData, makeups, intents, churn, events] = await Promise.all([
        api.getDashboardMetrics({ from: firstOfMonth(), to: today() }),
        api.getAdminMakeups().catch(() => []),
        api.getAdminPaymentIntents().catch(() => []),
        api.getChurnRisk().catch(() => []),
        api.getNotificationEvents().catch(() => []),
      ]);
      setMetrics(metricsData);
      setPendingMakeups(
        Array.isArray(makeups)
          ? makeups.filter((m) => m.status === 'requested' || m.status === 'completed').length
          : 0,
      );
      const intentsArr = Array.isArray(intents) ? intents : [];
      setPendingPayments(intentsArr.filter((p) => p.status === 'pending').length);
      setRecentPayments(
        intentsArr
          .filter((p) => p.status === 'paid')
          .sort((a, b) => new Date(b.paid_at || b.created_at || 0) - new Date(a.paid_at || a.created_at || 0))
          .slice(0, 5),
      );
      setHighRiskCount(Array.isArray(churn) ? churn.filter((r) => r.risk_level === 'high').length : 0);
      setRecentNotifications(
        Array.isArray(events)
          ? events
              .slice()
              .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
              .slice(0, 5)
          : [],
      );
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить дашборд.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return 'Доброй ночи';
    if (h < 12) return 'Доброе утро';
    if (h < 18) return 'Добрый день';
    return 'Добрый вечер';
  }, []);

  const kpi = metrics?.kpi || {};
  const groupsCount = metrics?.groups_options?.length || 0;

  return (
    <AdminLayout title="КиберШкола — Администратор">
      {error && <div className="alert alert-danger rounded-3">{error}</div>}

      {/* Шапка приветствия */}
      <div className="d-flex flex-wrap align-items-center gap-3 mb-4">
        <div className="flex-grow-1">
          <div className="text-muted small">
            {new Date().toLocaleDateString('ru-RU', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </div>
          <h3 className="fw-semibold mb-0">
            {greeting}, {user?.first_name || 'администратор'}!
          </h3>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-light border rounded-pill px-3 d-flex align-items-center gap-2"
            onClick={() => navigate('/admin/analytics')}
          >
            <IconChart width={16} height={16} />
            Аналитика
          </button>
          <button
            type="button"
            className="btn btn-dark rounded-pill px-3 d-flex align-items-center gap-2"
            onClick={() => navigate('/admin/users')}
          >
            <IconPlus width={16} height={16} />
            Добавить пользователя
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="row g-3 mb-4">
        <KpiCard
          icon={<IconUsers width={22} height={22} />}
          label="Активных учеников"
          value={kpi.students_total ?? '—'}
          accent="#111827"
          bg="#f8f9fb"
          loading={loading}
          onClick={() => navigate('/admin/users')}
        />
        <KpiCard
          icon={<IconLayers width={22} height={22} />}
          label="Групп"
          value={groupsCount}
          accent="#111827"
          bg="#f8f9fb"
          loading={loading}
          onClick={() => navigate('/admin/groups')}
        />
        <KpiCard
          icon={<IconCalendar width={22} height={22} />}
          label="Занятий за месяц"
          value={kpi.lessons_count ?? '—'}
          accent="#111827"
          bg="#f8f9fb"
          loading={loading}
        />
        <KpiCard
          icon={<IconCheck width={22} height={22} />}
          label="Посещаемость"
          value={formatPercent(kpi.attendance_rate)}
          accent="#16a34a"
          bg="#ecfdf5"
          loading={loading}
          hint={`Пропусков: ${kpi.absences ?? 0}`}
        />
        <KpiCard
          icon={<IconWallet width={22} height={22} />}
          label="Выручка за месяц"
          value={formatMoney(kpi.revenue_total)}
          accent="#1d4ed8"
          bg="#eff6ff"
          loading={loading}
          hint={`Платежей: ${kpi.payments_count ?? 0}`}
          onClick={() => navigate('/admin/finance')}
        />
        <KpiCard
          icon={<IconAlert width={22} height={22} />}
          label="Высокий риск оттока"
          value={highRiskCount}
          accent={highRiskCount > 0 ? '#dc2626' : '#16a34a'}
          bg={highRiskCount > 0 ? '#fef2f2' : '#ecfdf5'}
          loading={loading}
          onClick={() => navigate('/admin/churn-risk')}
        />
      </div>

      {/* Требует внимания */}
      <div className="row g-3 mb-4">
        <div className="col-md-6">
          <ActionCard
            title="Отработки ожидают подтверждения"
            value={pendingMakeups}
            icon={<IconClock width={20} height={20} />}
            accent={pendingMakeups > 0 ? '#b45309' : '#6b7280'}
            bg={pendingMakeups > 0 ? '#fef3c7' : '#f8f9fb'}
            actionLabel="Перейти к отработкам"
            onClick={() => navigate('/admin/makeups')}
          />
        </div>
        <div className="col-md-6">
          <ActionCard
            title="Платежей в ожидании"
            value={pendingPayments}
            icon={<IconWallet width={20} height={20} />}
            accent={pendingPayments > 0 ? '#b45309' : '#6b7280'}
            bg={pendingPayments > 0 ? '#fef3c7' : '#f8f9fb'}
            actionLabel="Перейти к финансам"
            onClick={() => navigate('/admin/finance')}
          />
        </div>
      </div>

      {/* Расписание на эту неделю */}
      <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-body p-3">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <div className="fw-semibold">Расписание</div>
            <button
              type="button"
              className="btn btn-link p-0 small text-decoration-none d-flex align-items-center gap-1"
              onClick={() => navigate('/admin/schedule')}
            >
              Все занятия <IconArrowRight width={14} height={14} />
            </button>
          </div>
          <AdminScheduleOverview embedded />
        </div>
      </div>

      {/* Последние уведомления и платежи */}
      <div className="row g-3">
        <div className="col-md-6">
          <RecentList
            title="Последние уведомления"
            icon={<IconBell width={18} height={18} />}
            items={recentNotifications.map((n) => ({
              id: n.id,
              primary: n.message || n.event_type,
              secondary: `${n.student_name || ''} · ${formatDateTime(n.created_at)}`,
              status: n.status,
            }))}
            emptyText="Уведомлений пока нет."
            onAllClick={() => navigate('/admin/notifications')}
          />
        </div>
        <div className="col-md-6">
          <RecentList
            title="Последние платежи"
            icon={<IconWallet width={18} height={18} />}
            items={recentPayments.map((p) => ({
              id: p.id,
              primary: `${p.student_name || `Ученик #${p.student_id}`} · ${formatMoney(p.amount)}`,
              secondary: formatDateTime(p.paid_at || p.created_at),
              status: 'sent',
            }))}
            emptyText="Платежей пока нет."
            onAllClick={() => navigate('/admin/finance')}
          />
        </div>
      </div>
    </AdminLayout>
  );
};

const KpiCard = ({ icon, label, value, accent, bg, hint, loading, onClick }) => (
  <div className="col-6 col-md-4 col-lg-2">
    <button
      type="button"
      className="w-100 text-start rounded-4 p-3 border-0 h-100 d-flex flex-column gap-2"
      style={{
        background: bg || '#f8f9fb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
      disabled={!onClick}
    >
      <div className="d-flex align-items-center gap-2" style={{ color: accent || '#374151' }}>
        {icon}
        <div className="small fw-semibold text-uppercase" style={{ letterSpacing: 0.3 }}>
          {label}
        </div>
      </div>
      <div
        className="fw-bold"
        style={{ fontSize: '1.4rem', lineHeight: 1.2, color: accent || '#111827' }}
      >
        {loading ? '…' : value}
      </div>
      {hint && (
        <div className="text-muted small" style={{ marginTop: -4 }}>
          {hint}
        </div>
      )}
    </button>
  </div>
);

const ActionCard = ({ title, value, icon, accent, bg, actionLabel, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-100 text-start rounded-4 p-3 border-0 d-flex align-items-center gap-3"
    style={{
      background: bg,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      transition: 'transform 0.1s ease, box-shadow 0.1s ease',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-1px)';
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
    }}
  >
    <div
      className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
      style={{ width: 44, height: 44, background: '#ffffff', color: accent }}
    >
      {icon}
    </div>
    <div className="flex-grow-1">
      <div className="text-muted small" style={{ fontWeight: 500 }}>
        {title}
      </div>
      <div className="d-flex align-items-baseline gap-2">
        <div className="fw-bold" style={{ fontSize: '1.6rem', color: accent }}>
          {value}
        </div>
        <div className="small text-muted">{actionLabel}</div>
      </div>
    </div>
    <IconArrowRight width={20} height={20} style={{ color: accent }} />
  </button>
);

const STATUS_BADGE = {
  sent: { bg: '#ecfdf5', color: '#16a34a' },
  failed: { bg: '#fef2f2', color: '#dc2626' },
  skipped: { bg: '#f3f4f6', color: '#6b7280' },
};

const RecentList = ({ title, icon, items, emptyText, onAllClick }) => (
  <div className="card border-0 shadow-sm rounded-4 h-100">
    <div className="card-body p-3">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="d-flex align-items-center gap-2 fw-semibold">
          {icon}
          {title}
        </div>
        <button
          type="button"
          className="btn btn-link p-0 small text-decoration-none d-flex align-items-center gap-1"
          onClick={onAllClick}
        >
          Все <IconArrowRight width={14} height={14} />
        </button>
      </div>
      {items.length === 0 ? (
        <div className="text-muted small py-3 text-center">{emptyText}</div>
      ) : (
        <div className="d-flex flex-column gap-2">
          {items.map((item) => {
            const badge = STATUS_BADGE[item.status] || STATUS_BADGE.skipped;
            return (
              <div
                key={item.id}
                className="rounded-3 p-2 d-flex align-items-center gap-2"
                style={{ background: '#f8f9fb' }}
              >
                <span
                  className="rounded-circle flex-shrink-0"
                  style={{
                    width: 8,
                    height: 8,
                    background: badge.color,
                  }}
                />
                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                  <div
                    className="small fw-semibold"
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.primary}
                  </div>
                  <div
                    className="text-muted"
                    style={{
                      fontSize: '0.75rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.secondary}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
);
