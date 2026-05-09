import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AppLayout, parentNavItems } from './AppLayout';

const STATUS_LABELS = {
  present: 'Присутствовал',
  absent: 'Пропуск',
  makeup: 'Отработка',
};

const MAKEUP_STATUS_LABELS = {
  requested: 'Запрошена',
  completed: 'Проведена',
  approved: 'Подтверждена администратором',
};

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('ru-RU');
};

export const ParentAttendance = () => {
  const [children, setChildren] = useState([]);
  const [records, setRecords] = useState([]);
  const [makeups, setMakeups] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [suggestions, setSuggestions] = useState({});
  const [suggestionLoading, setSuggestionLoading] = useState({});
  const [accepting, setAccepting] = useState({});

  const loadAttendance = async (studentId = '') => {
    setLoading(true);
    setError('');
    try {
      const [childrenData, attendanceData, makeupData] = await Promise.all([
        api.getParentChildren(),
        api.getParentAttendance(studentId),
        api.getParentMakeups(),
      ]);
      setChildren(Array.isArray(childrenData) ? childrenData : []);
      setRecords(Array.isArray(attendanceData) ? attendanceData : []);
      setMakeups(Array.isArray(makeupData) ? makeupData : []);
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить посещаемость.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, []);

  const childMap = useMemo(() => new Map(children.map((child) => [child.id, child])), [children]);

  const filteredMakeups = useMemo(() => {
    if (!selectedStudent) return makeups;
    return makeups.filter((item) => String(item.student_id) === String(selectedStudent));
  }, [makeups, selectedStudent]);

  const handleFilterChange = (value) => {
    setSelectedStudent(value);
    loadAttendance(value);
  };

  const makeupAbsenceIds = useMemo(
    () => new Set(makeups.map((item) => Number(item.absence_record_id)).filter(Boolean)),
    [makeups],
  );

  const handleSuggestSlots = async (recordId) => {
    setSuggestionLoading((prev) => ({ ...prev, [recordId]: true }));
    setError('');
    setSuccess('');
    try {
      const data = await api.suggestMakeupSlots(recordId);
      setSuggestions((prev) => ({ ...prev, [recordId]: data?.slots || [] }));
    } catch (suggestError) {
      setError(suggestError.message || 'Не удалось подобрать слоты.');
    } finally {
      setSuggestionLoading((prev) => ({ ...prev, [recordId]: false }));
    }
  };

  const handleAcceptSlot = async (recordId, lessonId) => {
    const key = `${recordId}:${lessonId}`;
    setAccepting((prev) => ({ ...prev, [key]: true }));
    setError('');
    setSuccess('');
    try {
      await api.requestMakeup({
        absence_record_id: Number(recordId),
        makeup_lesson_id: Number(lessonId),
      });
      setSuccess('Заявка на отработку отправлена.');
      setSuggestions((prev) => {
        const next = { ...prev };
        delete next[recordId];
        return next;
      });
      await loadAttendance(selectedStudent);
    } catch (acceptError) {
      setError(acceptError.message || 'Не удалось отправить заявку на отработку.');
    } finally {
      setAccepting((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <AppLayout title="KiberOne — Родитель" navItems={parentNavItems}>
      <div>
        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <strong>Записи посещаемости</strong>
            <div className="d-flex gap-2">
              <select
                className="form-select form-select-sm"
                value={selectedStudent}
                onChange={(event) => handleFilterChange(event.target.value)}
                disabled={loading}
              >
                <option value="">Все дети</option>
                {children.map((child) => {
                  const name = `${child.first_name || ''} ${child.last_name || ''}`.trim() || child.username;
                  return (
                    <option key={child.id} value={child.id}>
                      {name}
                    </option>
                  );
                })}
              </select>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => loadAttendance(selectedStudent)} disabled={loading}>
                Обновить
              </button>
            </div>
          </div>
          <div className="card-body p-0">
            {loading ? (
              <div className="p-3">Загрузка...</div>
            ) : records.length === 0 ? (
              <div className="p-3 text-muted">Записи посещаемости пока отсутствуют.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Ребёнок</th>
                      <th>Группа / тема</th>
                      <th>Статус</th>
                      <th>Оценка</th>
                      <th>ДЗ / комментарий</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => {
                      const child = childMap.get(record.student_id);
                      const childName = child
                        ? `${child.first_name || ''} ${child.last_name || ''}`.trim() || child.username
                        : record.student_name;

                      return (
                        <tr key={record.id}>
                          <td>{formatDateTime(record.lesson_starts_at)}</td>
                          <td>{childName || '-'}</td>
                          <td>
                            <div>{record.group_name || '-'}</div>
                            {record.lesson_topic && (
                              <small className="text-muted">{record.lesson_topic}</small>
                            )}
                          </td>
                          <td>
                            {STATUS_LABELS[record.status] || record.status}
                            {record.status === 'absent' && (
                              <div className="mt-2">
                                {makeupAbsenceIds.has(Number(record.id)) ? (
                                  <span className="badge text-bg-info">Отработка запрошена</span>
                                ) : suggestions[record.id] === undefined ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => handleSuggestSlots(record.id)}
                                    disabled={Boolean(suggestionLoading[record.id])}
                                  >
                                    {suggestionLoading[record.id] ? 'Подбираем…' : 'Подобрать слот'}
                                  </button>
                                ) : suggestions[record.id].length === 0 ? (
                                  <small className="text-muted d-block">Подходящих слотов нет</small>
                                ) : (
                                  <div className="d-flex flex-column gap-1">
                                    {suggestions[record.id].map((slot) => {
                                      const acceptKey = `${record.id}:${slot.lesson_id}`;
                                      return (
                                        <button
                                          key={slot.lesson_id}
                                          type="button"
                                          className="btn btn-sm btn-success text-start"
                                          onClick={() => handleAcceptSlot(record.id, slot.lesson_id)}
                                          disabled={Boolean(accepting[acceptKey])}
                                        >
                                          {accepting[acceptKey] ? 'Отправляем…' : `Принять: ${formatDateTime(slot.starts_at)}`}
                                          <br />
                                          <small>{slot.group_name} · {slot.teacher_name}</small>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td>{record.grade != null ? record.grade : '—'}</td>
                          <td style={{ minWidth: '220px' }}>
                            {record.homework && (
                              <div><strong>ДЗ:</strong> {record.homework}</div>
                            )}
                            {record.teacher_comment && (
                              <div className="text-muted small">{record.teacher_comment}</div>
                            )}
                            {!record.homework && !record.teacher_comment && '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="card mt-4">
          <div className="card-header d-flex justify-content-between align-items-center">
            <strong>Отработки</strong>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => loadAttendance(selectedStudent)} disabled={loading}>
              Обновить
            </button>
          </div>
          <div className="card-body p-0">
            {loading ? (
              <div className="p-3">Загрузка...</div>
            ) : filteredMakeups.length === 0 ? (
              <div className="p-3 text-muted">Заявок на отработки пока нет.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Ребёнок</th>
                      <th>Пропуск</th>
                      <th>Слот</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMakeups.map((item) => {
                      const child = childMap.get(item.student_id);
                      const childName = child
                        ? `${child.first_name || ''} ${child.last_name || ''}`.trim() || child.username
                        : item.student_name;

                      return (
                        <tr key={item.id}>
                          <td>{childName || '-'}</td>
                          <td>
                            {item.absence_starts_at ? formatDateTime(item.absence_starts_at) : '-'}
                            {item.absence_group_name ? ` · ${item.absence_group_name}` : ''}
                          </td>
                          <td>
                            {item.makeup_starts_at ? formatDateTime(item.makeup_starts_at) : '-'}
                            {item.makeup_group_name ? ` · ${item.makeup_group_name}` : ''}
                          </td>
                          <td>{MAKEUP_STATUS_LABELS[item.status] || item.status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};
