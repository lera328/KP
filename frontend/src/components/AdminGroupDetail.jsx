import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { AdminLayout } from './AdminLayout';
import { ConductLessonModal } from './ConductLessonModal';

const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const formatDate = (v) =>
  v ? new Date(v).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

const formatDateTime = (v) =>
  v ? new Date(v).toLocaleString('ru-RU', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

const fullName = (u) => `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
const initials = (u) => ((u.first_name?.[0] || '') + (u.last_name?.[0] || '')).toUpperCase() || '?';

const TABS = [
  { key: 'students', label: 'Ученики' },
  { key: 'schedule', label: 'Расписание' },
  { key: 'planning', label: 'Планирование' },
  { key: 'comments', label: 'Заметки' },
];

export const AdminGroupDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const groupId = Number(id);

  const [group, setGroup] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('students');
  const [commentText, setCommentText] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [allStudents, setAllStudents] = useState([]);

  // Schedule setup
  const [scheduleForm, setScheduleForm] = useState({ teacher: '', starts_at: '' });
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Extra lesson
  const [extraForm, setExtraForm] = useState({ teacher: '', starts_at: '' });
  const [savingExtra, setSavingExtra] = useState(false);

  // Delete group
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [groupData, lessonsData, commentsData, usersData] = await Promise.all([
        api.getGroup(groupId),
        api.getLessons(),
        api.getGroupComments(groupId),
        api.getUsers(),
      ]);
      setGroup(groupData);
      setLessons((Array.isArray(lessonsData) ? lessonsData : []).filter((l) => Number(l.group) === groupId));
      setComments(Array.isArray(commentsData) ? commentsData : []);
      const allUsers = Array.isArray(usersData) ? usersData : [];
      const teachersList = allUsers.filter((u) => Array.isArray(u.roles) && u.roles.includes('teacher'));
      setTeachers(teachersList);
      const studentsList = allUsers.filter((u) => Array.isArray(u.roles) && u.roles.includes('student'));
      setAllStudents(studentsList);
      const defaultTeacher = groupData?.teachers?.[0]?.id ? String(groupData.teachers[0].id) : '';
      setScheduleForm((p) => ({ ...p, teacher: p.teacher || defaultTeacher }));
      setExtraForm((p) => ({ ...p, teacher: p.teacher || defaultTeacher }));
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить данные группы.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (groupId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const now = useMemo(() => new Date(), []);
  const { pastLessons, upcomingLessons } = useMemo(() => {
    const past = [];
    const up = [];
    lessons.forEach((l) => {
      const d = new Date(l.starts_at);
      if (d < now) past.push(l);
      else up.push(l);
    });
    past.sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
    up.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    return { pastLessons: past, upcomingLessons: up };
  }, [lessons, now]);

  const conductedCount = pastLessons.filter((l) => l.conducted_topic).length;

  const availableStudents = useMemo(() => {
    const currentIds = new Set((group?.students || []).map((s) => s.id));
    return allStudents.filter((s) => !currentIds.has(s.id));
  }, [allStudents, group]);

  const handleRemoveStudent = async (studentId) => {
    const currentStudentIds = (group?.students || []).map((s) => s.id).filter((id) => id !== studentId);
    setError('');
    try {
      await api.updateGroup(groupId, { student_ids: currentStudentIds });
      await load();
    } catch (err) {
      setError(err.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0443\u0447\u0435\u043d\u0438\u043a\u0430.');
    }
  };

  const handleAddStudent = async (studentId) => {
    const currentStudentIds = (group?.students || []).map((s) => s.id);
    setError('');
    try {
      await api.updateGroup(groupId, { student_ids: [...currentStudentIds, studentId] });
      await load();
    } catch (err) {
      setError(err.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0443\u0447\u0435\u043d\u0438\u043a\u0430.');
    }
  };

  const handleSetupSchedule = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!scheduleForm.teacher || !scheduleForm.starts_at) {
      setError('Заполните преподавателя и стартовое время.');
      return;
    }
    setSavingSchedule(true);
    try {
      const result = await api.setupGroupSchedule({
        group_id: groupId,
        teacher_id: Number(scheduleForm.teacher),
        starts_at: new Date(scheduleForm.starts_at).toISOString(),
      });
      setSuccess(`Расписание настроено. Создано занятий: ${result?.created_count || 0}.`);
      await load();
    } catch (err) {
      setError(err.message || 'Не удалось настроить расписание.');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleAddExtra = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!extraForm.teacher || !extraForm.starts_at) {
      setError('Заполните преподавателя и дату/время.');
      return;
    }
    setSavingExtra(true);
    try {
      await api.addExtraLesson({
        group_id: groupId,
        teacher_id: Number(extraForm.teacher),
        starts_at: new Date(extraForm.starts_at).toISOString(),
      });
      setSuccess('Разовое занятие добавлено.');
      await load();
    } catch (err) {
      setError(err.message || 'Не удалось добавить занятие.');
    } finally {
      setSavingExtra(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm(`Удалить группу «${group?.name}» вместе со всеми уроками? Это действие необратимо.`)) return;
    setDeletingGroup(true);
    setError('');
    try {
      await api.deleteGroup(groupId);
      navigate('/admin/groups');
    } catch (err) {
      setError(err.message || 'Не удалось удалить группу.');
      setDeletingGroup(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text) return;
    setSavingComment(true);
    try {
      const created = await api.addGroupComment(groupId, text);
      setComments((prev) => [created, ...prev]);
      setCommentText('');
    } catch (saveError) {
      setError(saveError.message || 'Не удалось добавить заметку.');
    } finally {
      setSavingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Удалить заметку?')) return;
    try {
      await api.deleteGroupComment(groupId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (delError) {
      setError(delError.message || 'Не удалось удалить заметку.');
    }
  };

  return (
    <AdminLayout title="КиберШкола — Группа">
      <button type="button" className="btn btn-link text-decoration-none px-0 mb-2" onClick={() => navigate(-1)}>← Назад</button>

      {error && <div className="alert alert-danger rounded-3">{error}</div>}
      {success && <div className="alert alert-success rounded-3">{success}</div>}

      {loading || !group ? (
        <div className="kid-skeleton" style={{ height: 120, borderRadius: 16 }} />
      ) : (
        <>
          {/* Шапка группы */}
          <div className="card border-0 shadow-sm rounded-4 mb-3">
            <div className="card-body p-4">
              <div className="d-flex flex-wrap align-items-center gap-3">
                <div className="flex-grow-1">
                  <h1 className="fw-semibold mb-1" style={{ fontSize: '1.75rem' }}>{group.name}</h1>
                  <div className="text-muted small d-flex flex-wrap gap-3">
                    {group.location_name && <span>{group.location_name}</span>}
                    {group.weekly_lesson_time && (
                      <span>
                        {WEEKDAY_SHORT[group.weekly_lesson_weekday] || '—'}{' · '}{String(group.weekly_lesson_time).slice(0, 5)}
                      </span>
                    )}
                    <span
                      className="badge rounded-pill"
                      style={{
                        background: group.is_active ? '#ecfdf5' : '#f3f4f6',
                        color: group.is_active ? '#16a34a' : '#6b7280',
                        fontWeight: 500,
                      }}
                    >
                      {group.is_active ? 'Активна' : 'Архив'}
                    </span>
                  </div>
                </div>
                <button
                  className="btn btn-outline-danger btn-sm rounded-pill px-3"
                  onClick={handleDeleteGroup}
                  disabled={deletingGroup}
                >
                  {deletingGroup ? 'Удаляем...' : 'Удалить'}
                </button>
              </div>

              <div className="row g-2 mt-3">
                <KpiCard label="Учеников" value={group.students?.length || 0} />
                <KpiCard label="Преподавателей" value={group.teachers?.length || 0} />
                <KpiCard label="Проведено" value={conductedCount} />
                <KpiCard label="Впереди" value={upcomingLessons.length} />
              </div>
            </div>
          </div>

          {/* Табы */}
          <div className="d-flex gap-2 mb-3 flex-wrap">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className="btn btn-sm rounded-pill px-4"
                style={{
                  background: tab === t.key ? '#111827' : '#f8f9fb',
                  color: tab === t.key ? '#fff' : '#374151',
                  border: `1px solid ${tab === t.key ? '#111827' : '#e5e7eb'}`,
                  fontWeight: tab === t.key ? 600 : 500,
                }}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'students' && (
            <StudentsList
              students={group.students || []}
              teachers={group.teachers || []}
              navigate={navigate}
              onRemoveStudent={handleRemoveStudent}
              availableStudents={availableStudents}
              onAddStudent={handleAddStudent}
              allStudents={allStudents}
            />
          )}

          {tab === 'schedule' && (
            <ScheduleList upcoming={upcomingLessons} past={pastLessons} onLessonClick={(l) => setSelectedLesson(l)} />
          )}

          {tab === 'planning' && (
            <div className="d-flex flex-column gap-3">
              <div className="card border-0 shadow-sm rounded-4">
                <div className="card-body p-4">
                  <h6 className="fw-semibold mb-1">Настроить регулярное расписание</h6>
                  <p className="text-muted small mb-3">
                    Создаст еженедельные уроки на год вперёд по выбранному дню недели и времени. Слот группы автоматически обновится.
                  </p>
                  <form onSubmit={handleSetupSchedule} className="row g-3">
                    <div className="col-md-5">
                      <label className="form-label">Преподаватель</label>
                      <select className="form-select" value={scheduleForm.teacher} onChange={(e) => setScheduleForm((p) => ({ ...p, teacher: e.target.value }))} disabled={savingSchedule}>
                        <option value="">— выберите —</option>
                        {teachers.map((t) => <option key={t.id} value={t.id}>{fullName(t)}</option>)}
                      </select>
                    </div>
                    <div className="col-md-5">
                      <label className="form-label">Стартовое занятие</label>
                      <input type="datetime-local" className="form-control" value={scheduleForm.starts_at} onChange={(e) => setScheduleForm((p) => ({ ...p, starts_at: e.target.value }))} disabled={savingSchedule} />
                    </div>
                    <div className="col-md-2 d-flex align-items-end">
                      <button type="submit" className="btn btn-dark rounded-pill w-100" disabled={savingSchedule}>
                        {savingSchedule ? '...' : 'Прописать'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              <div className="card border-0 shadow-sm rounded-4">
                <div className="card-body p-4">
                  <h6 className="fw-semibold mb-3">Добавить разовое занятие</h6>
                  <form onSubmit={handleAddExtra} className="row g-3">
                    <div className="col-md-5">
                      <label className="form-label">Преподаватель</label>
                      <select className="form-select" value={extraForm.teacher} onChange={(e) => setExtraForm((p) => ({ ...p, teacher: e.target.value }))} disabled={savingExtra}>
                        <option value="">— выберите —</option>
                        {teachers.map((t) => <option key={t.id} value={t.id}>{fullName(t)}</option>)}
                      </select>
                    </div>
                    <div className="col-md-5">
                      <label className="form-label">Дата и время</label>
                      <input type="datetime-local" className="form-control" value={extraForm.starts_at} onChange={(e) => setExtraForm((p) => ({ ...p, starts_at: e.target.value }))} disabled={savingExtra} />
                    </div>
                    <div className="col-md-2 d-flex align-items-end">
                      <button type="submit" className="btn btn-dark rounded-pill w-100" disabled={savingExtra}>
                        {savingExtra ? '...' : 'Добавить'}
                      </button>
                    </div>
                    <div className="col-12">
                      <div className="form-text">Система не даст занять уже занятый слот по локации/преподавателю.</div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {tab === 'comments' && (
            <CommentsList
              comments={comments}
              commentText={commentText}
              onChangeText={setCommentText}
              onSubmit={handleAddComment}
              saving={savingComment}
              onDelete={handleDeleteComment}
            />
          )}
        </>
      )}

      {selectedLesson && (
        <ConductLessonModal
          lesson={selectedLesson}
          group={group}
          onClose={() => setSelectedLesson(null)}
          onSaved={() => { setSelectedLesson(null); load(); }}
        />
      )}
    </AdminLayout>
  );
};

/* ─── Sub-components ─── */

const KpiCard = ({ label, value }) => (
  <div className="col-6 col-md-3">
    <div className="rounded-3 p-3 h-100" style={{ background: '#f8f9fb' }}>
      <div className="text-muted small">{label}</div>
      <div className="fw-semibold" style={{ fontSize: '1.5rem', lineHeight: 1.2 }}>{value}</div>
    </div>
  </div>
);

const StudentsList = ({ students, teachers, navigate, onRemoveStudent, availableStudents, onAddStudent, allStudents }) => {
  const [addQuery, setAddQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const filteredAvailable = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    if (!q) return availableStudents;
    return availableStudents.filter((s) => fullName(s).toLowerCase().includes(q) || s.username.toLowerCase().includes(q));
  }, [availableStudents, addQuery]);

  const balanceMap = useMemo(() => {
    const m = {};
    (allStudents || []).forEach((s) => { m[s.id] = s.balance; });
    return m;
  }, [allStudents]);

  const all = [
    ...teachers.map((t) => ({ ...t, _role: 'teacher' })),
    ...students.map((s) => ({ ...s, _role: 'student', balance: balanceMap[s.id] })),
  ];

  return (
    <div className="d-flex flex-column gap-2">
      {/* Добавление ученика */}
      <div className="card border-0 shadow-sm rounded-4 mb-2">
        <div className="card-body p-3">
          <div className="position-relative">
            <button
              type="button"
              className="btn btn-outline-dark btn-sm rounded-pill px-3 w-100 text-start d-flex justify-content-between align-items-center"
              onClick={() => setAddOpen((p) => !p)}
            >
              <span>+ Добавить ученика</span>
              <span className="text-muted">▾</span>
            </button>
            {addOpen && (
              <div className="border rounded bg-white p-2 mt-1 position-absolute w-100 shadow-sm" style={{ zIndex: 20, maxHeight: '220px', overflow: 'auto' }}>
                <input
                  type="text"
                  className="form-control form-control-sm mb-2"
                  placeholder="Поиск по имени..."
                  value={addQuery}
                  onChange={(e) => setAddQuery(e.target.value)}
                  autoFocus
                />
                {filteredAvailable.length === 0 ? (
                  <div className="text-muted small px-1 py-2">Нет доступных учеников.</div>
                ) : (
                  filteredAvailable.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="btn btn-sm btn-light w-100 text-start mb-1"
                      onClick={() => { onAddStudent(s.id); setAddOpen(false); setAddQuery(''); }}
                    >
                      {fullName(s)} <span className="text-muted small">@{s.username}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {all.length === 0 ? (
        <Empty text="В группе пока нет участников." />
      ) : all.map((u) => {
        const name = fullName(u);
        const init = initials(u);
        const isTeacher = u._role === 'teacher';
        const hasDebt = !isTeacher && (u.balance === null || u.balance === undefined || u.balance < 0);
        return (
          <div
            key={`${u._role}-${u.id}`}
            className="card border-0 shadow-sm rounded-4"
            style={hasDebt ? { border: '2px solid #ef4444', background: '#fef2f2' } : {}}
          >
            <div className="card-body p-3 d-flex align-items-center gap-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center fw-semibold flex-shrink-0"
                style={{
                  width: 44, height: 44, fontSize: '0.95rem',
                  background: hasDebt ? '#fee2e2' : isTeacher ? '#eff6ff' : '#eef2ff',
                  color: hasDebt ? '#dc2626' : isTeacher ? '#2563eb' : '#3730a3',
                }}
              >
                {init || '👤'}
              </div>
              <div className="flex-grow-1" style={{ cursor: 'pointer' }} onClick={() => navigate(isTeacher ? `/admin/teachers/${u.id}` : `/admin/students/${u.id}`)}>
                <div className="fw-semibold" style={hasDebt ? { color: '#dc2626' } : {}}>{name}</div>
                <div className="text-muted small">
                  @{u.username}
                  {isTeacher && (
                    <span className="badge rounded-pill ms-2" style={{ background: '#eff6ff', color: '#2563eb', fontWeight: 500, fontSize: '0.6rem' }}>Преподаватель</span>
                  )}
                </div>
              </div>
              {hasDebt && (
                <span className="badge rounded-pill" style={{ background: '#fee2e2', color: '#dc2626', fontWeight: 600, fontSize: '0.75rem' }}>
                  {u.balance}
                </span>
              )}
              {!isTeacher && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger rounded-pill px-2"
                  title="Убрать из группы"
                  onClick={() => onRemoveStudent(u.id)}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const TILE_META = {
  upcoming: { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280', dot: '#9ca3af', label: 'Запланирован' },
  done: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', dot: '#16a34a', label: 'Проведён' },
  pending: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', dot: '#b45309', label: 'Не проведён' },
};

const ScheduleList = ({ upcoming, past, onLessonClick }) => {
  const now = new Date();
  const allSorted = useMemo(() => {
    const items = [
      ...upcoming.map((l) => ({ ...l, _tone: 'upcoming' })),
      ...past.map((l) => ({ ...l, _tone: l.conducted_topic ? 'done' : 'pending' })),
    ];
    items.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    return items;
  }, [upcoming, past]);

  const nowIndex = useMemo(() => {
    for (let i = 0; i < allSorted.length; i += 1) {
      if (new Date(allSorted[i].starts_at) >= now) return i;
    }
    return allSorted.length;
  }, [allSorted, now]);

  const tiles = [];
  allSorted.forEach((l, idx) => {
    if (idx === nowIndex) {
      tiles.push(
        <div key="__now__" style={{ background: '#fff', border: '2px dashed #6b7280', borderRadius: 10, padding: '6px 8px', minWidth: 56, textAlign: 'center', color: '#374151', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <svg width="10" height="14" viewBox="0 0 10 14" fill="none" style={{ display: 'block' }}><path d="M1 1h8v9l-4 3-4-3V1z" fill="#374151" /></svg>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, lineHeight: 1 }}>Сейчас</div>
        </div>,
      );
    }
    const meta = TILE_META[l._tone] || TILE_META.upcoming;
    const dt = new Date(l.starts_at);
    const weekday = WEEKDAY_SHORT[(dt.getDay() + 6) % 7];
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const isToday = dt.toDateString() === now.toDateString();
    tiles.push(
      <button
        key={l.id}
        type="button"
        onClick={() => onLessonClick(l)}
        title={[formatDateTime(l.starts_at), l.conducted_topic || l.topic_title || 'Тема не указана', meta.label].filter(Boolean).join('\n')}
        style={{
          background: meta.bg,
          border: `1.5px solid ${isToday ? '#111827' : meta.border}`,
          borderRadius: 10,
          padding: '6px 8px',
          minWidth: 56,
          textAlign: 'center',
          color: meta.text,
          cursor: 'pointer',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          boxShadow: isToday ? '0 0 0 2px rgba(17,24,39,0.15)' : 'none',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = isToday ? '0 0 0 2px rgba(17,24,39,0.15)' : 'none'; }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.dot, margin: '0 auto 3px' }} />
        <div style={{ fontSize: '0.68rem', fontWeight: 600, opacity: 0.7, lineHeight: 1.1 }}>{weekday}</div>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, lineHeight: 1.2 }}>{dd}.{mm}</div>
      </button>,
    );
  });
  if (nowIndex === allSorted.length) {
    tiles.push(
      <div key="__now__" style={{ background: '#fff', border: '2px dashed #6b7280', borderRadius: 10, padding: '6px 8px', minWidth: 56, textAlign: 'center', color: '#374151', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <svg width="10" height="14" viewBox="0 0 10 14" fill="none" style={{ display: 'block' }}><path d="M1 1h8v9l-4 3-4-3V1z" fill="#374151" /></svg>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, lineHeight: 1 }}>Сейчас</div>
      </div>,
    );
  }

  const legendItems = [
    { key: 'done', label: 'Проведён' },
    { key: 'upcoming', label: 'Запланирован' },
    { key: 'pending', label: 'Не проведён' },
  ];

  return (
    <div className="card border-0 shadow-sm rounded-4">
      <div className="card-body p-3">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <div className="fw-semibold" style={{ fontSize: '0.95rem' }}>История и прогноз посещений</div>
        </div>
        {allSorted.length === 0 ? (
          <div className="text-muted small text-center py-3">Занятий не найдено.</div>
        ) : (
          <div className="d-flex flex-wrap gap-2">{tiles}</div>
        )}
        <div className="d-flex flex-wrap gap-4 mt-3 pt-2" style={{ borderTop: '1px solid #f3f4f6' }}>
          {legendItems.map((li) => {
            const m = TILE_META[li.key];
            return (
              <div key={li.key} className="d-flex align-items-center gap-2">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.dot, display: 'inline-block' }} />
                  <span className="small" style={{ color: m.text, fontWeight: 500 }}>{li.label}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Empty = ({ text }) => (
  <div className="card border-0 shadow-sm rounded-4">
    <div className="card-body text-center py-4 text-muted small">{text}</div>
  </div>
);

const CommentsList = ({ comments, commentText, onChangeText, onSubmit, saving, onDelete }) => (
  <>
    <form onSubmit={onSubmit} className="card border-0 shadow-sm rounded-4 mb-3">
      <div className="card-body p-3">
        <label className="form-label small text-muted">Новая заметка</label>
        <textarea className="form-control rounded-3" rows={3} value={commentText} onChange={(e) => onChangeText(e.target.value)} placeholder="Например: разобрали циклы, Маша отлично справляется…" disabled={saving} />
        <div className="mt-2 text-end">
          <button type="submit" className="btn btn-dark rounded-pill px-4" disabled={saving || !commentText.trim()}>
            {saving ? 'Сохраняем…' : 'Добавить'}
          </button>
        </div>
      </div>
    </form>
    {comments.length === 0 ? (
      <Empty text="Заметок пока нет." />
    ) : (
      <div className="d-flex flex-column gap-2">
        {comments.map((c) => (
          <div key={c.id} className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-3">
              <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
                <div>
                  <div className="fw-semibold small">{c.author_name}</div>
                  <div className="text-muted" style={{ fontSize: '0.78rem' }}>{formatDate(c.created_at)}</div>
                </div>
                {c.is_mine && <button type="button" className="btn btn-sm btn-link text-danger px-0" onClick={() => onDelete(c.id)}>Удалить</button>}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{c.text}</div>
            </div>
          </div>
        ))}
      </div>
    )}
  </>
);

export default AdminGroupDetail;
