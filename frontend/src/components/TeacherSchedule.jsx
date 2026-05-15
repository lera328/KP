import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { AppLayout, teacherNavItems } from './AppLayout';
import { ConductLessonModal } from './ConductLessonModal';

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WEEKDAY_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

const startOfWeek = (date) => {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatTime = (v) =>
  v
    ? new Date(v).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : '';

const isLessonConducted = (lesson) =>
  Boolean(
    (lesson.conducted_topic || '').trim() ||
    (lesson.conducted_description || '').trim() ||
    (Array.isArray(lesson.attendance_records) && lesson.attendance_records.length > 0),
  );

export const TeacherSchedule = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeLesson, setActiveLesson] = useState(null);
  const [view, setView] = useState('week'); // week | day
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [g, l] = await Promise.all([api.getGroups(), api.getLessons()]);
      setGroups(Array.isArray(g) ? g : []);
      setLessons(Array.isArray(l) ? l : []);
    } catch (e) {
      setError(e.message || 'Не удалось загрузить расписание.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const groupMap = useMemo(() => {
    const m = new Map();
    for (const g of groups) m.set(g.id, g);
    return m;
  }, [groups]);

  const weekStart = useMemo(() => startOfWeek(cursor), [cursor]);
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

  const weekLessons = useMemo(() => {
    return lessons
      .filter((l) => {
        if (!l.starts_at) return false;
        const d = new Date(l.starts_at);
        return d >= weekStart && d < weekEnd;
      })
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }, [lessons, weekStart, weekEnd]);

  const lessonsByDay = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, idx) => ({
      index: idx,
      label: WEEKDAY_LABELS[idx],
      fullLabel: WEEKDAY_FULL[idx],
      date: addDays(weekStart, idx),
      lessons: [],
    }));
    for (const l of weekLessons) {
      const idx = (new Date(l.starts_at).getDay() + 6) % 7;
      days[idx].lessons.push(l);
    }
    return days;
  }, [weekLessons, weekStart]);

  const dayLessons = useMemo(() => {
    return lessons
      .filter((l) => l.starts_at && isSameDay(new Date(l.starts_at), cursor))
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }, [lessons, cursor]);

  const today = startOfDay(new Date());

  const handleSaved = async () => {
    setActiveLesson(null);
    setSuccess('Урок сохранён.');
    await load();
    setTimeout(() => setSuccess(''), 3000);
  };

  const navWeek = (delta) => setCursor((c) => addDays(c, delta * 7));
  const navDay = (delta) => setCursor((c) => addDays(c, delta));
  const goToday = () => setCursor(startOfDay(new Date()));

  return (
    <AppLayout title="KiberOne" navItems={teacherNavItems} kidMode>
      <div className="mb-4 d-flex flex-wrap align-items-center gap-3">
        <h1 className="fw-semibold mb-0" style={{ fontSize: '1.75rem' }}>
          Расписание
        </h1>
        <div className="ms-auto d-flex gap-2 flex-wrap align-items-center">
          {/* Переключатель Неделя / День */}
          <div
            className="btn-group rounded-pill p-1"
            role="group"
            style={{ background: '#eef0f3' }}
          >
            <button
              type="button"
              className="btn btn-sm rounded-pill px-3"
              style={{
                background: view === 'week' ? '#ffffff' : 'transparent',
                color: view === 'week' ? '#111827' : '#6b7280',
                fontWeight: view === 'week' ? 600 : 500,
                boxShadow: view === 'week' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                border: 'none',
              }}
              onClick={() => setView('week')}
            >
              Неделя
            </button>
            <button
              type="button"
              className="btn btn-sm rounded-pill px-3"
              style={{
                background: view === 'day' ? '#ffffff' : 'transparent',
                color: view === 'day' ? '#111827' : '#6b7280',
                fontWeight: view === 'day' ? 600 : 500,
                boxShadow: view === 'day' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                border: 'none',
              }}
              onClick={() => setView('day')}
            >
              День
            </button>
          </div>

          {/* Навигация */}
          <div className="btn-group">
            <button
              type="button"
              className="btn btn-light border rounded-start-pill px-3"
              onClick={() => (view === 'week' ? navWeek(-1) : navDay(-1))}
              aria-label="Назад"
            >
              ‹
            </button>
            <button
              type="button"
              className="btn btn-light border px-3"
              onClick={goToday}
            >
              Сегодня
            </button>
            <button
              type="button"
              className="btn btn-light border rounded-end-pill px-3"
              onClick={() => (view === 'week' ? navWeek(1) : navDay(1))}
              aria-label="Вперёд"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger rounded-3">{error}</div>}
      {success && <div className="alert alert-success rounded-3">{success}</div>}

      {/* Заголовок периода */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body py-3 text-center">
          <div className="fw-semibold">
            {view === 'week'
              ? `${weekStart.toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                })} — ${addDays(weekStart, 6).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}`
              : cursor.toLocaleDateString('ru-RU', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
          </div>
        </div>
      </div>

      {loading ? (
        <ScheduleSkeleton view={view} />
      ) : view === 'week' ? (
        <WeekView
          lessonsByDay={lessonsByDay}
          today={today}
          groupMap={groupMap}
          onLessonClick={setActiveLesson}
          onGroupClick={(groupId) => navigate(`/teacher/groups/${groupId}`)}
        />
      ) : (
        <DayView
          dayLessons={dayLessons}
          groupMap={groupMap}
          onLessonClick={setActiveLesson}
          onGroupClick={(groupId) => navigate(`/teacher/groups/${groupId}`)}
        />
      )}

      {activeLesson && (
        <ConductLessonModal
          lesson={activeLesson}
          group={groupMap.get(activeLesson.group)}
          onClose={() => setActiveLesson(null)}
          onSaved={handleSaved}
        />
      )}
    </AppLayout>
  );
};

const LESSON_STATUS = (lesson) => {
  const conducted = isLessonConducted(lesson);
  if (conducted) return 'conducted';
  const now = new Date();
  const start = new Date(lesson.starts_at);
  return start < now ? 'overdue' : 'upcoming';
};

const STATUS_STYLE = {
  conducted: { bg: '#ecfdf5', bgHover: '#d1fae5', dot: '#16a34a', label: '✓', labelColor: '#16a34a' },
  upcoming:  { bg: '#f0f4ff', bgHover: '#e0e7ff', dot: '#6366f1', label: '○', labelColor: '#6366f1' },
  overdue:   { bg: '#fef3c7', bgHover: '#fde68a', dot: '#d97706', label: '!', labelColor: '#b45309' },
};

const WeekView = ({ lessonsByDay, today, groupMap, onLessonClick, onGroupClick }) => {
  if (lessonsByDay.every((d) => d.lessons.length === 0)) {
    return <EmptyState text="На этой неделе занятий нет." />;
  }
  return (
    <div className="row g-3">
      {lessonsByDay.map((day) => {
        const isToday = isSameDay(day.date, today);
        return (
          <div className="col-12 col-sm-6 col-md-4 col-lg" key={day.index}>
            <div
              className="card border-0 shadow-sm rounded-4 h-100 overflow-hidden"
              style={
                isToday
                  ? { boxShadow: '0 0 0 2px #1f2937, 0 4px 12px rgba(31,41,55,0.15)' }
                  : {}
              }
            >
              {isToday && (
                <div
                  className="text-white text-center py-1 fw-semibold"
                  style={{
                    background: '#1f2937',
                    fontSize: '0.7rem',
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                  }}
                >
                  Сегодня
                </div>
              )}
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-baseline mb-2">
                  <div className="fw-semibold">{day.label}</div>
                  <div className="text-muted small">
                    {day.date.toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </div>
                </div>
                {day.lessons.length === 0 ? (
                  <div className="text-muted small">—</div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {day.lessons.map((l) => (
                      <LessonCard
                        key={l.id}
                        lesson={l}
                        groupMap={groupMap}
                        onClick={() => onLessonClick(l)}
                        onGroupClick={onGroupClick}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const DAY_STATUS_BADGE = {
  conducted: { bg: '#ecfdf5', color: '#16a34a', text: 'Проведён' },
  upcoming:  { bg: '#f0f4ff', color: '#6366f1', text: 'Предстоит' },
  overdue:   { bg: '#fef3c7', color: '#b45309', text: 'Не проведён' },
};

const DayView = ({ dayLessons, groupMap, onLessonClick, onGroupClick }) => {
  if (dayLessons.length === 0) {
    return <EmptyState text="В этот день занятий нет." />;
  }
  return (
    <div className="d-flex flex-column gap-2">
      {dayLessons.map((l) => {
        const group = groupMap.get(l.group);
        const status = LESSON_STATUS(l);
        const isMakeup = Boolean(l.is_makeup_slot);
        const badge = DAY_STATUS_BADGE[status];
        const st = isMakeup
          ? { ...STATUS_STYLE[status], bg: '#eff6ff', bgHover: '#dbeafe' }
          : STATUS_STYLE[status];
        return (
          <button
            key={l.id}
            type="button"
            onClick={() => onLessonClick(l)}
            className="card border-0 shadow-sm rounded-4 text-start kid-card-clickable"
            style={{ borderLeft: `4px solid ${st.dot}` }}
          >
            <div className="card-body p-3 d-flex align-items-center gap-3 flex-wrap">
              <div
                className="rounded-3 px-3 py-2 fw-semibold flex-shrink-0 text-center"
                style={{ background: st.bg, minWidth: 84, fontSize: '1.05rem' }}
              >
                {formatTime(l.starts_at)}
              </div>
              <div className="flex-grow-1" style={{ minWidth: 200 }}>
                <div className="fw-semibold">
                  {isMakeup ? (
                    'Слот отработки'
                  ) : (
                    <span
                      role="link"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (l.group) onGroupClick(l.group);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && l.group) {
                          e.stopPropagation();
                          onGroupClick(l.group);
                        }
                      }}
                      className="text-decoration-underline"
                      style={{ cursor: 'pointer' }}
                      title="Открыть группу"
                    >
                      {group?.name || l.group_name || `Группа #${l.group}`}
                    </span>
                  )}
                </div>
                <div className="text-muted small">
                  {status === 'conducted'
                    ? l.conducted_topic || 'Урок проведён'
                    : isMakeup
                    ? l.makeup_topics || 'Тема не задана'
                    : status === 'upcoming'
                    ? 'Ещё не началось'
                    : 'Требует проведения'}
                </div>
                {isMakeup && Array.isArray(l.makeup_students) && l.makeup_students.length > 0 && (
                  <div className="mt-2 d-flex flex-wrap gap-1">
                    {l.makeup_students.map((s, idx) => (
                      <span
                        key={s.student_id ?? idx}
                        role={s.student_id ? 'link' : undefined}
                        tabIndex={s.student_id ? 0 : -1}
                        className="badge rounded-pill"
                        style={{
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          fontWeight: 500,
                          cursor: s.student_id ? 'pointer' : 'default',
                        }}
                        onClick={(e) => {
                          if (!s.student_id) return;
                          e.stopPropagation();
                          navigate(`/teacher/students/${s.student_id}`);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && s.student_id) {
                            e.stopPropagation();
                            navigate(`/teacher/students/${s.student_id}`);
                          }
                        }}
                        title={
                          s.absence_group
                            ? `${s.absence_group}${s.absence_topic ? ' · ' + s.absence_topic : ''} — открыть карточку`
                            : 'Открыть карточку ученика'
                        }
                      >
                        {s.student_name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="d-flex gap-2 flex-wrap">
                {isMakeup && (
                  <span
                    className="badge rounded-pill"
                    style={{ background: '#eff6ff', color: '#2563eb', fontWeight: 500 }}
                  >
                    Отработка
                  </span>
                )}
                <span
                  className="badge rounded-pill"
                  style={{ background: badge.bg, color: badge.color, fontWeight: 500 }}
                >
                  {badge.text}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

const LessonCard = ({ lesson, groupMap, onClick, onGroupClick }) => {
  const group = groupMap.get(lesson.group);
  const isMakeup = Boolean(lesson.is_makeup_slot);
  const status = LESSON_STATUS(lesson);
  const st = isMakeup ? { ...STATUS_STYLE[status], bg: '#eff6ff', bgHover: '#dbeafe', dot: '#2563eb' } : STATUS_STYLE[status];

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-start rounded-3 p-2 border-0 w-100"
      style={{
        background: st.bg,
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = st.bgHover)}
      onMouseLeave={(e) => (e.currentTarget.style.background = st.bg)}
    >
      <div className="d-flex align-items-center gap-2 mb-1">
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: st.dot,
            color: '#fff',
            fontSize: '0.65rem',
            fontWeight: 700,
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          {st.label}
        </span>
        <div className="fw-semibold small">{formatTime(lesson.starts_at)}</div>
      </div>
      <div
        className="small fw-semibold"
        style={{ color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {isMakeup ? (
          'Отработка'
        ) : (
          <span
            role="link"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              if (lesson.group && onGroupClick) onGroupClick(lesson.group);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && lesson.group && onGroupClick) {
                e.stopPropagation();
                onGroupClick(lesson.group);
              }
            }}
            className="text-decoration-underline"
            style={{ cursor: 'pointer' }}
            title="Открыть группу"
          >
            {group?.name || lesson.group_name || `#${lesson.group}`}
          </span>
        )}
      </div>
      {(status === 'conducted' ? lesson.conducted_topic : isMakeup ? lesson.makeup_topics : null) ? (
        <div
          className="text-muted"
          style={{
            fontSize: '0.75rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {status === 'conducted' ? lesson.conducted_topic : lesson.makeup_topics}
        </div>
      ) : null}
      {isMakeup && Array.isArray(lesson.makeup_students) && lesson.makeup_students.length > 0 && (
        <div
          className="text-muted"
          style={{
            fontSize: '0.72rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginTop: 2,
          }}
        >
          {lesson.makeup_students.map((s) => s.student_name).join(', ')}
        </div>
      )}
    </button>
  );
};

const EmptyState = ({ text }) => (
  <div className="card border-0 shadow-sm rounded-4">
    <div className="card-body text-center py-5 text-muted">{text}</div>
  </div>
);

const ScheduleSkeleton = ({ view }) => {
  if (view === 'day') {
    return (
      <div className="d-flex flex-column gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-3">
              <div className="kid-skeleton" style={{ height: 40 }} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="row g-3">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <div className="col-12 col-sm-6 col-md-4 col-lg" key={i}>
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body p-3">
              <div className="kid-skeleton mb-3" style={{ height: 14, width: '60%' }} />
              <div className="kid-skeleton mb-2" style={{ height: 40 }} />
              <div className="kid-skeleton" style={{ height: 40 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TeacherSchedule;
