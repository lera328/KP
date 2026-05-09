import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AdminLayout } from './AdminLayout';

const STATUS_LABELS = {
  requested: 'Запрошена',
  completed: 'Проведена',
  approved: 'Подтверждена администратором',
};

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('ru-RU');
};

export const AdminMakeups = () => {
  const [makeups, setMakeups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadMakeups = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAdminMakeups();
      setMakeups(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить отработки.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMakeups();
  }, []);

  const filteredMakeups = useMemo(() => {
    if (statusFilter === 'all') return makeups;
    return makeups.filter((item) => item.status === statusFilter);
  }, [makeups, statusFilter]);

  const handleApprove = async (item) => {
    const confirmed = window.confirm('Подтвердить отработку?');
    if (!confirmed) return;

    setSavingId(item.id);
    setError('');
    setSuccess('');
    try {
      await api.approveMakeup(item.id, {});
      setSuccess('Отработка подтверждена.');
      await loadMakeups();
    } catch (saveError) {
      setError(saveError.message || 'Не удалось подтвердить отработку.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <AdminLayout title="Админ — Отработки">
      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
          <strong>Заявки на отработки</strong>
          <div className="d-flex gap-2">
            <select
              className="form-select form-select-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              disabled={loading}
            >
              <option value="all">Все статусы</option>
              <option value="requested">Запрошены</option>
              <option value="completed">Проведены</option>
              <option value="approved">Подтверждены</option>
            </select>
            <button className="btn btn-outline-secondary btn-sm" onClick={loadMakeups} disabled={loading}>
              Обновить
            </button>
          </div>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="p-3">Загрузка...</div>
          ) : filteredMakeups.length === 0 ? (
            <div className="p-3 text-muted">Заявок пока нет.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-hover mb-0">
                <thead>
                  <tr>
                    <th>Ученик</th>
                    <th>Пропуск</th>
                    <th>Слот</th>
                    <th>Статус</th>
                    <th>Создано</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMakeups.map((item) => (
                    <tr key={item.id}>
                      <td>{item.student_name || `ID ${item.student_id}`}</td>
                      <td>
                        {item.absence_starts_at ? formatDateTime(item.absence_starts_at) : '-'}
                        {item.absence_group_name ? ` · ${item.absence_group_name}` : ''}
                      </td>
                      <td>
                        {item.makeup_starts_at ? formatDateTime(item.makeup_starts_at) : '-'}
                        {item.makeup_group_name ? ` · ${item.makeup_group_name}` : ''}
                      </td>
                      <td>{STATUS_LABELS[item.status] || item.status}</td>
                      <td>{item.created_at ? formatDateTime(item.created_at) : '-'}</td>
                      <td className="text-end">
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleApprove(item)}
                          disabled={savingId === item.id || item.status !== 'completed'}
                        >
                          Подтвердить
                        </button>
                      </td>
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
