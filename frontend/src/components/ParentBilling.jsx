import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AppLayout, parentNavItems } from './AppLayout';

const LOW_BALANCE_THRESHOLD = 3;

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const INTENT_STATUS = {
  pending: { label: 'Ожидает', color: '#d97706', bg: '#fef3c7' },
  paid: { label: 'Оплачен', color: '#16a34a', bg: '#ecfdf5' },
  error: { label: 'Ошибка', color: '#dc2626', bg: '#fef2f2' },
};

export const ParentBilling = () => {
  const [billingData, setBillingData] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const planLabel = (code) => plans.find((p) => p.code === code)?.label || code;

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
    api.getPaymentPlans().then((data) => setPlans(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!hasPendingIntent) return undefined;
    const timer = setInterval(() => { loadBilling(); }, 4000);
    return () => clearInterval(timer);
  }, [hasPendingIntent]);

  return (
    <AppLayout title="КиберШкола — Оплата" navItems={parentNavItems} kidMode>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h1 className="fw-semibold mb-0" style={{ fontSize: '1.75rem' }}>Оплата</h1>
        <button type="button" className="btn btn-light border rounded-pill px-3 ms-auto" onClick={loadBilling} disabled={loading}>
          Обновить
        </button>
      </div>

      {error && <div className="alert alert-danger rounded-3">{error}</div>}

      {loading ? (
        <div className="d-flex flex-column gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="kid-skeleton" style={{ height: 180, borderRadius: 16 }} />
          ))}
        </div>
      ) : billingData.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body text-center py-5 text-muted">Данные по оплатам пока отсутствуют.</div>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {billingData.map((item) => {
            const sub = item.subscription;
            const remainingLessons = Number(sub?.remaining_lessons ?? 0);
            const isLowBalance = Boolean(sub?.is_active) && remainingLessons < LOW_BALANCE_THRESHOLD;
            const needsAttention = isLowBalance;

            const statusColor = sub?.is_active ? (needsAttention ? '#d97706' : '#16a34a') : '#6b7280';
            const statusBg = sub?.is_active ? (needsAttention ? '#fef3c7' : '#ecfdf5') : '#f3f4f6';
            const statusLabel = sub?.is_active ? (isLowBalance ? 'Мало занятий' : 'Активен') : 'Нет абонемента';

            const payments = Array.isArray(item.payments) ? item.payments : [];
            const intents = Array.isArray(item.payment_intents) ? item.payment_intents : [];

            return (
              <div key={item.student_id} className="card border-0 shadow-sm rounded-4" style={needsAttention ? { borderLeft: '4px solid #f59e0b' } : {}}>
                <div className="card-body p-4">
                  {/* Шапка */}
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                    <div className="fw-semibold" style={{ fontSize: '1.15rem' }}>{item.student_name}</div>
                    <span className="badge rounded-pill ms-auto" style={{ background: statusBg, color: statusColor, fontWeight: 600 }}>{statusLabel}</span>
                  </div>

                  {/* Баланс */}
                  {sub ? (
                    <div className="rounded-3 p-3 mb-3" style={{ background: '#f8f9fb' }}>
                      <div>
                        <div className="d-flex flex-wrap gap-3">
                          <div>
                            <div className="text-muted small">Всего занятий</div>
                            <div className="fw-semibold">{sub.total_lessons}</div>
                          </div>
                          <div>
                            <div className="text-muted small">Остаток занятий</div>
                            <div className="fw-semibold" style={{ color: isLowBalance ? '#dc2626' : '#111827', fontSize: '1.1rem' }}>{sub.remaining_lessons}</div>
                          </div>
                        </div>
                        {isLowBalance && (
                          <div className="mt-2 rounded-3 p-2 small fw-semibold" style={{ background: '#fef2f2', color: '#dc2626' }}>
                            Мало занятий. Обратитесь в школу для пополнения.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-3 p-3 mb-3 text-muted small" style={{ background: '#f8f9fb' }}>
                      Активный абонемент не найден.
                    </div>
                  )}

                  {/* Инфо */}
                  <div className="rounded-3 p-3 mb-3 small" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                    Оплата оформляется через администратора. При необходимости обратитесь в школу.
                  </div>

                  {/* Платежи */}
                  {payments.length > 0 && (
                    <div className="mb-3">
                      <div className="fw-semibold small mb-2">Платежи</div>
                      <div className="d-flex flex-column gap-1">
                        {payments.map((p) => (
                          <div key={p.id} className="d-flex justify-content-between align-items-center rounded-3 p-2" style={{ background: '#f8f9fb' }}>
                            <span className="small">{formatDateTime(p.paid_at)}</span>
                            <span className="fw-semibold small">{p.amount} ₸</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Счета */}
                  {intents.length > 0 && (
                    <div>
                      <div className="fw-semibold small mb-2">История счетов</div>
                      <div className="d-flex flex-column gap-1">
                        {intents.map((intent) => {
                          const st = INTENT_STATUS[intent.status] || INTENT_STATUS.error;
                          return (
                            <div key={intent.id} className="d-flex flex-wrap align-items-center gap-2 rounded-3 p-2" style={{ background: '#f8f9fb' }}>
                              <span className="small flex-grow-1">{planLabel(intent.plan)} · {intent.lessons} зан. · {intent.amount} ₸</span>
                              <span className="badge rounded-pill" style={{ background: st.bg, color: st.color, fontWeight: 500 }}>{st.label}</span>
                              <span className="text-muted small">{formatDateTime(intent.created_at)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
};
