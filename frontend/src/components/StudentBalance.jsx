import { useEffect, useState } from 'react';
import api from '../services/api';
import { AppLayout, studentNavItems } from './AppLayout';
import { useAuth } from '../context/AuthContext';

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('ru-RU');
};

export const StudentBalance = () => {
  const { user } = useAuth();

  const [balance, setBalance] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [balanceData, paymentsData] = await Promise.all([api.getBalance(), api.getMyPayments()]);
      setBalance(balanceData || null);
      setPayments(Array.isArray(paymentsData) ? paymentsData : []);

      try {
        const activeSubscription = await api.getActiveSubscription();
        setSubscription(activeSubscription || null);
      } catch {
        setSubscription(null);
      }
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить баланс занятий.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <AppLayout title="KiberOne — Ученик" navItems={studentNavItems}>
      <div>
        {error && <div className="alert alert-danger">{error}</div>}

        <div className="row g-4">
          <div className="col-lg-4">
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <strong>Текущий баланс</strong>
                <button className="btn btn-outline-secondary btn-sm" onClick={loadData} disabled={loading}>
                  Обновить
                </button>
              </div>
              <div className="card-body">
                {loading ? (
                  <div>Загрузка...</div>
                ) : (
                  <>
                    <div className="display-6 fw-bold mb-2">{Number(balance?.remaining_lessons ?? 0)}</div>
                    <div className="text-muted">Осталось занятий</div>
                    {subscription && (
                      <div className="mt-3 small text-muted">
                        Всего по пакету занятий: {subscription.total_lessons}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="col-lg-8">
            <div className="card">
              <div className="card-header">
                <strong>История пополнений</strong>
              </div>
              <div className="card-body p-0">
                {loading ? (
                  <div className="p-3">Загрузка...</div>
                ) : payments.length === 0 ? (
                  <div className="p-3 text-muted">Платежей пока нет.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-striped table-hover mb-0">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Сумма</th>
                          <th>Дата</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => (
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
          </div>
        </div>
      </div>
    </AppLayout>
  );
};
