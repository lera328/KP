import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { AppLayout, studentNavItems } from './AppLayout';
import { useAuth } from '../context/AuthContext';

const formatTime = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

const formatFullDate = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
};

const greetingByHour = (hour) => {
  if (hour < 6) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Привет';
  return 'Добрый вечер';
};

const pluralize = (n, one, few, many) => {
  const m = Math.abs(n) % 100;
  const m1 = m % 10;
  if (m > 10 && m < 20) return many;
  if (m1 > 1 && m1 < 5) return few;
  if (m1 === 1) return one;
  return many;
};

const formatCountdown = (startsAt) => {
  if (!startsAt) return '';
  const diff = new Date(startsAt) - new Date();
  if (diff <= 0) return 'идёт сейчас';
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) return `через ${days} ${pluralize(days, 'день', 'дня', 'дней')}`;
  if (hours >= 1) return `через ${hours} ${pluralize(hours, 'час', 'часа', 'часов')}`;
  return `через ${minutes} мин`;
};

export const StudentHome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [lessons, setLessons] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [projects, setProjects] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [lessonsData, attendanceData, projectsData, balanceData] = await Promise.all([
          api.getLessons().catch(() => []),
          api.getMyAttendance().catch(() => []),
          api.getStudentProjects().catch(() => []),
          api.getBalance().catch(() => null),
        ]);
        setLessons(Array.isArray(lessonsData) ? lessonsData : []);
        setAttendance(Array.isArray(attendanceData) ? attendanceData : []);
        setProjects(Array.isArray(projectsData) ? projectsData : []);
        setBalance(balanceData || null);
      } catch (loadError) {
        setError(loadError.message || 'Не удалось загрузить главную.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const nextLesson = useMemo(() => {
    const now = new Date();
    return lessons
      .filter((l) => l.starts_at && new Date(l.starts_at) >= now)
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))[0];
  }, [lessons]);

  const recentGrades = useMemo(
    () => attendance.filter((r) => r.grade != null).slice(0, 5),
    [attendance],
  );

  const grades = useMemo(
    () => attendance.filter((r) => r.grade != null).map((r) => r.grade),
    [attendance],
  );
  const avgGrade = grades.length
    ? (grades.reduce((s, g) => s + Number(g), 0) / grades.length).toFixed(1)
    : null;

  const attendedCount = attendance.filter(
    (r) => r.status === 'present' || r.status === 'makeup',
  ).length;

  const firstName = user?.first_name || 'друг';
  const hello = greetingByHour(new Date().getHours());

  return (
    <AppLayout title="КиберШкола" navItems={studentNavItems} kidMode>
      {error && <div className="alert alert-danger rounded-3">{error}</div>}

      {/* Приветствие */}
      <div className="mb-4">
        <div className="text-muted small">{hello},</div>
        <h1 className="fw-semibold mb-0" style={{ fontSize: '2rem' }}>
          {firstName}
        </h1>
      </div>

      {loading ? (
        <HomeSkeleton />
      ) : (
        <>
          {/* Следующее занятие */}
          <div className="row g-3 mb-3">
            <div className="col-lg-7">
              <div className="card border-0 shadow-sm rounded-4 h-100">
                <div className="card-body p-4">
                  <div className="text-muted small text-uppercase mb-2" style={{ letterSpacing: 0.5 }}>
                    Следующее занятие
                  </div>
                  {nextLesson ? (
                    <div>
                      <div className="d-flex flex-wrap align-items-baseline gap-3 mb-2">
                        <div className="fw-semibold" style={{ fontSize: '2.25rem', lineHeight: 1 }}>
                          {formatTime(nextLesson.starts_at)}
                        </div>
                        <div className="text-muted">{formatFullDate(nextLesson.starts_at)}</div>
                      </div>
                      <div className="mb-1" style={{ fontSize: '1.05rem' }}>
                        {nextLesson.is_makeup_slot
                          ? 'Отработка'
                          : nextLesson.group_name || 'Занятие'}
                      </div>
                      {nextLesson.location_name ? (
                        <div className="text-muted small">{nextLesson.location_name}</div>
                      ) : null}
                      <div className="text-muted small mt-2">
                        {formatCountdown(nextLesson.starts_at)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted py-2">Нет ближайших занятий.</div>
                  )}
                  <button
                    className="btn btn-link p-0 mt-3 text-decoration-none"
                    onClick={() => navigate('/student/schedule')}
                  >
                    Открыть расписание →
                  </button>
                </div>
              </div>
            </div>

            {/* KPI */}
            <div className="col-lg-5">
              <div className="row g-3 h-100">
                <div className="col-6">
                  <StatCard
                    label={Number(balance?.remaining_lessons ?? 0) < 0 ? 'Не оплачен!' : 'Осталось уроков'}
                    value={balance?.remaining_lessons ?? 0}
                    danger={balance == null || Number(balance?.remaining_lessons ?? 0) <= 0}
                  />
                </div>
                <div className="col-6">
                  <StatCard label="Средняя оценка" value={avgGrade ?? '—'} />
                </div>
                <div className="col-6">
                  <StatCard label="Моих проектов" value={projects.length} />
                </div>
                <div className="col-6">
                  <StatCard label="Посещений" value={attendedCount} />
                </div>
              </div>
            </div>
          </div>

          {/* Быстрые действия */}
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <ActionCard
                title="Поделиться проектом"
                subtitle="Загрузить работу в портфолио"
                onClick={() => navigate('/student/projects?tab=mine&new=1')}
              />
            </div>
            <div className="col-md-6">
              <ActionCard
                title="Моё портфолио"
                subtitle="Все проекты, оценки и достижения"
                onClick={() => navigate('/student/portfolio')}
              />
            </div>
          </div>

          {/* Последние оценки */}
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="text-muted small text-uppercase" style={{ letterSpacing: 0.5 }}>
                  Последние оценки
                </div>
                <button
                  className="btn btn-link btn-sm p-0 text-decoration-none"
                  onClick={() => navigate('/student/schedule')}
                >
                  Все занятия →
                </button>
              </div>
              {recentGrades.length === 0 ? (
                <div className="text-muted small">Оценок пока нет.</div>
              ) : (
                <div className="row g-2">
                  {recentGrades.map((r) => (
                    <div className="col-6 col-md-4 col-lg" key={r.id}>
                      <div
                        className="rounded-3 p-3 text-center h-100"
                        style={{ background: '#f8f9fb' }}
                      >
                        <div
                          className="fw-semibold"
                          style={{ fontSize: '1.75rem', lineHeight: 1 }}
                        >
                          {r.grade}
                        </div>
                        <div
                          className="small text-muted text-truncate mt-1"
                          title={r.lesson_topic || ''}
                        >
                          {r.lesson_topic || '—'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
};

const StatCard = ({ label, value, danger }) => {
  const display = useCountUp(value);
  return (
    <div className="card border-0 shadow-sm rounded-4 h-100" style={danger ? { border: '2px solid #ef4444', background: '#fef2f2' } : {}}>
      <div className="card-body p-3">
        <div
          className="small text-uppercase mb-1"
          style={{ letterSpacing: 0.5, fontSize: '0.7rem', color: danger ? '#dc2626' : '#6b7280' }}
        >
          {label}
        </div>
        <div className="fw-semibold" style={{ fontSize: '1.75rem', lineHeight: 1.1, color: danger ? '#dc2626' : undefined }}>
          {display}
        </div>
      </div>
    </div>
  );
};

const useCountUp = (value, duration = 600) => {
  const isNumber = typeof value === 'number' && Number.isFinite(value);
  const [display, setDisplay] = useState(isNumber ? 0 : value);
  useEffect(() => {
    if (!isNumber) {
      setDisplay(value);
      return undefined;
    }
    if (value === 0) {
      setDisplay(0);
      return undefined;
    }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, isNumber]);
  return display;
};

const ActionCard = ({ title, subtitle, onClick }) => (
  <button
    type="button"
    className="card border-0 shadow-sm rounded-4 w-100 text-start p-0 kid-card-clickable"
    onClick={onClick}
  >
    <div className="card-body d-flex align-items-center justify-content-between gap-3 p-4">
      <div>
        <div className="fw-semibold" style={{ fontSize: '1.05rem' }}>
          {title}
        </div>
        <div className="text-muted small">{subtitle}</div>
      </div>
      <div className="text-muted" style={{ fontSize: '1.4rem' }}>
        →
      </div>
    </div>
  </button>
);

const HomeSkeleton = () => (
  <>
    <div className="row g-3 mb-3">
      <div className="col-lg-7">
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-4">
            <div className="kid-skeleton mb-3" style={{ height: 12, width: '40%' }} />
            <div className="kid-skeleton mb-2" style={{ height: 36, width: '50%' }} />
            <div className="kid-skeleton mb-2" style={{ height: 16, width: '70%' }} />
            <div className="kid-skeleton" style={{ height: 16, width: '40%' }} />
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
    <div className="row g-3 mb-3">
      {[0, 1].map((i) => (
        <div className="col-md-6" key={i}>
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-4">
              <div className="kid-skeleton mb-2" style={{ height: 18, width: '50%' }} />
              <div className="kid-skeleton" style={{ height: 12, width: '70%' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  </>
);

export default StudentHome;
