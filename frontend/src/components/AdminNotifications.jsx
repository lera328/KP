import { useEffect, useState } from 'react';
import api from '../services/api';
import { AdminLayout } from './AdminLayout';

const EVENT_LABELS = {
  absence: 'Пропуск',
  makeup_approved: 'Отработка подтверждена',
  payment_reminder: 'Напоминание об оплате',
};

const STATUS_LABELS = {
  sent: 'Отправлено',
  failed: 'Ошибка',
  skipped: 'Пропущено',
};

const STATUS_CLASSES = {
  sent: 'text-bg-success',
  failed: 'text-bg-danger',
  skipped: 'text-bg-secondary',
};

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('ru-RU');
};

export const AdminNotifications = () => {
  const [events, setEvents] = useState([]);
  const [threshold, setThreshold] = useState('3');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadEvents = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getNotificationEvents();
      setEvents(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить уведомления.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleSendReminders = async () => {
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const payload = {};
      if (threshold) {
        payload.threshold = Number(threshold);
      }
      const result = await api.sendPaymentReminders(payload);
      setSuccess(
        `Отправлено: ${result?.sent || 0}, ошибок: ${result?.failed || 0}, пропущено: ${result?.skipped || 0}`,
      );
      await loadEvents();
    } catch (sendError) {
      setError(sendError.message || 'Не удалось отправить напоминания.');
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminLayout title="Админ — Уведомления">
      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <strong>Напоминания об оплате</strong>
          <button className="btn btn-primary btn-sm" onClick={handleSendReminders} disabled={sending}>
            {sending ? 'Отправка...' : 'Отправить напоминания'}
          </button>
        </div>
        <div className="card-body">
          <label className="form-label">Порог остатка занятий</label>
          <input
            type="number"
            className="form-control"
            value={threshold}
            min={0}
            onChange={(event) => setThreshold(event.target.value)}
            disabled={sending}
          />
          <div className="form-text">Напоминание уйдет всем с остатком &lt;= порога.</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <strong>История уведомлений</strong>
          <button className="btn btn-outline-secondary btn-sm" onClick={loadEvents} disabled={loading}>
            Обновить
          </button>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="p-3">Загрузка...</div>
          ) : events.length === 0 ? (
            <div className="p-3 text-muted">Уведомлений пока нет.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-hover mb-0">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Тип</th>
                    <th>Статус</th>
                    <th>Ученик</th>
                    <th>Родитель</th>
                    <th>Сообщение</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td>{event.id}</td>
                      <td>{EVENT_LABELS[event.event_type] || event.event_type}</td>
                      <td>
                        <span className={`badge ${STATUS_CLASSES[event.status] || 'text-bg-secondary'}`}>
                          {STATUS_LABELS[event.status] || event.status}
                        </span>
                      </td>
                      <td>{event.student_name || event.student}</td>
                      <td>{event.parent_name || '-'}</td>
                      <td>{event.message}</td>
                      <td>{formatDateTime(event.created_at)}</td>
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
