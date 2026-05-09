import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AppLayout, teacherNavItems } from './AppLayout';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Присутствовал' },
  { value: 'absent', label: 'Пропуск' },
  { value: 'makeup', label: 'Отработка' },
];

const getWeekRange = (referenceDate = new Date()) => {
  const date = new Date(referenceDate);
  const day = date.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { monday, sunday };
};

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('ru-RU');
};

const formatTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

const formatDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const isLessonConducted = (lesson) => {
  return Boolean((lesson.conducted_topic || '').trim() || (lesson.conducted_description || '').trim());
};

export const TeacherSchedule = () => {
  const [groups, setGroups] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [activeLesson, setActiveLesson] = useState(null);
  const [conductTopic, setConductTopic] = useState('');
  const [conductDescription, setConductDescription] = useState('');
  const [conductHomework, setConductHomework] = useState('');
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekRange(new Date()).monday);
  const [jumpDate, setJumpDate] = useState(() => formatDateInputValue(new Date()));

  const loadScheduleData = async () => {
    setLoading(true);
    setError('');
    try {
      const [groupsData, lessonsData] = await Promise.all([api.getGroups(), api.getLessons()]);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
      setLessons(Array.isArray(lessonsData) ? lessonsData : []);
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить расписание.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScheduleData();
  }, []);

  const weekRange = useMemo(() => getWeekRange(currentWeekStart), [currentWeekStart]);

  const groupMap = useMemo(() => {
    const map = new Map();
    for (const group of groups) {
      map.set(group.id, group);
    }
    return map;
  }, [groups]);

  const weekLessons = useMemo(() => {
    return lessons
      .filter((lesson) => {
        if (!lesson.starts_at) return false;
        const dt = new Date(lesson.starts_at);
        return dt >= weekRange.monday && dt <= weekRange.sunday;
      })
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }, [lessons, weekRange]);

  const lessonsByDay = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekRange.monday);
      date.setDate(weekRange.monday.getDate() + index);
      return {
        index,
        label: WEEKDAY_LABELS[index],
        date,
        lessons: [],
      };
    });

    for (const lesson of weekLessons) {
      const lessonDate = new Date(lesson.starts_at);
      const dayIndex = (lessonDate.getDay() + 6) % 7;
      days[dayIndex].lessons.push(lesson);
    }

    return days;
  }, [weekLessons, weekRange]);

  const openConductModal = (lesson) => {
    const group = groupMap.get(lesson.group);
    const students = Array.isArray(group?.students) ? group.students : [];
    const existingAttendance = Array.isArray(lesson.attendance_records) ? lesson.attendance_records : [];
    const recordByStudentId = new Map(
      existingAttendance
        .filter((record) => record && record.student_id && record.status)
        .map((record) => [Number(record.student_id), record]),
    );

    setActiveLesson(lesson);
    setConductTopic(lesson.conducted_topic || '');
    setConductDescription(lesson.conducted_description || '');
    setConductHomework(lesson.homework || '');
    setAttendanceRows(
      students.map((student) => {
        const existing = recordByStudentId.get(Number(student.id));
        return {
          studentId: student.id,
          studentName: `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.username || `ID ${student.id}`,
          status: existing?.status || 'present',
          grade: existing?.grade != null ? String(existing.grade) : '',
          teacher_comment: existing?.teacher_comment || '',
        };
      }),
    );
    setSuccess('');
    setError('');
  };

  const closeConductModal = () => {
    setActiveLesson(null);
    setConductTopic('');
    setConductDescription('');
    setConductHomework('');
    setAttendanceRows([]);
  };

  const handleStatusChange = (studentId, value) => {
    setAttendanceRows((prev) =>
      prev.map((row) => (row.studentId === studentId ? { ...row, status: value } : row)),
    );
  };

  const handleGradeChange = (studentId, value) => {
    setAttendanceRows((prev) =>
      prev.map((row) => (row.studentId === studentId ? { ...row, grade: value } : row)),
    );
  };

  const handleCommentChange = (studentId, value) => {
    setAttendanceRows((prev) =>
      prev.map((row) => (row.studentId === studentId ? { ...row, teacher_comment: value } : row)),
    );
  };

  const handleConductSubmit = async (event) => {
    event.preventDefault();

    if (!activeLesson) {
      return;
    }

    if (attendanceRows.length === 0) {
      setError('В этой группе нет учеников для отметки посещаемости.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.conductLesson(activeLesson.id, {
        topic: conductTopic,
        description: conductDescription,
        homework: conductHomework,
        attendance: attendanceRows.map((row) => ({
          student_id: row.studentId,
          status: row.status,
          grade: row.grade === '' ? null : Number(row.grade),
          teacher_comment: row.teacher_comment || '',
        })),
      });

      setSuccess('Урок проведён, посещаемость сохранена.');
      await loadScheduleData();
      closeConductModal();
    } catch (saveError) {
      setError(saveError.message || 'Не удалось сохранить проведение урока.');
    } finally {
      setSaving(false);
    }
  };

  const handlePrevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekStart(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next);
  };

  const handleCurrentWeek = () => {
    setCurrentWeekStart(getWeekRange(new Date()).monday);
    setJumpDate(formatDateInputValue(new Date()));
  };

  const handleJumpToDate = () => {
    if (!jumpDate) {
      return;
    }

    const parsedDate = new Date(`${jumpDate}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) {
      return;
    }

    setCurrentWeekStart(getWeekRange(parsedDate).monday);
  };

  return (
    <AppLayout title="KiberOne — Преподаватель" navItems={teacherNavItems}>
      <div>
        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <strong>
              Расписание на неделю ({weekRange.monday.toLocaleDateString('ru-RU')} —{' '}
              {weekRange.sunday.toLocaleDateString('ru-RU')})
            </strong>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary btn-sm" onClick={handlePrevWeek} disabled={loading}>
                ← Неделя
              </button>
              <button className="btn btn-outline-secondary btn-sm" onClick={handleCurrentWeek} disabled={loading}>
                Текущая
              </button>
              <button className="btn btn-outline-secondary btn-sm" onClick={handleNextWeek} disabled={loading}>
                Неделя →
              </button>
              <input
                type="date"
                className="form-control form-control-sm"
                value={jumpDate}
                onChange={(event) => setJumpDate(event.target.value)}
                disabled={loading}
                style={{ width: '170px' }}
              />
              <button className="btn btn-outline-secondary btn-sm" onClick={handleJumpToDate} disabled={loading || !jumpDate}>
                К дате
              </button>
              <button className="btn btn-outline-secondary btn-sm" onClick={loadScheduleData} disabled={loading}>
                Обновить
              </button>
            </div>
          </div>
          <div className="card-body p-0">
            {loading ? (
              <div className="p-3">Загрузка...</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-bordered align-top mb-0">
                  <thead>
                    <tr>
                      {lessonsByDay.map((day) => (
                        <th
                          key={day.index}
                          className={`text-center ${day.date.toDateString() === new Date().toDateString() ? 'table-info' : ''}`}
                          style={{ minWidth: '220px' }}
                        >
                          <div>{day.label}</div>
                          <small className="text-muted">{day.date.toLocaleDateString('ru-RU')}</small>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {lessonsByDay.map((day) => (
                        <td key={day.index} style={{ verticalAlign: 'top' }}>
                          {day.lessons.length === 0 ? (
                            <div className="text-muted small">Нет занятий</div>
                          ) : (
                            <div className="d-flex flex-column gap-2">
                              {day.lessons.map((lesson) => {
                                const group = groupMap.get(lesson.group);
                                const conducted = isLessonConducted(lesson);
                                const cardClassName = lesson.is_makeup_slot
                                  ? 'card border-warning'
                                  : conducted
                                    ? 'card border-success'
                                    : 'card';

                                return (
                                  <div key={lesson.id} className={cardClassName}>
                                    <div className="card-body p-2">
                                      <div className="fw-semibold">{formatTime(lesson.starts_at)}</div>
                                      <div className="small mb-2">
                                        {lesson.is_makeup_slot
                                          ? 'Слот отработки'
                                          : group?.name || lesson.group_name || (lesson.group ? `Группа #${lesson.group}` : 'Занятие')}
                                      </div>
                                      <div className="d-flex flex-wrap gap-1 mb-2">
                                        {lesson.is_makeup_slot ? (
                                          <span className="badge text-bg-warning">Отработка</span>
                                        ) : (
                                          <span className="badge text-bg-secondary">Основной</span>
                                        )}
                                        {conducted ? (
                                          <span className="badge text-bg-success">Проведён</span>
                                        ) : (
                                          <span className="badge text-bg-light">Не проведён</span>
                                        )}
                                      </div>
                                      <div className="small mb-2">
                                        Тема:{' '}
                                        {lesson.is_makeup_slot
                                          ? lesson.makeup_topics || '-'
                                          : lesson.conducted_topic || '-'}
                                      </div>
                                      <button className="btn btn-primary btn-sm w-100" onClick={() => openConductModal(lesson)}>
                                        Провести
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeLesson && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}
        >
          <div className="card" style={{ width: 'min(960px, 95vw)', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="card-header d-flex justify-content-between align-items-center">
              <strong>Провести урок #{activeLesson.id}</strong>
              <button className="btn btn-outline-secondary btn-sm" onClick={closeConductModal} disabled={saving}>
                Закрыть
              </button>
            </div>
            <div className="card-body">
              <form onSubmit={handleConductSubmit}>
                <div className="mb-3">
                  <label className="form-label">Тема урока</label>
                  <input
                    type="text"
                    className="form-control"
                    value={conductTopic}
                    onChange={(event) => setConductTopic(event.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Описание урока</label>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={conductDescription}
                    onChange={(event) => setConductDescription(event.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Домашнее задание</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={conductHomework}
                    onChange={(event) => setConductHomework(event.target.value)}
                    disabled={saving}
                    placeholder="Что задано на дом всей группе"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label d-block">Посещаемость и оценки</label>
                  {attendanceRows.length === 0 ? (
                    <div className="text-muted">В группе нет учеников.</div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered">
                        <thead>
                          <tr>
                            <th style={{ minWidth: '160px' }}>Ученик</th>
                            <th style={{ width: '140px' }}>Статус</th>
                            <th style={{ width: '110px' }}>Оценка</th>
                            <th>Комментарий</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendanceRows.map((row) => (
                            <tr key={row.studentId}>
                              <td>{row.studentName}</td>
                              <td>
                                <select
                                  className="form-select form-select-sm"
                                  value={row.status}
                                  onChange={(event) => handleStatusChange(row.studentId, event.target.value)}
                                  disabled={saving}
                                >
                                  {STATUS_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <select
                                  className="form-select form-select-sm"
                                  value={row.grade}
                                  onChange={(event) => handleGradeChange(row.studentId, event.target.value)}
                                  disabled={saving || row.status === 'absent'}
                                >
                                  <option value="">—</option>
                                  <option value="5">5</option>
                                  <option value="4">4</option>
                                  <option value="3">3</option>
                                  <option value="2">2</option>
                                  <option value="1">1</option>
                                </select>
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={row.teacher_comment}
                                  onChange={(event) => handleCommentChange(row.studentId, event.target.value)}
                                  disabled={saving}
                                  placeholder="Заметка по ученику"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Сохраняем...' : 'Сохранить проведение урока'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};
