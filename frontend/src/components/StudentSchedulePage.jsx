import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AppLayout, studentNavItems } from './AppLayout';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const STATUS_META = {
  present: { label: 'Был', color: '#16a34a', bg: '#ecfdf5' },
  absent: { label: 'Пропуск', color: '#dc2626', bg: '#fef2f2' },
  makeup: { label: 'Отработка', color: '#2563eb', bg: '#eff6ff' },
};

const MAKEUP_STATUS = {
  requested: { label: 'Ожидает', color: '#b45309', bg: '#fffbeb' },
  approved: { label: 'Подтверждена', color: '#16a34a', bg: '#ecfdf5' },
  completed: { label: 'Проведена', color: '#475569', bg: '#f1f5f9' },
};

const formatTime = (v) =>
  v ? new Date(v).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
const formatDate = (v) =>
  v ? new Date(v).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : '';
const formatDateTime = (v) =>
  v
    ? new Date(v).toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

const startOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfWeek = (monday) => {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const StudentSchedulePage = () => {
  const [tab, setTab] = useState('week');
  const [groups, setGroups] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [makeups, setMakeups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [groupsData, lessonsData, attendanceData, makeupsData] = await Promise.all([
        api.getGroups().catch(() => []),
        api.getLessons().catch(() => []),
        api.getMyAttendance().catch(() => []),
        api.getMyMakeups().catch(() => []),
      ]);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
      setLessons(Array.isArray(lessonsData) ? lessonsData : []);
      setAttendance(Array.isArray(attendanceData) ? attendanceData : []);
      setMakeups(Array.isArray(makeupsData) ? makeupsData : []);
    } catch (e) {
      setError(e.message || 'Не удалось загрузить расписание.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const weekEnd = useMemo(() => endOfWeek(weekStart), [weekStart]);

  const groupIds = useMemo(() => new Set(groups.map((g) => g.id)), [groups]);
  const groupMap = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  const weekLessons = useMemo(() => {
    return lessons
      .filter((l) => {
        if (!l.starts_at) return false;
        const d = new Date(l.starts_at);
        if (d < weekStart || d > weekEnd) return false;
        if (l.is_makeup_slot) {
          const students = Array.isArray(l.makeup_students) ? l.makeup_students : [];
          return students.some((s) => s.status === 'approved');
        }
        return groupIds.has(l.group);
      })
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }, [lessons, weekStart, weekEnd, groupIds]);

  const lessonsByDay = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      return { index: i, label: WEEKDAYS[i], date, lessons: [] };
    });
    for (const l of weekLessons) {
      const d = new Date(l.starts_at);
      const idx = (d.getDay() + 6) % 7;
      days[idx].lessons.push(l);
    }
    return days;
  }, [weekLessons, weekStart]);

  const isToday = (date) => {
    const t = new Date();
    return (
      date.getDate() === t.getDate() &&
      date.getMonth() === t.getMonth() &&
      date.getFullYear() === t.getFullYear()
    );
  };

  const pastAttendance = useMemo(
    () =>
      [...attendance].sort(
        (a, b) => new Date(b.lesson_starts_at) - new Date(a.lesson_starts_at),
      ),
    [attendance],
  );

  const attendanceByLessonId = useMemo(() => {
    const map = new Map();
    for (const r of attendance) {
      const key = r.lesson_id ?? r.lesson;
      if (key != null) map.set(key, r);
    }
    return map;
  }, [attendance]);

  const [selected, setSelected] = useState(null);

  const openLesson = (lesson) => {
    const record = attendanceByLessonId.get(lesson.id) || null;
    const group = groupMap.get(lesson.group);
    setSelected({
      title: lesson.is_makeup_slot
        ? 'Отработка'
        : group?.name || lesson.group_name || 'Занятие',
      startsAt: lesson.starts_at,
      endsAt: lesson.ends_at,
      groupName: group?.name || lesson.group_name || null,
      location: lesson.location_name || null,
      topic:
        record?.lesson_topic ||
        lesson.conducted_topic ||
        lesson.topic_title ||
        lesson.topic ||
        null,
      description: lesson.conducted_description || record?.lesson_description || null,
      isMakeup: Boolean(lesson.is_makeup_slot),
      makeupTopics: lesson.makeup_topics || null,
      status: record?.status || null,
      grade: record?.grade ?? null,
      homework: record?.homework || lesson.homework || null,
      teacherComment: record?.teacher_comment || null,
    });
  };

  const openRecord = (r) => {
    setSelected({
      title: r.group_name || 'Занятие',
      startsAt: r.lesson_starts_at,
      endsAt: r.lesson_ends_at,
      groupName: r.group_name || null,
      location: r.location_name || null,
      topic: r.lesson_topic || null,
      description: r.lesson_description || null,
      isMakeup: Boolean(r.is_makeup),
      makeupTopics: null,
      status: r.status || null,
      grade: r.grade ?? null,
      homework: r.homework || null,
      teacherComment: r.teacher_comment || null,
    });
  };

  return (
    <AppLayout title="КиберШкола" navItems={studentNavItems} kidMode>
      <h1 className="fw-semibold mb-4" style={{ fontSize: '2rem' }}>
        Расписание
      </h1>

      {error && <div className="alert alert-danger rounded-3">{error}</div>}

      {/* Табы */}
      <div className="mb-4 d-flex flex-wrap gap-2">
        <TabButton active={tab === 'week'} onClick={() => setTab('week')} label="Неделя" />
        <TabButton
          active={tab === 'history'}
          onClick={() => setTab('history')}
          label="История"
        />
        <TabButton
          active={tab === 'makeups'}
          onClick={() => setTab('makeups')}
          label={`Отработки${makeups.length ? ` (${makeups.length})` : ''}`}
        />
      </div>

      {loading ? (
        <ScheduleSkeleton />
      ) : tab === 'week' ? (
        <WeekView
          weekStart={weekStart}
          weekEnd={weekEnd}
          lessonsByDay={lessonsByDay}
          weekLessons={weekLessons}
          groupMap={groupMap}
          isToday={isToday}
          onLessonClick={openLesson}
          onPrev={() => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() - 7);
            setWeekStart(d);
          }}
          onNext={() => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + 7);
            setWeekStart(d);
          }}
          onToday={() => setWeekStart(startOfWeek(new Date()))}
        />
      ) : tab === 'history' ? (
        <HistoryView records={pastAttendance} onRecordClick={openRecord} />
      ) : (
        <MakeupsView makeups={makeups} />
      )}

      {selected && <LessonDetailModal data={selected} onClose={() => setSelected(null)} />}
    </AppLayout>
  );
};

const TabButton = ({ active, onClick, label }) => (
  <button
    type="button"
    className={`btn rounded-pill px-3 py-2 ${
      active
        ? 'btn-dark text-white'
        : 'btn-light border'
    }`}
    style={{ fontSize: '0.95rem' }}
    onClick={onClick}
  >
    {label}
  </button>
);

const WeekView = ({
  weekStart,
  weekEnd,
  lessonsByDay,
  weekLessons,
  groupMap,
  isToday,
  onLessonClick,
  onPrev,
  onNext,
  onToday,
}) => (
  <div>
    <div className="card border-0 shadow-sm rounded-4 mb-3">
      <div className="card-body py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
        <button
          type="button"
          className="btn btn-light border rounded-pill px-3"
          onClick={onPrev}
        >
          ← Прошлая
        </button>
        <div className="text-center">
          <div className="fw-semibold">
            {formatDate(weekStart)} — {formatDate(weekEnd)}
          </div>
          <button
            className="btn btn-link btn-sm text-decoration-none p-0"
            onClick={onToday}
          >
            Сегодня
          </button>
        </div>
        <button
          type="button"
          className="btn btn-light border rounded-pill px-3"
          onClick={onNext}
        >
          Следующая →
        </button>
      </div>
    </div>

    {weekLessons.length === 0 ? (
      <EmptyState text="На этой неделе занятий нет." />
    ) : (
      <div className="row g-3">
        {lessonsByDay.map((day) => (
          <div className="col-12 col-sm-6 col-md-4 col-lg" key={day.index}>
            <div
              className="card border-0 shadow-sm rounded-4 h-100 overflow-hidden"
              style={
                isToday(day.date)
                  ? { boxShadow: '0 0 0 2px #1f2937, 0 4px 12px rgba(31,41,55,0.15)' }
                  : {}
              }
            >
              {isToday(day.date) ? (
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
              ) : null}
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-baseline mb-2">
                  <div
                    className="fw-semibold"
                    style={isToday(day.date) ? { color: '#1f2937' } : undefined}
                  >
                    {day.label}
                  </div>
                  <div
                    className={isToday(day.date) ? 'small fw-semibold' : 'text-muted small'}
                    style={isToday(day.date) ? { color: '#1f2937' } : undefined}
                  >
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
                        onClick={() => onLessonClick && onLessonClick(l)}
                      />
                    ))}
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

const LessonCard = ({ lesson, groupMap, onClick }) => {
  const isMakeup = Boolean(lesson.is_makeup_slot);
  const group = groupMap.get(lesson.group);
  const title = isMakeup ? 'Отработка' : group?.name || lesson.group_name || 'Занятие';
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-3 p-2 text-start border-0 w-100"
      style={{
        background: '#f8f9fb',
        borderLeft: `3px solid ${isMakeup ? '#2563eb' : '#1f2937'}`,
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#eef0f3')}
      onMouseLeave={(e) => (e.currentTarget.style.background = '#f8f9fb')}
    >
      <div className="fw-semibold" style={{ fontSize: '0.95rem' }}>
        {formatTime(lesson.starts_at)}
      </div>
      <div className="small">{title}</div>
      {isMakeup && lesson.makeup_topics ? (
        <div className="small text-muted">{lesson.makeup_topics}</div>
      ) : null}
      {lesson.location_name ? (
        <div className="small text-muted">{lesson.location_name}</div>
      ) : null}
    </button>
  );
};

const HistoryView = ({ records, onRecordClick }) => {
  if (records.length === 0) {
    return <EmptyState text="Здесь будет история занятий." />;
  }

  return (
    <div className="d-flex flex-column gap-2">
      {records.map((r) => {
        const meta = STATUS_META[r.status] || STATUS_META.present;
        return (
          <div
            key={r.id}
            className="card border-0 shadow-sm rounded-4 kid-card-clickable"
            role="button"
            tabIndex={0}
            onClick={() => onRecordClick && onRecordClick(r)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && onRecordClick) {
                e.preventDefault();
                onRecordClick(r);
              }
            }}
          >
            <div className="card-body p-3">
              <div className="d-flex flex-wrap align-items-start gap-3">
                <div className="flex-grow-1" style={{ minWidth: 200 }}>
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                    <span className="fw-semibold">{r.group_name || 'Занятие'}</span>
                    <span
                      className="badge rounded-pill"
                      style={{
                        background: meta.bg,
                        color: meta.color,
                        fontWeight: 500,
                      }}
                    >
                      {meta.label}
                    </span>
                  </div>
                  {r.lesson_topic && (
                    <div className="text-muted small mb-1">{r.lesson_topic}</div>
                  )}
                  <div className="text-muted small">
                    {formatDateTime(r.lesson_starts_at)}
                  </div>
                  {r.homework && (
                    <div className="mt-2 small">
                      <span className="text-muted">ДЗ:</span> {r.homework}
                    </div>
                  )}
                  {r.teacher_comment && (
                    <div className="mt-1 small text-muted">{r.teacher_comment}</div>
                  )}
                </div>
                {r.grade != null && (
                  <div
                    className="rounded-3 px-3 py-2 text-center fw-semibold flex-shrink-0"
                    style={{
                      background: '#f8f9fb',
                      minWidth: 56,
                      fontSize: '1.5rem',
                      lineHeight: 1.1,
                    }}
                    title="Оценка"
                  >
                    {r.grade}
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

const MakeupsView = ({ makeups }) => {
  if (makeups.length === 0) {
    return (
      <EmptyState text="Здесь появятся твои отработки. Записывает на отработку родитель." />
    );
  }
  return (
    <div className="d-flex flex-column gap-2">
      {makeups.map((m) => {
        const meta =
          MAKEUP_STATUS[m.status] || { label: m.status, color: '#475569', bg: '#f1f5f9' };
        return (
          <div key={m.id} className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-3">
              <div className="d-flex flex-wrap justify-content-between gap-3">
                <div className="flex-grow-1">
                  <div className="text-muted small">Пропущено</div>
                  <div className="fw-semibold">
                    {formatDateTime(m.absence_starts_at)}
                    {m.absence_group_name ? ` · ${m.absence_group_name}` : ''}
                  </div>
                  <div className="text-muted small mt-2">Слот отработки</div>
                  <div className="fw-semibold">
                    {m.makeup_starts_at ? formatDateTime(m.makeup_starts_at) : '—'}
                    {m.makeup_group_name ? ` · ${m.makeup_group_name}` : ''}
                  </div>
                </div>
                <div className="d-flex align-items-center">
                  <span
                    className="badge rounded-pill px-3 py-2"
                    style={{
                      background: meta.bg,
                      color: meta.color,
                      fontWeight: 500,
                      fontSize: '0.85rem',
                    }}
                  >
                    {meta.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const EmptyState = ({ text }) => (
  <div className="card border-0 shadow-sm rounded-4">
    <div className="card-body text-center py-5 text-muted">{text}</div>
  </div>
);

const ScheduleSkeleton = () => (
  <div>
    <div className="card border-0 shadow-sm rounded-4 mb-3">
      <div className="card-body py-3">
        <div className="kid-skeleton mx-auto" style={{ height: 14, width: 220 }} />
      </div>
    </div>
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
  </div>
);

const LessonDetailModal = ({ data, onClose }) => {
  const meta = data.status ? STATUS_META[data.status] : null;
  const dateStr = data.startsAt
    ? new Date(data.startsAt).toLocaleDateString('ru-RU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : '';
  const timeRange =
    data.startsAt && data.endsAt
      ? `${formatTime(data.startsAt)} – ${formatTime(data.endsAt)}`
      : formatTime(data.startsAt);

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content rounded-4 border-0 shadow-lg">
          <div className="modal-header border-0">
            <div>
              <div className="text-muted small text-capitalize">{dateStr}</div>
              <h5 className="modal-title fw-semibold mb-0">{data.title}</h5>
            </div>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body pt-0">
            <div className="d-flex flex-wrap gap-2 mb-3">
              {timeRange ? (
                <span
                  className="badge rounded-pill"
                  style={{ background: '#f1f5f9', color: '#1f2937', fontWeight: 500 }}
                >
                  {timeRange}
                </span>
              ) : null}
              {data.isMakeup ? (
                <span
                  className="badge rounded-pill"
                  style={{ background: '#eff6ff', color: '#2563eb', fontWeight: 500 }}
                >
                  Отработка
                </span>
              ) : null}
              {meta ? (
                <span
                  className="badge rounded-pill"
                  style={{ background: meta.bg, color: meta.color, fontWeight: 500 }}
                >
                  {meta.label}
                </span>
              ) : null}
            </div>

            <DetailRow label="Группа" value={data.groupName} />
            <DetailRow label="Кабинет" value={data.location} />
            <DetailRow label="Тема" value={data.topic} />
            {data.isMakeup && data.makeupTopics ? (
              <DetailRow label="Темы отработки" value={data.makeupTopics} />
            ) : null}

            {data.description ? (
              <div className="mt-3">
                <div className="text-muted small mb-1">Описание занятия</div>
                <div
                  className="rounded-3 p-3"
                  style={{ background: '#f8f9fb', whiteSpace: 'pre-wrap' }}
                >
                  {data.description}
                </div>
              </div>
            ) : null}

            {data.grade != null ? (
              <div className="mt-3 d-flex align-items-center gap-2">
                <span className="text-muted small">Оценка:</span>
                <span
                  className="rounded-3 px-3 py-1 fw-semibold"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e5e7eb',
                    fontSize: '1.25rem',
                    lineHeight: 1.1,
                  }}
                >
                  {data.grade}
                </span>
              </div>
            ) : null}

            {data.homework ? (
              <div className="mt-3">
                <div className="text-muted small mb-1">Домашнее задание</div>
                <div className="rounded-3 p-3" style={{ background: '#f8f9fb' }}>
                  {data.homework}
                </div>
              </div>
            ) : null}

            {data.teacherComment ? (
              <div className="mt-3">
                <div className="text-muted small mb-1">Комментарий преподавателя</div>
                <div className="rounded-3 p-3" style={{ background: '#f8f9fb' }}>
                  {data.teacherComment}
                </div>
              </div>
            ) : null}

            {!data.topic &&
            !data.description &&
            !data.location &&
            !data.groupName &&
            !data.homework &&
            !data.teacherComment &&
            data.grade == null &&
            !data.makeupTopics ? (
              <div className="text-muted">Подробной информации пока нет.</div>
            ) : null}
          </div>
          <div className="modal-footer border-0">
            <button type="button" className="btn btn-dark rounded-pill px-4" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DetailRow = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="d-flex gap-3 py-1">
      <div className="text-muted small" style={{ minWidth: 100 }}>
        {label}
      </div>
      <div className="flex-grow-1">{value}</div>
    </div>
  );
};

export default StudentSchedulePage;
