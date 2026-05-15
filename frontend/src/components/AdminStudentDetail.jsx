import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { AdminLayout } from './AdminLayout';

const formatDate = (v) =>
  v ? new Date(v).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

const STATUS_META = {
  present: { label: 'Был', color: '#16a34a', bg: '#ecfdf5' },
  absent: { label: 'Пропуск', color: '#dc2626', bg: '#fef2f2' },
  makeup: { label: 'Отработка', color: '#2563eb', bg: '#eff6ff' },
};

const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

const WIDGET_TILE_META = {
  present: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', icon: '✓', iconColor: '#16a34a' },
  absent: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', icon: '✗', iconColor: '#dc2626' },
  makeup: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e3a8a', icon: '!', iconColor: '#2563eb' },
  scheduled: { bg: '#f3f4f6', border: '#e5e7eb', text: '#6b7280', icon: '⊘', iconColor: '#9ca3af', strike: true },
  none: { bg: '#f3f4f6', border: '#e5e7eb', text: '#6b7280', icon: '⊘', iconColor: '#9ca3af' },
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
  const [activeLesson, setActiveLesson] = useState(null);

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
    <AdminLayout title="KiberOne — Ученик">
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
                <KpiCard label="Баланс" value={student.balance || 0} />
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
            onTileClick={(item) => setActiveLesson(item)}
          />

          <div className="text-muted small text-uppercase mb-2" style={{ letterSpacing: 0.5 }}>Проекты</div>
          <ProjectsList projects={projects} />
        </>
      )}

      {activeLesson && (
        <LessonInfoModal item={activeLesson} studentName={fullName} onClose={() => setActiveLesson(null)} />
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

const AttendanceWidget = ({ items, periodDays, onPeriodChange, loading, onTileClick }) => {
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
    { key: 'present', label: 'Был' },
    { key: 'absent', label: 'Пропуски' },
    { key: 'makeup', label: 'Отработки' },
    { key: 'scheduled', label: 'Предстоит' },
  ];

  const tiles = [];
  filtered.forEach((item, idx) => {
    if (idx === nowIndex) tiles.push(<NowTile key="__now__" />);
    tiles.push(<WidgetTile key={item.lesson_id} item={item} todayStr={todayStr} onClick={() => onTileClick && onTileClick(item)} />);
  });
  if (nowIndex === filtered.length) tiles.push(<NowTile key="__now__" />);

  return (
    <div className="card border-0 shadow-sm rounded-4 mb-3">
      <div className="card-body p-3">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <div className="fw-semibold" style={{ fontSize: '0.95rem' }}>Виджет посещений</div>
          <div className="d-flex flex-wrap gap-1 ms-auto align-items-center">
            <span className="text-muted small me-1">Период:</span>
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                className="btn btn-sm rounded-pill px-3"
                style={{
                  background: periodDays === p.value ? '#111827' : '#f8f9fb',
                  color: periodDays === p.value ? '#fff' : '#374151',
                  border: `1px solid ${periodDays === p.value ? '#111827' : '#e5e7eb'}`,
                  fontWeight: periodDays === p.value ? 600 : 500,
                  fontSize: '0.78rem',
                }}
                onClick={() => onPeriodChange(p.value)}
                disabled={loading}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="d-flex flex-wrap gap-1 mb-3">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className="btn btn-sm rounded-pill px-3"
              style={{
                background: filter === f.key ? '#374151' : 'transparent',
                color: filter === f.key ? '#fff' : '#6b7280',
                border: `1px solid ${filter === f.key ? '#374151' : '#e5e7eb'}`,
                fontWeight: filter === f.key ? 600 : 500,
                fontSize: '0.78rem',
              }}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {items.length === 0 ? (
          <div className="text-muted small text-center py-3">За выбранный период занятий не найдено.</div>
        ) : (
          <div className="d-flex flex-wrap gap-2">{tiles}</div>
        )}
      </div>
    </div>
  );
};

const WidgetTile = ({ item, todayStr, onClick }) => {
  const meta = WIDGET_TILE_META[item.status] || WIDGET_TILE_META.none;
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
        item.group_name, item.topic,
        item.status === 'present' ? 'Был' : item.status === 'absent' ? 'Пропуск' : item.status === 'makeup' ? 'Отработка' : item.is_past ? 'Без отметки' : 'Запланирован',
        item.grade != null ? `Оценка: ${item.grade}` : null,
      ].filter(Boolean).join('\n')}
      style={{
        background: meta.bg, border: `1px solid ${isToday ? '#111827' : meta.border}`,
        borderRadius: 8, padding: '6px 8px', minWidth: 56, textAlign: 'center',
        position: 'relative', color: meta.text, cursor: 'pointer',
        transition: 'transform 0.1s ease, box-shadow 0.1s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.06)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ position: 'absolute', top: -7, left: 4, background: '#fff', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: meta.iconColor, fontWeight: 700, border: `1px solid ${meta.border}` }}>
        {meta.icon}
      </div>
      <div style={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.85 }}>{weekday}</div>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, textDecoration: meta.strike ? 'line-through' : 'none' }}>{dd}.{mm}</div>
    </button>
  );
};

const NowTile = () => (
  <div style={{ background: '#fff', border: '1px dashed #111827', borderRadius: 8, padding: '6px 8px', minWidth: 56, textAlign: 'center', color: '#111827', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>🚩</div>
    <div style={{ fontSize: '0.72rem', fontWeight: 600 }}>сейчас</div>
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
