import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AdminLayout } from './AdminLayout';
import { IconPlus, IconRefresh, IconSearch, IconWallet } from './KidIcons';

const STATUS_META = {
  pending: { label: 'Ожидает', bg: '#fef3c7', color: '#b45309' },
  paid: { label: 'Оплачен', bg: '#ecfdf5', color: '#16a34a' },
  failed: { label: 'Ошибка', bg: '#fef2f2', color: '#dc2626' },
};

const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const formatMoney = (value) => {
  const n = Number(value || 0);
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';
};

export const AdminFinance = () => {
  const [paymentIntents, setPaymentIntents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [studentFilter, setStudentFilter] = useState('');
  const [cancellingId, setCancellingId] = useState(null);

  // Form state for manual payment
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formStudentId, setFormStudentId] = useState('');
  const [formPlan, setFormPlan] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Pricing plans state
  const [plans, setPlans] = useState([]);
  const [editingPlans, setEditingPlans] = useState(null);
  const [savingPlans, setSavingPlans] = useState(false);

  const students = useMemo(() => {
    const studentIds = new Set();
    const map = new Map();

    paymentIntents.forEach((intent) => {
      if (!studentIds.has(intent.student_id)) {
        studentIds.add(intent.student_id);
        map.set(intent.student_id, intent.student_name || `Ученик #${intent.student_id}`);
      }
    });

    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1], 'ru'))
      .map(([id, name]) => ({ id, name }));
  }, [paymentIntents]);

  const filteredIntents = useMemo(() => {
    return paymentIntents.filter((intent) => {
      if (studentFilter && Number(intent.student_id) !== Number(studentFilter)) {
        return false;
      }
      return true;
    });
  }, [paymentIntents, studentFilter]);

  const stats = useMemo(() => {
    const totalIntents = paymentIntents.length;
    const totalAmount = paymentIntents.reduce((sum, intent) => sum + parseFloat(intent.amount || 0), 0);
    return {
      totalIntents,
      totalAmount: totalAmount.toFixed(2),
    };
  }, [paymentIntents]);

  const loadPlans = async () => {
    try {
      const data = await api.getPaymentPlans();
      setPlans(Array.isArray(data) ? data : []);
    } catch (e) {
      /* не критично */
    }
  };

  const handleSavePlans = async () => {
    setSavingPlans(true);
    setError('');
    try {
      await api.updatePaymentPlans(editingPlans);
      setPlans(editingPlans);
      setEditingPlans(null);
      setSuccess('Тарифы сохранены.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.message || 'Ошибка сохранения тарифов');
    } finally {
      setSavingPlans(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [intentsData, paymentsData, usersData] = await Promise.all([
        api.getAdminPaymentIntents(),
        api.getPayments(),
        api.getUsers(),
      ]);

      const safeIntents = Array.isArray(intentsData)
        ? intentsData.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        : [];

      const safePayments = Array.isArray(paymentsData)
        ? paymentsData.sort((a, b) => new Date(b.paid_at || 0) - new Date(a.paid_at || 0))
        : [];

      const safeUsers = Array.isArray(usersData) ? usersData : [];

      setPaymentIntents(safeIntents);
      setPayments(safePayments);
      setAllUsers(safeUsers);
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить финансовые данные.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadPlans();
  }, []);

  const handleResetFilters = () => {
    setStudentFilter('');
  };

  const handleCancelIntent = async (intent) => {
    const label = `${intent.student_name || `Ученик #${intent.student_id}`} · ${formatMoney(intent.amount)}`;
    if (!window.confirm(`Отменить платёж?\n${label}\n\nБудут удалены созданная подписка и платёж, активной станет предыдущая подписка.`)) {
      return;
    }
    setCancellingId(intent.id);
    setError('');
    setSuccess('');
    try {
      await api.cancelAdminPaymentIntent(intent.id);
      setSuccess('Платёж отменён.');
      await loadData();
    } catch (err) {
      setError(err.message || 'Не удалось отменить платёж.');
    } finally {
      setCancellingId(null);
    }
  };

  const handleCreatePayment = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.createAdminPayment({
        student_id: parseInt(formStudentId),
        plan: formPlan,
      });

      setSuccess(response?.detail || 'Платеж успешно создан');
      setFormStudentId('');
      setFormPlan(plans[0]?.code || '');
      setShowCreateForm(false);
      await loadData();
    } catch (err) {
      setError(err.message || 'Ошибка при создании платежа');
    } finally {
      setFormSubmitting(false);
    }
  };

  const studentUsers = useMemo(() => {
    return allUsers.filter((user) => user.roles && user.roles.includes('student')).sort((a, b) => {
      const nameA = (a.first_name + ' ' + a.last_name).trim() || a.username;
      const nameB = (b.first_name + ' ' + b.last_name).trim() || b.username;
      return nameA.localeCompare(nameB, 'ru');
    });
  }, [allUsers]);

  return (
    <AdminLayout title="КиберШкола — Финансы">
      {error && <div className="alert alert-danger rounded-3">{error}</div>}
      {success && <div className="alert alert-success rounded-3">{success}</div>}

      {/* Header */}
      <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
        <div className="flex-grow-1">
          <div className="text-muted small">Платежи и история обработки</div>
          <h3 className="fw-semibold mb-0">Финансы</h3>
        </div>
        <button
          type="button"
          className="btn btn-light border rounded-pill px-3 d-flex align-items-center gap-2"
          onClick={loadData}
          disabled={loading}
        >
          <IconRefresh width={16} height={16} />
          Обновить
        </button>
        <button
          type="button"
          className="btn btn-dark rounded-pill px-3 d-flex align-items-center gap-2"
          onClick={() => { setFormPlan(plans[0]?.code || ''); setShowCreateForm(true); }}
          disabled={loading}
        >
          <IconPlus width={16} height={16} />
          Новый платёж
        </button>
      </div>

      {/* KPI */}
      <div className="row g-3 mb-4">
        <div className="col-md-3 col-6">
          <KpiCard
            icon={<IconWallet width={20} height={20} />}
            label="Всего платежей"
            value={stats.totalIntents}
            bg="#f8f9fb"
            accent="#111827"
          />
        </div>
        <div className="col-md-3 col-6">
          <KpiCard
            icon={<IconWallet width={20} height={20} />}
            label="Общая сумма"
            value={formatMoney(stats.totalAmount)}
            bg="#eff6ff"
            accent="#1d4ed8"
          />
        </div>
      </div>

      {/* Pricing Plans */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-3">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <div className="fw-semibold">Тарифы обучения</div>
            {!editingPlans ? (
              <button
                type="button"
                className="btn btn-sm btn-light border rounded-pill px-3"
                onClick={() => setEditingPlans(plans.map((p) => ({ ...p })))}
                disabled={plans.length === 0}
              >
                Редактировать
              </button>
            ) : (
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-light border rounded-pill px-3"
                  onClick={() => setEditingPlans(null)}
                  disabled={savingPlans}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-dark rounded-pill px-3"
                  onClick={handleSavePlans}
                  disabled={savingPlans}
                >
                  {savingPlans ? 'Сохранение…' : 'Сохранить'}
                </button>
              </div>
            )}
          </div>
          {editingPlans ? (
            <div className="row g-3">
              {editingPlans.map((plan, idx) => (
                <div key={plan.code} className="col-md-4">
                  <div className="card rounded-3 h-100">
                    <div className="card-body p-3">
                      <div className="mb-2">
                        <label className="form-label small text-muted mb-1">Название</label>
                        <input
                          className="form-control form-control-sm rounded-3"
                          value={plan.label}
                          onChange={(e) => {
                            const next = [...editingPlans];
                            next[idx] = { ...next[idx], label: e.target.value };
                            setEditingPlans(next);
                          }}
                        />
                      </div>
                      <div className="mb-2">
                        <label className="form-label small text-muted mb-1">Стоимость, ₽</label>
                        <input
                          type="number"
                          className="form-control form-control-sm rounded-3"
                          value={plan.amount}
                          min={0}
                          onChange={(e) => {
                            const next = [...editingPlans];
                            next[idx] = { ...next[idx], amount: e.target.value };
                            setEditingPlans(next);
                          }}
                        />
                      </div>
                      <div>
                        <label className="form-label small text-muted mb-1">Количество занятий</label>
                        <input
                          type="number"
                          className="form-control form-control-sm rounded-3"
                          value={plan.lessons || ''}
                          min={1}
                          onChange={(e) => {
                            const next = [...editingPlans];
                            next[idx] = { ...next[idx], lessons: parseInt(e.target.value) || 1, duration_months: 0 };
                            setEditingPlans(next);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : plans.length === 0 ? (
            <div className="text-muted small">Тарифы не загружены</div>
          ) : (
            <div className="row g-3">
              {plans.map((plan) => (
                <div key={plan.code} className="col-md-4">
                  <div className="card rounded-3 h-100" style={{ background: '#f8f9fb' }}>
                    <div className="card-body p-3 text-center">
                      <div className="fw-semibold mb-1">{plan.label}</div>
                      <div className="fs-4 fw-bold" style={{ color: '#111827' }}>{formatMoney(plan.amount)}</div>
                      <div className="text-muted small">{plan.duration_months ? `${plan.duration_months} мес.` : `${plan.lessons} занятий`}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-3 d-flex flex-wrap align-items-center gap-2">
          <div className="position-relative" style={{ minWidth: 220 }}>
            <span className="position-absolute text-muted" style={{ left: 12, top: '50%', transform: 'translateY(-50%)' }}>
              <IconSearch width={16} height={16} />
            </span>
            <select
              className="form-select rounded-pill ps-5"
              value={studentFilter}
              onChange={(event) => setStudentFilter(event.target.value)}
              disabled={loading}
            >
              <option value="">Все ученики</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>{student.name}</option>
              ))}
            </select>
          </div>
          {studentFilter ? (
            <button
              className="btn btn-link text-decoration-none ms-auto p-0 small"
              onClick={handleResetFilters}
              disabled={loading}
            >
              Сбросить
            </button>
          ) : null}
        </div>
      </div>

      {/* Payment intents list */}
      <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-body p-0">
          <div className="px-3 py-2 d-flex align-items-center justify-content-between border-bottom">
            <div className="fw-semibold">Платежи родителей</div>
            <div className="text-muted small">{filteredIntents.length}</div>
          </div>
          {loading ? (
            <div className="p-4 text-center text-muted">Загрузка...</div>
          ) : filteredIntents.length === 0 ? (
            <div className="p-4 text-center text-muted">Платежи не найдены.</div>
          ) : (
            <div className="list-group list-group-flush">
              {filteredIntents.map((intent) => {
                const meta = STATUS_META[intent.status] || { label: intent.status, bg: '#f1f3f5', color: '#374151' };
                return (
                  <div key={intent.id} className="list-group-item border-0 px-3 py-3">
                    <div className="d-flex flex-wrap align-items-start gap-3">
                      <div className="flex-grow-1" style={{ minWidth: 220 }}>
                        <div className="fw-semibold">
                          {intent.student_name || `Ученик #${intent.student_id}`}
                        </div>
                        <div className="text-muted small">
                          {intent.parent_name ? `Родитель: ${intent.parent_name}` : 'Родитель не указан'}
                        </div>
                      </div>
                      <div className="text-muted small" style={{ minWidth: 120 }}>
                        <div>Тариф: {plans.find((p) => p.code === intent.plan)?.label || intent.plan}</div>
                        <div>Занятий: {intent.lessons}</div>
                      </div>
                      <div className="text-end" style={{ minWidth: 140 }}>
                        <div className="fw-semibold">{formatMoney(intent.amount)}</div>
                        <div className="text-muted small">Создан: {formatDateTime(intent.created_at)}</div>
                        {intent.processed_at ? (
                          <div className="text-muted small">Обработан: {formatDateTime(intent.processed_at)}</div>
                        ) : null}
                      </div>
                      <div className="d-flex flex-column align-items-end gap-2">
                        <span
                          className="badge rounded-pill"
                          style={{ background: meta.bg, color: meta.color, fontWeight: 500 }}
                        >
                          {meta.label}
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger rounded-pill px-3"
                          onClick={() => handleCancelIntent(intent)}
                          disabled={cancellingId === intent.id}
                        >
                          {cancellingId === intent.id ? 'Отмена…' : 'Отменить'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreateForm ? (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ background: 'rgba(17,24,39,0.5)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreateForm(false); }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4 shadow">
              <div className="modal-header border-0 px-4 pt-4 pb-2">
                <h5 className="modal-title fw-semibold">Новый платёж</h5>
                <button type="button" className="btn-close" onClick={() => setShowCreateForm(false)} disabled={formSubmitting} />
              </div>
              <form onSubmit={handleCreatePayment}>
                <div className="modal-body px-4 pb-2">
                  <div className="mb-3">
                    <label className="form-label">Ученик</label>
                    <select
                      className="form-select rounded-3"
                      value={formStudentId}
                      onChange={(e) => setFormStudentId(e.target.value)}
                      required
                      disabled={formSubmitting}
                      autoFocus
                    >
                      <option value="">Выберите ученика</option>
                      {studentUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {(u.first_name + ' ' + u.last_name).trim() || u.username}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-1">
                    <label className="form-label">Тариф</label>
                    <select
                      className="form-select rounded-3"
                      value={formPlan}
                      onChange={(e) => setFormPlan(e.target.value)}
                      disabled={formSubmitting || plans.length === 0}
                    >
                      <option value="" disabled>Выберите тариф</option>
                      {plans.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.label} — {formatMoney(p.amount)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal-footer border-0 px-4 pb-4 pt-2">
                  <button type="button" className="btn btn-light border rounded-pill px-3" onClick={() => setShowCreateForm(false)} disabled={formSubmitting}>
                    Отмена
                  </button>
                  <button type="submit" className="btn btn-dark rounded-pill px-4" disabled={formSubmitting || !formStudentId}>
                    {formSubmitting ? 'Создание...' : 'Создать платёж'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
};

const KpiCard = ({ icon, label, value, bg, accent }) => (
  <div className="card border-0 shadow-sm rounded-4 h-100">
    <div className="card-body p-3 d-flex align-items-center gap-3">
      <div
        className="d-flex align-items-center justify-content-center rounded-3"
        style={{ width: 40, height: 40, background: bg, color: accent }}
      >
        {icon}
      </div>
      <div className="flex-grow-1">
        <div className="text-muted small">{label}</div>
        <div className="fw-semibold" style={{ fontSize: 20, color: accent }}>{value}</div>
      </div>
    </div>
  </div>
);
