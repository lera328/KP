import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const formatDateTime = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ru-RU');
  } catch {
    return value;
  }
};

const STATE_MESSAGES = {
  used: 'Это приглашение уже использовано — отработка подтверждена ранее.',
  expired: 'Срок действия приглашения истёк. Обратитесь к администратору KiberOne.',
};

export default function MakeupConfirm() {
  const { token } = useParams();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/attendance/makeups/invites/${token}/`);
        if (!res.ok) {
          if (cancelled) return;
          setError(res.status === 404 ? 'Приглашение не найдено' : 'Не удалось загрузить приглашение');
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setDetails(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Ошибка сети');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [token]);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/attendance/makeups/invites/${token}/accept/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = data.detail || 'error';
        if (code === 'already-used') {
          setDetails((d) => (d ? { ...d, state: 'used' } : d));
          setConfirmed(true);
        } else if (code === 'expired') {
          setDetails((d) => (d ? { ...d, state: 'expired' } : d));
        } else {
          setError('Не удалось подтвердить отработку');
        }
        return;
      }
      setConfirmed(true);
    } catch (err) {
      setError(err.message || 'Ошибка сети');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <div className="text-center mb-4">
        <h2 className="fw-semibold">KiberOne</h2>
        <div className="text-muted">Подтверждение отработки пропуска</div>
      </div>

      {loading && (
        <div className="card"><div className="card-body text-muted">Загрузка…</div></div>
      )}

      {!loading && error && (
        <div className="alert alert-danger">{error}</div>
      )}

      {!loading && details && (
        <div className="card shadow-sm">
          <div className="card-body">
            {confirmed && (
              <div className="alert alert-success mb-3">
                Спасибо! Отработка подтверждена. Преподаватель ждёт ученика на занятии.
              </div>
            )}

            {!confirmed && details.state !== 'active' && (
              <div className="alert alert-warning mb-3">
                {STATE_MESSAGES[details.state] || 'Приглашение недоступно.'}
              </div>
            )}

            <h5 className="mb-3">Ученик: {details.student_name}</h5>

            <div className="mb-3">
              <div className="text-muted small">Пропущено занятие</div>
              <div>{details.missed_topic}</div>
              <div className="small text-muted">
                {formatDateTime(details.missed_starts_at)} · группа «{details.missed_group}»
              </div>
            </div>

            <div className="mb-4">
              <div className="text-muted small">Предлагаемая отработка</div>
              <div className="fw-semibold">{formatDateTime(details.makeup_starts_at)}</div>
              <div>
                Группа «{details.makeup_group}», преподаватель {details.makeup_teacher}
              </div>
              <div className="small text-muted">Тема: {details.makeup_topic}</div>
            </div>

            {details.state === 'active' && !confirmed && (
              <button
                className="btn btn-primary w-100"
                onClick={handleConfirm}
                disabled={submitting}
              >
                {submitting ? 'Подтверждаем…' : 'Подтвердить отработку'}
              </button>
            )}

            <div className="text-center small text-muted mt-3">
              Действительно до {formatDateTime(details.expires_at)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
