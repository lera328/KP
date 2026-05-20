import { useEffect, useState } from 'react';
import apiService from '../services/api';

/**
 * Блок «Подключить Telegram» для кабинета пользователя.
 * Показывает статус привязки, кнопку для генерации deep-link, отвязки и теста.
 */
export default function TelegramConnect() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [testResult, setTestResult] = useState('');
  const [busy, setBusy] = useState(false);

  const loadStatus = async () => {
    try {
      const data = await apiService.getTelegramStatus();
      setStatus(data);
    } catch (e) {
      setError(e.message || 'Не удалось получить статус');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleConnect = async () => {
    setBusy(true);
    setError('');
    setTestResult('');
    try {
      const data = await apiService.createTelegramLink();
      if (data?.deep_link) {
        setLink(data.deep_link);
        window.open(data.deep_link, '_blank', 'noopener');
      } else {
        setError('Сервер не вернул ссылку');
      }
    } catch (e) {
      setError(e.message || 'Ошибка при создании ссылки');
    } finally {
      setBusy(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Отвязать Telegram-аккаунт? Уведомления приходить не будут.')) return;
    setBusy(true);
    setError('');
    setTestResult('');
    try {
      await apiService.unlinkTelegram();
      setLink('');
      await loadStatus();
    } catch (e) {
      setError(e.message || 'Ошибка отвязки');
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setBusy(true);
    setError('');
    setTestResult('');
    try {
      const res = await apiService.sendTelegramTest();
      setTestResult(res?.ok ? '✅ Сообщение отправлено' : '❌ Не удалось отправить');
    } catch (e) {
      setError(e.message || 'Ошибка отправки');
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = async () => {
    setBusy(true);
    await loadStatus();
    setBusy(false);
  };

  if (loading) {
    return (
      <div className="card mb-3">
        <div className="card-body small text-muted">Загрузка статуса Telegram…</div>
      </div>
    );
  }

  return (
    <div className="card mb-3">
      <div className="card-body">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
          <div>
            <div className="fw-semibold">Telegram-уведомления</div>
            <div className="small text-muted">
              {status?.linked
                ? 'Аккаунт привязан — вы будете получать уведомления в Telegram.'
                : 'Подключите Telegram, чтобы получать пропуски, отработки и напоминания об оплате.'}
            </div>
          </div>
          <span className={`badge ${status?.linked ? 'bg-success' : 'bg-secondary'}`}>
            {status?.linked ? 'Привязан' : 'Не привязан'}
          </span>
        </div>

        {error ? <div className="alert alert-danger py-2 small mb-2">{error}</div> : null}
        {testResult ? <div className="alert alert-info py-2 small mb-2">{testResult}</div> : null}

        <div className="d-flex flex-wrap gap-2">
          {!status?.linked ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleConnect}
              disabled={busy}
            >
              {busy ? 'Минутку…' : 'Подключить Telegram'}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={handleTest}
                disabled={busy}
              >
                Отправить тестовое сообщение
              </button>
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={handleUnlink}
                disabled={busy}
              >
                Отвязать
              </button>
            </>
          )}
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={handleRefresh}
            disabled={busy}
            title="Обновить статус"
          >
            Обновить
          </button>
        </div>

        {link && !status?.linked ? (
          <div className="mt-2 small">
            <div className="text-muted">Если Telegram не открылся, перейдите по ссылке вручную:</div>
            <a href={link} target="_blank" rel="noopener noreferrer">{link}</a>
            <div className="text-muted mt-1">
              После нажатия Start в боте — обновите статус кнопкой выше.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
