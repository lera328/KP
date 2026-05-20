import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { AdminLayout } from './AdminLayout';
import { ConductLessonModal } from './ConductLessonModal';

const formatDate = (v) =>
  v ? new Date(v).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

const STATUS_META = {
  present: { label: 'Был', color: '#16a34a', bg: '#ecfdf5' },
  absent: { label: 'Пропуск', color: '#dc2626', bg: '#fef2f2' },
  makeup: { label: 'Отработка', color: '#2563eb', bg: '#eff6ff' },
};

const PERIOD_OPTIONS = [
  { value: 7, label: '7 дней' },
  { value: 30, label: '30 дней' },
  { value: 90, label: '90 дней' },
  { value: 180, label: '180 дней' },
  { value: 360, label: '360 дней' },
];

export const AdminStudentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const studentId = Number(id);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [periodDays, setPeriodDays] = useState(90);
  const [conductLesson, setConductLesson] = useState(null);
  const [conductGroup, setConductGroup] = useState(null);

  const openLessonForEdit = async (item) => {
    if (!item?.lesson_id) return;
    try {
      const full = await api.getLesson(item.lesson_id);
      if (full.group) {
        try { setConductGroup(await api.getGroup(full.group)); } catch { setConductGroup(null); }
      } else {
        setConductGroup(null);
      }
      setConductLesson(full);
    } catch (e) {
      setError(e.message || 'Не удалось загрузить занятие.');
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.getTeacherStudentDetail(studentId, { days: periodDays });
        setData(res);
      } catch (loadError) {
        setError(loadError.message || 'Не удалось загрузить данные ученика.');
      } finally {
        setLoading(false);
      }
    };
    if (studentId) load();
  }, [studentId, periodDays]);

  const student = data?.student;
  const stats = data?.stats;
  const projects = data?.projects || [];
  const groups = data?.groups || [];
  const parents = data?.parents || [];
  const widget = data?.attendance_widget || [];

  const fullName = useMemo(() => {
    if (!student) return '';
    return `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.username;
  }, [student]);

  const initials = useMemo(() => {
    if (!student) return '';
    return ((student.first_name?.[0] || '') + (student.last_name?.[0] || '')).toUpperCase();
  }, [student]);

  return (
    <AdminLayout title="КиберШкола — Ученик">
      <button type="button" className="btn btn-link text-decoration-none px-0 mb-2" onClick={() => navigate(-1)}>← Назад</button>

      {error && <div className="alert alert-danger rounded-3">{error}</div>}

      {loading || !student ? (
        <div className="kid-skeleton" style={{ height: 160, borderRadius: 16 }} />
      ) : (
        <>
          {/* Шапка ученика */}
          <div className="card border-0 shadow-sm rounded-4 mb-3">
            <div className="card-body p-4 d-flex flex-wrap align-items-center gap-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center fw-semibold flex-shrink-0"
                style={{ width: 72, height: 72, background: '#eef2ff', color: '#3730a3', fontSize: '1.4rem' }}
              >
                {initials || '👤'}
              </div>
              <div className="flex-grow-1" style={{ minWidth: 200 }}>
                <h1 className="fw-semibold mb-1" style={{ fontSize: '1.6rem' }}>{fullName}</h1>
                <div className="text-muted small d-flex flex-wrap gap-3">
                  <span>@{student.username}</span>
                  {student.email && <span>{student.email}</span>}
                  {student.phone && <span>{student.phone}</span>}
                </div>
                <div className="d-flex flex-wrap gap-2 mt-2">
                  {groups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      className="btn btn-sm rounded-pill px-3"
                      style={{ background: '#f8f9fb', color: '#374151', border: '1px solid #e5e7eb' }}
                      onClick={() => navigate(`/admin/groups/${g.id}`)}
                    >
                      {g.name}{g.location_name ? ` · ${g.location_name}` : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* KPI */}
            <div className="card-body pt-0">
              <div className="row g-2">
                <KpiCard label="Уроков" value={stats?.total_records || 0} />
                <KpiCard label="Был" value={stats?.present || 0} accent="#16a34a" />
                <KpiCard label="Пропуски" value={stats?.absent || 0} accent="#dc2626" />
                <KpiCard label="Средняя оценка" value={stats?.avg_grade ?? '—'} />
                <KpiCard label="Баланс" value={student.balance ?? 0} accent={(student.balance === null || student.balance === undefined || Number(student.balance) <= 0) ? '#dc2626' : undefined} />
                <KpiCard label="Проектов" value={stats?.projects_count || 0} />
              </div>
            </div>
          </div>

          {/* Родители */}
          {parents.length > 0 && (
            <div className="card border-0 shadow-sm rounded-4 mb-3">
              <div className="card-body p-3">
                <div className="text-muted small text-uppercase mb-2" style={{ letterSpacing: 0.5 }}>Родители</div>
                <div className="row g-2">
                  {parents.map((p) => (
                    <div key={p.id} className="col-12 col-md-6">
                      <div className="rounded-3 p-3 h-100" style={{ background: '#f8f9fb' }}>
                        <div className="fw-semibold">{p.full_name}</div>
                        <div className="text-muted small mt-1 d-flex flex-column gap-1">
                          {p.phone && <a href={`tel:${p.phone}`} className="text-decoration-none" style={{ color: '#374151' }}>📞 {p.phone}</a>}
                          {p.email && <a href={`mailto:${p.email}`} className="text-decoration-none" style={{ color: '#374151' }}>✉ {p.email}</a>}
                          {!p.phone && !p.email && <span>Контакты не указаны</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <AttendanceWidget
            items={widget}
            periodDays={periodDays}
            onPeriodChange={setPeriodDays}
            loading={loading}
            onTileClick={openLessonForEdit}
          />

          <div className="text-muted small text-uppercase mb-2" style={{ letterSpacing: 0.5 }}>Проекты</div>
          <ProjectsList projects={projects} />
        </>
      )}

      {conductLesson && (
        <ConductLessonModal
          lesson={conductLesson}
          group={conductGroup}
          onClose={() => setConductLesson(null)}
          onSaved={() => {
            setConductLesson(null);
            // Перезагружаем данные ученика
            (async () => {
              try {
                const res = await api.getTeacherStudentDetail(studentId, { days: periodDays });
                setData(res);
              } catch {}
            })();
          }}
        />
      )}
    </AdminLayout>
  );
};

/* ─── Sub-components ─── */

const KpiCard = ({ label, value, accent }) => (
  <div className="col-6 col-md-2">
    <div className="rounded-3 p-3 h-100" style={{ background: '#f8f9fb' }}>
      <div className="text-muted small">{label}</div>
      <div className="fw-semibold" style={{ fontSize: '1.4rem', lineHeight: 1.2, color: accent || '#111827' }}>{value}</div>
    </div>
  </div>
);

const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

const TILE_META = {
  present: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', dot: '#16a34a', label: 'Проведён' },
  absent: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', dot: '#dc2626', label: 'Отменён' },
  makeup: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e3a8a', dot: '#2563eb', label: 'Отработка' },
  scheduled: { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280', dot: '#9ca3af', label: 'Запланирован' },
  none: { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280', dot: '#9ca3af', label: '—' },
};

const AttendanceWidget = ({ items, periodDays, onPeriodChange, loading, onTileClick }) => {
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const filtered = useMemo(() => (filter === 'all' ? items : items.filter((i) => i.status === filter)), [items, filter]);
  const todayStr = useMemo(() => new Date().toDateString(), []);
  const nowIndex = useMemo(() => {
    const now = new Date();
    for (let i = 0; i < filtered.length; i += 1) {
      if (new Date(filtered[i].starts_at) >= now) return i;
    }
    return filtered.length;
  }, [filtered]);

  const FILTERS = [
    { key: 'all', label: 'Все' },
    { key: 'present', label: 'Проведён' },
    { key: 'absent', label: 'Отменён' },
    { key: 'makeup', label: 'Отработка' },
    { key: 'scheduled', label: 'Запланирован' },
  ];

  const tiles = [];
  filtered.forEach((item, idx) => {
    if (idx === nowIndex) tiles.push(<NowTile key="__now__" />);
    tiles.push(<WidgetTile key={item.lesson_id} item={item} todayStr={todayStr} onClick={() => onTileClick && onTileClick(item)} />);
  });
  if (nowIndex === filtered.length) tiles.push(<NowTile key="__now__" />);

  const legendItems = [
    { status: 'present', label: 'Проведён' },
    { status: 'scheduled', label: 'Запланирован' },
    { status: 'absent', label: 'Отменён' },
  ];

  return (
    <div className="card border-0 shadow-sm rounded-4 mb-3">
      <div className="card-body p-3">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <div className="fw-semibold" style={{ fontSize: '0.95rem' }}>История и прогноз посещений</div>
          <div className="d-flex flex-wrap gap-2 ms-auto align-items-center">
            <div className="dropdown">
              <button
                type="button"
                className="btn btn-sm px-3 d-flex align-items-center gap-1"
                style={{ background: 'transparent', color: '#6b7280', border: 'none', fontWeight: 500, fontSize: '0.85rem' }}
                onClick={() => setFilterOpen(!filterOpen)}
              >
                ±{periodDays} дней
              </button>
              {filterOpen && (
                <div className="position-absolute bg-white shadow rounded-3 p-2 mt-1" style={{ zIndex: 10, minWidth: 120 }}>
                  {PERIOD_OPTIONS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      className="btn btn-sm w-100 text-start rounded-2 px-3 py-1"
                      style={{
                        background: periodDays === p.value ? '#f3f4f6' : 'transparent',
                        fontWeight: periodDays === p.value ? 600 : 400,
                        fontSize: '0.82rem',
                      }}
                      onClick={() => { onPeriodChange(p.value); setFilterOpen(false); }}
                      disabled={loading}
                    >
                      ±{p.value} дней
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="dropdown">
              <button
                type="button"
                className="btn btn-sm px-3 d-flex align-items-center gap-1"
                style={{ background: 'transparent', color: '#16a34a', border: 'none', fontWeight: 500, fontSize: '0.85rem' }}
                onClick={() => {
                  const keys = FILTERS.map((f) => f.key);
                  const curIdx = keys.indexOf(filter);
                  setFilter(keys[(curIdx + 1) % keys.length]);
                }}
              >
                Фильтр{filter !== 'all' ? `: ${FILTERS.find((f) => f.key === filter)?.label}` : ''}
              </button>
            </div>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-muted small text-center py-3">За выбранный период занятий не найдено.</div>
        ) : (
          <div className="d-flex flex-wrap gap-2">{tiles}</div>
        )}

        <div className="d-flex flex-wrap gap-4 mt-3 pt-2" style={{ borderTop: '1px solid #f3f4f6' }}>
          {legendItems.map((li) => {
            const m = TILE_META[li.status];
            return (
              <div key={li.status} className="d-flex align-items-center gap-2">
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

const WidgetTile = ({ item, todayStr, onClick }) => {
  const meta = TILE_META[item.status] || TILE_META.none;
  const dt = new Date(item.starts_at);
  const weekday = WEEKDAY_SHORT[dt.getDay()];
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const isToday = dt.toDateString() === todayStr;

  return (
    <button
      type="button"
      onClick={onClick}
      title={[
        dt.toLocaleString('ru-RU', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
        item.group_name, item.topic, meta.label,
        item.grade != null ? `Оценка: ${item.grade}` : null,
      ].filter(Boolean).join('\n')}
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
    </button>
  );
};

const NowTile = () => (
  <div style={{
    background: '#fff',
    border: '2px dashed #6b7280',
    borderRadius: 10,
    padding: '6px 8px',
    minWidth: 56,
    textAlign: 'center',
    color: '#374151',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  }}>
    <svg width="10" height="14" viewBox="0 0 10 14" fill="none" style={{ display: 'block' }}>
      <path d="M1 1h8v9l-4 3-4-3V1z" fill="#374151" />
    </svg>
    <div style={{ fontSize: '0.68rem', fontWeight: 700, lineHeight: 1 }}>Сейчас</div>
  </div>
);

const LessonInfoModal = ({ item, studentName, onClose }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const meta = STATUS_META[item.status] || {
    label: item.status === 'scheduled' ? 'Запланирован' : item.is_past ? 'Без отметки' : '—',
    color: '#6b7280', bg: '#f3f4f6',
  };

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content rounded-4 border-0 shadow-lg">
          <div className="modal-header border-0">
            <div>
              <div className="text-muted small">
                {new Date(item.starts_at).toLocaleString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
              <h5 className="modal-title fw-semibold mb-0">{item.topic || 'Тема не указана'}</h5>
              <div className="text-muted small mt-1">{item.group_name}{studentName ? ` · ${studentName}` : ''}</div>
            </div>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body pt-0">
            <div className="d-flex flex-wrap gap-2 mb-3">
              <span className="badge rounded-pill" style={{ background: meta.bg, color: meta.color, fontWeight: 500, fontSize: '0.85rem' }}>{meta.label}</span>
              {item.grade != null && (
                <span className="badge rounded-pill" style={{ background: '#fef3c7', color: '#b45309', fontWeight: 600, fontSize: '0.85rem' }}>Оценка: {item.grade}</span>
              )}
            </div>
            {item.description && <InfoBlock title="Описание занятия" text={item.description} />}
            {item.homework && <InfoBlock title="Домашнее задание" text={item.homework} />}
            {item.teacher_comment && <InfoBlock title="Комментарий преподавателя" text={item.teacher_comment} />}
            {!item.description && !item.homework && !item.teacher_comment && (
              <div className="text-muted small">{item.is_past ? 'Преподаватель не оставил дополнительной информации.' : 'Занятие ещё не проведено.'}</div>
            )}
          </div>
          <div className="modal-footer border-0">
            <button type="button" className="btn btn-light border rounded-pill px-4" onClick={onClose}>Закрыть</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoBlock = ({ title, text }) => (
  <div className="mb-3">
    <div className="text-muted small text-uppercase mb-1" style={{ letterSpacing: 0.5 }}>{title}</div>
    <div className="rounded-3 p-3" style={{ background: '#f8f9fb', whiteSpace: 'pre-wrap' }}>{text}</div>
  </div>
);

const ProjectsList = ({ projects }) => {
  if (!projects.length) {
    return (
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body text-center py-4 text-muted small">Проектов пока нет.</div>
      </div>
    );
  }
  return (
    <div className="row g-2">
      {projects.map((p) => (
        <div key={p.id} className="col-12 col-md-6">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-start gap-2">
                <div className="fw-semibold">{p.title}</div>
                <span className="text-muted small flex-shrink-0">{formatDate(p.created_at)}</span>
              </div>
              {p.description && <div className="text-muted small mt-1" style={{ whiteSpace: 'pre-wrap' }}>{p.description}</div>}
              {Array.isArray(p.images) && p.images.length > 0 && (
                <div className="d-flex flex-wrap gap-2 mt-2">
                  {p.images.slice(0, 6).map((img) => (
                    <img key={img.id} src={img.url} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} />
                  ))}
                </div>
              )}
              <div className="text-muted small mt-2">❤ {p.likes_count || 0}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdminStudentDetail;
