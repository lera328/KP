import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AdminLayout } from './AdminLayout';
import { IconRefresh, IconCheck, IconClock, IconAlert } from './KidIcons';

const STATUS_META = {
  requested: { label: 'Запрошена', bg: '#fef3c7', color: '#b45309' },
  completed: { label: 'Проведена', bg: '#eff6ff', color: '#1d4ed8' },
  approved: { label: 'Подтверждена', bg: '#ecfdf5', color: '#16a34a' },
};

const STATUS_PILLS = [
  { value: 'all', label: 'Все' },
  { value: 'requested', label: 'Запрошены' },
  { value: 'completed', label: 'Проведены' },
  { value: 'approved', label: 'Подтверждены' },
];

const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export const AdminMakeups = () => {
  const [makeups, setMakeups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAssignModal, setShowAssignModal] = useState(false);

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
    if (!window.confirm('Подтвердить отработку?')) return;
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

  const handleReject = async (item) => {
    if (!window.confirm('Отменить заявку? Родитель сможет выбрать другой слот.')) return;
    setSavingId(item.id);
    setError('');
    setSuccess('');
    try {
      await api.rejectMakeup(item.id);
      setSuccess('Заявка отменена. Родитель может записаться заново.');
      await loadMakeups();
    } catch (saveError) {
      setError(saveError.message || 'Не удалось отменить заявку.');
    } finally {
      setSavingId(null);
    }
  };

  const counts = useMemo(() => ({
    all: makeups.length,
    requested: makeups.filter((m) => m.status === 'requested').length,
    completed: makeups.filter((m) => m.status === 'completed').length,
    approved: makeups.filter((m) => m.status === 'approved').length,
  }), [makeups]);

  return (
    <AdminLayout title="KiberOne — Отработки">
      {error && <div className="alert alert-danger rounded-3">{error}</div>}
      {success && <div className="alert alert-success rounded-3">{success}</div>}

      {/* Шапка */}
      <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
        <div className="flex-grow-1">
          <div className="text-muted small">Заявки на отработки и подтверждение</div>
          <h3 className="fw-semibold mb-0">Отработки</h3>
        </div>
        <button
          type="button"
          className="btn btn-dark rounded-pill px-3 d-flex align-items-center gap-2"
          onClick={() => setShowAssignModal(true)}
        >
          + Назначить отработку
        </button>
        <button
          type="button"
          className="btn btn-light border rounded-pill px-3 d-flex align-items-center gap-2"
          onClick={loadMakeups}
          disabled={loading}
        >
          <IconRefresh width={16} height={16} />
          Обновить
        </button>
      </div>

      {/* Фильтры */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-3 d-flex flex-wrap gap-2">
          {STATUS_PILLS.map((pill) => {
            const active = statusFilter === pill.value;
            return (
              <button
                type="button"
                key={pill.value}
                className="btn btn-sm rounded-pill px-3 d-flex align-items-center gap-1"
                style={{
                  background: active ? '#111827' : '#f1f3f5',
                  color: active ? '#fff' : '#374151',
                  border: 'none',
                }}
                onClick={() => setStatusFilter(pill.value)}
                disabled={loading}
              >
                {pill.label}
                <span
                  className="badge rounded-pill ms-1"
                  style={{
                    background: active ? 'rgba(255,255,255,0.2)' : '#e5e7eb',
                    color: active ? '#fff' : '#374151',
                    fontSize: 11,
                  }}
                >
                  {counts[pill.value] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Список */}
      {loading ? (
        <div className="text-muted py-4 text-center">Загрузка...</div>
      ) : filteredMakeups.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-4 text-center text-muted">Заявок не найдено.</div>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {filteredMakeups.map((item) => {
            const meta = STATUS_META[item.status] || { label: item.status, bg: '#f1f3f5', color: '#374151' };
            const isBusy = savingId === item.id;
            return (
              <div key={item.id} className="card border-0 shadow-sm rounded-4">
                <div className="card-body p-3">
                  <div className="d-flex flex-wrap align-items-start gap-3">
                    {/* Ученик + родители */}
                    <div className="flex-grow-1" style={{ minWidth: 200 }}>
                      <div className="fw-semibold">{item.student_name || `ID ${item.student_id}`}</div>
                      {Array.isArray(item.parent_contacts) && item.parent_contacts.length > 0 ? (
                        <div className="mt-1">
                          {item.parent_contacts.map((parent) => (
                            <div key={parent.id} className="text-muted small">
                              {parent.name}
                              {parent.phone ? (
                                <> · <a href={`tel:${parent.phone}`} className="text-decoration-none">{parent.phone}</a></>
                              ) : null}
                              {parent.email ? ` · ${parent.email}` : ''}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted small">нет родителей</div>
                      )}
                    </div>

                    {/* Пропуск + слот */}
                    <div style={{ minWidth: 180 }}>
                      <div className="text-muted small">
                        <IconClock width={12} height={12} className="me-1" />
                        Пропуск: {item.absence_starts_at ? formatDateTime(item.absence_starts_at) : '—'}
                        {item.absence_group_name ? ` · ${item.absence_group_name}` : ''}
                      </div>
                      <div className="text-muted small mt-1">
                        <IconClock width={12} height={12} className="me-1" />
                        Слот: {item.makeup_starts_at ? formatDateTime(item.makeup_starts_at) : '—'}
                        {item.makeup_group_name ? ` · ${item.makeup_group_name}` : ''}
                      </div>
                      <div className="text-muted small mt-1">Создано: {formatDateTime(item.created_at)}</div>
                    </div>

                    {/* Статус + действия */}
                    <div className="d-flex flex-column align-items-end gap-2" style={{ minWidth: 160 }}>
                      <span
                        className="badge rounded-pill"
                        style={{ background: meta.bg, color: meta.color, fontWeight: 500 }}
                      >
                        {meta.label}
                      </span>
                      <div className="d-flex gap-2">
                        {item.status !== 'approved' && (
                          <button
                            type="button"
                            className="btn btn-sm rounded-pill px-3 d-flex align-items-center gap-1"
                            style={{ background: '#ecfdf5', color: '#16a34a', border: 'none' }}
                            onClick={() => handleApprove(item)}
                            disabled={isBusy}
                          >
                            <IconCheck width={14} height={14} />
                            {isBusy ? '...' : 'Подтвердить'}
                          </button>
                        )}
                        {item.status !== 'approved' && (
                          <button
                            type="button"
                            className="btn btn-sm rounded-pill px-3 d-flex align-items-center gap-1"
                            style={{ background: '#fef2f2', color: '#dc2626', border: 'none' }}
                            onClick={() => handleReject(item)}
                            disabled={isBusy}
                          >
                            <IconAlert width={14} height={14} />
                            {isBusy ? '...' : 'Отменить'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAssignModal && (
        <AssignMakeupModal
          onClose={() => setShowAssignModal(false)}
          onAssigned={async () => {
            setShowAssignModal(false);
            setSuccess('Отработка назначена.');
            await loadMakeups();
            setTimeout(() => setSuccess(''), 4000);
          }}
        />
      )}
    </AdminLayout>
  );
};

const AssignMakeupModal = ({ onClose, onAssigned }) => {
  const [absenceRecordId, setAbsenceRecordId] = useState('');
  const [makeupLessonId, setMakeupLessonId] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!absenceRecordId || !makeupLessonId) {
      setErr('Заполните оба поля.');
      return;
    }
    setSaving(true);
    try {
      await api.adminAssignMakeup({
        absence_record_id: Number(absenceRecordId),
        makeup_lesson_id: Number(makeupLessonId),
      });
      onAssigned();
    } catch (saveError) {
      setErr(saveError.message || 'Не удалось назначить отработку.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content rounded-4 border-0 shadow-lg">
          <div className="modal-header border-0">
            <h5 className="modal-title fw-semibold">Назначить отработку</h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={saving} />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body pt-0">
              {err && <div className="alert alert-danger rounded-3 small">{err}</div>}
              <div className="rounded-3 p-3 mb-3 small" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                Укажите ID записи посещаемости (пропуска) и ID слота отработки. Ограничение «3 последних занятия» для администратора не действует.
              </div>
              <div className="mb-3">
                <label className="form-label small fw-semibold">ID пропуска (absence_record_id)</label>
                <input
                  className="form-control rounded-3"
                  type="number"
                  value={absenceRecordId}
                  onChange={(e) => setAbsenceRecordId(e.target.value)}
                  required
                  placeholder="Например: 42"
                  disabled={saving}
                />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-semibold">ID слота отработки (makeup_lesson_id)</label>
                <input
                  className="form-control rounded-3"
                  type="number"
                  value={makeupLessonId}
                  onChange={(e) => setMakeupLessonId(e.target.value)}
                  required
                  placeholder="Например: 108"
                  disabled={saving}
                />
              </div>
            </div>
            <div className="modal-footer border-0">
              <button type="button" className="btn btn-light border rounded-pill px-4" onClick={onClose} disabled={saving}>
                Отмена
              </button>
              <button type="submit" className="btn btn-dark rounded-pill px-4" disabled={saving || !absenceRecordId || !makeupLessonId}>
                {saving ? 'Назначаем...' : 'Назначить'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
