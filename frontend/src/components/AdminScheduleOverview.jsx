import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { AdminLayout } from './AdminLayout';
import { ConductLessonModal } from './ConductLessonModal';
import { IconRefresh, IconCalendar } from './KidIcons';

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const getWeekRange = (ref = new Date()) => {
  const d = new Date(ref);
  const diff = (d.getDay() + 6) % 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - diff);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { monday: mon, sunday: sun };
};

const formatTime = (v) =>
  v ? new Date(v).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '-';

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const isLessonConducted = (l) =>
  Boolean(
    (l.conducted_topic || '').trim() ||
    (l.conducted_description || '').trim() ||
    (Array.isArray(l.attendance_records) && l.attendance_records.length > 0),
  );

const lessonStatus = (l) => {
  if (isLessonConducted(l)) return 'conducted';
  return new Date(l.starts_at) < new Date() ? 'overdue' : 'upcoming';
};

const STATUS_STYLE = {
  conducted: { bg: '#ecfdf5', border: '#16a34a', dot: '#16a34a', label: 'Проведён' },
  upcoming:  { bg: '#f0f4ff', border: '#6366f1', dot: '#6366f1', label: 'Предстоит' },
  overdue:   { bg: '#fef3c7', border: '#d97706', dot: '#d97706', label: 'Не проведён' },
};

export const AdminScheduleOverview = ({ embedded = false }) => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekRange().monday);
  const [groupFilter, setGroupFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');

  const [conductLesson, setConductLesson] = useState(null);
  const [infoLesson, setInfoLesson] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [g, u, l] = await Promise.all([api.getGroups(), api.getUsers(), api.getLessons()]);
      setGroups(Array.isArray(g) ? g : []);
      setTeachers((Array.isArray(u) ? u : []).filter(
        (x) => x?.is_superuser || (Array.isArray(x?.roles) && x.roles.includes('teacher')),
      ));
      setLessons(Array.isArray(l) ? l : []);
    } catch (e) {
      setError(e.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const weekRange = useMemo(() => getWeekRange(currentWeekStart), [currentWeekStart]);
  const groupMap = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const weekLessons = useMemo(() => {
    return lessons
      .filter((l) => {
        if (!l.starts_at) return false;
        const dt = new Date(l.starts_at);
        if (dt < weekRange.monday || dt > weekRange.sunday) return false;
        if (groupFilter && Number(l.group) !== Number(groupFilter)) return false;
        if (teacherFilter && Number(l.teacher) !== Number(teacherFilter)) return false;
        return true;
      })
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }, [lessons, weekRange, groupFilter, teacherFilter]);

  const lessonsByDay = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekRange.monday);
      date.setDate(weekRange.monday.getDate() + i);
      return { index: i, label: WEEKDAY_LABELS[i], date, lessons: [] };
    });
    for (const l of weekLessons) {
      const di = (new Date(l.starts_at).getDay() + 6) % 7;
      days[di].lessons.push(l);
    }
    return days;
  }, [weekLessons, weekRange]);

  const teacherLabel = (t) => {
    if (!t) return '-';
    return `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.username || `ID ${t.id}`;
  };

  const navWeek = (d) => setCurrentWeekStart((c) => {
    const n = new Date(c); n.setDate(n.getDate() + d * 7); return n;
  });

  const handleDelete = async (lesson) => {
    if (!window.confirm('Удалить это занятие? Это действие нельзя отменить.')) return;
    setDeleting(lesson.id);
    try {
      await api.deleteLesson(lesson.id);
      setLessons((prev) => prev.filter((l) => l.id !== lesson.id));
      setInfoLesson(null);
      setSuccess('Занятие удалено.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.message || 'Ошибка удаления');
    } finally {
      setDeleting(null);
    }
  };

  const handleConductSaved = async () => {
    setConductLesson(null);
    setInfoLesson(null);
    setSuccess('Урок сохранён.');
    await loadData();
    setTimeout(() => setSuccess(''), 3000);
  };

  const content = (
    <div className="container-fluid mt-3">
      {error && <div className="alert alert-danger rounded-3">{error}</div>}
      {success && <div className="alert alert-success rounded-3">{success}</div>}

      {/* Header */}
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h1 className="fw-semibold mb-0" style={{ fontSize: '1.75rem' }}>
          <IconCalendar width={28} height={28} style={{ marginRight: 8, verticalAlign: -4 }} />
          Расписание
        </h1>
        <div className="ms-auto d-flex gap-2 flex-wrap align-items-center">
          <select
            className="form-select form-select-sm rounded-pill"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            disabled={loading}
            style={{ minWidth: 140 }}
          >
            <option value="">Все группы</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select
            className="form-select form-select-sm rounded-pill"
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
            disabled={loading}
            style={{ minWidth: 160 }}
          >
            <option value="">Все преподаватели</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{teacherLabel(t)}</option>)}
          </select>

          <div className="btn-group">
            <button className="btn btn-light border rounded-start-pill px-3 btn-sm" onClick={() => navWeek(-1)} disabled={loading}>‹</button>
            <button className="btn btn-light border px-3 btn-sm" onClick={() => setCurrentWeekStart(getWeekRange().monday)} disabled={loading}>Сегодня</button>
            <button className="btn btn-light border rounded-end-pill px-3 btn-sm" onClick={() => navWeek(1)} disabled={loading}>›</button>
          </div>
          <button className="btn btn-light border rounded-pill btn-sm px-3" onClick={loadData} disabled={loading}>
            <IconRefresh width={14} height={14} />
          </button>
        </div>
      </div>

      {/* Period label */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body py-2 text-center fw-semibold">
          {weekRange.monday.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
          {' — '}
          {weekRange.sunday.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Week grid */}
      {loading ? (
        <div className="row g-3">
          {[0,1,2,3,4,5,6].map((i) => (
            <div className="col-12 col-sm-6 col-md-4 col-lg" key={i}>
              <div className="card border-0 shadow-sm rounded-4 h-100"><div className="card-body p-3"><div className="kid-skeleton mb-2" style={{ height: 14, width: '60%' }} /><div className="kid-skeleton" style={{ height: 40 }} /></div></div>
            </div>
          ))}
        </div>
      ) : lessonsByDay.every((d) => d.lessons.length === 0) ? (
        <div className="card border-0 shadow-sm rounded-4"><div className="card-body text-center py-5 text-muted">На этой неделе занятий нет.</div></div>
      ) : (
        <div className="row g-3">
          {lessonsByDay.map((day) => {
            const isToday = isSameDay(day.date, today);
            return (
              <div className="col-12 col-sm-6 col-md-4 col-lg" key={day.index}>
                <div
                  className="card border-0 shadow-sm rounded-4 h-100 overflow-hidden"
                  style={isToday ? { boxShadow: '0 0 0 2px #1f2937, 0 4px 12px rgba(31,41,55,0.15)' } : {}}
                >
                  {isToday && (
                    <div className="text-white text-center py-1 fw-semibold" style={{ background: '#1f2937', fontSize: '0.7rem', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                      Сегодня
                    </div>
                  )}
                  <div className="card-body p-3">
                    <div className="d-flex justify-content-between align-items-baseline mb-2">
                      <div className="fw-semibold">{day.label}</div>
                      <div className="text-muted small">{day.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</div>
                    </div>
                    {day.lessons.length === 0 ? (
                      <div className="text-muted small">—</div>
                    ) : (
                      <div className="d-flex flex-column gap-2">
                        {day.lessons.map((l) => (
                          <AdminLessonCard
                            key={l.id}
                            lesson={l}
                            groupMap={groupMap}
                            teacherMap={teacherMap}
                            teacherLabel={teacherLabel}
                            onClick={() => setInfoLesson(l)}
                            navigate={navigate}
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
      )}

      {/* Info modal */}
      {infoLesson && !conductLesson && (
        <AdminLessonInfoModal
          lesson={infoLesson}
          groupMap={groupMap}
          teacherMap={teacherMap}
          teacherLabel={teacherLabel}
          onClose={() => setInfoLesson(null)}
          onConduct={() => setConductLesson(infoLesson)}
          onDelete={() => handleDelete(infoLesson)}
          deleting={deleting === infoLesson.id}
          navigate={navigate}
        />
      )}

      {/* Conduct modal */}
      {conductLesson && (
        <ConductLessonModal
          lesson={conductLesson}
          group={groupMap.get(conductLesson.group)}
          onClose={() => setConductLesson(null)}
          onSaved={handleConductSaved}
        />
      )}
    </div>
  );

  if (embedded) return content;

  return (
    <AdminLayout title="Расписание">
      {content}
    </AdminLayout>
  );
};

/* ─── Карточка урока в сетке недели ─── */
const AdminLessonCard = ({ lesson, groupMap, teacherMap, teacherLabel, onClick, navigate }) => {
  const group = groupMap.get(lesson.group);
  const teacher = teacherMap.get(lesson.teacher);
  const isMakeup = Boolean(lesson.is_makeup_slot);
  const status = lessonStatus(lesson);
  const st = STATUS_STYLE[status];

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-start rounded-3 p-2 border-0 w-100"
      style={{ background: isMakeup ? '#eff6ff' : st.bg, borderLeft: `3px solid ${isMakeup ? '#2563eb' : st.border}`, transition: 'filter 0.15s' }}
      onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(0.96)')}
      onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
    >
      <div className="d-flex align-items-center gap-2 mb-1">
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: isMakeup ? '#2563eb' : st.dot, color: '#fff', fontSize: '0.55rem', fontWeight: 700, flexShrink: 0 }}>
          {status === 'conducted' ? '✓' : status === 'overdue' ? '!' : '○'}
        </span>
        <div className="fw-semibold small">{formatTime(lesson.starts_at)}</div>
      </div>
      <div className="small fw-semibold text-truncate" style={{ color: '#111827' }}>
        {isMakeup ? 'Отработка' : group?.name || lesson.group_name || `#${lesson.group}`}
      </div>
      <div className="text-muted" style={{ fontSize: '0.72rem' }}>
        {teacherLabel(teacher)}
      </div>
      <div className="mt-1 d-flex flex-wrap gap-1">
        <span className="badge rounded-pill" style={{ background: isMakeup ? '#dbeafe' : st.bg, color: isMakeup ? '#2563eb' : st.dot, fontWeight: 500, fontSize: '0.6rem' }}>
          {isMakeup ? 'Отработка' : st.label}
        </span>
      </div>
    </button>
  );
};

/* ─── Модалка информации/действий для админа ─── */
const AdminLessonInfoModal = ({ lesson, groupMap, teacherMap, teacherLabel, onClose, onConduct, onDelete, deleting, navigate }) => {
  const group = groupMap.get(lesson.group);
  const teacher = teacherMap.get(lesson.teacher);
  const isMakeup = Boolean(lesson.is_makeup_slot);
  const status = lessonStatus(lesson);
  const st = STATUS_STYLE[status];
  const attendance = Array.isArray(lesson.attendance_records) ? lesson.attendance_records : [];
  const presentCount = attendance.filter((a) => a.status === 'present').length;
  const absentCount = attendance.filter((a) => a.status === 'absent').length;

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content rounded-4 border-0 shadow-lg">
          <div className="modal-header border-0">
            <div className="flex-grow-1">
              <div className="text-muted small">
                {lesson.starts_at ? new Date(lesson.starts_at).toLocaleString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
              </div>
              <h5 className="modal-title fw-semibold mb-0">
                {isMakeup ? 'Слот отработки' : group?.name || lesson.group_name || `Группа #${lesson.group}`}
              </h5>
            </div>
            <span className="badge rounded-pill me-2" style={{ background: st.bg, color: st.dot, fontWeight: 600 }}>{st.label}</span>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body pt-0">
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                {!isMakeup && group && (
                  <div className="mb-2">
                    <strong>Группа: </strong>
                    <button type="button" className="btn btn-link p-0 fw-semibold" onClick={() => { onClose(); navigate(`/admin/groups`); }}>{group.name}</button>
                  </div>
                )}
                <div className="mb-1">
                  <strong>Преподаватель: </strong>
                  {teacher ? (
                    <button type="button" className="btn btn-link p-0 fw-semibold" onClick={() => { onClose(); navigate(`/admin/teachers/${lesson.teacher}`); }}>{teacherLabel(teacher)}</button>
                  ) : '-'}
                </div>
                <div className="mb-1"><strong>Тип: </strong>{isMakeup ? 'Отработка' : lesson.is_extra ? 'Разовое' : 'Регулярное'}</div>
              </div>
              <div className="col-md-6">
                {isLessonConducted(lesson) && (
                  <>
                    <div className="mb-1"><strong>Тема: </strong>{lesson.conducted_topic || '—'}</div>
                    <div className="mb-1"><strong>Описание: </strong>{lesson.conducted_description || '—'}</div>
                    <div className="mb-1"><strong>ДЗ: </strong>{lesson.homework || '—'}</div>
                  </>
                )}
                {attendance.length > 0 && (
                  <div className="d-flex gap-2 mt-2">
                    <span className="badge rounded-pill" style={{ background: '#ecfdf5', color: '#16a34a' }}>Был: {presentCount}</span>
                    <span className="badge rounded-pill" style={{ background: '#fef2f2', color: '#dc2626' }}>Пропуск: {absentCount}</span>
                    <span className="text-muted small">из {attendance.length}</span>
                  </div>
                )}
                {isMakeup && Array.isArray(lesson.makeup_students) && lesson.makeup_students.length > 0 && (
                  <div className="mt-2">
                    <strong>Записаны: </strong>
                    <div className="d-flex flex-wrap gap-1 mt-1">
                      {lesson.makeup_students.map((s, i) => (
                        <span key={s.student_id ?? i} className="badge rounded-pill" style={{ background: '#eff6ff', color: '#1d4ed8', fontWeight: 500 }}>{s.student_name}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="modal-footer border-0 d-flex flex-wrap gap-2">
            <button type="button" className="btn btn-outline-danger rounded-pill px-3 me-auto" onClick={onDelete} disabled={deleting}>
              {deleting ? 'Удаление…' : 'Удалить занятие'}
            </button>
            <button type="button" className="btn btn-light border rounded-pill px-4" onClick={onClose}>Закрыть</button>
            <button type="button" className="btn btn-dark rounded-pill px-4" onClick={onConduct}>
              {isLessonConducted(lesson) ? 'Редактировать' : 'Провести урок'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
