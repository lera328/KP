import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AdminLayout } from './AdminLayout';

const PLAN_LABELS = {
  month: '1 месяц',
  half_year: '6 месяцев',
  year: '12 месяцев',
};

const STATUS_LABELS = {
  pending: 'Ожидает',
  paid: 'Оплачен',
  failed: 'Ошибка',
};

const STATUS_BADGE_CLASSES = {
  pending: 'text-bg-warning',
  paid: 'text-bg-success',
  failed: 'text-bg-danger',
};

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('ru-RU');
};

export const AdminFinance = () => {
  const [paymentIntents, setPaymentIntents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [studentFilter, setStudentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Form state for manual payment
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formStudentId, setFormStudentId] = useState('');
  const [formPlan, setFormPlan] = useState('month');
  const [formSubmitting, setFormSubmitting] = useState(false);

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

      if (statusFilter !== 'all' && intent.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [paymentIntents, studentFilter, statusFilter]);

  const stats = useMemo(() => {
    const totalIntents = paymentIntents.length;
    const totalAmount = paymentIntents.reduce((sum, intent) => sum + parseFloat(intent.amount || 0), 0);
    const paidIntents = paymentIntents.filter((intent) => intent.status === 'paid').length;
    const pendingIntents = paymentIntents.filter((intent) => intent.status === 'pending').length;

    return {
      totalIntents,
      totalAmount: totalAmount.toFixed(2),
      paidIntents,
      pendingIntents,
    };
  }, [paymentIntents]);

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
  }, []);

  const handleResetFilters = () => {
    setStudentFilter('');
    setStatusFilter('all');
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
      setFormPlan('month');
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
    <AdminLayout title="Админ — Финансы">
      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Stats row */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card text-center">
            <div className="card-body">
              <div className="text-muted small">Всего платежей</div>
              <div className="h4 mb-0">{stats.totalIntents}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-center">
            <div className="card-body">
              <div className="text-muted small">Общая сумма</div>
              <div className="h4 mb-0">{stats.totalAmount}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-center">
            <div className="card-body">
              <div className="text-muted small">Оплачено</div>
              <div className="h4 mb-0 text-success">{stats.paidIntents}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-center">
            <div className="card-body">
              <div className="text-muted small">Ожидают</div>
              <div className="h4 mb-0 text-warning">{stats.pendingIntents}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Create payment card */}
      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <strong>Создать платеж за наличку</strong>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowCreateForm(!showCreateForm)}
            disabled={loading}
          >
            {showCreateForm ? 'Отменить' : 'Новый платеж'}
          </button>
        </div>
        {showCreateForm && (
          <div className="card-body">
            <form onSubmit={handleCreatePayment}>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Ученик</label>
                  <select
                    className="form-select"
                    value={formStudentId}
                    onChange={(e) => setFormStudentId(e.target.value)}
                    required
                    disabled={formSubmitting}
                  >
                    <option value="">Выберите ученика</option>
                    {studentUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {(user.first_name + ' ' + user.last_name).trim() || user.username}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Тариф</label>
                  <select
                    className="form-select"
                    value={formPlan}
                    onChange={(e) => setFormPlan(e.target.value)}
                    disabled={formSubmitting}
                  >
                    <option value="month">1 месяц</option>
                    <option value="half_year">6 месяцев</option>
                    <option value="year">12 месяцев</option>
                  </select>
                </div>
              </div>
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-success btn-sm" disabled={formSubmitting || !formStudentId}>
                  {formSubmitting ? 'Создание...' : 'Создать платеж'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setShowCreateForm(false)}
                  disabled={formSubmitting}
                >
                  Отменить
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Payment intents table */}
      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <strong>Платежные интенты родителей</strong>
          <div className="d-flex gap-2">
            <select
              className="form-select form-select-sm"
              value={studentFilter}
              onChange={(event) => setStudentFilter(event.target.value)}
              disabled={loading}
            >
              <option value="">Все ученики</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
            <select
              className="form-select form-select-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              disabled={loading}
            >
              <option value="all">Все статусы</option>
              <option value="pending">Ожидают</option>
              <option value="paid">Оплачены</option>
              <option value="failed">Ошибки</option>
            </select>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={handleResetFilters}
              disabled={loading || (!studentFilter && statusFilter === 'all')}
            >
              Сбросить
            </button>
            <button className="btn btn-outline-secondary btn-sm" onClick={loadData} disabled={loading}>
              Обновить
            </button>
          </div>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="p-3">Загрузка...</div>
          ) : filteredIntents.length === 0 ? (
            <div className="p-3 text-muted">Платежные интенты не найдены.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-hover mb-0">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Ученик</th>
                    <th>Родитель</th>
                    <th>Тариф</th>
                    <th>Занятий</th>
                    <th>Сумма</th>
                    <th>Статус</th>
                    <th>Создан</th>
                    <th>Обработан</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIntents.map((intent) => (
                    <tr key={intent.id}>
                      <td>{intent.id}</td>
                      <td>{intent.student_name || `Ученик #${intent.student_id}`}</td>
                      <td>{intent.parent_name || '-'}</td>
                      <td>{PLAN_LABELS[intent.plan] || intent.plan}</td>
                      <td>{intent.lessons}</td>
                      <td>{intent.amount}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE_CLASSES[intent.status]}`}>
                          {STATUS_LABELS[intent.status] || intent.status}
                        </span>
                      </td>
                      <td>{formatDateTime(intent.created_at)}</td>
                      <td>{formatDateTime(intent.processed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Payments history */}
      <div className="card">
        <div className="card-header">
          <strong>История обработанных платежей</strong>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="p-3">Загрузка...</div>
          ) : payments.length === 0 ? (
            <div className="p-3 text-muted">Обработанных платежей пока нет.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-hover mb-0">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Сумма</th>
                    <th>Дата оплаты</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.slice(0, 50).map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.id}</td>
                      <td>{payment.amount}</td>
                      <td>{formatDateTime(payment.paid_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};
