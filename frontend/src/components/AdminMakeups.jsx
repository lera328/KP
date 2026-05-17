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
    <AdminLayout title="КиберШкола — Отработки">
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

const fmtDt = (v) => {
  if (!v) return '—';
  return new Date(v).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const fmtTime = (v) =>
  new Date(v).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

const fmtDateHeader = (v) =>
  new Date(v).toLocaleDateString('ru-RU', { weekday: 'long', day: '2-digit', month: 'long' });

const slotDateKey = (v) => {
  const d = new Date(v);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const AssignMakeupModal = ({ onClose, onAssigned }) => {
  const [absences, setAbsences] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedAbsence, setSelectedAbsence] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');

  useEffect(() => {
    (async () => {
      setLoadingData(true);
      try {
        const data = await api.getAdminAbsencesAndSlots();
        setAbsences(Array.isArray(data?.absences) ? data.absences : []);
        setSlots(Array.isArray(data?.slots) ? data.slots : []);
      } catch (e) {
        setErr(e.message || 'Не удалось загрузить данные.');
      } finally {
        setLoadingData(false);
      }
    })();
  }, []);

  const filteredAbsences = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return absences;
    return absences.filter(
      (a) =>
        (a.student_name || '').toLowerCase().includes(q) ||
        (a.group_name || '').toLowerCase().includes(q),
    );
  }, [absences, searchQuery]);

  const slotLocations = useMemo(() => {
    const map = new Map();
    for (const s of slots) {
      if (s.location_name && !map.has(s.location_name)) {
        map.set(s.location_name, s.location_name);
      }
    }
    return Array.from(map.keys());
  }, [slots]);

  const filteredSlots = useMemo(() => {
    if (locationFilter === 'all') return slots;
    return slots.filter((s) => s.location_name === locationFilter);
  }, [slots, locationFilter]);

  const groupedSlots = useMemo(() => {
    const map = new Map();
    for (const s of filteredSlots) {
      const k = slotDateKey(s.starts_at);
      const arr = map.get(k) || [];
      arr.push(s);
      map.set(k, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, daySlots]) => ({
        key,
        label: fmtDateHeader(daySlots[0].starts_at),
        slots: daySlots,
      }));
  }, [filteredSlots]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!selectedAbsence || !selectedSlot) {
      setErr('Выберите пропуск и слот.');
      return;
    }
    setSaving(true);
    try {
      await api.adminAssignMakeup({
        absence_record_id: Number(selectedAbsence),
        makeup_lesson_id: Number(selectedSlot),
      });
      onAssigned();
    } catch (saveError) {
      setErr(saveError.message || 'Не удалось назначить отработку.');
    } finally {
      setSaving(false);
    }
  };

  const selectedAbsenceObj = absences.find((a) => String(a.id) === String(selectedAbsence));

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content rounded-4 border-0 shadow-lg">
          <div className="modal-header border-0">
            <div>
              <h5 className="modal-title fw-semibold">Назначить отработку</h5>
              {selectedAbsenceObj && (
                <div className="text-muted small">
                  {selectedAbsenceObj.student_name} — {selectedAbsenceObj.group_name} ({fmtDt(selectedAbsenceObj.lesson_starts_at)})
                </div>
              )}
            </div>
            <button type="button" className="btn-close" onClick={onClose} disabled={saving} />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body pt-0" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {err && <div className="alert alert-danger rounded-3 small">{err}</div>}
              <div className="rounded-3 p-3 mb-3 small" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                Выберите ученика с пропуском и свободный слот отработки. Ограничение «3 последних занятия» для администратора не действует.
              </div>

              {loadingData ? (
                <div className="text-muted text-center py-3">Загрузка данных...</div>
              ) : (
                <>
                  {/* ─── Шаг 1: выбор пропуска с поиском ─── */}
                  <div className="mb-4">
                    <label className="form-label small fw-semibold">1. Ученик с пропуском</label>
                    {absences.length === 0 ? (
                      <div className="text-muted small">Нет пропусков без активной заявки.</div>
                    ) : (
                      <>
                        <input
                          type="text"
                          className="form-control rounded-3 mb-2"
                          placeholder="Поиск по ФИО или группе..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          disabled={saving}
                        />
                        <div
                          className="d-flex flex-column gap-1 border rounded-3 p-2"
                          style={{ maxHeight: 200, overflowY: 'auto' }}
                        >
                          {filteredAbsences.length === 0 ? (
                            <div className="text-muted small text-center py-2">Ничего не найдено</div>
                          ) : (
                            filteredAbsences.map((a) => {
                              const active = String(selectedAbsence) === String(a.id);
                              return (
                                <button
                                  key={a.id}
                                  type="button"
                                  className="btn btn-sm text-start rounded-3 d-flex justify-content-between align-items-center"
                                  style={{
                                    background: active ? '#111827' : '#f8f9fb',
                                    color: active ? '#fff' : '#374151',
                                    border: active ? '1.5px solid #111827' : '1px solid #e5e7eb',
                                    fontWeight: active ? 600 : 400,
                                  }}
                                  onClick={() => setSelectedAbsence(String(a.id))}
                                  disabled={saving}
                                >
                                  <span>
                                    <span className="fw-semibold">{a.student_name}</span>
                                    <span className="text-muted ms-2" style={{ fontSize: '0.78rem', color: active ? 'rgba(255,255,255,0.7)' : undefined }}>
                                      {a.group_name}{a.lesson_topic ? ` · ${a.lesson_topic}` : ''}
                                    </span>
                                  </span>
                                  <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{fmtDt(a.lesson_starts_at)}</span>
                                </button>
                              );
                            })
                          )}
                        </div>
                        <div className="text-muted small mt-1">
                          Найдено: {filteredAbsences.length} из {absences.length}
                        </div>
                      </>
                    )}
                  </div>

                  {/* ─── Шаг 2: выбор слота (карточки по дням) ─── */}
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">2. Слот отработки</label>
                    {slots.length === 0 ? (
                      <div className="text-muted small">Нет свободных слотов.</div>
                    ) : (
                      <>
                        {/* Фильтр по локации */}
                        {slotLocations.length > 1 && (
                          <div className="d-flex flex-wrap gap-2 mb-3">
                            <button
                              type="button"
                              className="btn btn-sm rounded-pill px-3"
                              style={{
                                background: locationFilter === 'all' ? '#111827' : '#f1f3f5',
                                color: locationFilter === 'all' ? '#fff' : '#374151',
                                border: 'none',
                              }}
                              onClick={() => setLocationFilter('all')}
                            >
                              Все локации
                            </button>
                            {slotLocations.map((loc) => (
                              <button
                                key={loc}
                                type="button"
                                className="btn btn-sm rounded-pill px-3"
                                style={{
                                  background: locationFilter === loc ? '#111827' : '#f1f3f5',
                                  color: locationFilter === loc ? '#fff' : '#374151',
                                  border: 'none',
                                }}
                                onClick={() => setLocationFilter(loc)}
                              >
                                {loc}
                              </button>
                            ))}
                          </div>
                        )}

                        {filteredSlots.length === 0 ? (
                          <div className="text-muted small">Нет слотов в выбранной локации.</div>
                        ) : (
                          <div className="d-flex flex-column gap-3">
                            {groupedSlots.map((day) => (
                              <div key={day.key}>
                                <div className="fw-semibold text-capitalize mb-2 border-bottom pb-1" style={{ fontSize: '0.85rem' }}>
                                  {day.label}
                                </div>
                                <div className="d-flex flex-wrap gap-2">
                                  {day.slots.map((s) => {
                                    const active = String(selectedSlot) === String(s.id);
                                    const free = s.capacity - s.booked;
                                    return (
                                      <button
                                        key={s.id}
                                        type="button"
                                        className="btn text-start rounded-3"
                                        style={{
                                          minWidth: 160,
                                          background: active ? '#111827' : '#f8f9fb',
                                          color: active ? '#fff' : '#374151',
                                          border: active ? '2px solid #111827' : '1.5px solid #e5e7eb',
                                          transition: 'all 0.15s',
                                        }}
                                        onClick={() => setSelectedSlot(String(s.id))}
                                        disabled={saving}
                                      >
                                        <div className="fw-bold">{fmtTime(s.starts_at)}</div>
                                        <div className="small" style={{ opacity: 0.8 }}>{s.location_name || '—'}</div>
                                        <div className="small" style={{ opacity: 0.7 }}>{s.teacher_name}</div>
                                        <div className="small" style={{ opacity: 0.6 }}>
                                          Свободно мест: {free}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer border-0">
              <button type="button" className="btn btn-light border rounded-pill px-4" onClick={onClose} disabled={saving}>
                Отмена
              </button>
              <button type="submit" className="btn btn-dark rounded-pill px-4" disabled={saving || !selectedAbsence || !selectedSlot || loadingData}>
                {saving ? 'Назначаем...' : 'Назначить'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
