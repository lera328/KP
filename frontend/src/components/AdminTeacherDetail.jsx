import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { AdminLayout } from './AdminLayout';
import { ConductLessonModal } from './ConductLessonModal';

/* ─── Модалка информации об уроке (с кнопкой редактирования) ─── */
const LessonInfoModal = ({ lesson, onClose, onConduct, onDelete, deleting, navigate }) => {
  const attendance = Array.isArray(lesson.attendance_records) ? lesson.attendance_records : [];
  const presentCount = attendance.filter((a) => a.status === 'present').length;
  const absentCount = attendance.filter((a) => a.status === 'absent').length;
  const isMakeup = Boolean(lesson.is_makeup_slot);
  const isConducted = Boolean(lesson.conducted_topic || lesson.conducted_description);

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
                {isMakeup ? 'Слот отработки' : lesson.group_name || `Группа #${lesson.group}`}
              </h5>
            </div>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body pt-0">
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                {!isMakeup && lesson.group && (
                  <div className="mb-2">
                    <strong>Группа: </strong>
                    <button type="button" className="btn btn-link p-0 fw-semibold" onClick={() => { onClose(); navigate(`/admin/groups/${lesson.group}`); }}>
                      {lesson.group_name || `#${lesson.group}`}
                    </button>
                  </div>
                )}
                <div className="mb-1"><strong>Тип: </strong>{isMakeup ? 'Отработка' : lesson.is_extra ? 'Разовое' : 'Регулярное'}</div>
              </div>
              <div className="col-md-6">
                {isConducted && (
                  <>
                    {lesson.conducted_topic && <div className="mb-1"><strong>Тема: </strong>{lesson.conducted_topic}</div>}
                    {lesson.conducted_description && <div className="mb-1"><strong>Описание: </strong>{lesson.conducted_description}</div>}
                    {lesson.homework && <div className="mb-1"><strong>ДЗ: </strong>{lesson.homework}</div>}
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
              {isConducted ? 'Редактировать' : 'Провести урок'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatRub = (n) =>
  `${Number(n || 0).toLocaleString('ru-RU')} ₽`;

const formatDateTime = (v) =>
  v
    ? new Date(v).toLocaleString('ru-RU', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

const isoDate = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const startOfWeek = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
};

const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

const PRESETS = [
  { key: 'current_month', label: 'Текущий месяц' },
  { key: 'prev_month', label: 'Прошлый месяц' },
  { key: 'current_week', label: 'Эта неделя' },
  { key: 'prev_week', label: 'Прошлая неделя' },
  { key: 'custom', label: 'Свой период' },
];

const computeRange = (preset) => {
  const now = new Date();
  switch (preset) {
    case 'prev_month': {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { from: isoDate(startOfMonth(prev)), to: isoDate(endOfMonth(prev)) };
    }
    case 'current_week': {
      const s = startOfWeek(now);
      return { from: isoDate(s), to: isoDate(addDays(s, 6)) };
    }
    case 'prev_week': {
      const s = addDays(startOfWeek(now), -7);
      return { from: isoDate(s), to: isoDate(addDays(s, 6)) };
    }
    case 'current_month':
    default:
      return { from: isoDate(startOfMonth(now)), to: isoDate(endOfMonth(now)) };
  }
};

const formatRangeLabel = (from, to) => {
  if (!from || !to) return '';
  const f = new Date(from);
  const t = new Date(to);
  const opts = { day: '2-digit', month: 'short', year: 'numeric' };
  return `${f.toLocaleDateString('ru-RU', opts)} — ${t.toLocaleDateString('ru-RU', opts)}`;
};

export const AdminTeacherDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [preset, setPreset] = useState('current_month');
  const initialRange = useMemo(() => computeRange('current_month'), []);
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);

  const [teacherName, setTeacherName] = useState('');
  const [teacherPhone, setTeacherPhone] = useState('');
  const [teacherTelegram, setTeacherTelegram] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherGroups, setTeacherGroups] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [ratePerLesson, setRatePerLesson] = useState(1500);
  const [ratePerMakeup, setRatePerMakeup] = useState(1000);
  const [bonus, setBonus] = useState(0);
  const [penalty, setPenalty] = useState(0);

  const [modalLesson, setModalLesson] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [conductLesson, setConductLesson] = useState(null);
  const [conductGroup, setConductGroup] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const openLessonModal = useCallback(async (lessonId) => {
    setModalLoading(true);
    try {
      const full = await api.getLesson(lessonId);
      setModalLesson(full);
      if (full.group) {
        try { setConductGroup(await api.getGroup(full.group)); } catch { setConductGroup(null); }
      }
    } catch {
      setModalLesson(null);
    } finally {
      setModalLoading(false);
    }
  }, []);

  const handleDeleteLesson = useCallback(async () => {
    if (!modalLesson || !window.confirm('Удалить это занятие? Это действие нельзя отменить.')) return;
    setDeleting(modalLesson.id);
    try {
      await api.deleteLesson(modalLesson.id);
      setModalLesson(null);
      loadLessons();
    } catch (e) {
      setError(e.message || 'Ошибка удаления');
    } finally {
      setDeleting(null);
    }
  }, [modalLesson]);

  const handleConductSaved = useCallback(() => {
    setConductLesson(null);
    setModalLesson(null);
    loadLessons();
  }, []);

  const loadLessons = async (from = fromDate, to = toDate) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getTeacherSalary({ from, to, teacher_id: id });
      setLessons(Array.isArray(data?.lessons) ? data.lessons : []);
      if (data?.teacher_name) setTeacherName(data.teacher_name);
      setTeacherPhone(data?.teacher_phone || '');
      setTeacherTelegram(data?.teacher_telegram || '');
      setTeacherEmail(data?.teacher_email || '');
      setTeacherGroups(Array.isArray(data?.teacher_groups) ? data.teacher_groups : []);
      if (Number.isFinite(Number(data?.rate_per_lesson))) setRatePerLesson(Number(data.rate_per_lesson));
      if (Number.isFinite(Number(data?.rate_per_makeup))) setRatePerMakeup(Number(data.rate_per_makeup));
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить данные.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLessons(fromDate, toDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handlePreset = (key) => {
    setPreset(key);
    if (key === 'custom') return;
    const r = computeRange(key);
    setFromDate(r.from);
    setToDate(r.to);
    loadLessons(r.from, r.to);
  };

  const handleApplyCustom = () => {
    if (!fromDate || !toDate) return;
    if (new Date(fromDate) > new Date(toDate)) {
      setError('Дата «от» должна быть раньше даты «до».');
      return;
    }
    loadLessons(fromDate, toDate);
  };

  const regularLessons = lessons.filter((l) => !l.is_makeup_slot);
  const makeupLessons = lessons.filter((l) => l.is_makeup_slot);
  const regularCount = regularLessons.length;
  const makeupCount = makeupLessons.length;
  const regularAmount = regularCount * toNumber(ratePerLesson);
  const makeupAmount = makeupCount * toNumber(ratePerMakeup);
  const baseAmount = regularAmount + makeupAmount;
  const totalAmount = baseAmount + toNumber(bonus) - toNumber(penalty);

  return (
    <AdminLayout title="КиберШкола — Преподаватель">
      <button
        type="button"
        className="btn btn-link text-decoration-none px-0 mb-2"
        onClick={() => navigate(-1)}
      >
        ← Назад
      </button>

      <div className="mb-4 d-flex flex-wrap align-items-center gap-3">
        <div>
          <h1 className="fw-semibold mb-0" style={{ fontSize: '1.75rem' }}>
            {teacherName || `Преподаватель #${id}`}
          </h1>
          <div className="text-muted small">Зарплата · {formatRangeLabel(fromDate, toDate)}</div>
        </div>
        <button
          type="button"
          className="ms-auto btn btn-light border rounded-pill px-4"
          onClick={() => loadLessons()}
          disabled={loading}
        >
          Обновить
        </button>
      </div>

      {error && <div className="alert alert-danger rounded-3">{error}</div>}

      {/* Информация о преподавателе */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-4">
          <div className="text-muted small text-uppercase mb-3" style={{ letterSpacing: 0.5 }}>Информация</div>
          <div className="row g-3">
            {teacherPhone && (
              <div className="col-md-4">
                <div className="d-flex align-items-center gap-2">
                  <span className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 36, height: 36, background: '#f0fdf4', color: '#16a34a' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                  </span>
                  <div>
                    <div className="text-muted" style={{ fontSize: '0.7rem' }}>Телефон</div>
                    <div className="fw-semibold small">{teacherPhone}</div>
                  </div>
                </div>
              </div>
            )}
            {teacherTelegram && (
              <div className="col-md-4">
                <div className="d-flex align-items-center gap-2">
                  <span className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 36, height: 36, background: '#eff6ff', color: '#2563eb' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
                  </span>
                  <div>
                    <div className="text-muted" style={{ fontSize: '0.7rem' }}>Telegram ID</div>
                    <div className="fw-semibold small">{teacherTelegram}</div>
                  </div>
                </div>
              </div>
            )}
            {teacherEmail && (
              <div className="col-md-4">
                <div className="d-flex align-items-center gap-2">
                  <span className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 36, height: 36, background: '#fef3c7', color: '#b45309' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  </span>
                  <div>
                    <div className="text-muted" style={{ fontSize: '0.7rem' }}>Email</div>
                    <div className="fw-semibold small">{teacherEmail}</div>
                  </div>
                </div>
              </div>
            )}
            {!teacherPhone && !teacherTelegram && !teacherEmail && (
              <div className="col-12 text-muted small">Контактные данные не заполнены.</div>
            )}
          </div>
          {teacherGroups.length > 0 && (
            <div className="mt-3">
              <div className="text-muted" style={{ fontSize: '0.7rem' }}>Группы</div>
              <div className="d-flex flex-wrap gap-2 mt-1">
                {teacherGroups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className="badge rounded-pill px-3 py-2 border-0"
                    style={{ background: '#f3f4f6', color: '#374151', fontWeight: 500, fontSize: '0.8rem', cursor: 'pointer', transition: 'background 0.15s' }}
                    onClick={() => navigate(`/admin/groups/${g.id}`)}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#e5e7eb'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Выбор периода */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-3">
          <div className="d-flex flex-wrap gap-2 mb-2">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                className="btn btn-sm rounded-pill px-3"
                style={{
                  background: preset === p.key ? '#111827' : '#f8f9fb',
                  color: preset === p.key ? '#fff' : '#374151',
                  border: `1px solid ${preset === p.key ? '#111827' : '#e5e7eb'}`,
                  fontWeight: preset === p.key ? 600 : 500,
                }}
                onClick={() => handlePreset(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="d-flex flex-wrap align-items-end gap-2 mt-2">
              <div>
                <label className="form-label small text-muted mb-1">С</label>
                <input
                  type="date"
                  className="form-control form-control-sm rounded-3"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label small text-muted mb-1">По</label>
                <input
                  type="date"
                  className="form-control form-control-sm rounded-3"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-sm btn-dark rounded-pill px-4"
                onClick={handleApplyCustom}
                disabled={loading}
              >
                Применить
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5 text-muted">Загрузка...</div>
      ) : (
        <>
          {/* Итоговая карточка */}
          <div className="row g-3 mb-3">
            <div className="col-lg-7">
              <div className="card border-0 shadow-sm rounded-4 h-100">
                <div className="card-body p-4">
                  <div className="text-muted small text-uppercase mb-2" style={{ letterSpacing: 0.5 }}>
                    Итого к выплате
                  </div>
                  <div className="fw-semibold mb-3" style={{ fontSize: '2.5rem', lineHeight: 1 }}>
                    {formatRub(totalAmount)}
                  </div>

                  <div className="d-flex flex-column gap-2">
                    <BreakdownRow
                      label={`Обычные уроки × ${formatRub(ratePerLesson)}`}
                      value={`${regularCount} × ${ratePerLesson} = ${formatRub(regularAmount)}`}
                    />
                    <BreakdownRow
                      label={`Отработки × ${formatRub(ratePerMakeup)}`}
                      value={`${makeupCount} × ${ratePerMakeup} = ${formatRub(makeupAmount)}`}
                    />
                    {toNumber(bonus) > 0 && (
                      <BreakdownRow label="Премии" value={`+ ${formatRub(toNumber(bonus))}`} positive />
                    )}
                    {toNumber(penalty) > 0 && (
                      <BreakdownRow label="Штрафы" value={`− ${formatRub(toNumber(penalty))}`} negative />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-5">
              <div className="card border-0 shadow-sm rounded-4 h-100">
                <div className="card-body p-4">
                  <div className="text-muted small text-uppercase mb-3" style={{ letterSpacing: 0.5 }}>
                    Параметры расчёта
                  </div>
                  <FieldNumber label="Ставка за обычный урок" value={ratePerLesson} onChange={setRatePerLesson} suffix="₽" />
                  <FieldNumber label="Ставка за отработку" value={ratePerMakeup} onChange={setRatePerMakeup} suffix="₽" />
                  <FieldNumber label="Премии" value={bonus} onChange={setBonus} suffix="₽" />
                  <FieldNumber label="Штрафы" value={penalty} onChange={setPenalty} suffix="₽" />
                </div>
              </div>
            </div>
          </div>

          {/* Список уроков */}
          <div
            className="text-muted small text-uppercase mb-2 d-flex justify-content-between"
            style={{ letterSpacing: 0.5 }}
          >
            <span>Проведённые уроки за период</span>
            <span>{regularCount + makeupCount} шт. (уроки: {regularCount}, отработки: {makeupCount})</span>
          </div>

          {lessons.length === 0 ? (
            <div className="card border-0 shadow-sm rounded-4">
              <div className="card-body text-center py-5 text-muted">
                Проведённые уроки за выбранный период не найдены.
              </div>
            </div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {lessons.map((lesson) => (
                <button
                  key={lesson.id}
                  type="button"
                  className="card border-0 shadow-sm rounded-4 text-start w-100"
                  style={{ cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.1s' }}
                  onClick={() => openLessonModal(lesson.id)}
                  disabled={modalLoading}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
                >
                  <div className="card-body p-3 d-flex align-items-center gap-3 flex-wrap">
                    <div
                      className="rounded-3 px-3 py-2 fw-semibold flex-shrink-0 text-center"
                      style={{ background: '#f8f9fb', minWidth: 130, fontSize: '0.95rem' }}
                    >
                      {formatDateTime(lesson.starts_at)}
                    </div>
                    <div className="flex-grow-1" style={{ minWidth: 200 }}>
                      <div className="fw-semibold">
                        {lesson.conducted_topic || 'Тема не указана'}
                      </div>
                      <div className="text-muted small d-flex gap-2 align-items-center">
                        {lesson.is_makeup_slot ? (
                          <span className="badge rounded-pill" style={{ background: '#dbeafe', color: '#2563eb', fontWeight: 500, fontSize: '0.65rem' }}>Отработка</span>
                        ) : (
                          <span>{lesson.group_name || `Группа #${lesson.group || '—'}`}</span>
                        )}
                      </div>
                    </div>
                    <div className="fw-semibold text-end" style={{ minWidth: 100 }}>
                      {formatRub(lesson.is_makeup_slot ? ratePerMakeup : ratePerLesson)}
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {modalLesson && !conductLesson && (
        <LessonInfoModal
          lesson={modalLesson}
          onClose={() => setModalLesson(null)}
          onConduct={() => setConductLesson(modalLesson)}
          onDelete={handleDeleteLesson}
          deleting={deleting === modalLesson.id}
          navigate={navigate}
        />
      )}
      {conductLesson && (
        <ConductLessonModal
          lesson={conductLesson}
          group={conductGroup}
          onClose={() => setConductLesson(null)}
          onSaved={handleConductSaved}
        />
      )}
    </AdminLayout>
  );
};

const BreakdownRow = ({ label, value, positive, negative }) => (
  <div className="d-flex justify-content-between align-items-center rounded-3 p-3" style={{ background: '#f8f9fb' }}>
    <span className="text-muted small">{label}</span>
    <span className="fw-semibold" style={{ color: positive ? '#16a34a' : negative ? '#dc2626' : '#111827' }}>
      {value}
    </span>
  </div>
);

const FieldNumber = ({ label, value, onChange, suffix }) => (
  <div className="mb-3">
    <label className="form-label small text-muted">{label}</label>
    <div className="input-group">
      <input
        type="number"
        className="form-control rounded-start-3"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={0}
      />
      {suffix && (
        <span className="input-group-text rounded-end-3 border-start-0" style={{ background: '#f8f9fb', color: '#6b7280' }}>
          {suffix}
        </span>
      )}
    </div>
  </div>
);

export default AdminTeacherDetail;
