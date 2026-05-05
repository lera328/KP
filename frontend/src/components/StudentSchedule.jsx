import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

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

const formatDate = (date) => {
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric', year: 'numeric' });
};

export const StudentSchedule = () => {
  const [groups, setGroups] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekRange(new Date()).monday);

  const loadData = async () => {
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
    loadData();
  }, []);

  const weekRange = useMemo(() => getWeekRange(currentWeekStart), [currentWeekStart]);

  const groupIds = useMemo(() => new Set(groups.map((g) => g.id)), [groups]);

  const weekLessons = useMemo(() => {
    return lessons
      .filter((lesson) => {
        if (!lesson.starts_at) return false;
        const dt = new Date(lesson.starts_at);
        return dt >= weekRange.monday && dt <= weekRange.sunday && groupIds.has(lesson.group);
      })
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }, [lessons, weekRange, groupIds]);

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

  const groupMap = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

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

  if (loading) {
    return <div className="p-3">Загрузка расписания...</div>;
  }

  if (error) {
    return <div className="alert alert-danger mb-0">{error}</div>;
  }

  if (groups.length === 0) {
    return <div className="alert alert-info mb-0">Вы еще не прикреплены ни к одной группе.</div>;
  }

  const weekProgress = (
    <div className="text-center mb-3">
      <button className="btn btn-sm btn-outline-secondary" onClick={handlePrevWeek}>
        ← Пред
      </button>
      <span className="mx-3">
        {formatDate(weekRange.monday)} — {formatDate(weekRange.sunday)}
      </span>
      <button className="btn btn-sm btn-outline-secondary" onClick={handleNextWeek}>
        След →
      </button>
      <button className="btn btn-sm btn-outline-info ms-2" onClick={handleCurrentWeek}>
        Сегодня
      </button>
    </div>
  );

  return (
    <div>
      {weekProgress}

      {weekLessons.length === 0 ? (
        <div className="alert alert-warning mb-0">На этой неделе занятий не запланировано.</div>
      ) : (
        <div className="row g-2">
          {lessonsByDay.map((day) => (
            <div className="col-12 col-sm-6 col-md-4 col-lg-2" key={day.index}>
              <div className="card h-100">
                <div className="card-header bg-light">
                  <div className="fw-bold text-center">{day.label}</div>
                  <div className="text-center small text-muted">
                    {day.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' })}
                  </div>
                </div>
                <div className="card-body p-2">
                  {day.lessons.length === 0 ? (
                    <div className="text-muted small">Нет занятий</div>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {day.lessons.map((lesson) => {
                        const groupName = groupMap.get(lesson.group)?.name || `Группа #${lesson.group}`;
                        return (
                          <div
                            key={lesson.id}
                            className="border rounded p-2 bg-light-subtle"
                            style={{ fontSize: '0.85rem' }}
                          >
                            <div className="fw-bold text-primary">{formatTime(lesson.starts_at)}</div>
                            <div className="small">{groupName}</div>
                            {lesson.location && <div className="text-muted small">📍 {lesson.location}</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
