import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AdminLayout } from './AdminLayout';

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

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

const formatTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

export const AdminScheduleOverview = ({ embedded = false }) => {
  const [groups, setGroups] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekRange(new Date()).monday);
  const [groupFilter, setGroupFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [groupsData, usersData, lessonsData] = await Promise.all([api.getGroups(), api.getUsers(), api.getLessons()]);

      const safeGroups = Array.isArray(groupsData) ? groupsData : [];
      const safeUsers = Array.isArray(usersData) ? usersData : [];
      const safeLessons = Array.isArray(lessonsData) ? lessonsData : [];

      const teacherUsers = safeUsers.filter(
        (userItem) => userItem?.is_superuser || (Array.isArray(userItem?.roles) && userItem.roles.includes('teacher')),
      );

      setGroups(safeGroups);
      setTeachers(teacherUsers);
      setLessons(safeLessons);
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить общее расписание.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const weekRange = useMemo(() => getWeekRange(currentWeekStart), [currentWeekStart]);

  const groupMap = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const teacherMap = useMemo(() => new Map(teachers.map((teacher) => [teacher.id, teacher])), [teachers]);

  const weekLessons = useMemo(() => {
    return lessons
      .filter((lesson) => {
        if (!lesson.starts_at) return false;
        const dt = new Date(lesson.starts_at);
        const inWeek = dt >= weekRange.monday && dt <= weekRange.sunday;
        if (!inWeek) return false;

        if (groupFilter && Number(lesson.group) !== Number(groupFilter)) {
          return false;
        }

        if (teacherFilter && Number(lesson.teacher) !== Number(teacherFilter)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }, [lessons, weekRange, groupFilter, teacherFilter]);

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

  const teacherLabel = (teacher) => {
    if (!teacher) return '-';
    const fullName = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim();
    return fullName || teacher.username || `ID ${teacher.id}`;
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
  };

  const handleResetFilters = () => {
    setGroupFilter('');
    setTeacherFilter('');
  };

  const openLessonModal = (lesson) => {
    setSelectedLesson(lesson);
  };

  const closeLessonModal = () => {
    setSelectedLesson(null);
  };

  const contentHeight = embedded ? 'calc(100vh - 250px)' : 'calc(100vh - 200px)';

  const lessonDetails = useMemo(() => {
    if (!selectedLesson) {
      return null;
    }

    const attendance = Array.isArray(selectedLesson.attendance_records) ? selectedLesson.attendance_records : [];
    const summary = attendance.reduce(
      (acc, item) => {
        if (item.status === 'present') acc.present += 1;
        if (item.status === 'absent') acc.absent += 1;
        if (item.status === 'makeup') acc.makeup += 1;
        return acc;
      },
      { present: 0, absent: 0, makeup: 0 },
    );

    const startsAtDate = selectedLesson.starts_at ? new Date(selectedLesson.starts_at) : null;
    const isPast = startsAtDate ? startsAtDate < new Date() : false;
    const hasConductedData = Boolean(selectedLesson.conducted_topic || selectedLesson.conducted_description || attendance.length > 0);
    const statusLabel = hasConductedData ? 'Проведено' : isPast ? 'Запланировано (прошло время)' : 'Будущее занятие';

    return {
      group: groupMap.get(selectedLesson.group),
      teacher: teacherMap.get(selectedLesson.teacher),
      attendanceCount: attendance.length,
      summary,
      statusLabel,
    };
  }, [selectedLesson, groupMap, teacherMap]);

  const content = (
    <div className="container-fluid mt-4">
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <strong>
            Неделя ({weekRange.monday.toLocaleDateString('ru-RU')} — {weekRange.sunday.toLocaleDateString('ru-RU')})
          </strong>
          <div className="d-flex gap-2 flex-wrap justify-content-end">
            <select
              className="form-select form-select-sm"
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
              disabled={loading}
              style={{ minWidth: '150px' }}
            >
              <option value="">Все группы</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            <select
              className="form-select form-select-sm"
              value={teacherFilter}
              onChange={(event) => setTeacherFilter(event.target.value)}
              disabled={loading}
              style={{ minWidth: '170px' }}
            >
              <option value="">Все преподаватели</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacherLabel(teacher)}
                </option>
              ))}
            </select>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={handleResetFilters}
              disabled={loading || (!groupFilter && !teacherFilter)}
            >
              Сбросить фильтры
            </button>
            <button className="btn btn-outline-secondary btn-sm" onClick={handlePrevWeek} disabled={loading}>
              ← Неделя
            </button>
            <button className="btn btn-outline-secondary btn-sm" onClick={handleCurrentWeek} disabled={loading}>
              Текущая
            </button>
            <button className="btn btn-outline-secondary btn-sm" onClick={handleNextWeek} disabled={loading}>
              Неделя →
            </button>
            <button className="btn btn-outline-secondary btn-sm" onClick={loadData} disabled={loading}>
              Обновить
            </button>
          </div>
        </div>

        <div className="card-body p-0" style={{ maxHeight: contentHeight, overflow: 'auto' }}>
          {loading ? (
            <div className="p-3">Загрузка...</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-bordered align-top mb-0" style={{ tableLayout: 'fixed', width: '100%' }}>
                <thead>
                  <tr>
                    {lessonsByDay.map((day) => (
                      <th key={day.index} className="text-center small">
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
                              const teacher = teacherMap.get(lesson.teacher);
                              return (
                                <button
                                  key={lesson.id}
                                  type="button"
                                  className={lesson.is_extra ? 'card border-warning text-start w-100' : 'card text-start w-100'}
                                  onClick={() => openLessonModal(lesson)}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <div className="card-body p-1">
                                    <div className="fw-semibold small">{formatTime(lesson.starts_at)}</div>
                                    <div className="small text-truncate" title={group?.name || `Группа #${lesson.group}`}>
                                      {group?.name || `Группа #${lesson.group}`}
                                    </div>
                                    <div className="small text-muted text-truncate" title={teacherLabel(teacher)}>
                                      {teacherLabel(teacher)}
                                    </div>
                                    <div className="mt-1">
                                      <span className={`badge ${lesson.is_extra ? 'text-bg-warning' : 'text-bg-secondary'}`} style={{ fontSize: '0.65rem' }}>
                                        {lesson.is_extra ? 'Разовое' : 'Регулярное'}
                                      </span>
                                    </div>
                                  </div>
                                </button>
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

      {selectedLesson && lessonDetails ? (
        <>
          <div className="modal-backdrop show" onClick={closeLessonModal} />
          <div className="modal show d-block" tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Информация о занятии</h5>
                  <button type="button" className="btn-close" onClick={closeLessonModal} aria-label="Закрыть" />
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <div><strong>Группа:</strong> {lessonDetails.group?.name || `Группа #${selectedLesson.group}`}</div>
                      <div><strong>Дата:</strong> {selectedLesson.starts_at ? new Date(selectedLesson.starts_at).toLocaleDateString('ru-RU') : '-'}</div>
                      <div><strong>Время:</strong> {formatTime(selectedLesson.starts_at)}</div>
                      <div><strong>Статус:</strong> {lessonDetails.statusLabel}</div>
                    </div>
                    <div className="col-md-6">
                      <div><strong>Преподаватель:</strong> {teacherLabel(lessonDetails.teacher)}</div>
                      <div><strong>Тип:</strong> {selectedLesson.is_extra ? 'Разовое' : 'Регулярное'}</div>
                      <div><strong>Слот отработки:</strong> {selectedLesson.is_makeup_slot ? 'Да' : 'Нет'}</div>
                      <div><strong>ID темы:</strong> {selectedLesson.topic || '-'}</div>
                    </div>
                  </div>

                  <hr />

                  <div className="row g-3">
                    <div className="col-md-6">
                      <h6 className="mb-2">Проведение урока</h6>
                      <div><strong>Проведённая тема:</strong> {selectedLesson.conducted_topic || '—'}</div>
                      <div><strong>Описание:</strong> {selectedLesson.conducted_description || '—'}</div>
                    </div>
                    <div className="col-md-6">
                      <h6 className="mb-2">Посещаемость</h6>
                      <div><strong>Отметок:</strong> {lessonDetails.attendanceCount}</div>
                      <div><strong>Присутствовали:</strong> {lessonDetails.summary.present}</div>
                      <div><strong>Пропуски:</strong> {lessonDetails.summary.absent}</div>
                      <div><strong>Отработки:</strong> {lessonDetails.summary.makeup}</div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closeLessonModal}>
                    Закрыть
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <AdminLayout title="Админ — общее расписание">
      {content}
    </AdminLayout>
  );
};
