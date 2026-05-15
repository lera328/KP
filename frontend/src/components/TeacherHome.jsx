import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { AppLayout, teacherNavItems } from './AppLayout';
import { useAuth } from '../context/AuthContext';
import { ConductLessonModal } from './ConductLessonModal';

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

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const startOfWeek = (d) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
};
const startOfMonth = (d) => {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const TeacherHome = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [groups, setGroups] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeLesson, setActiveLesson] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [g, l] = await Promise.all([api.getGroups(), api.getLessons()]);
      setGroups(Array.isArray(g) ? g : []);
      setLessons(Array.isArray(l) ? l : []);
    } catch (e) {
      setError(e.message || 'Не удалось загрузить данные.');
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

  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayLessons = useMemo(
    () =>
      lessons
        .filter((l) => {
          if (!l.starts_at) return false;
          const d = new Date(l.starts_at);
          return d >= today && d < tomorrow;
        })
        .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)),
    [lessons, today, tomorrow],
  );

  const upcomingLesson = useMemo(
    () =>
      todayLessons.find((l) => new Date(l.starts_at) >= now) ||
      todayLessons[todayLessons.length - 1] ||
      null,
    [todayLessons, now],
  );

  // KPI
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const conductedThisWeek = useMemo(
    () =>
      lessons.filter(
        (l) =>
          isLessonConducted(l) &&
          new Date(l.starts_at) >= weekStart &&
          new Date(l.starts_at) < tomorrow,
      ).length,
    [lessons, weekStart, tomorrow],
  );
  const conductedThisMonth = useMemo(
    () =>
      lessons.filter(
        (l) =>
          isLessonConducted(l) &&
          new Date(l.starts_at) >= monthStart &&
          new Date(l.starts_at) < tomorrow,
      ).length,
    [lessons, monthStart, tomorrow],
  );

  // Непроведённые занятия за прошлые 7 дней
  const overdueLessons = useMemo(() => {
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return lessons
      .filter((l) => {
        if (!l.starts_at || l.is_makeup_slot) return false;
        const d = new Date(l.starts_at);
        return d >= weekAgo && d < today && !isLessonConducted(l);
      })
      .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
  }, [lessons, today]);

  const studentsCount = useMemo(
    () =>
      groups.reduce(
        (sum, g) => sum + (Array.isArray(g.students) ? g.students.length : 0),
        0,
      ),
    [groups],
  );

  const firstName = user?.first_name || 'Преподаватель';

  const handleConducted = async () => {
    setActiveLesson(null);
    setSuccess('Урок проведён.');
    await load();
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <AppLayout title="KiberOne" navItems={teacherNavItems} kidMode>
      {/* Приветствие */}
      <div className="mb-4">
        <div className="text-muted small">
          {now.toLocaleDateString('ru-RU', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </div>
        <h1 className="fw-semibold mb-0" style={{ fontSize: '2rem' }}>
          Привет, {firstName}
        </h1>
      </div>

      {error && <div className="alert alert-danger rounded-3">{error}</div>}
      {success && <div className="alert alert-success rounded-3">{success}</div>}

      {loading ? (
        <HomeSkeleton />
      ) : (
        <>
          <div className="row g-3 mb-3">
            {/* Ближайшее / следующее занятие */}
            <div className="col-lg-7">
              <div className="card border-0 shadow-sm rounded-4 h-100">
                <div className="card-body p-4">
                  <div
                    className="text-muted small text-uppercase mb-2"
                    style={{ letterSpacing: 0.5 }}
                  >
                    {upcomingLesson
                      ? new Date(upcomingLesson.starts_at) > now
                        ? 'Ближайшее занятие'
                        : 'Сейчас идёт / последнее сегодня'
                      : 'Сегодня занятий нет'}
                  </div>
                  {upcomingLesson ? (
                    <UpcomingCard
                      lesson={upcomingLesson}
                      groupMap={groupMap}
                      onConduct={() => setActiveLesson(upcomingLesson)}
                      onAllSchedule={() => navigate('/teacher/schedule')}
                    />
                  ) : (
                    <div className="text-muted">
                      Свободный день. Можно подготовиться к завтрашним занятиям.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* KPI */}
            <div className="col-lg-5">
              <div className="row g-3">
                <StatCard label="Сегодня" value={todayLessons.length} />
                <StatCard label="За неделю" value={conductedThisWeek} hint="проведено" />
                <StatCard label="За месяц" value={conductedThisMonth} hint="проведено" />
                <StatCard label="Учеников" value={studentsCount} />
              </div>
            </div>
          </div>

          {/* Сегодня — таймлайн */}
          {todayLessons.length > 0 && (
            <div className="mb-3">
              <div
                className="text-muted small text-uppercase mb-2"
                style={{ letterSpacing: 0.5 }}
              >
                План на сегодня
              </div>
              <div className="d-flex flex-column gap-2">
                {todayLessons.map((lesson) => (
                  <TodayLessonRow
                    key={lesson.id}
                    lesson={lesson}
                    groupMap={groupMap}
                    onClick={() => setActiveLesson(lesson)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Непроведённые занятия — алерт-карточка */}
          {overdueLessons.length > 0 && (
            <div className="mb-3">
              <div
                className="card border-0 shadow-sm rounded-4"
                style={{ background: '#fffbeb', borderLeft: '4px solid #f59e0b' }}
              >
                <div className="card-body p-3">
                  <div className="fw-semibold mb-2">
                    Требуют внимания: {overdueLessons.length}{' '}
                    {pluralize(overdueLessons.length, ['занятие', 'занятия', 'занятий'])} за
                    последние 7 дней не проведены
                  </div>
                  <div className="d-flex flex-column gap-1">
                    {overdueLessons.slice(0, 5).map((l) => {
                      const g = groupMap.get(l.group);
                      return (
                        <button
                          key={l.id}
                          type="button"
                          className="btn btn-light border rounded-3 p-2 text-start d-flex justify-content-between align-items-center"
                          onClick={() => setActiveLesson(l)}
                        >
                          <span className="small">
                            {new Date(l.starts_at).toLocaleDateString('ru-RU', {
                              day: 'numeric',
                              month: 'short',
                            })}
                            {' · '}
                            {formatTime(l.starts_at)}
                            {' · '}
                            {g?.name || `Группа #${l.group}`}
                          </span>
                          <span className="text-muted small">Провести →</span>
                        </button>
                      );
                    })}
                    {overdueLessons.length > 5 && (
                      <button
                        type="button"
                        className="btn btn-link p-0 text-decoration-none small text-start"
                        onClick={() => navigate('/teacher/schedule')}
                      >
                        Показать все →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Мои группы */}
          {groups.length > 0 && (
            <div className="mb-3">
              <div
                className="text-muted small text-uppercase mb-2"
                style={{ letterSpacing: 0.5 }}
              >
                Мои группы
              </div>
              <div className="row g-3">
                {groups.map((g) => (
                  <div key={g.id} className="col-md-6 col-lg-4">
                    <button
                      type="button"
                      className="card border-0 shadow-sm rounded-4 h-100 text-start w-100"
                      style={{ cursor: 'pointer', transition: 'transform 0.1s ease' }}
                      onClick={() => navigate(`/teacher/groups/${g.id}`)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div className="card-body p-3">
                        <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                          <div className="fw-semibold">{g.name}</div>
                          <span className="text-muted" aria-hidden>›</span>
                        </div>
                        <div className="text-muted small mb-2">
                          {Array.isArray(g.students) ? g.students.length : 0} учеников
                          {g.is_active ? '' : ' · неактивна'}
                        </div>
                        {Array.isArray(g.students) && g.students.length > 0 && (
                          <div className="text-muted small text-truncate">
                            {g.students
                              .map(
                                (s) =>
                                  `${s.first_name || ''} ${s.last_name || ''}`.trim() ||
                                  s.username ||
                                  `ID ${s.id}`,
                              )
                              .join(', ')}
                          </div>
                        )}
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeLesson && (
        <ConductLessonModal
          lesson={activeLesson}
          group={groupMap.get(activeLesson.group)}
          onClose={() => setActiveLesson(null)}
          onSaved={handleConducted}
        />
      )}
    </AppLayout>
  );
};

const pluralize = (n, forms) => {
  const cases = [2, 0, 1, 1, 1, 2];
  return forms[n % 100 > 4 && n % 100 < 20 ? 2 : cases[Math.min(n % 10, 5)]];
};

const UpcomingCard = ({ lesson, groupMap, onConduct, onAllSchedule }) => {
  const group = groupMap.get(lesson.group);
  const conducted = isLessonConducted(lesson);
  const dt = new Date(lesson.starts_at);
  const now = new Date();
  const diffMin = Math.round((dt - now) / 60000);
  const inFuture = diffMin > 0;

  return (
    <>
      <div className="d-flex align-items-baseline gap-3 mb-1 flex-wrap">
        <div className="fw-semibold" style={{ fontSize: '2rem', lineHeight: 1 }}>
          {formatTime(lesson.starts_at)}
        </div>
        {inFuture && diffMin <= 240 ? (
          <span
            className="badge rounded-pill"
            style={{ background: '#eef0f3', color: '#1f2937', fontWeight: 500 }}
          >
            через {formatRelative(diffMin)}
          </span>
        ) : null}
        {conducted ? (
          <span
            className="badge rounded-pill"
            style={{ background: '#ecfdf5', color: '#16a34a', fontWeight: 500 }}
          >
            Проведён
          </span>
        ) : (
          <span
            className="badge rounded-pill"
            style={{ background: '#fef3c7', color: '#b45309', fontWeight: 500 }}
          >
            Не проведён
          </span>
        )}
      </div>
      <div className="fw-semibold mb-1" style={{ fontSize: '1.1rem' }}>
        {lesson.is_makeup_slot
          ? 'Слот отработки'
          : group?.name || lesson.group_name || `Группа #${lesson.group}`}
      </div>
      {lesson.location_name && (
        <div className="text-muted small mb-2">{lesson.location_name}</div>
      )}
      {lesson.conducted_topic ? (
        <div className="small text-muted mb-3">Тема: {lesson.conducted_topic}</div>
      ) : null}
      <div className="d-flex gap-2 flex-wrap">
        <button
          type="button"
          className="btn btn-dark rounded-pill px-4"
          onClick={onConduct}
        >
          {conducted ? 'Открыть журнал' : 'Провести урок'}
        </button>
        <button
          type="button"
          className="btn btn-light border rounded-pill px-4"
          onClick={onAllSchedule}
        >
          Всё расписание
        </button>
      </div>
    </>
  );
};

const formatRelative = (mins) => {
  if (mins < 60) return `${mins} мин`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
};

const HOME_STATUS = (lesson) => {
  const conducted = isLessonConducted(lesson);
  if (conducted) return { key: 'conducted', bg: '#ecfdf5', dot: '#16a34a', badge: 'Проведён', badgeBg: '#ecfdf5', badgeColor: '#16a34a' };
  const start = new Date(lesson.starts_at);
  if (start < new Date()) return { key: 'overdue', bg: '#fef3c7', dot: '#d97706', badge: 'Не проведён', badgeBg: '#fef3c7', badgeColor: '#b45309' };
  return { key: 'upcoming', bg: '#f0f4ff', dot: '#6366f1', badge: 'Предстоит', badgeBg: '#f0f4ff', badgeColor: '#6366f1' };
};

const TodayLessonRow = ({ lesson, groupMap, onClick }) => {
  const group = groupMap.get(lesson.group);
  const isMakeup = Boolean(lesson.is_makeup_slot);
  const st = HOME_STATUS(lesson);
  return (
    <button
      type="button"
      onClick={onClick}
      className="card border-0 shadow-sm rounded-4 text-start kid-card-clickable"
      style={{ borderLeft: `4px solid ${st.dot}` }}
    >
      <div className="card-body p-3 d-flex align-items-center gap-3">
        <div
          className="rounded-3 px-3 py-2 fw-semibold flex-shrink-0 text-center"
          style={{ background: st.bg, minWidth: 64, fontSize: '1.05rem' }}
        >
          {formatTime(lesson.starts_at)}
        </div>
        <div className="flex-grow-1">
          <div className="fw-semibold">
            {isMakeup
              ? 'Слот отработки'
              : group?.name || lesson.group_name || `Группа #${lesson.group}`}
          </div>
          <div className="text-muted small">
            {st.key === 'conducted'
              ? lesson.conducted_topic || 'Урок проведён'
              : st.key === 'upcoming'
              ? 'Ещё не началось'
              : isMakeup
              ? lesson.makeup_topics || 'Требует проведения'
              : 'Требует проведения'}
          </div>
        </div>
        <span
          className="badge rounded-pill"
          style={{
            background: st.badgeBg,
            color: st.badgeColor,
            fontWeight: 500,
          }}
        >
          {st.badge}
        </span>
      </div>
    </button>
  );
};

const StatCard = ({ label, value, hint }) => (
  <div className="col-6">
    <div className="card border-0 shadow-sm rounded-4 h-100">
      <div className="card-body p-3">
        <div
          className="text-muted small text-uppercase mb-1"
          style={{ letterSpacing: 0.5, fontSize: '0.7rem' }}
        >
          {label}
        </div>
        <div className="fw-semibold" style={{ fontSize: '1.75rem', lineHeight: 1.1 }}>
          {value}
        </div>
        {hint ? <div className="text-muted small">{hint}</div> : null}
      </div>
    </div>
  </div>
);

const HomeSkeleton = () => (
  <div className="row g-3">
    <div className="col-lg-7">
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4">
          <div className="kid-skeleton mb-3" style={{ height: 12, width: '40%' }} />
          <div className="kid-skeleton mb-3" style={{ height: 40, width: '50%' }} />
          <div className="kid-skeleton mb-2" style={{ height: 16, width: '70%' }} />
          <div className="kid-skeleton" style={{ height: 36, width: 200 }} />
        </div>
      </div>
    </div>
    <div className="col-lg-5">
      <div className="row g-3">
        {[0, 1, 2, 3].map((i) => (
          <div className="col-6" key={i}>
            <div className="card border-0 shadow-sm rounded-4">
              <div className="card-body p-3">
                <div className="kid-skeleton mb-2" style={{ height: 10, width: '60%' }} />
                <div className="kid-skeleton" style={{ height: 28, width: '40%' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default TeacherHome;
