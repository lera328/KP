import { useEffect, useState } from 'react';
import api from '../services/api';
import { AdminLayout } from './AdminLayout';
import { IconRefresh, IconBell } from './KidIcons';

const EVENT_META = {
  absence: { label: 'Пропуск', bg: '#fef3c7', color: '#b45309' },
  makeup_approved: { label: 'Отработка', bg: '#ecfdf5', color: '#16a34a' },
  payment_reminder: { label: 'Оплата', bg: '#eff6ff', color: '#1d4ed8' },
};

const STATUS_META = {
  sent: { label: 'Отправлено', bg: '#ecfdf5', color: '#16a34a' },
  failed: { label: 'Ошибка', bg: '#fef2f2', color: '#dc2626' },
  skipped: { label: 'Пропущено', bg: '#f1f3f5', color: '#6b7280' },
};

const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
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
    <AdminLayout title="KiberOne — Уведомления">
      {error && <div className="alert alert-danger rounded-3">{error}</div>}
      {success && <div className="alert alert-success rounded-3">{success}</div>}

      {/* Header */}
      <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
        <div className="flex-grow-1">
          <div className="text-muted small">Напоминания и история событий</div>
          <h3 className="fw-semibold mb-0">Уведомления</h3>
        </div>
        <button
          type="button"
          className="btn btn-light border rounded-pill px-3 d-flex align-items-center gap-2"
          onClick={loadEvents}
          disabled={loading}
        >
          <IconRefresh width={16} height={16} />
          Обновить
        </button>
      </div>

      {/* Reminder card */}
      <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-body p-3">
          <div className="d-flex flex-wrap align-items-end gap-3">
            <div className="flex-grow-1" style={{ minWidth: 200 }}>
              <div className="fw-semibold mb-2">Напоминания об оплате</div>
              <label className="form-label text-muted small mb-1">Порог остатка занятий</label>
              <input
                type="number"
                className="form-control rounded-3"
                style={{ maxWidth: 160 }}
                value={threshold}
                min={0}
                onChange={(event) => setThreshold(event.target.value)}
                disabled={sending}
              />
              <div className="form-text small">Напоминание уйдёт всем с остатком &le; порога.</div>
            </div>
            <button
              type="button"
              className="btn btn-dark rounded-pill px-4 d-flex align-items-center gap-2"
              onClick={handleSendReminders}
              disabled={sending}
            >
              <IconBell width={16} height={16} />
              {sending ? 'Отправка...' : 'Отправить'}
            </button>
          </div>
        </div>
      </div>

      {/* Events list */}
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-0">
          <div className="px-3 py-2 border-bottom d-flex align-items-center justify-content-between">
            <div className="fw-semibold">История уведомлений</div>
            <div className="text-muted small">{events.length}</div>
          </div>
          {loading ? (
            <div className="p-4 text-center text-muted">Загрузка...</div>
          ) : events.length === 0 ? (
            <div className="p-4 text-center text-muted">Уведомлений пока нет.</div>
          ) : (
            <div className="list-group list-group-flush">
              {events.map((event) => {
                const evMeta = EVENT_META[event.event_type] || { label: event.event_type, bg: '#f1f3f5', color: '#374151' };
                const stMeta = STATUS_META[event.status] || { label: event.status, bg: '#f1f3f5', color: '#374151' };
                return (
                  <div key={event.id} className="list-group-item border-0 px-3 py-3">
                    <div className="d-flex flex-wrap align-items-start gap-3">
                      <div className="flex-grow-1" style={{ minWidth: 180 }}>
                        <div className="fw-semibold">{event.student_name || event.student}</div>
                        <div className="text-muted small">{event.parent_name || 'Родитель не указан'}</div>
                        {event.message ? (
                          <div className="text-muted small mt-1" style={{ maxWidth: 400 }}>{event.message}</div>
                        ) : null}
                      </div>
                      <div className="d-flex flex-wrap gap-2 align-items-center">
                        <span
                          className="badge rounded-pill"
                          style={{ background: evMeta.bg, color: evMeta.color, fontWeight: 500 }}
                        >
                          {evMeta.label}
                        </span>
                        <span
                          className="badge rounded-pill"
                          style={{ background: stMeta.bg, color: stMeta.color, fontWeight: 500 }}
                        >
                          {stMeta.label}
                        </span>
                      </div>
                      <div className="text-muted small" style={{ minWidth: 100 }}>
                        {formatDateTime(event.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};
