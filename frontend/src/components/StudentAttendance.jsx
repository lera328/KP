import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AppLayout, studentNavItems } from './AppLayout';

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

const formatTimeToNextLesson = (startsAt) => {
  if (!startsAt) return '';

  const now = new Date();
  const target = new Date(startsAt);
  const diffMs = target - now;

  if (diffMs <= 0) {
    return '0 дней';
  }

  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return `${days} дней`;
};

export const StudentAttendance = () => {
  const [records, setRecords] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [makeups, setMakeups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [requestForm, setRequestForm] = useState({
    absenceId: '',
    makeupLessonId: '',
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const [attendanceData, lessonsData, makeupData] = await Promise.all([
        api.getMyAttendance(),
        api.getLessons(),
        api.getMyMakeups(),
      ]);
      setRecords(Array.isArray(attendanceData) ? attendanceData : []);
      setLessons(Array.isArray(lessonsData) ? lessonsData : []);
      setMakeups(Array.isArray(makeupData) ? makeupData : []);
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить посещаемость.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const upcomingLessons = useMemo(() => {
    const now = new Date();
    return lessons
      .filter((lesson) => lesson.starts_at && new Date(lesson.starts_at) >= now)
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
      .slice(0, 10);
  }, [lessons]);

  const nextLesson = upcomingLessons.length > 0 ? upcomingLessons[0] : null;

  const lessonsById = useMemo(() => new Map(lessons.map((lesson) => [lesson.id, lesson])), [lessons]);

  const absenceRecords = useMemo(() => records.filter((record) => record.status === 'absent'), [records]);

  const makeupsByAbsence = useMemo(() => {
    const map = new Map();
    makeups.forEach((item) => {
      if (item.absence_record_id) {
        map.set(item.absence_record_id, item);
      }
    });
    return map;
  }, [makeups]);

  const availableMakeupLessons = useMemo(() => {
    if (!requestForm.absenceId) return [];
    const absenceRecord = records.find((record) => String(record.id) === String(requestForm.absenceId));
    if (!absenceRecord) return [];
    const absenceLesson = lessonsById.get(absenceRecord.lesson_id);
    if (!absenceLesson) return [];

    const topicId = absenceLesson.topic;
    const now = new Date();

    return lessons
      .filter((lesson) => {
        if (!lesson.is_makeup_slot || !lesson.starts_at) return false;
        if (lesson.topic !== topicId) return false;
        return new Date(lesson.starts_at) >= now;
      })
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }, [requestForm.absenceId, records, lessons, lessonsById]);

  const handleRequestChange = (field, value) => {
    setRequestForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'absenceId' ? { makeupLessonId: '' } : null),
    }));
  };

  const handleRequestMakeup = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!requestForm.absenceId || !requestForm.makeupLessonId) {
      setError('Выберите пропуск и слот отработки.');
      return;
    }

    try {
      await api.requestMakeup({
        absence_record_id: Number(requestForm.absenceId),
        makeup_lesson_id: Number(requestForm.makeupLessonId),
      });
      setSuccess('Заявка на отработку отправлена.');
      setRequestForm({ absenceId: '', makeupLessonId: '' });
      await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось отправить заявку на отработку.');
    }
  };

  return (
    <AppLayout title="KiberOne — Ученик" navItems={studentNavItems}>
      <div>
        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="row g-4">
          <div className="col-lg-7">
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <strong>Моя посещаемость</strong>
                <button className="btn btn-outline-secondary btn-sm" onClick={loadData} disabled={loading}>
                  Обновить
                </button>
              </div>
              <div className="card-body p-0">
                {loading ? (
                  <div className="p-3">Загрузка...</div>
                ) : records.length === 0 ? (
                  <div className="p-3 text-muted">Записей посещаемости пока нет.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-striped table-hover mb-0">
                      <thead>
                        <tr>
                          <th>Дата</th>
                          <th>Группа / тема</th>
                          <th>Статус</th>
                          <th>Оценка</th>
                          <th>ДЗ / комментарий</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => (
                          <tr key={record.id}>
                            <td>{formatDateTime(record.lesson_starts_at)}</td>
                            <td>
                              <div>{record.group_name || '-'}</div>
                              {record.lesson_topic && (
                                <small className="text-muted">{record.lesson_topic}</small>
                              )}
                            </td>
                            <td>{STATUS_LABELS[record.status] || record.status}</td>
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-lg-5">
            <div className="card">
              <div className="card-header">
                <strong>Ближайшие занятия</strong>
              </div>
              <div className="card-body p-0">
                {nextLesson && !loading && (
                  <div className="alert alert-info m-3 mb-0 py-2">
                    Следующее занятие через: <strong>{formatTimeToNextLesson(nextLesson.starts_at)}</strong>
                  </div>
                )}
                {loading ? (
                  <div className="p-3">Загрузка...</div>
                ) : upcomingLessons.length === 0 ? (
                  <div className="p-3 text-muted">Ближайших занятий пока нет.</div>
                ) : (
                  <ul className="list-group list-group-flush">
                    {upcomingLessons.map((lesson) => (
                      <li key={lesson.id} className="list-group-item d-flex justify-content-between align-items-start">
                        <div>
                          <div className="fw-semibold">{formatDateTime(lesson.starts_at)}</div>
                          <small className="text-muted">Занятие #{lesson.id}</small>
                        </div>
                        <span className={`badge ${lesson.is_extra ? 'text-bg-warning' : 'text-bg-secondary'}`}>
                          {lesson.is_extra ? 'Разовое' : 'Регулярное'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="card mt-4">
              <div className="card-header">
                <strong>Запросить отработку</strong>
              </div>
              <div className="card-body">
                {absenceRecords.length === 0 ? (
                  <div className="text-muted">Пропусков для отработки нет.</div>
                ) : (
                  <form onSubmit={handleRequestMakeup}>
                    <div className="mb-3">
                      <label className="form-label">Пропуск</label>
                      <select
                        className="form-select"
                        value={requestForm.absenceId}
                        onChange={(event) => handleRequestChange('absenceId', event.target.value)}
                        disabled={loading}
                      >
                        <option value="">Выберите пропуск</option>
                        {absenceRecords.map((record) => {
                          const lesson = lessonsById.get(record.lesson_id);
                          const lessonDate = record.lesson_starts_at ? formatDateTime(record.lesson_starts_at) : '-';
                          const lessonGroup = lesson?.group || record.group_name || '';
                          const isRequested = makeupsByAbsence.has(record.id);

                          return (
                            <option key={record.id} value={record.id} disabled={isRequested}>
                              {lessonDate} — {lessonGroup || 'Группа'}{isRequested ? ' (уже есть заявка)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Слот отработки</label>
                      <select
                        className="form-select"
                        value={requestForm.makeupLessonId}
                        onChange={(event) => handleRequestChange('makeupLessonId', event.target.value)}
                        disabled={loading || !requestForm.absenceId}
                      >
                        <option value="">Выберите слот</option>
                        {availableMakeupLessons.map((lesson) => (
                          <option key={lesson.id} value={lesson.id}>
                            {formatDateTime(lesson.starts_at)} — группа #{lesson.group}
                          </option>
                        ))}
                      </select>
                      {requestForm.absenceId && availableMakeupLessons.length === 0 && (
                        <div className="text-muted small mt-2">
                          Подходящих слотов пока нет.
                        </div>
                      )}
                    </div>

                    <button className="btn btn-primary" type="submit" disabled={loading}>
                      Отправить заявку
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="card mt-4">
          <div className="card-header d-flex justify-content-between align-items-center">
            <strong>Мои отработки</strong>
            <button className="btn btn-outline-secondary btn-sm" onClick={loadData} disabled={loading}>
              Обновить
            </button>
          </div>
          <div className="card-body p-0">
            {loading ? (
              <div className="p-3">Загрузка...</div>
            ) : makeups.length === 0 ? (
              <div className="p-3 text-muted">Заявок на отработки пока нет.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Пропуск</th>
                      <th>Слот</th>
                      <th>Статус</th>
                      <th>Создано</th>
                    </tr>
                  </thead>
                  <tbody>
                    {makeups.map((requestItem) => (
                      <tr key={requestItem.id}>
                        <td>
                          {requestItem.absence_starts_at ? formatDateTime(requestItem.absence_starts_at) : '-'}
                          {requestItem.absence_group_name ? ` · ${requestItem.absence_group_name}` : ''}
                        </td>
                        <td>
                          {requestItem.makeup_starts_at ? formatDateTime(requestItem.makeup_starts_at) : '-'}
                          {requestItem.makeup_group_name ? ` · ${requestItem.makeup_group_name}` : ''}
                        </td>
                        <td>{MAKEUP_STATUS_LABELS[requestItem.status] || requestItem.status}</td>
                        <td>{requestItem.created_at ? formatDateTime(requestItem.created_at) : '-'}</td>
                      </tr>
                    ))}
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
