import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { AppLayout, teacherNavItems } from './AppLayout';
import { ConductLessonModal } from './ConductLessonModal';

const formatDate = (v) =>
  v
    ? new Date(v).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '';

const formatDateTime = (v) =>
  v
    ? new Date(v).toLocaleString('ru-RU', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

const TABS = [
  { key: 'students', label: 'Ученики' },
  { key: 'schedule', label: 'Расписание' },
  { key: 'comments', label: 'Заметки' },
];

export const TeacherGroupDetail = () => {
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

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [groupData, lessonsData, commentsData] = await Promise.all([
        api.getGroup(groupId),
        api.getLessons(),
        api.getGroupComments(groupId),
      ]);
      setGroup(groupData);
      setLessons(
        (Array.isArray(lessonsData) ? lessonsData : []).filter(
          (l) => Number(l.group) === groupId,
        ),
      );
      setComments(Array.isArray(commentsData) ? commentsData : []);
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
    <AppLayout title="КиберШкола" navItems={teacherNavItems} kidMode>
      <button
        type="button"
        className="btn btn-link text-decoration-none px-0 mb-2"
        onClick={() => navigate('/teacher')}
      >
        ← Назад
      </button>

      {error && <div className="alert alert-danger rounded-3">{error}</div>}

      {loading || !group ? (
        <div className="kid-skeleton" style={{ height: 120, borderRadius: 16 }} />
      ) : (
        <>
          {/* Шапка группы */}
          <div className="card border-0 shadow-sm rounded-4 mb-3">
            <div className="card-body p-4">
              <div className="d-flex flex-wrap align-items-center gap-3">
                <div className="flex-grow-1">
                  <h1 className="fw-semibold mb-1" style={{ fontSize: '1.75rem' }}>
                    {group.name}
                  </h1>
                  <div className="text-muted small d-flex flex-wrap gap-3">
                    {group.location_name && (
                      <span>{group.location_name}</span>
                    )}
                    {group.weekly_lesson_time && (
                      <span>
                        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][group.weekly_lesson_weekday] || '—'}
                        {' · '}
                        {String(group.weekly_lesson_time).slice(0, 5)}
                      </span>
                    )}
                    <span
                      className={`badge rounded-pill ${group.is_active ? '' : 'text-muted'}`}
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
              </div>

              <div className="row g-2 mt-3">
                <KpiCard label="Учеников" value={group.students?.length || 0} />
                <KpiCard label="Проведено" value={conductedCount} />
                <KpiCard label="Впереди" value={upcomingLessons.length} />
                <KpiCard label="Заметок" value={comments.length} />
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
              onStudentClick={(s) => navigate(`/teacher/students/${s.id}`)}
            />
          )}

          {tab === 'schedule' && (
            <ScheduleList
              upcoming={upcomingLessons}
              past={pastLessons}
              onLessonClick={(l) => setSelectedLesson(l)}
            />
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
          onSaved={() => {
            setSelectedLesson(null);
            load();
          }}
        />
      )}
    </AppLayout>
  );
};

const KpiCard = ({ label, value }) => (
  <div className="col-6 col-md-3">
    <div
      className="rounded-3 p-3 h-100"
      style={{ background: '#f8f9fb' }}
    >
      <div className="text-muted small">{label}</div>
      <div className="fw-semibold" style={{ fontSize: '1.5rem', lineHeight: 1.2 }}>
        {value}
      </div>
    </div>
  </div>
);

const StudentsList = ({ students, onStudentClick }) => {
  if (!students.length) {
    return (
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body text-center py-5 text-muted">
          В группе пока нет учеников.
        </div>
      </div>
    );
  }
  return (
    <div className="d-flex flex-column gap-2">
      {students.map((s) => {
        const fullName = `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.username;
        const initials = (s.first_name?.[0] || '') + (s.last_name?.[0] || '');
        return (
          <button
            key={s.id}
            type="button"
            className="card border-0 shadow-sm rounded-4 text-start"
            style={{ cursor: 'pointer', transition: 'transform 0.1s ease' }}
            onClick={() => onStudentClick(s)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div className="card-body p-3 d-flex align-items-center gap-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center fw-semibold flex-shrink-0"
                style={{
                  width: 44,
                  height: 44,
                  background: '#eef2ff',
                  color: '#3730a3',
                  fontSize: '0.95rem',
                }}
              >
                {initials.toUpperCase() || '👤'}
              </div>
              <div className="flex-grow-1">
                <div className="fw-semibold">{fullName}</div>
                <div className="text-muted small">@{s.username}</div>
              </div>
              <span className="text-muted" aria-hidden>›</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

const WEEKDAY_SHORT_MAP = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

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
    const weekday = WEEKDAY_SHORT_MAP[dt.getDay()];
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

const CommentsList = ({
  comments,
  commentText,
  onChangeText,
  onSubmit,
  saving,
  onDelete,
}) => (
  <>
    <form onSubmit={onSubmit} className="card border-0 shadow-sm rounded-4 mb-3">
      <div className="card-body p-3">
        <label className="form-label small text-muted">Новая заметка</label>
        <textarea
          className="form-control rounded-3"
          rows={3}
          value={commentText}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder="Например: разобрали циклы, Маша отлично справляется, нужно повторить условия с Петей."
          disabled={saving}
        />
        <div className="mt-2 text-end">
          <button
            type="submit"
            className="btn btn-dark rounded-pill px-4"
            disabled={saving || !commentText.trim()}
          >
            {saving ? 'Сохраняем…' : 'Добавить'}
          </button>
        </div>
      </div>
    </form>

    {comments.length === 0 ? (
      <Empty text="Заметок пока нет. Добавьте первую — это поможет коллегам." />
    ) : (
      <div className="d-flex flex-column gap-2">
        {comments.map((c) => (
          <div key={c.id} className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-3">
              <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
                <div>
                  <div className="fw-semibold small">{c.author_name}</div>
                  <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                    {formatDate(c.created_at)}
                  </div>
                </div>
                {c.is_mine && (
                  <button
                    type="button"
                    className="btn btn-sm btn-link text-danger px-0"
                    onClick={() => onDelete(c.id)}
                  >
                    Удалить
                  </button>
                )}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{c.text}</div>
            </div>
          </div>
        ))}
      </div>
    )}
  </>
);

export default TeacherGroupDetail;
