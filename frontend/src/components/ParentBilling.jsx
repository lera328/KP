import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AppLayout, parentNavItems } from './AppLayout';

const LOW_BALANCE_THRESHOLD = 3;

const PLAN_LABELS = {
  month: '1 месяц',
  half_year: '6 месяцев',
  year: '12 месяцев',
};

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('ru-RU');
};

export const ParentBilling = () => {
  const [billingData, setBillingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const hasPendingIntent = useMemo(
    () =>
      billingData.some((item) =>
        Array.isArray(item.payment_intents) && item.payment_intents.some((intent) => intent.status === 'pending'),
      ),
    [billingData],
  );

  const loadBilling = async () => {
    setLoading(true);
    setError('');
    try {
      const billingResponse = await api.getParentBilling();
      setBillingData(Array.isArray(billingResponse) ? billingResponse : []);
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить данные по оплатам.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBilling();
  }, []);

  useEffect(() => {
    if (!hasPendingIntent) {
      return undefined;
    }

    const timer = setInterval(() => {
      loadBilling();
    }, 4000);

    return () => clearInterval(timer);
  }, [hasPendingIntent]);


  return (
    <AppLayout title="KiberOne — Родитель" navItems={parentNavItems}>
      <div>
        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <strong>Оплата по детям</strong>
            <button className="btn btn-outline-secondary btn-sm" onClick={loadBilling} disabled={loading}>
              Обновить
            </button>
          </div>
          <div className="card-body">
            {loading ? (
              <div>Загрузка...</div>
            ) : billingData.length === 0 ? (
              <div className="text-muted">Данные по оплатам пока отсутствуют.</div>
            ) : (
              <div className="row g-3">
                {billingData.map((item) => {
                  const remainingLessons = Number(item.subscription?.remaining_lessons ?? 0);
                  const isLowBalance = Boolean(item.subscription?.is_active) && remainingLessons < LOW_BALANCE_THRESHOLD;
                  const latestIntent = Array.isArray(item.payment_intents) ? item.payment_intents[0] : null;

                  return (
                    <div className="col-12" key={item.student_id}>
                      <div className="card">
                        <div className="card-header d-flex justify-content-between align-items-center">
                          <strong>{item.student_name}</strong>
                          <span className={`badge ${item.subscription?.is_active ? (isLowBalance ? 'text-bg-warning' : 'text-bg-success') : 'text-bg-secondary'}`}>
                            {item.subscription?.is_active
                              ? isLowBalance
                                ? 'Низкий остаток'
                                : 'Активный пакет занятий'
                              : 'Нет активного пакета занятий'}
                          </span>
                        </div>
                        <div className="card-body">
                          {item.subscription ? (
                            <div className="mb-3">
                              <div>Всего занятий: {item.subscription.total_lessons}</div>
                              <div>Остаток: {item.subscription.remaining_lessons}</div>
                              {isLowBalance && (
                                <div className="alert alert-warning py-2 mt-2 mb-0">
                                  Осталось мало занятий. Рекомендуем пополнить пакет занятий.
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-muted mb-3">Активный пакет занятий не найден.</div>
                          )}

                          <div className="card mb-3">
                            <div className="card-header">
                              <strong>Оплата</strong>
                            </div>
                            <div className="card-body">
                              <div className="alert alert-info py-2 mb-0">
                                Оплата оформляется через администратора. При необходимости обратитесь в школу.
                              </div>

                              {latestIntent ? (
                                <div className="mt-3 small">
                                  <strong>Последний платеж:</strong>{' '}
                                  {PLAN_LABELS[latestIntent.plan] || latestIntent.plan}, статус{' '}
                                  {latestIntent.status === 'pending'
                                    ? 'ожидает'
                                    : latestIntent.status === 'paid'
                                      ? 'оплачен'
                                      : 'ошибка'}
                                  , создан {formatDateTime(latestIntent.created_at)}
                                  {latestIntent.processed_at ? `, обработан ${formatDateTime(latestIntent.processed_at)}` : ''}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="table-responsive mb-3">
                            <table className="table table-sm table-bordered mb-0">
                              <thead>
                                <tr>
                                  <th>ID</th>
                                  <th>Сумма</th>
                                  <th>Дата</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Array.isArray(item.payments) && item.payments.length > 0 ? (
                                  item.payments.map((payment) => (
                                    <tr key={payment.id}>
                                      <td>{payment.id}</td>
                                      <td>{payment.amount}</td>
                                      <td>{formatDateTime(payment.paid_at)}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={3} className="text-muted text-center">
                                      Платежей пока нет.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>

                          <div className="table-responsive">
                            <table className="table table-sm table-bordered mb-0">
                              <thead>
                                <tr>
                                  <th>ID</th>
                                  <th>Тариф</th>
                                  <th>Занятий</th>
                                  <th>Сумма</th>
                                  <th>Статус</th>
                                  <th>Создан</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Array.isArray(item.payment_intents) && item.payment_intents.length > 0 ? (
                                  item.payment_intents.map((intent) => (
                                    <tr key={intent.id}>
                                      <td>{intent.id}</td>
                                      <td>{PLAN_LABELS[intent.plan] || intent.plan}</td>
                                      <td>{intent.lessons}</td>
                                      <td>{intent.amount}</td>
                                      <td>
                                        {intent.status === 'pending'
                                          ? 'Ожидает'
                                          : intent.status === 'paid'
                                            ? 'Оплачен'
                                            : 'Ошибка'}
                                      </td>
                                      <td>{formatDateTime(intent.created_at)}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={6} className="text-muted text-center">
                                      Инициированных платежей пока нет.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};
